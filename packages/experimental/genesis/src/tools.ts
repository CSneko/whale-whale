/** Native Genesis tools keep outputs in the normal durable tool pipeline. @module */
import type { SessionEvent, SessionId } from '@deepseek-ai/dsh-session'
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { z } from 'zod'
import type { Config } from './config.ts'
import { GenesisError } from './error.ts'
import type { LifeCore } from './core.ts'

/**
 * Register query and explicitly sourced candidate-memory tools in the mounting scope.
 * @param ctx - Owning scope; registrations are reversible effects of this plugin.
 * @param core - Ready persistent life owner.
 * @param config - Complete output and retrieval bounds.
 * @param userEvidence - Latest actual user message observed since plugin activation.
 */
export function registerTools(ctx: Context, core: LifeCore, config: Config,
  userEvidence: (sessionId: SessionId) => SessionEvent<'user/message'> | undefined): void {
  const output = {
    schema: { type: 'json' } as const,
    render: (_args: unknown, value: z.core.util.JSONType) => [{ type: 'text' as const, text: JSON.stringify(value) }],
  }
  const bounded = (value: unknown) => {
    const json = z.json().parse(value)
    if (JSON.stringify(json).length <= config.resultChars) return json
    return { omitted: true, code: 'result-budget', message: 'Result exceeds the configured character budget. Narrow the query or increase resultChars.' }
  }
  ctx.tools.register(defineTool({
    name: 'genesis_self',
    description: 'Query the persistent life identity, actual Session tool availability, recent life events and system growth. Visibility is not authorization or proof of successful use.',
    parameters: {}, output,
    async execute(_args, exec) {
      exec.signal.throwIfAborted()
      const agent = exec.agent
      if (agent === undefined) throw new GenesisError('invalid-source', 'Genesis requires a calling Agent.')
      await core.scan(agent.session.id, ctx.tools.schemas(agent))
      const state = await core.snapshot()
      return bounded({ identity: state.identity,
        environment: { platform: process.platform, arch: process.arch, node: process.versions.node },
        capabilities: state.sessions[agent.session.id] ?? [],
        recentEvents: state.events.slice(-config.queryLimit), growth: state.growth.slice(-config.queryLimit),
        limitations: ['No emotion, motivation, autonomous awakening or self-improvement system.',
          'Installed/disabled plugins and package versions are unknown. Permission is checked at execution.'] })
    },
    presentCall: () => ({ card: 'generic', title: 'Genesis', kind: 'read' }),
  }))
  ctx.tools.register(defineTool({
    name: 'genesis_recall',
    description: 'Search persistent sourced candidate memories across Sessions. Empty query lists important recent memories; source event ids allow evidence inspection.',
    parameters: { query: { type: 'string', required: true },
      category: { type: 'string', enum: ['episodic', 'semantic', 'self', 'procedural'] } }, output,
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      return bounded(await core.retrieve({ text: args.query, ...(args.category === undefined ? {} : { category: args.category }),
        limit: config.queryLimit, chars: config.resultChars - 2 }))
    },
    presentCall: args => ({ card: 'generic', title: 'Genesis', kind: 'search', rawInput: args.query }),
  }))
  ctx.tools.register(defineTool({
    name: 'genesis_history', description: 'Query persisted life facts by type and ISO time, or system growth records. Old capabilities remain in history after removal.',
    parameters: { kind: { type: 'string', required: true, enum: ['events', 'growth'] },
      type: { type: 'string' }, after: { type: 'string' }, before: { type: 'string' } }, output,
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      if (args.kind === 'growth') {
        return bounded((await core.snapshot()).growth.filter(record =>
          (args.after === undefined || record.timestamp >= args.after)
          && (args.before === undefined || record.timestamp <= args.before)).slice(-config.queryLimit))
      }
      return bounded(await core.events({ limit: config.queryLimit,
        ...(args.type === undefined ? {} : { type: args.type }),
        ...(args.after === undefined ? {} : { after: args.after }),
        ...(args.before === undefined ? {} : { before: args.before }) }))
    },
    presentCall: () => ({ card: 'generic', title: 'Genesis', kind: 'read' }),
  }))
  ctx.tools.register(defineTool({
    name: 'genesis_remember',
    description: 'Save a candidate memory only when the user explicitly asks to remember it. Evidence is taken from the latest matching user message in this Session. Content must occur verbatim in that message. This does not establish truth or change identity or capabilities.',
    parameters: {
      content: { type: 'string', required: true }, source_seq: { type: 'integer' },
      category: { type: 'string', required: true, enum: ['episodic', 'semantic', 'self', 'procedural'] },
      importance: { type: 'number', required: true }, confidence: { type: 'number', required: true },
    }, output,
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      const agent = exec.agent
      if (agent === undefined) throw new GenesisError('invalid-source', 'Genesis requires a calling Agent.')
      const source = userEvidence(agent.session.id)
      if (source === undefined || source.data.source.kind !== 'user'
        || (args.source_seq !== undefined && source.seq !== args.source_seq)
        || !source.data.content.some(block => block.type === 'text' && block.text.includes(args.content.trim()))) {
        throw new GenesisError('invalid-source', 'Memory needs verbatim content from an actual user message in this Session.')
      }
      const event = await core.observe({ sessionId: agent.session.id, eventId: String(source.seq),
        timestamp: new Date(source.time).toISOString(), kind: 'user-message' })
      exec.signal.throwIfAborted()
      const memory = await core.remember({ content: args.content, category: args.category, importance: args.importance,
        confidence: args.confidence, sourceEventIds: [event.id] })
      return bounded({ memory, status: 'candidate', source: { sessionId: agent.session.id, seq: source.seq } })
    },
    presentCall: args => ({ card: 'generic', title: 'Genesis', kind: 'edit', rawInput: args.content }),
  }))
}
