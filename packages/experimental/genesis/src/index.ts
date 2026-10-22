/** Optional Genesis Phase 1 Cordis integration; no changes to the Agent Loop. @module */
import type { Context } from '@deepseek-ai/cordis'
import type { SessionEvent, SessionId } from '@deepseek-ai/dsh-session'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { Config } from './config.ts'
import { LifeCore } from './core.ts'
import { GUIDANCE, selfContext } from './context.ts'
import { lifeDomain } from './model.ts'
import { GenesisError } from './error.ts'
import { acquireLease } from './lease.ts'
import { GenesisStatusGateway } from './status.ts'
import { registerTools } from './tools.ts'

export { Config } from './config.ts'
export { GenesisStatusGateway } from './status.ts'
export type { LifeStatus } from './status-types.ts'
export { LifeCore } from './core.ts'
export { GenesisError } from './error.ts'
export type * from './model.ts'
export type { EventQuery, MemoryQuery, ObservedInteraction } from './core.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** One persistent life shared by all Sessions in this composition. */
    genesis: LifeCore
  }
}
/** Loader plugin identifier. */
export const name = 'experimental-genesis'
/** Storage, scoped tools, prompts and real lifecycle owners must already exist. */
export const inject = ['storageDomain', 'tools', 'systemPrompt', 'agents']

/**
 * Acquire exclusive life storage, restore identity and mount reversible contributions.
 * @param ctx - Cordis effect owner.
 * @param config - Validated deployment and context limits.
 * @returns After the life is restored and every registration is available.
 */
export async function apply(ctx: Context, config: Config): Promise<void> {
  const release = await acquireLease(config.leasePath)
  let core: LifeCore
  try {
    const domain = await ctx.storageDomain.open(lifeDomain)
    core = new LifeCore(domain, config)
    try {
      await core.start()
    } catch (error) {
      await domain.close()
      throw error
    }
  } catch (error) {
    await release()
    throw error
  }
  ctx.effect(() => async () => {
    try { await core.close() } finally { await release() }
  })
  ctx.provide('genesis', core)
  await ctx.plugin(GenesisStatusGateway, config)
  const contexts = new Map<object, string>()
  const refresh = async (agent: Agent, query: string) => {
    await core.scan(agent.session.id, ctx.tools.schemas(agent))
    contexts.set(agent, await selfContext(core, agent, query, config))
  }
  const userEvidence = new Map<SessionId, SessionEvent<'user/message'>>()
  const calls = new Map<SessionId, Map<string, string>>()
  registerTools(ctx, core, config, id => userEvidence.get(id))
  ctx.systemPrompt.section({ name: 'genesis:guidance', order: 650, text: GUIDANCE, interpolate: false })
  ctx.systemPrompt.context({ name: 'genesis:self', order: 130, interpolate: false,
    text: ({ scope }) => scope === undefined ? '' : contexts.get(scope) ?? '' })
  ctx.on('agent/created', async ({ agent, source }) => {
    await core.bind(agent.session.id, source)
    await refresh(agent, '')
  }, { global: true })
  ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
    const assembled = await next()
    if (context.agent !== undefined) {
      await refresh(context.agent, '')
      const section = assembled.contexts.find(candidate => candidate.name === 'genesis:self')
      if (section !== undefined) section.text = contexts.get(context.agent) ?? ''
    }
    return assembled
  }, { global: true })
  ctx.on('agent/pre-step', async ({ agent, messages }, next) => {
    await refresh(agent, messages.flatMap(message => message.content)
      .filter(block => block.type === 'text').map(block => block.text).join(' '))
    return next()
  }, { global: true })
  ctx.on('agent/disposed', ({ agent }) => {
    contexts.delete(agent)
    userEvidence.delete(agent.session.id)
    calls.delete(agent.session.id)
  }, { global: true })
  ctx.on('session/event', (session, event) => {
    if (event.type === 'tool/call') {
      const pending = calls.get(session.id) ?? new Map<string, string>()
      pending.set(event.data.callId, event.data.name)
      calls.set(session.id, pending)
      return
    }
    if (event.type !== 'user/message' && event.type !== 'tool/result') return
    if (event.type === 'user/message' && event.data.source.kind !== 'user') return
    if (event.type === 'user/message') userEvidence.set(session.id, event)
    // Life facts never emit Session events; live evidence is bounded to the latest user and pending calls.
    const toolName = event.type === 'tool/result' ? calls.get(session.id)?.get(event.data.message.toolCallId) : undefined
    if (event.type === 'tool/result') calls.get(session.id)?.delete(event.data.message.toolCallId)
    const observation = event.type === 'user/message'
      ? { sessionId: session.id, eventId: String(event.seq), timestamp: new Date(event.time).toISOString(), kind: 'user-message' as const }
      : { sessionId: session.id, eventId: String(event.seq), timestamp: new Date(event.time).toISOString(), kind: 'tool-result' as const,
        ...(toolName === undefined ? {} : { tool: toolName }), success: !event.data.message.isError }
    void core.observe(observation).catch((error: unknown) => {
      ctx.logger.error(`Genesis observation failed; dependent Genesis operations may be unavailable. Inspect storage and capacity before retrying. ${error instanceof GenesisError ? error.code : 'unexpected-error'}`)
    })
  }, { global: true })
  for (const agent of ctx.agents.list()) {
    await core.bind(agent.session.id, 'plugin-enabled')
    await refresh(agent, '')
  }
}
