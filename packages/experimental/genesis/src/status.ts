/** Life status and one-time naming, exported through the existing authenticated Gateway. @module */
import { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { LifeStatus } from './status-types.ts'
import type { Config } from './config.ts'
import { GenesisError } from './error.ts'
import { memoryView } from './memory.ts'
import { MemoryEmbeddings } from './embedding.ts'
import { assertUsableApiKey } from '@deepseek-ai/dsh-llm'
import { LEARN_TOOL } from './awakening.ts'

declare module '@deepseek-ai/cordis' {
  interface Context { genesisStatus: GenesisStatusGateway }
}

/** Sample shared life state and initialize its name without changing its identity or permissions. */
export class GenesisStatusGateway extends TypertRemoteService {
  static inject = ['genesis', 'agents', 'tools', 'llm']
  private readonly lifetime = new AbortController()
  private readonly operations = new Set<Promise<unknown>>()

  /**
   * @param ctx - Life state and real Agent registry.
   * @param config - Resolved projection limits.
   */
  constructor(ctx: Context, private readonly config: Config) {
    super(ctx, 'genesisStatus')
    ctx.effect(() => async () => {
      this.lifetime.abort()
      await Promise.allSettled(this.operations)
    })
  }

  private async operation<T>(signal: AbortSignal, run: (owned: AbortSignal) => Promise<T>): Promise<T> {
    const owned = AbortSignal.any([signal, this.lifetime.signal])
    owned.throwIfAborted()
    const pending = run(owned)
    this.operations.add(pending)
    try { return await pending } finally { this.operations.delete(pending) }
  }

  private async prepare(signal: AbortSignal): Promise<void> {
    const { awakening, memory } = this.config
    if (awakening === undefined || memory === undefined) throw new GenesisError('invalid-state', 'Enable awakening with memory configuration first.')
    for (const route of [awakening,
      { provider: memory.decisionProvider, model: memory.decisionModel },
      { provider: memory.writerProvider, model: memory.writerModel }]) {
      signal.throwIfAborted()
      await this.ctx.llm.prepareCall(route, signal)
    }
    if (memory.embeddingKeyEnv !== undefined) {
      assertUsableApiKey(process.env[memory.embeddingKeyEnv] ?? '', 'Genesis embeddings', memory.embeddingKeyEnv)
    }
  }

  /**
   * Check configured chat/reviewer/writer routes and the embedding service, then name this existing life once.
   * Credentials use the existing provider settings or account sign-in; no secrets are accepted or stored here.
   * @param name - User-chosen name, retained across Sessions and restarts.
   * @param signal - Caller cancellation; an admitted storage commit may still finish after cancellation.
   * @returns After naming commits; errors leave initialization pending unless a storage write has uncertain outcome.
   */
  @Remote('initialize')
  async initialize(name: string, signal: AbortSignal): Promise<void> {
    return this.operation(signal, async (signal) => {
      const memory = this.config.memory
      if (memory === undefined) throw new GenesisError('invalid-state', 'Configure independent memory before initialization.')
      if (!name.trim() || name.trim().length > 200) throw new GenesisError('invalid-source', 'Choose a name of 1 to 200 characters.')
      const deadline = AbortSignal.any([signal, AbortSignal.timeout(memory.timeoutMs)])
      await this.prepare(deadline)
      await new MemoryEmbeddings(memory).embed('Memory initialization', deadline)
      deadline.throwIfAborted()
      await this.ctx.genesis.awaken(name)
    })
  }

  /**
   * Sample live tools, identity, counts and bounded memory/growth previews.
   * Historical scopes are excluded from current availability. Errors reject;
   * callers keep their previous sample visibly stale and offer retry.
   * @param signal - Caller cancellation; already-started life writes retain their durability semantics.
   * @returns A bounded detached status sample with explicit omission counts.
   */
  @Remote('inspect')
  async inspect(signal: AbortSignal): Promise<LifeStatus> {
    return this.operation(signal, async (signal) => {
      signal.throwIfAborted()
      const agents = this.ctx.agents.list()
      for (const agent of agents) {
        signal.throwIfAborted()
        const learned = this.config.awakening === undefined ? undefined : this.ctx.genesis.learningStatus().tools
        await this.ctx.genesis.scan(agent.session.id, this.ctx.tools.schemas(agent)
          .filter(tool => learned === undefined || tool.name === LEARN_TOOL || learned.includes(tool.name)))
      }
      const state = await this.ctx.genesis.snapshot()
      const capabilities = agents.flatMap(agent => (state.sessions[agent.session.id] ?? [])
        .filter(capability => capability.available).map(capability => ({ sessionId: agent.session.id, capability })))
      const result: LifeStatus = {
        identity: state.identity, sampledAt: new Date().toISOString(),
        runtime: { platform: process.platform, node: process.versions.node, liveSessions: agents.length },
        counts: { events: state.events.length, memories: state.memories.length, growth: state.growth.length },
        capabilities: [], memories: [], growth: [],
        omitted: { capabilities: capabilities.length, memories: state.memories.length, growth: state.growth.length },
      }
      if (this.config.awakening !== undefined) {
        const memory = this.config.memory
        if (memory === undefined) throw new GenesisError('invalid-state', 'Awakening requires independent memory configuration.')
        if (state.identity.name !== null) result.setup = { phase: 'ready' }
        else {
          try {
            await this.prepare(AbortSignal.any([signal, AbortSignal.timeout(memory.timeoutMs)]))
            result.setup = { phase: 'naming' }
          } catch {
            // Readiness failures contain provider/credential details; the UI receives only the recoverable setup phase.
            signal.throwIfAborted()
            result.setup = { phase: 'credentials' }
          }
        }
      }
      const admit = <T>(entries: T[], source: T[], kind: keyof LifeStatus['omitted']) => {
        for (const item of source.slice(0, this.config.queryLimit)) {
          entries.push(item)
          result.omitted[kind] -= 1
          if (JSON.stringify(result).length > this.config.resultChars) {
            entries.pop()
            result.omitted[kind] += 1
          }
        }
      }
      admit(result.memories, state.memories.slice().sort((a, b) => b.importance - a.importance).map(memoryView), 'memories')
      admit(result.growth, state.growth.slice().reverse(), 'growth')
      admit(result.capabilities, capabilities, 'capabilities')
      if (JSON.stringify(result).length > this.config.resultChars) {
        throw new GenesisError('capacity', 'Genesis status exceeds resultChars. Increase the response budget before querying status.')
      }
      return result
    })
  }
}
