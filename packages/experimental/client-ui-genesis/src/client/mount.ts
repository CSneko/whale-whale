/** Optional generated Remote and Settings registration with shared resources. @module */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-experimental-genesis/remote'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-resources/client'
import type { LifeStatus } from '@deepseek-ai/dsh-experimental-genesis/types'
import type { TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import { StatusResource } from './resource.ts'
import { StatusPanel } from './StatusPanel.tsx'
import { Awakening } from './Awakening.tsx'
import { en, zh, type GenesisKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { genesis: GenesisKey }
  interface ResourceProtocolMap { genesis: LifeStatus }
}

/** Required infrastructure, with no stable product import of the experimental namespace. */
export const inject = ['remote', 'slots', 'locale', 'resources']

/**
 * Mount Genesis status, credential-first naming and their shared resource.
 * @param ctx - Browser lifetime owner.
 * @param contribution - Generated Remote definitions from the owning Host package.
 * @returns Disposer awaiting UI withdrawal before Remote removal.
 */
export async function mountStatus(ctx: Context, contribution: TypertRemoteContribution): Promise<() => Promise<void>> {
  const unmount = await ctx.remote.$mount(contribution)
  const ui = ctx.inject(['remote.genesisStatus', 'slots', 'locale', 'resources'], (scope) => {
    scope.effect(() => scope.locale.register('genesis', { en, zh }))
    const resource = new StatusResource()
    scope.effect(() => scope.resources.register<'genesis'>({ protocol: 'genesis',
      open: (_address, { signal }) => resource.open(callerSignal => scope.remote.genesisStatus.inspect(callerSignal), signal),
    }))
    scope.on('connection/reset', () => { resource.refresh() })
    scope.effect(() => {
      const refresh = () => { resource.refresh() }
      const dispose = [
        scope.remote.$on('settings/document-updated', refresh),
        scope.remote.$on('credentials/record-updated', refresh),
        scope.remote.$on('credentials/reference-updated', refresh),
        scope.remote.$on('llm/adapters-updated', refresh),
      ]
      return () => { for (const remove of dispose) remove() }
    })
    const actions = () => ({ refresh: () => { resource.refresh() },
      initialize: async (name: string, signal: AbortSignal) => {
        const result = await scope.remote.genesisStatus.initialize(name, signal)
        resource.refresh()
        return result.ok
      },
    })
    scope.slots.inject('settings.general.item', () => scope.slots.register({
      name: 'settings.general.item', id: 'genesis', order: 110, locale: 'genesis', inject: actions,
    }, StatusPanel))
    scope.slots.inject('settings.onboarding', () => scope.slots.register({
      name: 'settings.onboarding', id: 'genesis-awakening', order: 20, locale: 'genesis', inject: actions,
    }, Awakening))
  })
  try { await ui } catch (error) { await ui.dispose(); await unmount(); throw error }
  return async () => { await ui.dispose(); await unmount() }
}
