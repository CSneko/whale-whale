/** Isolated record failure/recovery checks against real Storage Domain and private files. */
import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import { JsonStorageBackend } from '@deepseek-ai/dsh-storage-json'
import { brandString } from '@deepseek-ai/dsh-brand'
import { SessionId } from '@deepseek-ai/dsh-session'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import { randomUUID } from 'node:crypto'
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { Config } from '../src/config.ts'
import type { LifeId } from '../src/model.ts'
import { writingsDomain, type WritingTypeId } from '../src/records-model.ts'
import { prepareWritingRoot } from '../src/records-files.ts'
import { WritingRecords } from '../src/records.ts'

const cleanup: Array<() => Promise<unknown>> = []
afterEach(async () => {
  const errors: unknown[] = []
  for (const close of cleanup.splice(0).reverse()) {
    try { await close() } catch (error) { errors.push(error) }
  }
  if (errors.length) throw new AggregateError(errors, 'Record fixture cleanup')
})
async function directory() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'genesis-records-')))
  cleanup.push(() => rm(root, { recursive: true, force: true }))
  return root
}
async function store(root: string, lifeId: LifeId) {
  const ctx = new Context()
  cleanup.push(() => ctx.fiber.dispose())
  await ctx.plugin(Storage)
  const backend = new JsonStorageBackend(root)
  cleanup.push(() => backend.close())
  ctx.storage.backend.register('json', backend)
  const facility = new DomainFacility(ctx, { backend: 'json' })
  const domain = await facility.open(writingsDomain)
  cleanup.push(() => facility.closeAll())
  const personal = join(root, 'personal')
  await mkdir(personal, { recursive: true, mode: 0o700 })
  const records = new WritingRecords(domain, await prepareWritingRoot(personal), lifeId, Config({ leasePath: join(root, 'life.lock'), records: {} }).records!)
  cleanup.push(() => records.close())
  return { records, domain, async close() { await records.close(); await backend.close(); await ctx.fiber.dispose() } }
}

it.skipIf(process.platform === 'win32')('contains a replaced directory, recovers a committed write, and refuses missing or damaged record ownership', async () => {
  // The symlink replacement exercises POSIX directory confinement; Windows symlink privileges differ.
  const root = await directory(); const outside = await directory()
  const lifeId = brandString<LifeId>(randomUUID())
  const first = await store(root, lifeId)
  await first.records.start()
  await symlink(outside, join(root, 'personal', 'records', 'diary'), 'dir')
  const signal = new AbortController().signal
  const source = { sessionId: SessionId('recovery'), callId: ToolCallId('interrupted-publication') }
  const draft = { title: 'My note', content: 'A committed record with pending files.', typeId: brandString<WritingTypeId>('diary') }
  await expect(first.records.create(draft, source, signal)).rejects.toThrow('catalog may already be saved')
  await expect(first.records.catalog(signal)).rejects.toThrow('operations stopped')
  expect(await readdir(outside)).toEqual([])
  expect(first.domain.table('states').get('catalog')!.pendingFiles).toBe(true)
  await rm(join(root, 'personal', 'records', 'diary'))
  await first.close()

  const second = await store(root, lifeId)
  await second.records.start()
  const receipt = await second.records.create(draft, source, signal)
  expect((await second.records.catalog(signal)).count).toBe(1)
  expect(await readFile(join(root, 'personal', 'records', receipt.fileName!), 'utf8')).toContain(draft.content)
  expect(second.domain.table('states').get('catalog')!.pendingFiles).toBe(false)
  await second.close()
  const catalog = await readFile(join(root, 'genesis_writings.json'), 'utf8')
  await rm(join(root, 'genesis_writings.json'))
  const missing = await store(root, lifeId)
  await expect(missing.records.start()).rejects.toThrow('catalog is missing')
  await missing.close()
  await writeFile(join(root, 'genesis_writings.json'), catalog)
  await writeFile(join(root, 'personal', 'records', '.owner.json'), '{damaged')
  const damaged = await store(root, lifeId)
  await expect(damaged.records.start()).rejects.toThrow('ownership marker is unreadable')
})
