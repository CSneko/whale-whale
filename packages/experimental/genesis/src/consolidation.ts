/** Owned quiet-memory maintenance; timers, resumed Sessions and inference drain before teardown. @module */
import type { Context } from '@deepseek-ai/cordis'
import type { AgentHandle } from '@deepseek-ai/dsh-agent'
import type { LifeCore } from './core.ts'
import type { LifeMemoryEngine } from './memory.ts'
import type { MemoryConfig } from './config.ts'
import { GenesisError } from './error.ts'
import { statusFailure } from './status-error.ts'

/** One bounded idle worker; it never generates chat messages, reminders or external actions. */
export class MemoryConsolidator {
  private timer: ReturnType<typeof setTimeout> | undefined
  private readonly lifetime = new AbortController()
  private active: AbortController | undefined
  private running: Promise<boolean> | undefined
  private idleSince = Date.now()
  private generation = 0

  /** @param ctx - Timer and resumed-Agent owner. @param core - Durable work owner.
   * @param engine - Serialized, audited writer. @param config - Resolved idle and retry budgets. */
  constructor(private readonly ctx: Context, private readonly core: LifeCore,
    private readonly engine: LifeMemoryEngine, private readonly config: MemoryConfig) {}

  /** Reset the quiet interval on user activity; cancellation retains pending work. */
  activity(): void {
    this.idleSince = Date.now()
    this.generation++
    this.clearTimer()
    this.active?.abort()
  }

  /** Reconsider pending work after startup, idle transitions, edits or preference changes. */
  kick(): void {
    if (this.lifetime.signal.aborted) return
    this.clearTimer()
    const generation = ++this.generation
    void this.arm(generation).catch((error: unknown) => {
      if (!this.lifetime.signal.aborted) this.ctx.logger.error(`Genesis maintenance scheduling failed: ${statusFailure(error).message}`)
    })
  }

  private async arm(generation: number): Promise<void> {
    const state = await this.core.snapshot()
    if (generation !== this.generation || this.lifetime.signal.aborted || this.running !== undefined) return
    const work = state.consolidation
    const policy = this.config.consolidation
    if (work === undefined || work.completed >= work.revision || !(work.enabled ?? policy.enabled)
      || work.failures >= policy.maxFailures || this.ctx.agents.list().some(agent => agent.status === 'running')) return
    const due = Math.max(this.idleSince + policy.idleMs, Date.parse(work.requestedAt) + policy.idleMs,
      work.lastRunAt === undefined ? 0 : Date.parse(work.lastRunAt) + policy.cooldownMs,
      work.failure === undefined || work.lastAttemptAt === undefined ? 0 : Date.parse(work.lastAttemptAt) + policy.retryMs)
    this.timer = setTimeout(() => {
      this.timer = undefined
      const operation = this.ctx.agents.withoutInitiator(() => this.execute())
      void operation.catch((error: unknown) => {
        if (!this.lifetime.signal.aborted && !this.active?.signal.aborted) this.ctx.logger.warn(`Genesis idle consolidation failed: ${statusFailure(error).message}`)
      })
    }, Math.max(0, due - Date.now()))
    this.timer.unref()
  }

  /**
   * Run one operator-requested pass, bypassing idle delay while refusing an active conversation.
   * @param signal - Operator cancellation.
   * @returns Whether a pending revision committed; no chat reply is created.
   */
  async run(signal: AbortSignal): Promise<boolean> {
    signal.throwIfAborted()
    if (this.ctx.agents.list().some(agent => agent.status === 'running')) {
      throw new GenesisError('invalid-state', 'A conversation is running. Wait until it completes before consolidating memories.')
    }
    if (this.running !== undefined) return this.running
    await this.core.requestConsolidation()
    this.clearTimer()
    return this.execute(signal)
  }

  private execute(caller?: AbortSignal): Promise<boolean> {
    if (this.running !== undefined) return this.running
    const owned = new AbortController()
    this.active = owned
    const signal = AbortSignal.any([owned.signal, this.lifetime.signal, ...(caller === undefined ? [] : [caller])])
    const operation = this.perform(signal)
    this.running = operation
    const release = () => { this.running = undefined; this.active = undefined; this.kick() }
    void operation.then(release, release)
    return operation
  }

  private async perform(signal: AbortSignal): Promise<boolean> {
    signal.throwIfAborted()
    const state = await this.core.snapshot()
    const work = state.consolidation
    if (work === undefined || work.completed >= work.revision) return false
    let resumed: AgentHandle | undefined
    let inference = false
    try {
      if (this.ctx.agents.list().some(agent => agent.status === 'running')) return false
      if (work.sessionId === undefined) throw new GenesisError('invalid-source', 'Pending consolidation has no source conversation for its model-call audit.')
      const sessionId = work.sessionId
      let agent = this.ctx.agents.get(sessionId)
      if (agent === undefined) {
        resumed = await this.ctx.agents.withoutInitiator(() => this.ctx.agents.resume({ resumeSessionId: sessionId, signal }))
        agent = resumed.agent
      }
      signal.throwIfAborted()
      if (this.ctx.agents.list().some(item => item.status === 'running')) return false
      inference = true
      return await this.engine.consolidate(agent.session, signal)
    } catch (error) {
      signal.throwIfAborted()
      if (!inference) {
        const safe = statusFailure(error)
        await this.core.failConsolidation(work.revision, { stage: 'evidence', code: safe.code, message: safe.message })
      }
      throw error
    } finally { await resumed?.dispose() }
  }

  private clearTimer(): void {
    if (this.timer !== undefined) clearTimeout(this.timer)
    this.timer = undefined
  }

  /**
   * Stop timers and inference, then drain any admitted commit and privately resumed Agent.
   * @returns After owned work settles; the engine and life core may then close.
   */
  async close(): Promise<void> {
    this.generation++
    this.lifetime.abort()
    this.clearTimer()
    await Promise.allSettled(this.running === undefined ? [] : [this.running])
  }
}
