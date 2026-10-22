/** Read-only status business service, exported through the existing authenticated Gateway. @module */
import { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { LifeStatus } from './status-types.ts'
import type { Config } from './config.ts'
import { GenesisError } from './error.ts'

declare module '@deepseek-ai/cordis' {
  interface Context { genesisStatus: GenesisStatusGateway }
}

/** Read current Genesis state without exposing a remote identity or permission writer. */
export class GenesisStatusGateway extends TypertRemoteService {
  static inject = ['genesis', 'agents', 'tools']

  /**
   * @param ctx - Life state and real Agent registry.
   * @param config - Resolved projection limits.
   */
  constructor(ctx: Context, private readonly config: Config) { super(ctx, 'genesisStatus') }

  /**
   * Sample live tools, identity, counts and bounded memory/growth previews.
   * Historical scopes are excluded from current availability. Errors reject;
   * callers keep their previous sample visibly stale and offer retry.
   * @param signal - Caller cancellation; already-started life writes retain their durability semantics.
   * @returns A bounded detached status sample with explicit omission counts.
   */
  @Remote('inspect')
  async inspect(signal: AbortSignal): Promise<LifeStatus> {
    signal.throwIfAborted()
    const agents = this.ctx.agents.list()
    for (const agent of agents) {
      signal.throwIfAborted()
      await this.ctx.genesis.scan(agent.session.id, this.ctx.tools.schemas(agent))
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
    admit(result.memories, state.memories.slice().sort((a, b) => b.importance - a.importance), 'memories')
    admit(result.growth, state.growth.slice().reverse(), 'growth')
    admit(result.capabilities, capabilities, 'capabilities')
    if (JSON.stringify(result).length > this.config.resultChars) {
      throw new GenesisError('capacity', 'Genesis status exceeds resultChars. Increase the response budget before querying status.')
    }
    return result
  }
}
