/** Atomic life state, sourced memory retrieval and observed system growth. @module */
import { randomUUID, createHash } from 'node:crypto'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { Domain } from '@deepseek-ai/dsh-storage-domain'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { ToolSchema } from '@deepseek-ai/dsh-llm'
import type { Config } from './config.ts'
import { GenesisError } from './error.ts'
import { lifeDomain, memoryInputSchema } from './model.ts'
import type { CapabilityId, GrowthId, LifeEvent, LifeEventId, LifeId, LifeMemory, LifeState, MemoryId, MemoryInput } from './model.ts'

/** Bounded event query, ordered by recorded time. */
export interface EventQuery {
  type?: string
  after?: string
  before?: string
  limit: number
}
/** Replaceable lexical retrieval request with explicit output bounds. */
export interface MemoryQuery {
  text: string
  category?: LifeMemory['category']
  after?: string
  before?: string
  limit: number
  chars: number
}
/** Real Session evidence; no message bodies or tool results are copied automatically. */
export interface ObservedInteraction {
  sessionId: SessionId
  eventId: string
  timestamp: string
  kind: 'user-message' | 'tool-result'
  tool?: string
  success?: boolean
}

function fact(state: LifeState, type: string, dedupKey: string, payload: LifeEvent['payload'],
  source: LifeEvent['source'] = 'system', sessionId?: string, relatedEventId?: string, at = new Date().toISOString()): LifeEvent {
  const previous = state.events.find(event => event.dedupKey === dedupKey)
  if (previous !== undefined) return previous
  const event: LifeEvent = {
    id: brandString<LifeEventId>(randomUUID()), lifeId: state.identity.id, type, timestamp: at,
    source, payload, dedupKey,
    ...(sessionId === undefined ? {} : { relatedSessionId: sessionId }),
    ...(relatedEventId === undefined ? {} : { relatedEventId }),
  }
  state.events.push(event)
  return event
}
function grow(state: LifeState, event: LifeEvent, title: string, description: string): void {
  fact(state, 'growth.recorded', `growth:${event.id}`, { relatedEventId: event.id, title })
  state.growth.push({ id: brandString<GrowthId>(randomUUID()), lifeId: state.identity.id,
    timestamp: event.timestamp, category: 'system', title, description, relatedEventIds: [event.id] })
}

/**
 * One life domain owner. Writes serialize and replace one snapshot, so facts and
 * state commit together. Storage failures poison this instance until reload;
 * validation and capacity refusals leave it usable. Returned data is detached.
 */
export class LifeCore {
  private chain: Promise<void> = Promise.resolve()
  private stopping = false
  private failure: GenesisError | undefined
  private closing: Promise<void> | undefined
  private initialized: Promise<void> | undefined

  /**
   * @param domain - Exclusively leased validated domain; ownership transfers to this core.
   * @param config - Resolved storage and response limits.
   */
  constructor(private readonly domain: Domain<typeof lifeDomain>, private readonly config: Config) {}

  /**
   * Initialize once or restore the same life; birth and initial memory commit atomically.
   * @returns Resolution only after durable startup.
   */
  start(): Promise<void> {
    this.initialized ??= this.initialize()
    return this.initialized
  }

  private async initialize(): Promise<void> {
    if (this.domain.table('states').size > 1
      || [...this.domain.table('states').keys()].some((key: string) => key !== 'life')) {
      throw new GenesisError('invalid-state', 'Genesis has unexpected state keys. Restore a verified backup before restarting.')
    }
    const existing = this.domain.table('states').get('life')
    if (existing === undefined) {
      const now = new Date().toISOString()
      const state: LifeState = {
        schemaVersion: 1,
        identity: { id: brandString<LifeId>(randomUUID()), name: null, createdAt: now, updatedAt: now,
          lifeCoreVersion: '0.1.0-alpha.1', origin: { framework: 'DeepSeek Harness', initialVersion: '0.1.0-alpha.1' } },
        events: [], memories: [], growth: [], sessions: {},
      }
      const born = fact(state, 'life.created', 'birth', {}, 'system', undefined, undefined, now)
      grow(state, born, 'Foundation initialized', 'Persistent identity, life facts, sourced lexical memory and runtime tool observation are enabled.')
      const initialMemoryId = brandString<MemoryId>(randomUUID())
      state.memories.push({ id: initialMemoryId, lifeId: state.identity.id, category: 'self',
        content: 'Persistent identity and sourced long-term memory are enabled. Emotion, motivation and autonomous awakening are not implemented.',
        importance: 1, confidence: 1, sourceEventIds: [born.id], createdAt: now, updatedAt: now })
      fact(state, 'memory.created', `initial-memory:${born.id}`, { memoryId: initialMemoryId })
      await this.persist(state)
    }
    await this.change((state) => { fact(state, 'life.started', `start:${randomUUID()}`, {}) })
  }

  /**
   * Read committed state after all previously accepted observations settle.
   * @returns Detached life snapshot; rejects when closed or storage is untrusted.
   */
  async snapshot(): Promise<LifeState> {
    await this.chain
    this.assertUsable()
    return structuredClone(this.state())
  }

  /**
   * Append an attributed fact once, identified by Session plus durable sequence.
   * @param observation - Actual Session event metadata, never a model assertion.
   * @returns Committed fact, including the original fact for duplicate delivery.
   */
  observe(observation: ObservedInteraction): Promise<LifeEvent> {
    return this.change((state) => {
      const key = `session:${observation.sessionId}:${observation.eventId}`
      const previous = state.events.find(event => event.dedupKey === key)
      if (previous !== undefined) return previous
      const event = fact(state, 'interaction.observed', key, {
        kind: observation.kind, ...(observation.tool === undefined ? {} : { tool: observation.tool }),
        ...(observation.success === undefined ? {} : { success: observation.success }),
      }, observation.kind === 'user-message' ? 'user' : 'tool', observation.sessionId,
      observation.eventId, observation.timestamp)
      if (observation.tool !== undefined) {
        const capability = state.sessions[observation.sessionId]?.find(item => item.id === observation.tool)
        if (capability !== undefined) {
          capability.verification = observation.success ? 'succeeded' : 'failed'
          capability.changedAt = event.timestamp
        }
      }
      return event
    })
  }

  /**
   * Bind an actual created or resumed Session to this life without changing identity.
   * @param sessionId - Harness Session identifier.
   * @param source - Actual Harness creation/resume source.
   * @returns After the binding fact commits; repeat bindings are idempotent.
   */
  bind(sessionId: SessionId, source: string): Promise<void> {
    return this.change((state) => {
      fact(state, 'interaction.observed', `binding:${sessionId}:${source}`, { kind: 'session-bound', source }, 'system', sessionId)
    })
  }

  /**
   * Compare real visible tool declarations in one Session scope. Permission
   * remains execution-time policy; declaration changes do not imply tested skill.
   * @param sessionId - Scope whose previous observation is compared.
   * @param tools - Current registry projection after scope restrictions.
   * @returns After changed capabilities and their growth history commit together.
   */
  scan(sessionId: SessionId, tools: readonly ToolSchema[]): Promise<void> {
    return this.change((state) => {
      const previous = Object.hasOwn(state.sessions, sessionId) ? state.sessions[sessionId] ?? [] : []
      const visible = new Map(tools.map(tool => [brandString<CapabilityId>(tool.name),
        createHash('sha256').update(JSON.stringify(tool)).digest('hex')]))
      const now = new Date().toISOString()
      for (const [id, hash] of visible) {
        const old = previous.find(capability => capability.id === id)
        if (old !== undefined && old.available && old.declarationHash === hash) continue
        const known = Object.values(state.sessions).flat().find(capability => capability.id === id && capability.declarationHash === hash)
        if (old === undefined && known !== undefined) {
          previous.push({ ...known, available: true, changedAt: now, verification: 'unverified' })
          continue
        }
        const type = old === undefined ? 'capability.discovered' : !old.available ? 'capability.acquired' : 'capability.updated'
        const event = fact(state, type, `capability:${randomUUID()}`, {
          capabilityId: id, declarationHash: hash, available: true, verification: 'unverified',
          permission: 'checked-at-execution',
        }, 'system', sessionId)
        grow(state, event, `${id}: ${type}`, 'Observed callable declaration in this Session. Authorization is checked per call; successful use is recorded separately.')
        if (old === undefined) previous.push({ id, declarationHash: hash, firstSeenAt: now, changedAt: now,
          available: true, verification: 'unverified', permission: 'checked-at-execution' })
        else Object.assign(old, { declarationHash: hash, changedAt: now, available: true, verification: 'unverified' })
      }
      for (const old of previous) {
        if (!old.available || visible.has(old.id)) continue
        old.available = false
        old.changedAt = now
        const event = fact(state, 'capability.lost', `capability:${randomUUID()}`, { capabilityId: old.id, available: false }, 'system', sessionId)
        grow(state, event, `${old.id}: unavailable`, 'The tool is absent from this Session registry view; its historical use remains recorded.')
      }
      Object.defineProperty(state.sessions, sessionId, { value: previous, enumerable: true, writable: true, configurable: true })
    })
  }

  /**
   * Create a sourced memory. Caller interpretation remains a candidate, never an automatic fact.
   * @param input - Validated memory fields with existing life-event references.
   * @returns Newly committed memory.
   */
  remember(input: MemoryInput): Promise<LifeMemory> {
    const parsed = memoryInputSchema.parse(input)
    return this.change((state) => {
      this.checkSources(state, parsed.sourceEventIds)
      const previous = state.memories.find(memory => memory.content === parsed.content && memory.category === parsed.category
        && JSON.stringify(memory.sourceEventIds) === JSON.stringify(parsed.sourceEventIds))
      if (previous !== undefined) return previous
      const now = new Date().toISOString()
      const memory: LifeMemory = { ...parsed, id: brandString<MemoryId>(randomUUID()), lifeId: state.identity.id,
        createdAt: now, updatedAt: now }
      state.memories.push(memory)
      fact(state, 'memory.created', `memory:${memory.id}`, { memoryId: memory.id }, 'agent')
      return memory
    })
  }

  /**
   * Replace mutable memory fields, retaining identity and creation time.
   * @param id - Memory identifier.
   * @param input - Complete replacement and evidence.
   * @returns Committed replacement, or undefined if absent.
   */
  updateMemory(id: MemoryId, input: MemoryInput): Promise<LifeMemory | undefined> {
    const parsed = memoryInputSchema.parse(input)
    return this.change((state) => {
      this.checkSources(state, parsed.sourceEventIds)
      const index = state.memories.findIndex(memory => memory.id === id)
      const old = state.memories[index]
      if (old === undefined) return undefined
      const memory = { ...old, ...parsed, updatedAt: new Date().toISOString() }
      state.memories[index] = memory
      fact(state, 'memory.updated', `memory-update:${randomUUID()}`, { memoryId: id }, 'agent')
      return memory
    })
  }

  /**
   * Delete memory content while retaining an audit fact and its original sources.
   * @param id - Memory identifier.
   * @returns Whether a memory was durably removed.
   */
  deleteMemory(id: MemoryId): Promise<boolean> {
    return this.change((state) => {
      const index = state.memories.findIndex(memory => memory.id === id)
      if (index === -1) return false
      state.memories.splice(index, 1)
      fact(state, 'memory.deleted', `memory-delete:${randomUUID()}`, { memoryId: id }, 'agent')
      return true
    })
  }

  /**
   * Rename the life through an explicit application operation; immutable birth fields stay fixed.
   * @param name - Display name or null for unnamed.
   * @returns After identity and its history commit.
   */
  rename(name: string | null): Promise<void> {
    const parsed = memoryInputSchema.shape.content.nullable().parse(name)
    if (parsed !== null && parsed.length > 200) throw new GenesisError('invalid-state', 'Genesis name exceeds 200 characters.')
    return this.change((state) => {
      if (state.identity.name === parsed) return
      state.identity.name = parsed
      state.identity.updatedAt = new Date().toISOString()
      fact(state, 'identity.updated', `identity:${randomUUID()}`, { name: parsed }, 'user')
    })
  }

  /**
   * Read one committed memory without activating a Session.
   * @param id - Stable memory identifier.
   * @returns A detached memory or undefined if absent or deleted.
   */
  async getMemory(id: MemoryId): Promise<LifeMemory | undefined> {
    return (await this.snapshot()).memories.find(memory => memory.id === id)
  }

  /**
   * Retrieve lexical memories by category, time, importance and recency.
   * @param query - Explicit result and character bounds.
   * @returns Highest-ranked whole memories fitting both limits.
   */
  async retrieve(query: MemoryQuery): Promise<LifeMemory[]> {
    const state = await this.snapshot()
    const terms = [...new Set(query.text.toLowerCase().split(/\s+/u).filter(Boolean))]
    const score = (memory: LifeMemory) => {
      const matches = terms.filter(term => memory.content.toLowerCase().includes(term)).length
      const ageDays = Math.max(0, Date.now() - Date.parse(memory.updatedAt)) / 86_400_000
      return matches * 10 + memory.importance + 1 / (1 + ageDays)
    }
    let remaining = Math.max(0, query.chars)
    const result: LifeMemory[] = []
    for (const memory of state.memories.filter(memory =>
      (query.category === undefined || memory.category === query.category)
      && (query.after === undefined || memory.createdAt >= query.after)
      && (query.before === undefined || memory.createdAt <= query.before)
      && (terms.length === 0 || terms.some(term => memory.content.toLowerCase().includes(term))))
      .sort((a, b) => score(b) - score(a) || b.updatedAt.localeCompare(a.updatedAt))) {
      if (result.length >= Math.max(0, Math.min(query.limit, this.config.queryLimit))) break
      const chars = JSON.stringify(memory).length
      if (chars > remaining) continue
      result.push(memory)
      remaining -= chars
    }
    return result
  }

  /**
   * Query facts in chronological order, with optional type/time filters.
   * @param query - Bounded query.
   * @returns Detached facts, newest matching page retained in ascending order.
   */
  async events(query: EventQuery): Promise<LifeEvent[]> {
    const state = await this.snapshot()
    if (query.limit <= 0) return []
    return state.events.filter(event => (query.type === undefined || event.type === query.type)
      && (query.after === undefined || event.timestamp >= query.after)
      && (query.before === undefined || event.timestamp <= query.before))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .slice(-Math.max(1, Math.min(query.limit, this.config.queryLimit)))
  }

  /**
   * Stop admission, drain accepted observations, persist graceful stop and release the domain.
   * @returns Shared teardown promise. A stop-write failure rejects after releasing storage.
   */
  close(): Promise<void> {
    if (this.closing !== undefined) return this.closing
    this.stopping = true
    this.closing = this.chain.then(async () => {
      try {
        if (this.failure !== undefined) throw this.failure
        const state = structuredClone(this.state())
        fact(state, 'life.stopped', `stop:${randomUUID()}`, {})
        await this.persist(state)
      } finally {
        await this.domain.close()
      }
    })
    return this.closing
  }

  private state(): LifeState {
    const state = this.domain.table('states').get('life')
    if (state === undefined) throw new GenesisError('invalid-state', 'Genesis identity is absent. Stop dependent work and inspect storage.')
    return state
  }
  private assertUsable(): void {
    if (this.failure !== undefined) throw this.failure
    if (this.stopping) throw new GenesisError('closed', 'Genesis is stopping; no new operations are accepted.')
  }
  private checkSources(state: LifeState, sources: LifeEventId[]): void {
    if (sources.some(id => !state.events.some(event => event.id === id))) {
      throw new GenesisError('invalid-source', 'Memory source event is absent from this life.')
    }
  }
  private change<T>(operation: (state: LifeState) => T): Promise<T> {
    try { this.assertUsable() } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error('Genesis operation refused', { cause: error }))
    }
    const pending = this.chain.then(async () => {
      if (this.failure !== undefined) throw this.failure
      const state = structuredClone(this.state())
      const before = JSON.stringify(state)
      const result = operation(state)
      if (JSON.stringify(state) !== before) await this.persist(state)
      return structuredClone(result)
    })
    this.chain = pending.then(() => undefined, (_error: unknown) => {
      // The requesting caller owns the failure; the FIFO tail only tracks settlement.
    })
    return pending
  }
  private async persist(state: LifeState): Promise<void> {
    const count = state.events.length + state.memories.length + state.growth.length
      + Object.values(state.sessions).reduce((total, capabilities) => total + capabilities.length + 1, 0)
    if (count > this.config.maxRecords || JSON.stringify(state).length > this.config.maxStateChars) {
      throw new GenesisError('capacity', 'Genesis history reached its configured capacity. Increase the limit or export history before retrying; records were not discarded.')
    }
    try {
      await this.domain.table('states').put('life', state)
    } catch (error) {
      this.failure = new GenesisError('storage', 'Genesis persistence failed; state is untrusted. Stop dependent work, inspect storage and reload from verified data.', { cause: error })
      throw this.failure
    }
  }
}
