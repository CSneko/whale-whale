import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SessionId } from '@deepseek-ai/dsh-session'
import { brandString } from '@deepseek-ai/dsh-brand'
import { acquireLease } from '../src/lease.ts'
import { stateSchema, type LifeEventId } from '../src/model.ts'
import { z } from 'zod'
import { boundedJson } from '../src/context.ts'
import { openCore } from './harness.ts'

const cleanup: Array<() => Promise<unknown>> = []
afterEach(async () => {
  vi.restoreAllMocks()
  const errors: unknown[] = []
  for (const fn of cleanup.splice(0).reverse()) {
    try { await fn() } catch (error) { errors.push(error) }
  }
  if (errors.length) throw new AggregateError(errors, 'Genesis fixture teardown')
})
async function directory() {
  const root = await mkdtemp(join(tmpdir(), 'genesis-core-'))
  cleanup.push(() => rm(root, { recursive: true, force: true }))
  return root
}
async function setup(root: string, medium: 'json' | 'sqlite' = 'json', overrides = {}) {
  const fixture = await openCore(root, medium, overrides)
  cleanup.push(() => fixture.close())
  return fixture
}
const sessionId = SessionId('genesis-session')
const tool = { name: 'lookup', description: 'Read a fixture', parameters: {} }

describe.each(['json', 'sqlite'] as const)('%s life persistence', (medium) => {
  it('commits one birth and restores identity, memories, sources and growth across restart', async () => {
    const root = await directory()
    const first = await setup(root, medium)
    const initial = await first.core.snapshot()
    expect(initial.identity.name).toBeNull()
    expect(initial.identity.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(Date.parse(initial.identity.createdAt)).not.toBeNaN()
    expect(stateSchema.safeParse(initial).success).toBe(true)
    await first.core.start()
    const observed = await first.core.observe({ sessionId, eventId: '12', timestamp: new Date().toISOString(), kind: 'user-message' })
    const memory = await first.core.remember({ content: 'I prefer oolong tea', category: 'semantic', importance: 0.9,
      confidence: 0.8, sourceEventIds: [observed.id] })
    await first.core.scan(sessionId, [tool])
    await first.close()
    const second = await setup(root, medium)
    const restored = await second.core.snapshot()
    expect(restored.identity).toEqual(initial.identity)
    expect(await second.core.getMemory(memory.id)).toEqual(memory)
    expect(restored.events.filter(event => event.type === 'life.created')).toHaveLength(1)
    expect(restored.events.some(event => event.type === 'life.stopped')).toBe(true)
    expect(restored.growth.some(record => record.title.includes('lookup'))).toBe(true)
    expect(await second.core.retrieve({ text: 'oolong', limit: 5, chars: 5000 })).toEqual([memory])
    const updated = await second.core.updateMemory(memory.id, { category: memory.category, importance: memory.importance, sourceEventIds: memory.sourceEventIds, content: 'I prefer green tea', confidence: 0.9 })
    expect(updated?.createdAt).toBe(memory.createdAt)
    expect(await second.core.retrieve({ text: 'oolong', limit: 5, chars: 5000 })).toEqual([])
    expect(await second.core.deleteMemory(memory.id)).toBe(true)
    expect(await second.core.deleteMemory(memory.id)).toBe(false)
    expect(await second.core.getMemory(memory.id)).toBeUndefined()
    await second.close()
    const third = await setup(root, medium)
    expect(await third.core.retrieve({ text: 'green tea', limit: 5, chars: 5000 })).toEqual([])
    expect((await third.core.events({ type: 'memory.deleted', limit: 20 }))).toHaveLength(1)
  })
})

it('deduplicates concurrent source delivery and keeps Session capabilities separate', async () => {
  const { core } = await setup(await directory())
  const observation = { sessionId, eventId: '3', timestamp: new Date().toISOString(), kind: 'user-message' as const }
  const events = await Promise.all(Array.from({ length: 10 }, () => core.observe(observation)))
  expect(new Set(events.map(event => event.id)).size).toBe(1)
  await core.bind(sessionId, 'startup')
  await core.bind(SessionId('another'), 'startup')
  await core.scan(sessionId, [tool])
  const count = (await core.snapshot()).events.length
  await core.scan(sessionId, [tool])
  expect((await core.snapshot()).events).toHaveLength(count)
  const growthBefore = (await core.snapshot()).growth.length
  await core.scan(SessionId('another'), [tool])
  expect((await core.snapshot()).growth).toHaveLength(growthBefore)
  await core.scan(SessionId('another'), [])
  expect((await core.snapshot()).sessions[sessionId]?.[0]?.available).toBe(true)
  await core.scan(sessionId, [{ ...tool, description: 'Updated declaration' }])
  await core.scan(sessionId, [])
  await core.scan(sessionId, [tool])
  const snapshot = await core.snapshot()
  for (const type of ['capability.discovered', 'capability.updated', 'capability.lost', 'capability.acquired']) {
    expect(snapshot.events.some(event => event.type === type)).toBe(true)
  }
  expect(snapshot.sessions[sessionId]?.[0]?.permission).toBe('checked-at-execution')
  await core.observe({ ...observation, eventId: '4', kind: 'tool-result', tool: 'lookup', success: true })
  expect((await core.snapshot()).sessions[sessionId]?.[0]?.verification).toBe('succeeded')
})

it('serializes concurrent memories without losing records and refuses missing evidence', async () => {
  const { core } = await setup(await directory())
  const birth = (await core.snapshot()).events[0]!
  const input = { category: 'episodic' as const, importance: 0.5, confidence: 0.5, sourceEventIds: [birth.id] }
  await Promise.all(Array.from({ length: 12 }, (_, index) => core.remember({ ...input, content: `experience ${index}` })))
  expect(await core.retrieve({ text: 'experience', limit: 20, chars: 20000 })).toHaveLength(12)
  await expect(core.remember({ ...input, content: 'unsupported', sourceEventIds: [brandString<LifeEventId>('00000000-0000-4000-8000-000000000001')] })).rejects.toMatchObject({ code: 'invalid-source' })
  expect(await core.retrieve({ text: '', category: 'episodic', after: '2999', limit: 20, chars: 10000 })).toEqual([])
  expect(await core.retrieve({ text: '', limit: 0, chars: 0 })).toEqual([])
  const snapshot = await core.snapshot()
  snapshot.identity.name = 'mutated copy'
  expect((await core.snapshot()).identity.name).toBeNull()
  await core.rename('Chosen name')
  expect((await core.snapshot()).identity.id).toBe(snapshot.identity.id)
})

it.each(['broken-json', 'future-version', 'invalid-identity', 'missing-source'])(
  'refuses %s without replacing identity or changing the file', async (corruption) => {
    const root = await directory()
    const fixture = await setup(root)
    await fixture.close()
    const file = join(root, 'genesis.json')
    const original = await readFile(file, 'utf8')
    const value = z.object({ unit: z.object({ name: z.string(), version: z.number() }), global: z.unknown(),
      tables: z.object({ states: z.object({ life: stateSchema }) }) }).parse(JSON.parse(original))
    if (corruption === 'future-version') value.unit.version = 999
    if (corruption === 'missing-source') value.tables.states.life.events = []
    const corrupted = corruption === 'broken-json' ? '{' : corruption === 'invalid-identity'
      ? JSON.stringify({ ...value, tables: { states: { life: { ...value.tables.states.life, identity: { ...value.tables.states.life.identity, id: 'broken' } } } } })
      : JSON.stringify(value)
    await writeFile(file, corrupted)
    await expect(openCore(root)).rejects.toThrow()
    expect(await readFile(file, 'utf8')).toBe(corrupted)
  },
)

it('refuses a second writer and releases the lease on graceful close', async () => {
  const path = join(await directory(), 'writer.lock')
  const release = await acquireLease(path)
  cleanup.push(release)
  await expect(acquireLease(path)).rejects.toMatchObject({ code: 'locked' })
  await release()
  const next = await acquireLease(path)
  cleanup.push(next)
  await next()
  await expect(acquireLease('relative.lock')).rejects.toMatchObject({ code: 'locked' })
})

it('leaves committed state unchanged after a failed write and refuses dependent reads', async () => {
  const fixture = await setup(await directory())
  const previous = await fixture.core.snapshot()
  const write = vi.spyOn(fixture.domain.table('states'), 'put').mockRejectedValue(new Error('disk unavailable'))
  await expect(fixture.core.rename('not committed')).rejects.toMatchObject({ code: 'storage' })
  expect(fixture.domain.table('states').get('life')).toEqual(previous)
  await expect(fixture.core.snapshot()).rejects.toMatchObject({ code: 'storage' })
  write.mockRestore()
  await expect(fixture.close()).rejects.toMatchObject({ code: 'storage' })
})

it('refuses capacity overflow without discarding history or poisoning reads', async () => {
  const { core } = await setup(await directory(), 'json', { maxRecords: 20 })
  await expect(core.scan(sessionId, Array.from({ length: 10 }, (_, index) => ({ ...tool, name: `tool${index}` })))).rejects.toMatchObject({ code: 'capacity' })
  expect((await core.snapshot()).sessions).toEqual({})
  expect(boundedJson({ content: 'a'.repeat(500) }, 100)).toBe('{"omitted":true,"reason":"context-budget"}')
})
