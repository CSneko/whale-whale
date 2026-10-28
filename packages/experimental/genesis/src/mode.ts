/** Keep ordinary presets outside Life tools, including PTC schemas and direct execution. @module */
import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'

/**
 * Mount reversible tool restrictions and remove them when a blank session changes mode.
 * @param ctx - Genesis contribution owner.
 * @param participates - Whether the Agent belongs to the life integration.
 */
export function installModeIsolation(ctx: Context, participates: (agent: Agent | undefined) => boolean): void {
  const owned = (name: string) => name === 'learn' || name.startsWith('genesis_')
  const restrictions = new Map<Agent, { dispose: () => void; names: string }>()
  const sync = (agent: Agent) => {
    const previous = restrictions.get(agent)
    const names = participates(agent) ? [] : ctx.tools.schemas().map(tool => tool.name).filter(owned)
    const key = JSON.stringify(names)
    if (previous?.names === key) return
    previous?.dispose()
    restrictions.delete(agent)
    if (names.length) restrictions.set(agent, { dispose: agent.ctx.tools.restrict({ deny: names }), names: key })
  }
  ctx.tools.guard(exec => owned(exec.name) && !participates(exec.agent)
    ? 'Life tools are unavailable in this mode.' : undefined)
  ctx.on('agent/created', ({ agent }) => { sync(agent) }, { global: true })
  ctx.on('agent/disposed', ({ agent }) => { restrictions.get(agent)?.dispose(); restrictions.delete(agent) }, { global: true })
  ctx.on('system-prompt/assemble', (_assembly, context, next) => {
    if (context.agent !== undefined) sync(context.agent)
    return next()
  }, { global: true })
  ctx.on('agent-preset/selected', (id) => {
    const agent = ctx.agents.get(id)
    if (agent !== undefined) sync(agent)
  }, { global: true })
  ctx.effect(() => () => { for (const { dispose } of restrictions.values()) dispose(); restrictions.clear() })
  for (const agent of ctx.agents.list()) sync(agent)
}
