/** Private login-key file and bounded, cancellable form verification; cookies remain owned by BrowserAuth. @module */
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto'
import { constants } from 'node:fs'
import { lstat, mkdir, open } from 'node:fs/promises'
import { dirname, isAbsolute } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ConnectionIndexRequest, ConnectionIndexResponse } from './rpc.ts'
import { clientIp } from './socket-address.ts'
import { loginPage, type LoginNotice } from './login-page.ts'

/** Fixed login endpoint; proxies retain its directory-relative form and redirect. */
export const LOGIN_PATH = '/auth/login'
// These are credential-format and request-admission limits, independent of deployment rate policy.
const MIN_KEY_BYTES = 16
const MAX_KEY_BYTES = 1024
const MAX_BODY_BYTES = 4096

/** Explicit file location and deployment rate limits for optional address-bound browser login. */
export interface KeyLoginConfig {
  /** Absolute private UTF-8 key file; created with a random key when absent. */
  keyFile: string
  /** Attempts accepted from one IP during one rate window. */
  attemptsPerWindow: number
  /** Rate window in milliseconds. */
  windowMs: number
  /** Maximum simultaneously tracked IPs; additional addresses receive 429. */
  maxAddresses: number
  /** Maximum time allowed to submit the complete small form. */
  timeoutMs: number
}

function equal(actual: string, expected: string): boolean {
  return timingSafeEqual(createHash('sha256').update(actual).digest(), createHash('sha256').update(expected).digest())
}

async function readKey(path: string): Promise<string> {
  const info = await lstat(path)
  if (!info.isFile() || info.isSymbolicLink() || (process.platform !== 'win32'
    && ((info.mode & 0o077) !== 0 || info.uid !== process.getuid?.()))) {
    throw new Error('client-connection: login key must be an owned private regular file without a symbolic link; restrict its permissions to 0600')
  }
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const info = await file.stat()
    if (!info.isFile() || (process.platform !== 'win32' && ((info.mode & 0o077) !== 0 || info.uid !== process.getuid?.()))) {
      throw new Error('client-connection: the opened login key is not an owned private regular file; restore its permissions before retrying')
    }
    if (info.size > MAX_KEY_BYTES + 2 || info.size < MIN_KEY_BYTES) throw new Error('client-connection: login key must contain 16–1024 UTF-8 bytes')
    const key = new TextDecoder('utf-8', { fatal: true }).decode(await file.readFile()).trim()
    if (Buffer.byteLength(key, 'utf8') < MIN_KEY_BYTES || Buffer.byteLength(key, 'utf8') > MAX_KEY_BYTES) {
      throw new Error('client-connection: login key must contain 16–1024 nonblank UTF-8 bytes')
    }
    return key
  } finally { await file.close() }
}

/** One activation owns login attempts and active request lifetimes; no IP alone grants access. */
export class KeyLogin {
  private readonly attempts = new Map<string, { count: number; expiresAt: number }>()
  private readonly pending = new Map<IncomingMessage, Promise<boolean>>()
  private closing = false

  private constructor(private readonly config: KeyLoginConfig) {}

  /**
   * Prepare and validate a private key file before exposing a network login page.
   * @param config - Validated deployment limits and absolute key-file path.
   * @returns Ready verifier; unreadable, linked or insecure files fail without replacement.
   */
  static async create(config: KeyLoginConfig): Promise<KeyLogin> {
    if (!isAbsolute(config.keyFile)) throw new Error('client-connection: keyLogin.keyFile must be absolute')
    await mkdir(dirname(config.keyFile), { recursive: true, mode: 0o700 })
    try {
      const file = await open(config.keyFile, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
      try { await file.writeFile(randomBytes(32).toString('base64url') + '\n', 'utf8'); await file.sync() } finally { await file.close() }
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error
    }
    await readKey(config.keyFile)
    return new KeyLogin(config)
  }

  /**
   * Render a safe localized login page without loading application data.
   * @param req - Request headers choose the language; query values are never rendered.
   * @param res - Response owned to completion.
   * @param csrf - Authentication owner's signed form token.
   * @param notice - Public result of this attempt; required for initial navigation.
   * @param status - HTTP status, initially 200.
   * @param atLogin - Whether this response is served at the login endpoint.
   */
  page(req: ConnectionIndexRequest, res: ConnectionIndexResponse, csrf: string, notice: LoginNotice = 'required', status = 200, atLogin = false): void {
    const headers = req.headers
    const language = headers instanceof Headers ? headers.get('accept-language') : headers['accept-language']
    const page = loginPage(typeof language === 'string' && /^zh(?:-|,|;|$)/iu.test(language), csrf, notice, atLogin)
    res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store',
      'content-security-policy': page.policy, 'referrer-policy': 'same-origin', 'x-content-type-options': 'nosniff',
      ...(status === 429 ? { 'retry-after': String(Math.ceil(this.config.windowMs / 1000)) } : {}) })
    res.end(req.method === 'HEAD' ? undefined : page.html)
  }

  /**
   * Verify a small same-origin form against the current key file and signed nonce.
   * @param req - Incoming Node request with trusted socket address.
   * @param res - Failure response owner; success leaves response to BrowserAuth.
   * @param csrf - Expected process/authority/IP token.
   * @param report - Host-only operational diagnostic, never submitted text.
   * @returns True after successful verification, false after a complete failure response or closed connection.
   */
  verify(req: IncomingMessage, res: ServerResponse, csrf: string, report: (error: unknown) => void): Promise<boolean> {
    const operation = this.check(req, res, csrf, report)
    this.pending.set(req, operation)
    void operation.finally(() => this.pending.delete(req)).catch((_error: unknown) => {
      // The route owner observes the original failure; this branch only tracks teardown.
    })
    return operation
  }
  private async check(req: IncomingMessage, res: ServerResponse, csrf: string, report: (error: unknown) => void): Promise<boolean> {
    const ip = clientIp(req)
    if (this.closing || ip === undefined) { this.page(req, res, csrf, 'bad-request', 403, true); return false }
    const now = Date.now()
    for (const [address, attempt] of this.attempts) if (attempt.expiresAt <= now) this.attempts.delete(address)
    const attempt = this.attempts.get(ip)
    if ((attempt === undefined && this.attempts.size >= this.config.maxAddresses) || (attempt !== undefined && attempt.count >= this.config.attemptsPerWindow)) {
      req.resume(); this.page(req, res, csrf, 'limited', 429, true); return false
    }
    this.attempts.set(ip, { count: (attempt?.count ?? 0) + 1, expiresAt: attempt?.expiresAt ?? now + this.config.windowMs })
    if (req.method !== 'POST' || req.headers['content-type']?.split(';', 1)[0]?.trim() !== 'application/x-www-form-urlencoded'
      || Number(req.headers['content-length'] ?? 0) > MAX_BODY_BYTES) {
      req.resume(); this.page(req, res, csrf, 'bad-request', 400, true); return false
    }
    const timeout = setTimeout(() => { req.destroy() }, this.config.timeoutMs)
    try {
      const chunks: Buffer[] = []; let bytes = 0
      for await (const chunk of req) {
        if (!Buffer.isBuffer(chunk) || bytes + chunk.length > MAX_BODY_BYTES) {
          this.page(req, res, csrf, 'bad-request', 413, true); req.destroy(); return false
        }
        bytes += chunk.length; chunks.push(chunk)
      }
      if (this.closing || req.destroyed && !req.complete) return false
      const form = new URLSearchParams(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)))
      if (form.getAll('csrf').length !== 1 || form.getAll('key').length !== 1 || !equal(form.get('csrf') ?? '', csrf)) {
        this.page(req, res, csrf, 'bad-request', 403, true); return false
      }
      const key = await readKey(this.config.keyFile)
      if (this.closing) { req.destroy(); return false }
      if (!equal(form.get('key') ?? '', key)) { this.page(req, res, csrf, 'invalid', 401, true); return false }
      this.attempts.delete(ip)
      return true
    } catch (error) {
      if (!req.aborted && !this.closing) {
        report(error)
        if (!res.headersSent) this.page(req, res, csrf, 'unavailable', 503, true)
      }
      return false
    } finally { clearTimeout(timeout) }
  }

  /**
   * Reject new attempts and cancel incomplete requests before plugin resources disappear.
   * @returns After all admitted verifications settle.
   */
  async close(): Promise<void> {
    this.closing = true
    for (const req of this.pending.keys()) req.destroy()
    await Promise.allSettled(this.pending.values())
    this.attempts.clear()
  }
}
