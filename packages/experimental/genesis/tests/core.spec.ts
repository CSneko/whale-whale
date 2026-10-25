import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SessionId } from '@deepseek-ai/dsh-session'
import { brandString } from '@deepseek-ai/dsh-brand'
import { acquireLease } from '../src/lease.ts'
import { stateSchema, type LifeEventId, type MemoryId } from '../src/model.ts'
import { z } from 'zod'
import { boundedJson } from '../src/context.ts'
import { readBackup } from '../src/backup.ts'
import { joinState } from '../src/storage-state.ts'
import { manifestSchema } from '../src/storage-layout.ts'
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

it('publishes learned tools only after the complete persistence operation settles', async () => {
  const fixture = await setup(await directory())
  await fixture.core.awaken('小芽')
  const table = fixture.domain.table('states')
  const put = table.put.bind(table)
  const entered = Promise.withResolvers<undefined>()
  const release = Promise.withResolvers<undefined>()
  vi.spyOn(table, 'put').mockImplementationOnce(async (...args) => {
    await put(...args)
    entered.resolve(undefined)
    await release.promise
  })
  const learning = fixture.core.learn('lookup', sessionId)
  try {
    await entered.promise
    expect((await joinState(manifestSchema.parse(table.get('life')), (name, key) => fixture.records.table(name).get(key))).events.some(event => event.type === 'capability.learned')).toBe(true)
    expect(fixture.core.learningStatus().tools).toEqual([])
  } finally { release.resolve(undefined) }
  await learning
  expect(fixture.core.learningStatus().tools).toEqual(['lookup'])
})

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
    await first.core.scan(sessionId, [])
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
    expect(await second.core.retrieve({ text: 'oolong', limit: 5, chars: 5000 })).toEqual([updated])
    expect(updated?.history?.[0]?.content).toBe(memory.content)
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

it.each(['broken-json', 'future-version', 'invalid-identity', 'missing-source', 'missing-history-source'])(
  'refuses %s without replacing identity or changing the file', async (corruption) => {
    const root = await directory()
    const fixture = await setup(root)
    await fixture.close()
    const file = join(root, 'genesis.json')
    const value = z.object({ unit: z.object({ name: z.string(), version: z.number() }), global: z.unknown(),
      tables: z.object({ states: z.object({ life: stateSchema }) }) }).parse({ unit: { name: 'genesis', version: 1 }, global: null,
      tables: { states: { life: await readBackup(join(root, 'life.lock.backup.json')) } } })
    if (corruption === 'future-version') value.unit.version = 999
    if (corruption === 'missing-source') value.tables.states.life.events = []
    if (corruption === 'missing-history-source') {
      const memory = value.tables.states.life.memories[0]!
      memory.history = [{ category: memory.category, content: 'Earlier interpretation', importance: 0.5, confidence: 0.5,
        sourceEventIds: [brandString<LifeEventId>('14ba15fd-3cdd-42b8-a6b2-d6faeac692fc')],
        recordedAt: '2026-01-01T00:00:00.000Z', supersededAt: '2026-01-02T00:00:00.000Z' }]
    }
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
  const previous = fixture.domain.table('states').get('life')
  const write = vi.spyOn(fixture.domain.table('states'), 'put').mockRejectedValue(new Error('disk unavailable'))
  await expect(fixture.core.rename('not committed')).rejects.toMatchObject({ code: 'storage' })
  expect(fixture.domain.table('states').get('life')).toEqual(previous)
  await expect(fixture.core.snapshot()).rejects.toMatchObject({ code: 'storage' })
  write.mockRestore()
  await expect(fixture.close()).rejects.toMatchObject({ code: 'storage' })
})

it('refuses capacity overflow without discarding history or poisoning reads', async () => {
  const { core } = await setup(await directory(), 'json', { maxRecords: 20 })
  await expect(core.scan(sessionId, Array.from({ length: 20 }, (_, index) => ({ ...tool, name: `tool${index}` })))).rejects.toMatchObject({ code: 'capacity' })
  expect((await core.snapshot()).sessions).toEqual({})
  expect(boundedJson({ content: 'a'.repeat(500) }, 100)).toBe('{"omitted":true,"reason":"context-budget"}')
})

it('keeps a local backup and refuses rebirth after the primary store disappears', async () => {
  const root = await directory()
  const fixture = await setup(root)
  await fixture.close()
  const backup = await readFile(join(root, 'life.lock.backup.json'), 'utf8')
  expect((await readBackup(join(root, 'life.lock.backup.json'))).events.some(event => event.type === 'life.stopped')).toBe(true)
  await rm(join(root, 'genesis.json'))
  await expect(openCore(root)).rejects.toMatchObject({ code: 'invalid-state' })
  expect(await readFile(join(root, 'life.lock.backup.json'), 'utf8')).toBe(backup)
})

it('commits review changes once, invalidates corrected vectors and refuses oversized implicit memory atomically', async () => {
  const { core } = await setup(await directory())
  const born = (await core.snapshot()).events[0]!
  const input = { content: 'Oolong preference', category: 'semantic' as const, kind: 'declarative' as const,
    importance: 0.8, confidence: 0.8, sourceEventIds: [born.id] }
  const embedding = { space: 'fixture', vector: [1, 0] }
  await core.reviewMemory('first', [{ action: 'upsert', input, embedding }], 1)
  const committed = await core.snapshot()
  await core.reviewMemory('first', [{ action: 'upsert', input, embedding }], 1)
  expect(await core.snapshot()).toEqual(committed)
  const saved = committed.memories.find(memory => memory.content === input.content)!
  const { kind: _kind, ...implicit } = input
  await expect(core.reviewMemory('too-many', [
    { action: 'upsert', input: { ...implicit, kind: 'non-declarative', content: 'First habit' }, embedding },
    { action: 'upsert', input: { ...implicit, kind: 'non-declarative', content: 'Second habit' }, embedding },
  ], 1)).rejects.toMatchObject({ code: 'capacity' })
  expect(await core.snapshot()).toEqual(committed)
  await core.updateMemory(saved.id, { ...input, content: 'Corrected preference' })
  expect((await core.getMemory(saved.id))?.embedding).toBeUndefined()
  await core.reviewMemory('delete', [{ action: 'delete', id: saved.id }], 1)
  expect(await core.getMemory(saved.id)).toBeUndefined()
})

it('records hundreds of preinstalled tools as one baseline with no growth, including after restart', async () => {
  const root = await directory()
  const first = await setup(root)
  expect((await first.core.snapshot()).growth).toEqual([])
  const tools = Array.from({ length: 300 }, (_, index) => ({ ...tool, name: `preinstalled_${index}` }))
  await first.core.scan(sessionId, tools)
  const initial = await first.core.snapshot()
  expect(initial.sessions[sessionId]).toHaveLength(300)
  expect(initial.events.filter(event => event.type === 'capability.discovered')).toHaveLength(1)
  expect(initial.growth).toEqual([])
  await first.core.scan(sessionId, tools)
  expect(await first.core.snapshot()).toEqual(initial)
  await first.close()
  const restored = await setup(root)
  const before = await restored.core.snapshot()
  await restored.core.scan(sessionId, tools)
  expect(await restored.core.snapshot()).toEqual(before)
  await restored.core.scan(SessionId('another-initial-inventory'), tools)
  expect((await restored.core.snapshot()).growth).toEqual([])
  await restored.core.scan(sessionId, [...tools, { ...tool, name: 'new_capability' }])
  const upgraded = await restored.core.snapshot()
  expect(upgraded.identity).toEqual(initial.identity)
  expect(upgraded.growth).toHaveLength(1)
  expect(upgraded.growth[0]?.title).toContain('new_capability')
})


it('directly edits and converts operator memories without adding history, fences stale edits and restores current content', async () => {
  const root = await directory()
  const first = await setup(root)
  const id = brandString<MemoryId>('e8133924-9acf-4f86-8246-d169a14f200a')
  const draft = { content: 'I prefer oolong.', category: 'semantic' as const, kind: 'declarative' as const,
    importance: 0.7, confidence: 0.8 }
  const created = await first.core.editMemory(id, draft, null, 1)
  expect(created.attribution).toBe('user-stated')
  expect(created.sourceEventIds).toHaveLength(1)
  const initial = await first.core.snapshot()
  expect(initial.events.find(event => event.id === created.sourceEventIds[0])).toMatchObject({ source: 'user', payload: { kind: 'manual-memory-entry' } })
  expect(await first.core.editMemory(id, draft, null, 1)).toEqual(created)
  expect(await first.core.snapshot()).toEqual(initial)
  const converted = await first.core.convertMemory(id, 'non-declarative', created.updatedAt, 1)
  expect(converted).toMatchObject({ id, content: created.content, sourceEventIds: created.sourceEventIds, kind: 'non-declarative' })
  expect(converted.updatedAt).not.toBe(created.updatedAt)
  expect(converted.history).toBeUndefined()
  expect((await first.core.snapshot()).events).toEqual(initial.events)
  const before = await first.core.snapshot()
  await expect(first.core.editMemory(id, { ...draft, content: 'Stale text' }, created.updatedAt, 1)).rejects.toMatchObject({ code: 'configuration-conflict' })
  await expect(first.core.deleteMemory(id, created.updatedAt)).rejects.toMatchObject({ code: 'configuration-conflict' })
  const other = brandString<MemoryId>('98ed39b4-f484-4002-b6b4-ce4ae4a23af4')
  await expect(first.core.editMemory(other, { ...draft, kind: 'non-declarative' }, null, 1)).rejects.toMatchObject({ code: 'capacity' })
  expect(await first.core.snapshot()).toEqual(before)
  const content = 'I now prefer green tea. 说明年龄，说明年纪，模型版本 2026-10。'
  const edited = await first.core.editMemory(id, { ...draft, content }, converted.updatedAt, 1)
  expect(edited.content).toBe(content)
  expect(edited.sourceEventIds).toEqual(created.sourceEventIds)
  expect(edited.history).toBeUndefined()
  expect((await first.core.snapshot()).events).toEqual(initial.events)
  await first.close()
  const restored = await setup(root)
  expect(await restored.core.getMemory(id)).toEqual(edited)
  expect(await restored.core.deleteMemory(id, edited.updatedAt)).toBe(true)
  await restored.close()
  const final = await setup(root)
  expect(await final.core.getMemory(id)).toBeUndefined()
  expect((await final.core.snapshot()).events.some(event => event.type === 'memory.deleted' && event.payload['memoryId'] === id)).toBe(false)
})


it('removes experience links on explicit deletion and refuses invalid version data before storage admission', async () => {
  const { core, domain } = await setup(await directory())
  const source = await core.observe({ sessionId, eventId: 'experience-source', timestamp: new Date().toISOString(), kind: 'user-message' })
  const input = { category: 'semantic' as const, content: 'Oolong preference', importance: 0.5, confidence: 0.8, sourceEventIds: [source.id] }
  await core.reviewMemory('experience', [{ action: 'upsert', input, embedding: { space: 'fixture', vector: [1, 0] } }], 4,
    { input: { ...input, category: 'episodic', content: 'We talked about tea.' },
      details: { sessionId, startedAt: source.timestamp, endedAt: source.timestamp, topics: ['tea'] },
      embedding: { space: 'fixture', vector: [1, 0] } })
  const state = await core.snapshot()
  const episode = state.memories.find(memory => memory.experience !== undefined)!
  const knowledge = state.memories.find(memory => memory.content === input.content)!
  expect(knowledge.experienceIds).toEqual([episode.id])
  const budget = JSON.stringify(knowledge).length + 1
  expect(JSON.stringify(await core.retrieve({ text: knowledge.id, limit: 5, chars: budget })).length).toBeLessThanOrEqual(budget)
  const write = vi.spyOn(domain.table('states'), 'put')
  await expect(core.reviewMemory('invalid-experience', [], 4, { input: { ...input, category: 'episodic' },
    details: { sessionId, startedAt: '2026-02-01T00:00:00.000Z', endedAt: '2026-01-01T00:00:00.000Z', topics: [] },
    embedding: { space: 'fixture', vector: [1, 0] } })).rejects.toThrow('Experience starts after it ends')
  expect(write).not.toHaveBeenCalled()
  expect(await core.snapshot()).toEqual(state)
  await core.deleteMemory(episode.id, episode.updatedAt)
  expect((await core.getMemory(knowledge.id))?.experienceIds).toEqual([])
})

it('restores queued consolidation, fences operator edits, and commits each revision once', async () => {
  const root = await directory()
  const first = await setup(root)
  const source = await first.core.observe({ sessionId, eventId: 'habit-user', kind: 'user-message', timestamp: new Date().toISOString() })
  const input = { category: 'semantic' as const, kind: 'declarative' as const, attribution: 'model-inference' as const,
    content: 'The user prefers concise greetings.', importance: 0.7, confidence: 0.7, sourceEventIds: [source.id] }
  await first.core.reviewMemory('habit-turn', [{ action: 'upsert', input, embedding: { space: 'fixture', vector: [1, 0] } }], 4,
    undefined, { sessionId, turn: 1, userEventIds: [source.id] })
  await first.core.setConsolidation(false)
  const pending = await first.core.snapshot()
  await first.close()
  const second = await setup(root)
  expect((await second.core.snapshot()).consolidation).toEqual(pending.consolidation)
  const memory = pending.memories.find(item => item.content === input.content)!
  const plan = { revision: pending.consolidation!.revision, versions: [{ id: memory.id, updatedAt: memory.updatedAt }],
    changes: [{ id: memory.id, input: { ...input, content: 'A concise greeting is preferred.' },
      embedding: { space: 'fixture', vector: [1, 0] }, experienceIds: [] }] }
  await second.core.editMemory(memory.id, { category: input.category, importance: input.importance, confidence: input.confidence, content: 'An operator correction.', kind: 'declarative' }, memory.updatedAt, 4)
  expect(await second.core.consolidate(plan, 4)).toBe(false)
  const current = await second.core.snapshot()
  const empty = { revision: current.consolidation!.revision, versions: [], changes: [] }
  expect(await second.core.consolidate(empty, 4)).toBe(true)
  expect(await second.core.consolidate(empty, 4)).toBe(false)
  await second.close()
  const third = await setup(root)
  expect((await third.core.snapshot()).consolidation).toMatchObject({ completed: empty.revision, enabled: false })
  expect((await third.core.events({ type: 'memory.consolidated', limit: 10 }))).toHaveLength(1)
})

it('counts independent user turns rather than saved copies or assistant repetitions as habit support', async () => {
  const { feedbackTurns, consolidationChanges } = await import('../src/consolidation-plan.ts')
  const { Config } = await import('../src/config.ts')
  const { core } = await setup(await directory())
  const user = await core.observe({ sessionId, eventId: 'same-user', kind: 'user-message', timestamp: new Date().toISOString() })
  const assistant = await core.observe({ sessionId, eventId: 'assistant-repeat', kind: 'assistant-message', timestamp: user.timestamp })
  const input = { category: 'semantic' as const, content: 'A brief greeting is preferred.', importance: 0.7,
    confidence: 0.7, sourceEventIds: [user.id, assistant.id] }
  for (const key of ['automatic', 'manual-one', 'manual-two']) {
    await core.reviewMemory(key, [], 4, undefined, { sessionId, turn: 1, userEventIds: [user.id] })
  }
  const memory = await core.remember(input)
  const state = await core.snapshot()
  expect(feedbackTurns(state, [user.id, assistant.id]).size).toBe(1)
  expect(feedbackTurns(state, [assistant.id]).size).toBe(0)
  const config = Config({ leasePath: '/fixture/lease', memory: { decisionProvider: 'fixture', decisionModel: 'decision',
    writerProvider: 'fixture', writerModel: 'writer', embeddingUrl: '', embeddingModel: '', embeddingDimensions: 0,
    timeoutMs: 5000, inputChars: 24000, outputChars: 24000, maxTokens: 4096, reasoningEffort: 'auto', organizationLimit: 20, identityRewriteLimit: 100, maxChanges: 8, maxImplicitMemories: 4,
    associationLimit: 3, associationChars: 2000, associationInputChars: 1000, experienceWindowMs: 1800000, minSimilarity: 0.35,
    consolidation: { enabled: true, idleMs: 60000, cooldownMs: 300000, retryMs: 60000, maxFailures: 3, batchLimit: 20, minHabitSupport: 3 },
  } }).memory!
  const embed = vi.fn().mockResolvedValue({ space: 'fixture', vector: [1, 0] })
  await expect(consolidationChanges({ changes: [{ evidenceIds: [memory.id], memory: { category: 'procedural', kind: 'non-declarative',
    content: 'Greet briefly.', importance: 0.7, confidence: 0.7 }, habit: { cue: 'Greeting', response: 'Keep it brief',
    active: true, supportEventIds: [user.id] } }] }, state, [memory], config, embed)).rejects.toThrow('at least 3')
  expect(embed).not.toHaveBeenCalled()
})
