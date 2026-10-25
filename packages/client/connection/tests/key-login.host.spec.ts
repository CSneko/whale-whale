/** Real HTTP key-login, IP, replay and restart failures with isolated sockets and storage. */
import { Context } from '@deepseek-ai/cordis'
import WebServer from '@deepseek-ai/dsh-host-webserver'
import type { CredentialProvider } from '@deepseek-ai/dsh-credentials'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import * as Connection from '../src/index.ts'
import { isTrustedApiRequest } from '../src/api-request-trust.ts'
import { BrowserAuth } from '../src/browser-auth.ts'
import { provideBrowserCredentials } from './browser-credentials.ts'

const cleanup: Array<() => Promise<unknown>> = []
afterEach(async () => {
  const errors: unknown[] = []
  for (const close of cleanup.splice(0).reverse()) {
    try { await close() } catch (error) { errors.push(error) }
  }
  if (errors.length) throw new AggregateError(errors, 'Key login fixture cleanup')
})
async function directory() {
  const root = await mkdtemp(join(tmpdir(), 'dsh-key-login-'))
  cleanup.push(() => rm(root, { recursive: true, force: true }))
  return root
}
async function fixture(root: string, credentials?: CredentialProvider, attemptsPerWindow = 10) {
  const ctx = new Context()
  cleanup.push(() => ctx.fiber.dispose())
  if (credentials === undefined) provideBrowserCredentials(ctx)
  else ctx.provide('credentials', credentials)
  await ctx.plugin(WebServer, { host: '0.0.0.0', allowWildcardHost: true, port: 0 })
  const config = Connection.Config({ keyLogin: { keyFile: join(root, 'web-login.key'), attemptsPerWindow } })
  await ctx.plugin(Connection, config)
  ctx.effect(() => ctx.connection.fetch.register({ path: '/api/protected', methods: ['GET'], requestBody: 'buffered',
    fetch: () => Promise.resolve(new Response('private data')) }))
  ctx.effect(() => ctx.webServer.registerFallback((req, res) => {
    if (ctx.connection.authorizeIndex(req, res)) { res.writeHead(200); res.end('authenticated application') }
  }))
  const origin = `http://127.0.0.1:${String(ctx.webServer.port)}`
  return { ctx, origin, config, key: (await readFile(config.keyLogin!.keyFile, 'utf8')).trim() }
}
function nonce(html: string): string {
  const value = /name="csrf" value="([A-Za-z0-9_-]+)"/u.exec(html)?.[1]
  if (value === undefined) throw new Error('Missing login form token')
  return value
}
async function login(origin: string, key: string, csrf: string) {
  return fetch(`${origin}/auth/login`, { method: 'POST', redirect: 'manual',
    headers: { origin, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ key, csrf }) })
}

it('allows omitted key login configuration to select launch-token authentication', () => {
  expect(Connection.Config({}).keyLogin).toBeUndefined()
})

it('requires the form key, protects all HTTP dispatch, binds the cookie to IP, and expires it at process restart', async () => {
  const root = await directory()
  const { ctx, origin, key, config } = await fixture(root)
  expect(ctx.connection.authenticatedUrl(origin)).toBe(origin + '/')
  const page = await fetch(origin, { headers: { 'accept-language': 'zh-CN' } })
  const html = await page.text()
  expect(page.status).toBe(200)
  expect(page.headers.get('referrer-policy')).toBe('same-origin')
  expect(html).toContain('访问密钥')
  expect(html).not.toContain(key)
  expect(page.headers.get('content-security-policy')).toContain("frame-ancestors 'none'")
  expect((await fetch(`${origin}/api/protected`)).status).toBe(401)
  expect((await fetch(`${origin}/connect?token=unused`, { redirect: 'manual' })).status).toBe(401)
  expect((await login(origin, 'incorrect-fixture-key', nonce(html))).status).toBe(401)
  expect((await login(origin, key, 'wrong-form-token')).status).toBe(403)
  const forged = await fetch(`${origin}/auth/login`, { method: 'POST', headers: { origin: 'http://other.invalid',
    'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ key, csrf: nonce(html) }) })
  expect(forged.status).toBe(403)
  const accepted = await login(origin, key, nonce(html))
  expect(accepted.status).toBe(303)
  expect(accepted.headers.get('location')).toBe('../')
  const cookie = accepted.headers.get('set-cookie')!.split(';', 1)[0]!
  expect(cookie).toContain('=v3.')
  expect(accepted.headers.get('set-cookie')).toContain('HttpOnly; SameSite=Strict')
  expect(await (await fetch(`${origin}/api/protected`, { headers: { cookie } })).text()).toBe('private data')
  expect(await (await fetch(origin, { headers: { cookie } })).text()).toBe('authenticated application')
  const auth = await BrowserAuth.create(ctx.root, ctx.credentials, 30, config.keyLogin)
  cleanup.push(() => auth.close())
  const headers = { host: new URL(origin).host, cookie, 'x-forwarded-for': '127.0.0.1' }
  expect(auth.isAuthenticated({ headers, socket: { remoteAddress: '::ffff:127.0.0.1' } })).toBe(true)
  expect(auth.isAuthenticated({ headers, socket: { remoteAddress: '127.0.0.2' } })).toBe(false)
  expect(auth.isAuthenticated({ headers })).toBe(false)
  expect(ctx.connection.admitConnection({ headers, socket: { remoteAddress: '127.0.0.2' } })).toEqual({ rejection: 401 })
  const socketAdmission = ctx.connection.admitConnection({ headers, socket: { remoteAddress: '127.0.0.1' } })
  expect('peer' in socketAdmission).toBe(true)
  if ('release' in socketAdmission) await socketAdmission.release()
  const credentials = ctx.credentials
  await auth.close(); await ctx.fiber.dispose()
  const restarted = await fixture(root, credentials)
  expect(restarted.key).toBe(key)
  expect((await fetch(`${restarted.origin}/api/protected`, { headers: { cookie, host: new URL(origin).host } })).status).toBe(401)
  if (process.platform !== 'win32') expect((await stat(config.keyLogin!.keyFile)).mode & 0o077).toBe(0)
})

it('bounds failed attempts and accepts only actual local interface authorities on wildcard listeners', async () => {
  const { origin, key } = await fixture(await directory(), undefined, 1)
  const html = await (await fetch(origin)).text()
  expect((await login(origin, 'incorrect-fixture-key', nonce(html))).status).toBe(401)
  const blocked = await login(origin, key, nonce(html))
  expect(blocked.status).toBe(429)
  expect(blocked.headers.get('retry-after')).toBe('60')
  expect(isTrustedApiRequest({ headers: { host: '192.168.1.10:4004' }, socket: { localAddress: '192.168.1.10' } }, [], '0.0.0.0')).toBe(true)
  expect(isTrustedApiRequest({ headers: { host: 'attacker.invalid' }, socket: { localAddress: '192.168.1.10' } }, [], '0.0.0.0')).toBe(false)
  expect(isTrustedApiRequest({ headers: { host: '192.168.1.11:4004', 'x-forwarded-host': '192.168.1.10' }, socket: { localAddress: '192.168.1.10' } }, [], '0.0.0.0')).toBe(false)
  expect(isTrustedApiRequest({ headers: { host: '192.168.1.10:4004' } }, [], '0.0.0.0')).toBe(false)
  expect(isTrustedApiRequest({ headers: { host: '[fd00::1]:4004' }, socket: { localAddress: 'fd00::1' } }, [], '::')).toBe(true)
})

it('refuses a damaged existing key without replacement and recovers after the operator restores it', async () => {
  const root = await directory()
  const { ctx, origin, key, config } = await fixture(root)
  const html = await (await fetch(origin)).text()
  await writeFile(config.keyLogin!.keyFile, 'damaged')
  const unavailable = await login(origin, key, nonce(html))
  expect(unavailable.status).toBe(503)
  expect(await unavailable.text()).not.toContain(key)
  await ctx.fiber.dispose()
  await expect(fixture(root)).rejects.toThrow('16–1024')
  expect(await readFile(config.keyLogin!.keyFile, 'utf8')).toBe('damaged')
  await writeFile(config.keyLogin!.keyFile, key + '\n')
  const restored = await fixture(root)
  const restoredPage = await (await fetch(restored.origin)).text()
  expect((await login(restored.origin, key, nonce(restoredPage))).status).toBe(303)
})
