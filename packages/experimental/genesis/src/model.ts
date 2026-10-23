/** Validated Genesis durable records; independent of any model provider. @module */
import { z } from 'zod'
import { brandString, type Branded } from '@deepseek-ai/dsh-brand'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'

/** Stable identity of one life, unrelated to Session and user identifiers. */
export type LifeId = Branded<'GenesisLifeId'>
/** Identifier of one durable life fact. */
export type LifeEventId = Branded<'GenesisLifeEventId'>
/** Identifier of one retained memory. */
export type MemoryId = Branded<'GenesisMemoryId'>
/** Identifier of a runtime tool capability. */
export type CapabilityId = Branded<'GenesisCapabilityId'>
/** Identifier of a growth record. */
export type GrowthId = Branded<'GenesisGrowthId'>

const lifeId = z.uuid().transform(brandString<LifeId>)
const eventId = z.uuid().transform(brandString<LifeEventId>)
const memoryId = z.uuid().transform(brandString<MemoryId>)
const growthId = z.uuid().transform(brandString<GrowthId>)
const capabilityId = z.string().min(1).max(512).transform(brandString<CapabilityId>)
const timestamp = z.iso.datetime()
const identitySchema = z.strictObject({
  id: lifeId, name: z.string().min(1).max(200).nullable(), createdAt: timestamp, updatedAt: timestamp,
  lifeCoreVersion: z.string().min(1),
  origin: z.strictObject({ framework: z.literal('DeepSeek Harness'), initialVersion: z.literal('0.1.0-alpha.1') }),
})
const eventSchema = z.strictObject({
  id: eventId, lifeId, type: z.string().regex(/^[a-z]+\.[a-z]+$/), timestamp,
  source: z.enum(['system', 'user', 'agent', 'tool']), payload: z.record(z.string(), z.json()),
  dedupKey: z.string().min(1).max(1000), relatedSessionId: z.string().optional(),
  relatedEventId: z.string().optional(),
})
/** Validation at model/tool input and durable memory reads. */
export const memoryInputSchema = z.strictObject({
  category: z.enum(['episodic', 'semantic', 'self', 'procedural']),
  content: z.string().trim().min(1).max(8000), importance: z.number().min(0).max(1),
  sourceEventIds: z.array(eventId).min(1).max(100), confidence: z.number().min(0).max(1),
  kind: z.enum(['declarative', 'non-declarative']).optional(),
  attribution: z.enum(['user-stated', 'model-inference']).optional(),
})
/** Cached semantic vector with an exact embedding-space identifier. */
export const embeddingSchema = z.strictObject({
  space: z.string().min(1), vector: z.array(z.number()).min(1).max(65536),
}).refine(value => value.vector.some(component => component !== 0), 'Embedding must be nonzero')
const memorySchema = memoryInputSchema.extend({ id: memoryId, lifeId, createdAt: timestamp, updatedAt: timestamp,
  embedding: embeddingSchema.optional() })
const capabilitySchema = z.strictObject({
  id: capabilityId, declarationHash: z.string(), firstSeenAt: timestamp, changedAt: timestamp,
  available: z.boolean(), permission: z.literal('checked-at-execution'),
  verification: z.enum(['unverified', 'succeeded', 'failed']),
})
const growthSchema = z.strictObject({
  id: growthId, lifeId, timestamp, category: z.literal('system'), title: z.string(), description: z.string(),
  relatedEventIds: z.array(eventId).min(1),
})
/** Complete atomic life snapshot. Unknown schema versions are refused, never reset. */
export const stateSchema = z.strictObject({
  schemaVersion: z.literal(1), identity: identitySchema,
  events: z.array(eventSchema), memories: z.array(memorySchema), growth: z.array(growthSchema),
  sessions: z.record(z.string(), z.array(capabilitySchema)),
}).superRefine((state, context) => {
  const ids = new Set<string>()
  const keys = new Set<string>()
  const reject = (message: string) => { context.addIssue({ code: 'custom', message }) }
  for (const event of state.events) {
    if (event.lifeId !== state.identity.id || ids.has(event.id) || keys.has(event.dedupKey)) reject('Invalid life event ownership or duplicate')
    ids.add(event.id)
    keys.add(event.dedupKey)
  }
  if (state.events.filter(event => event.type === 'life.created').length !== 1) reject('Exactly one birth event is required')
  const born = state.events.find(event => event.type === 'life.created')
  if (born?.timestamp !== state.identity.createdAt) reject('Birth timestamp differs from identity')
  for (const records of [state.memories, state.growth]) {
    const recordIds = new Set<string>()
    for (const record of records) {
      if (record.lifeId !== state.identity.id || recordIds.has(record.id)) reject('Invalid record ownership or duplicate')
      recordIds.add(record.id)
      const refs = 'sourceEventIds' in record ? record.sourceEventIds : record.relatedEventIds
      if (refs.some(id => !ids.has(id))) reject('Missing source event')
    }
  }
  for (const capabilities of Object.values(state.sessions)) {
    if (new Set(capabilities.map(capability => capability.id)).size !== capabilities.length) reject('Duplicate capability')
  }
})

/** Persistent single-writer domain; each replacement commits facts and state together. */
export const lifeDomain = defineDomain({
  name: 'genesis', version: 1,
  tables: { states: domainTable<'life', z.infer<typeof stateSchema>>(stateSchema) },
})
/** Persisted identity restored before any Agent is bound. */
export type LifeIdentity = z.infer<typeof identitySchema>
/** Durable, deduplicated fact with explicit attribution. */
export type LifeEvent = z.infer<typeof eventSchema>
/** Sourced memory; confidence does not establish factual truth. */
export type LifeMemory = z.infer<typeof memorySchema>
/** Memory creation fields supplied by a caller. */
export type MemoryInput = z.infer<typeof memoryInputSchema>
/** Persisted vector cache; it can be rebuilt from the local memory text. */
export type MemoryEmbedding = z.infer<typeof embeddingSchema>
/** Capability availability belongs to its Session scope; permission is evaluated on execution. */
export type CapabilityState = z.infer<typeof capabilitySchema>
/** Persistent system growth linked to life facts. */
export type GrowthRecord = z.infer<typeof growthSchema>
/** Atomic persistent state including the most recently observed Session tool views. */
export type LifeState = z.infer<typeof stateSchema>
