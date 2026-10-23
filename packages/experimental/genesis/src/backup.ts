/** Owner-private, atomically replaced local life-state backup. @module */
import { randomUUID } from 'node:crypto'
import { mkdir, open, rename, rm, stat } from 'node:fs/promises'
import { dirname, isAbsolute } from 'node:path'
import type { LifeState } from './model.ts'
import { GenesisError } from './error.ts'

/**
 * Resolve one backup location before opening life storage.
 * @param leasePath - Configured writer lease.
 * @param configured - Explicit backup override.
 * @returns Absolute backup filename; rejects relative paths or lease collisions.
 */
export function backupPath(leasePath: string, configured?: string): string {
  const path = configured ?? `${leasePath}.backup.json`
  if (!isAbsolute(path) || path === leasePath) {
    throw new GenesisError('invalid-state', 'Genesis backupPath must be absolute and different from leasePath.')
  }
  return path
}

/**
 * Refuse accidental rebirth when only the primary storage has disappeared.
 * @param path - Resolved backup file.
 * @returns Whether any backup exists; other filesystem errors propagate.
 */
export async function hasBackup(path: string): Promise<boolean> {
  try { await stat(path) } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false
    throw error
  }
  return true
}

/**
 * Publish a complete backup after the primary commit. Failure leaves the previous backup.
 * @param path - Resolved destination, independent of the primary storage backend.
 * @param state - Committed life snapshot, including text, evidence and vector cache.
 * @returns After file fsync and atomic replacement; caller owns partial-outcome reporting.
 */
export async function writeBackup(path: string, state: LifeState): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    const file = await open(temporary, 'wx', 0o600)
    try {
      await file.writeFile(JSON.stringify(state) + '\n', 'utf8')
      await file.sync()
    } finally { await file.close() }
    await rename(temporary, path)
  } finally { await rm(temporary, { force: true }) }
}
