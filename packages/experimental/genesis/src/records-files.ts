/** Private Markdown projections; only validated system-generated relative paths may reach the filesystem. @module */
import { constants } from 'node:fs'
import { lstat, mkdir, open, readFile, realpath, rename, rm } from 'node:fs/promises'
import { dirname, join, relative, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { LifeId } from './model.ts'
import type { WritingEntry, WritingState } from './records-model.ts'
import { GenesisError } from './error.ts'

/**
 * Create a private records directory, rejecting links throughout its managed subtree.
 * @param personal - Previously validated, canonical personal directory.
 * @returns Canonical records root; existing symlink endpoints are rejected.
 */
export async function prepareWritingRoot(personal: string): Promise<string> {
  const root = join(personal, 'records')
  await mkdir(root, { recursive: true, mode: 0o700 })
  const info = await lstat(root)
  if (!info.isDirectory() || info.isSymbolicLink() || await realpath(root) !== root
    || (process.platform !== 'win32' && ((info.mode & 0o077) !== 0 || info.uid !== process.getuid?.()))) {
    throw new GenesisError('invalid-state', 'Records require an owned private directory without symbolic links. Check personal/records permissions before restarting.')
  }
  return root
}

/**
 * Detect previous record storage when its authoritative domain has disappeared.
 * @param root - Validated records directory.
 * @returns Its life id, or null before initialization; malformed or unreadable markers fail visibly.
 */
export async function writingOwner(root: string): Promise<LifeId | null> {
  try {
    const path = await targetPath(root, '.owner.json')
    const text = await readFile(path, 'utf8')
    return z.strictObject({ schemaVersion: z.literal(1), lifeId: z.uuid().transform(brandString<LifeId>) }).parse(JSON.parse(text)).lifeId
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null
    throw new GenesisError('invalid-state', 'The records ownership marker is unreadable or incompatible. Restore its verified copy before restarting.', { cause: error })
  }
}

async function targetPath(root: string, path: string): Promise<string> {
  const target = join(root, path)
  const inside = relative(root, target)
  if (!inside || inside.startsWith(`..${sep}`) || inside === '..') throw new GenesisError('invalid-state', 'Invalid record file location.')
  const parts = relative(root, dirname(target)).split(sep).filter(Boolean)
  let current = root
  for (const part of ['', ...parts]) {
    if (part) current = join(current, part)
    await mkdir(current, { recursive: false, mode: 0o700 }).catch((error: unknown) => {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error
    })
    const info = await lstat(current)
    if (!info.isDirectory() || info.isSymbolicLink()) throw new GenesisError('invalid-state', 'A records directory was replaced by a link or file. Stop and restore its owned directories.')
  }
  try {
    const info = await lstat(target)
    if (!info.isFile() || info.isSymbolicLink()) throw new GenesisError('invalid-state', 'A record file was replaced by a link or directory. Restore the managed file before retrying.')
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error
  }
  return target
}

async function atomicFile(root: string, path: string, text: string): Promise<void> {
  const target = await targetPath(root, path)
  const temporary = `${target}.${randomUUID()}.tmp`
  try {
    const file = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
    try { await file.writeFile(text, 'utf8'); await file.sync() } finally { await file.close() }
    await targetPath(root, path)
    await rename(temporary, target)
  } finally { await rm(temporary, { force: true }) }
}

function markdown(state: WritingState, entry: WritingEntry): string {
  const { content, ...metadata } = entry
  return `---\n${JSON.stringify({ schemaVersion: 1, lifeId: state.lifeId, ...metadata,
    type: state.types.find(type => type.id === entry.typeId)!.name }, null, 2)}\n---\n\n${content}\n`
}

/**
 * Publish committed Markdown and finish removals; replay is safe after interrupted publication.
 * @param state - Authoritative catalog, including retired generated paths.
 * @returns After file publication; failure leaves the catalog’s pending flag set.
 */
export async function publishWritingFiles(state: WritingState): Promise<void> {
  for (const entry of state.entries) {
    const text = markdown(state, entry)
    const target = await targetPath(state.root, entry.fileName)
    let existing: string | undefined
    try { existing = await readFile(target, 'utf8') } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error
    }
    if (existing !== text) await atomicFile(state.root, entry.fileName, text)
  }
  for (const path of state.retiredPaths) await rm(await targetPath(state.root, path), { force: true })
  await atomicFile(state.root, '.owner.json', JSON.stringify({ schemaVersion: 1, lifeId: state.lifeId }) + '\n')
}
