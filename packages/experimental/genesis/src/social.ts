/** Small life-wide proactive conversation worker using the existing deliberation and Agent channel. @module */
import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { SessionId, type Session } from '@deepseek-ai/dsh-session'
import { createUserMessage, type UserMessage } from '@deepseek-ai/dsh-llm'
import type { LifeCore } from './core.ts'
import type { LifeDeliberationEngine } from './deliberation.ts'
import type { SocialInitiativeConfig } from './config.ts'
import type { LifeEvent, LifeEventId, LifeState } from './model.ts'
import type { InteractionRecord } from './social-state.ts'
import { statusFailure } from './status-error.ts'

/** One serialized, cancelable owner; pending delivery never implies successful delivery. */
export class SocialInitiative {
  private tail: Promise<void> = Promise.resolve()
  private readonly lifetime = new AbortController()
  private timer: ReturnType<typeof setTimeout> | undefined
  private unsubscribe: (() => void) | undefined

  /** @param ctx - Actual channel and Session projections. @param core - Durable life owner.
   * @param decisions - Existing bounded emotion/motivation/memory deliberation.
   * @param policy - Validated delivery limits. @param applies - Character preset selection. */
  constructor(private readonly ctx: Context, private readonly core: LifeCore, private readonly decisions: LifeDeliberationEngine,
    private readonly policy: SocialInitiativeConfig, private readonly applies: (agent: Agent) => boolean) {}

  /** @returns After durable initialization and subscription; no immediate unsolicited message is forced. */
  async start(): Promise<void> {
    await this.core.initializeInitiative()
    this.unsubscribe = this.core.onCommitted(events => {
      const relevant = events.filter(event => ['goal.completed', 'goal.changed', 'memory.created', 'memory.updated'].includes(event.type))
      if (relevant.length) this.background(this.checkEvents(relevant))
    })
    this.arm()
  }

  private arm(): void {
    if (this.lifetime.signal.aborted) return
    this.timer = setTimeout(() => {
      this.timer = undefined
      this.background(this.tick().finally(() => this.arm()))
    }, this.policy.intervalMs)
    this.timer.unref()
  }

  private background(operation: Promise<unknown>): void {
    void operation.catch((error: unknown) => {
      if (!this.lifetime.signal.aborted) this.ctx.logger.warn(`Genesis social initiative paused or pending: ${statusFailure(error).message}`)
    })
  }

  private serial<T>(run: () => Promise<T>): Promise<T> {
    const operation = this.tail.then(() => { this.lifetime.signal.throwIfAborted(); return run() })
    this.tail = operation.then(() => {}, (_error: unknown) => { /* Caller or background reporter owns the failure. */ })
    return operation
  }

  /**
   * Give a timer or trusted life event exactly one speak-or-wait opportunity.
   * @param request - Stable deduplication key and actual life evidence.
   * @param signal - Optional caller cancellation; absent uses the plugin lifetime.
   * @returns Durable outcome, including pending when there is no usable channel.
   */
  considerInteraction(request: { key: string; sourceEventId: LifeEventId }, signal?: AbortSignal): Promise<InteractionRecord> {
    return this.serial(async () => {
      const owned = AbortSignal.any([this.lifetime.signal, ...(signal === undefined ? [] : [signal])])
      owned.throwIfAborted()
      const record = await this.core.requestInteraction(request.key, request.sourceEventId)
      return this.process(record, owned)
    })
  }

  /** One scheduled wake; the persisted bucket also deduplicates restarts within the interval.
   * @returns After event catch-up and one scheduled opportunity. */
  async tick(): Promise<void> {
    const state = await this.core.snapshot()
    const start = state.events.findIndex(event => event.type === 'initiative.initialized')
    await this.checkEvents(state.events.slice(start + 1))
    await this.resume()
    // A timer may reconsider grounded life evidence, but never its own request,
    // decision or delivery records; those would turn silence into a feedback loop.
    const source = [...state.events].reverse().find(event => event.type === 'goal.completed'
      || event.type === 'memory.created' || event.type === 'memory.updated'
      || event.source === 'user' && event.payload['kind'] === 'user-message')
    if (source !== undefined) await this.considerInteraction({ key: `timer:${Math.floor(Date.now() / this.policy.intervalMs)}`, sourceEventId: source.id })
  }

  private async checkEvents(events: readonly LifeEvent[]): Promise<void> {
    const state = await this.core.snapshot()
    for (const event of events) {
      const memory = state.memories.find(item => item.id === event.payload['memoryId'])
      const important = ['memory.created', 'memory.updated'].includes(event.type) && memory !== undefined
        && memory.importance >= this.policy.eventImportance
      const decision = state.agency?.decisions.find(item => item.id === event.payload['decisionId'])
      const proposal = event.payload['after']
      const significantThought = event.type === 'goal.changed' && event.payload['previousStatus'] === null
        && decision?.purpose !== 'interaction' && typeof proposal === 'object' && proposal !== null
        && 'origin' in proposal && proposal.origin === 'autonomous'
      if (event.type === 'goal.completed' || important || significantThought) {
        await this.considerInteraction({ key: `event:${event.id}`, sourceEventId: event.id })
      }
    }
  }

  private channel(record: InteractionRecord, state: LifeState): Agent | undefined {
    const agents = this.ctx.agents.list().filter(agent => this.applies(agent) && agent.status === 'idle'
      && agent.inbox.nextTurn.length === 0 && agent.inbox.nextStep.length === 0)
    const target = record.sessionId ?? (this.policy.sessionId === undefined ? undefined : SessionId(this.policy.sessionId))
    if (target !== undefined) return agents.find(agent => agent.session.id === target)
    const latest = [...state.events].reverse().find(event => event.source === 'user' && event.payload['kind'] === 'user-message'
      && agents.some(agent => agent.session.id === event.relatedSessionId))
    return agents.find(agent => agent.session.id === latest?.relatedSessionId)
  }

  private limited(state: LifeState, record: InteractionRecord): string | undefined {
    const now = Date.now()
    const records = state.initiative?.records ?? []
    if (records.some(item => item.id !== record.id && item.status === 'dispatching')) return 'Another proactive delivery is awaiting confirmation.'
    const deliveries = records.filter(item => item.id !== record.id && (item.status === 'sent' || item.status === 'uncertain'))
    const times = deliveries.map(item => Date.parse(item.sentAt ?? item.dispatchedAt ?? item.createdAt))
    if (times.some(time => now - time < this.policy.minSendIntervalMs)) return 'Proactive message cooldown is active.'
    if (times.filter(time => now - time < 86400000).length >= this.policy.maxPer24Hours) return 'Rolling proactive message limit reached.'
    const user = [...state.events].reverse().find(event => event.source === 'user' && event.payload['kind'] === 'user-message')
    if (user !== undefined && now - Date.parse(user.timestamp) < this.policy.userIdleMs) return 'Wait for a quiet interval after user activity.'
    return undefined
  }

  private async process(record: InteractionRecord, signal: AbortSignal): Promise<InteractionRecord> {
    if (record.status !== 'pending') return record
    if (Date.now() - Date.parse(record.createdAt) >= this.policy.maxPendingAgeMs) {
      record = { ...record, status: 'skipped', note: 'The opportunity expired without a confirmed delivery.' }
    } else {
      const state = await this.core.snapshot()
      const agent = this.channel(record, state)
      if (agent === undefined) record = { ...record, note: 'No idle character conversation channel is available; not sent.' }
      else {
        if (record.decisionId === undefined) {
          const decision = await this.decisions.considerInteraction(agent, record.key, record.sourceEventId, signal)
          const wants = decision.candidates[decision.selected]?.disposition === 'accept'
          record = { ...record, decisionId: decision.id, sessionId: agent.session.id, reason: decision.reason,
            status: wants ? 'pending' : 'skipped', note: wants ? 'Genesis chose to communicate; delivery is pending.' : 'Genesis chose not to initiate a conversation.' }
          await this.core.saveInteraction(record)
        }
        if (record.status === 'pending') {
          const limit = this.limited(await this.core.snapshot(), record)
          if (limit !== undefined) record = { ...record, note: limit }
          else if (agent.status === 'idle' && agent.inbox.nextTurn.length === 0 && agent.inbox.nextStep.length === 0) {
            signal.throwIfAborted()
            record = { ...record, status: 'dispatching', dispatchedAt: new Date().toISOString(), note: 'Awaiting an actual assistant message in the conversation.' }
            await this.core.saveInteraction(record)
            // Reserve before enqueueing. A crash here is reconciled, never blindly resent.
            agent.followup(createUserMessage({ source: { kind: 'genesis-initiative', interactionId: record.id,
              form: 'notice', summary: 'Genesis chose to initiate a conversation' }, content: [{ type: 'text',
              text: `You chose to initiate a conversation. Your recorded decision is ${JSON.stringify(
                (await this.core.snapshot()).agency?.decisions.find(item => item.id === record.decisionId))}. Speak directly to the operator in your own voice about your chosen intent. This is your proactive assistant message, not a user request. Use no task tools. Do not invent discoveries, offline experiences or a need for the operator to respond; absence is not rejection.` }] }))
            return record
          }
        }
      }
    }
    await this.core.saveInteraction(record)
    return record
  }

  /**
   * Admit only an outstanding attributed notice, rechecking limits and giving real user input priority.
   * @param agent - Actual receiving conversation. @param messages - Proposed next-step inputs.
   * @returns Inputs with any unsafe, canceled or already-settled initiative removed.
   */
  async admit(agent: Agent, messages: UserMessage[]): Promise<UserMessage[]> {
    const result: UserMessage[] = []
    for (const message of messages) {
      if (message.source.kind !== 'genesis-initiative') { result.push(message); continue }
      const interactionId = message.source.interactionId
      const state = await this.core.snapshot()
      const record = state.initiative?.records.find(item => item.id === interactionId)
      if (record?.status !== 'dispatching' || record.sessionId !== agent.session.id || !this.applies(agent)) continue
      const limit = messages.some(item => item.source.kind === 'user') ? 'Real user input takes priority.' : this.limited(state, record)
      if (limit !== undefined) await this.core.saveInteraction({ ...record, status: 'pending', note: limit })
      else result.push(message)
    }
    return result
  }

  /**
   * Settle deliveries from the replayable receipt and retry only confirmed pending opportunities.
   * @returns After currently available channels have been reconciled and pending work considered.
   */
  resume(): Promise<void> {
    return this.serial(async () => {
      for (const agent of this.ctx.agents.list().filter(this.applies)) await this.reconcile(agent.session, agent)
      const records = (await this.core.snapshot()).initiative?.records ?? []
      for (const record of records) if (record.status === 'pending') await this.process(record, this.lifetime.signal)
    })
  }

  /**
   * Consume committed Session evidence; enqueueing or whole-Agent idle alone never marks success.
   * @param session - Session whose projection has already folded the actual event.
   */
  observe(session: Session): void { this.background(this.serial(() => this.reconcile(session))) }

  private async reconcile(session: Session, agent?: Agent): Promise<void> {
    const state = await this.core.snapshot()
    for (const record of state.initiative?.records ?? []) {
      if (record.status !== 'dispatching' || record.sessionId !== session.id) continue
      const projected = this.ctx.sessionProjections.stateOf(session, 'genesisInitiative')
      if (projected?.id === record.id && projected.receipt !== null) {
        const receipt = projected.receipt
        await this.core.saveInteraction({ ...record, status: receipt.interrupted ? 'uncertain' : 'sent',
          message: receipt.text, messageSeq: receipt.seq, ...(receipt.interrupted ? {} : { sentAt: receipt.timestamp }),
          note: receipt.interrupted ? 'An interrupted assistant prefix is visible; do not automatically resend.' : 'Confirmed assistant message committed to the Harness conversation.' })
        if (record.decisionId !== undefined) {
          const source = await this.core.observe({ sessionId: session.id, eventId: String(receipt.seq), timestamp: receipt.timestamp, kind: 'assistant-message' })
          await this.core.settleDecision(record.decisionId, receipt.interrupted ? 'interrupted' : 'responded', [source.id])
        }
      } else if ((projected?.id === record.id && projected.ended) || (agent !== undefined
        && ![...agent.inbox.nextTurn, ...agent.inbox.nextStep].some(message => message.source.kind === 'genesis-initiative'
          && message.source.interactionId === record.id) && agent.status === 'idle')) {
        await this.core.saveInteraction({ ...record, status: 'uncertain', note: 'No confirmed assistant receipt or queued notice. Inspect the Session before any manual retry.' })
        this.ctx.logger.warn('Genesis proactive delivery outcome is uncertain; automatic resend is disabled. Inspect the originating Session.')
      }
    }
  }

  /** @returns After timers stop and every accepted operation drains; queued notices require active plugin admission. */
  async close(): Promise<void> {
    this.lifetime.abort()
    if (this.timer !== undefined) clearTimeout(this.timer)
    this.unsubscribe?.()
    await this.tail
  }
}
