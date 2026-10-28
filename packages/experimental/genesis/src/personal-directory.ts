/** Persistent host directory with a scoped, identity-pinned sandbox grant. @module */
import type { Context } from '@deepseek-ai/cordis'
import type { Session } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-sandbox-policy'
import { mkdir, lstat, realpath } from 'node:fs/promises'
import { isAbsolute, parse } from 'node:path'
import type { LifeCore } from './core.ts'
import { GenesisError } from './error.ts'

/**
 * Prepare one private directory and register its explicit cross-workspace grant.
 * @param ctx - Grant owner; disposal removes the registered permission.
 * @param core - Stable life and learned capability owner.
 * @param path - Configured absolute directory, outside identity and credential storage files.
 * @param participates - Whether the requesting session belongs to this life.
 * @returns Canonical host path recorded in life history; no files are removed on disposal.
 */
export async function preparePersonalDirectory(ctx: Context, core: LifeCore, path: string,
  participates: (session: Session | undefined) => boolean): Promise<string> {
  if (!isAbsolute(path) || path === parse(path).root) throw new GenesisError('invalid-state', 'personalDirectory must name a private absolute directory, not a filesystem root.')
  const policy = ctx.sandboxPolicy
  const recorded = (await core.snapshot()).events.some(event => event.dedupKey === 'personal-directory')
  if (!recorded) await mkdir(path, { recursive: true, mode: 0o700 })
  const info = await lstat(path)
  if (!info.isDirectory() || info.isSymbolicLink() || (process.platform !== 'win32'
    && ((info.mode & 0o077) !== 0 || info.uid !== process.getuid?.()))) {
    throw new GenesisError('invalid-state', 'personalDirectory must be an owned private directory without a symbolic-link endpoint.')
  }
  const canonical = await realpath(path)
  await core.setPersonalDirectory(canonical)
  ctx.effect(() => policy.registerWritableDirectory(canonical, (session) => {
    if (!participates(session)) return false
    const learned = core.learningStatus().tools
    return learned.includes('read') && learned.includes('write')
  }))
  return canonical
}
