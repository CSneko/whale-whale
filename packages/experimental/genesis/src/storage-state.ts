/** Lossless decomposition and checked reconstruction of one committed life. @module */
import { stateSchema, embeddingSchema, memoryRevisionSchema, type LifeState } from './model.ts'
import { GenesisError } from './error.ts'
import { recordHash, type LifeManifest, type LifeRecord } from './storage-layout.ts'
import { z } from 'zod'

/**
 * Separate large histories, vectors and current projections into immutable records.
 * @param state - Validated life snapshot.
 * @returns Manifest and records; order is stable across unchanged writes.
 */
export function splitState(state: LifeState): { manifest: LifeManifest; records: LifeRecord[] } {
  const records: LifeRecord[] = []
  const add = (table: LifeRecord['table'], input: unknown) => {
    const value = JSON.parse(JSON.stringify(input)) as LifeRecord['value']
    records.push({ table, key: recordHash(value), value })
  }
  const { identity, events, memories, growth, sessions, ...projection } = state
  add('identity', identity)
  add('projections', projection)
  for (const event of events) add('events', event)
  for (const memory of memories) {
    const { embedding, history, ...text } = memory
    add(`memories_${memory.category}`, text)
    if (embedding !== undefined) add('embeddings', { id: memory.id, embedding })
    if (history !== undefined) add('memory_history', { id: memory.id, history })
  }
  for (const record of growth) add('growth', record)
  for (const [sessionId, capabilities] of Object.entries(sessions)) add('capabilities', { sessionId, capabilities })
  return { manifest: { format: 'genesis-split-v1', records: records.map(({ table, key }) => ({ table, key })) }, records }
}

/**
 * Verify every referenced component and all cross-record life invariants.
 * @param manifest - Validated atomic commit descriptor.
 * @param read - Read one component; missing components must return undefined or reject.
 * @returns Complete validated life; corruption never yields a partial life.
 */
export async function joinState(manifest: LifeManifest,
  read: (table: LifeRecord['table'], key: LifeRecord['key']) => unknown): Promise<LifeState> {
  const groups = new Map<LifeRecord['table'], unknown[]>()
  const refs = new Map<string, unknown>()
  for (const { table, key } of manifest.records) {
    if (refs.has(`${table}:${key}`)) throw new GenesisError('invalid-state', 'Genesis has duplicate record references. Restore a verified backup.')
    const value = await read(table, key)
    if (value === undefined || recordHash(value) !== key) throw new GenesisError('invalid-state', 'Genesis has a missing or damaged life record. Restore a verified backup; no new life was created.')
    refs.set(`${table}:${key}`, value)
    const group = groups.get(table) ?? []
    group.push(value)
    groups.set(table, group)
  }
  const single = (table: LifeRecord['table']) => {
    const values = groups.get(table)
    if (values?.length !== 1) throw new GenesisError('invalid-state', 'Genesis identity or projection is absent or duplicated. Restore a verified backup.')
    return z.record(z.string(), z.unknown()).parse(values[0])
  }
  const memories = new Map<string, Record<string, unknown>>()
  for (const category of ['episodic', 'semantic', 'self', 'procedural'] as const) {
    for (const raw of groups.get(`memories_${category}`) ?? []) {
      const memory = z.looseObject({ id: z.string(), category: z.literal(category) }).parse(raw)
      if (memories.has(memory.id)) throw new GenesisError('invalid-state', 'Genesis has duplicate memories. Restore a verified backup.')
      memories.set(memory.id, memory)
    }
  }
  for (const table of ['embeddings', 'memory_history'] as const) {
    const seen = new Set<string>()
    for (const raw of groups.get(table) ?? []) {
      const record = (table === 'embeddings'
        ? z.strictObject({ id: z.string(), embedding: embeddingSchema })
        : z.strictObject({ id: z.string(), history: z.array(memoryRevisionSchema) })).parse(raw)
      const memory = memories.get(record.id)
      if (memory === undefined || seen.has(record.id)) throw new GenesisError('invalid-state', 'Genesis has invalid memory component references. Restore a verified backup.')
      seen.add(record.id)
      if ('embedding' in record) memory['embedding'] = record.embedding
      else memory['history'] = record.history
    }
  }
  const sessions = new Map<string, unknown>()
  for (const raw of groups.get('capabilities') ?? []) {
    const record = z.strictObject({ sessionId: z.string(), capabilities: z.array(z.unknown()) }).parse(raw)
    if (sessions.has(record.sessionId)) throw new GenesisError('invalid-state', 'Genesis has duplicate Session capability records. Restore a verified backup.')
    sessions.set(record.sessionId, record.capabilities)
  }
  // Manifest order, rather than category-directory order, defines memory retrieval tie order.
  const orderedMemories = manifest.records.filter(ref => ref.table.startsWith('memories_'))
    .map(ref => refs.get(`${ref.table}:${ref.key}`))
    .map(raw => memories.get(z.object({ id: z.string() }).parse(raw).id))
  return stateSchema.parse({ ...single('projections'), identity: single('identity'), events: groups.get('events') ?? [],
    memories: orderedMemories, growth: groups.get('growth') ?? [], sessions: Object.fromEntries(sessions) })
}
