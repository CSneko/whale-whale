/** Exclusive writer lease; abandoned leases require explicit operator recovery. @module */
import { mkdir, open, unlink } from 'node:fs/promises'
import { dirname, isAbsolute } from 'node:path'
import { GenesisError } from './error.ts'

/**
 * Exclude concurrent processes before opening the cached Storage Domain.
 * @param path - Absolute lease filename shared by users of the same life data.
 * @returns Idempotent release function; ownership is never stolen automatically.
 */
export async function acquireLease(path: string): Promise<() => Promise<void>> {
  if (!isAbsolute(path)) throw new GenesisError('locked', 'Genesis leasePath must be absolute.')
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  let handle
  try {
    handle = await open(path, 'wx', 0o600)
  } catch (error) {
    throw new GenesisError('locked', 'Genesis cannot acquire its writer lease. Stop the other writer; after a crash, verify it is stopped before removing the lease file.', { cause: error })
  }
  let released = false
  return async () => {
    if (released) return
    await handle.close()
    await unlink(path)
    released = true
  }
}
