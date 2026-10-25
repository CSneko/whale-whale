/** Persistent idle-memory controls and concrete maintenance failures. @module */
import { useEffect, useRef, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { LifeStatus } from '@deepseek-ai/dsh-experimental-genesis/types'
import type { MemoryActions } from './MemoryPanel.tsx'
import { operationFailure } from './operation-failure.ts'
import css from './StatusPanel.module.css'

/**
 * Show shared automatic-learning settings, progress and a cancellable explicit pass.
 * @param props - Durable status and authenticated maintenance actions.
 * @returns Controls retaining actual failure details and previous memory data.
 */
export function ConsolidationControls({ status, setConsolidation, consolidate, refresh, t }: PropsLocale<'genesis'> &
  Pick<MemoryActions, 'setConsolidation' | 'consolidate' | 'refresh'> & { status: NonNullable<LifeStatus['consolidation']> }) {
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<string>()
  const operation = useRef<AbortController>()
  useEffect(() => () => { operation.current?.abort() }, [])
  const run = (toggle: boolean) => {
    if (operation.current !== undefined) return
    const owned = new AbortController()
    operation.current = owned; setPending(true); setFailure(undefined)
    const result = toggle ? setConsolidation(!status.enabled, owned.signal) : consolidate(owned.signal)
    void result.then((reply) => {
      if (!owned.signal.aborted && !reply.ok) setFailure(operationFailure(reply.error, [], t('unknownError')))
    }).catch((error: unknown) => {
      if (!owned.signal.aborted) setFailure(operationFailure(error, [], t('unknownError')))
    }).finally(() => {
      if (!owned.signal.aborted) { operation.current = undefined; setPending(false); refresh() }
    })
  }
  return <section className={css.panel} aria-label={t('consolidationTitle')}>
    <h4>{t('consolidationTitle')}</h4>
    <p className={css.secondary}>{t('consolidationHint', { count: status.minHabitSupport })}</p>
    <div className={css.actions}>
      <Button variant="outline" size="sm" aria-pressed={status.enabled} disabled={pending} onClick={() => { run(true) }}>
        {t(status.enabled ? 'consolidationEnabled' : 'consolidationDisabled')}
      </Button>
      <Button variant="outline" size="sm" disabled={pending} onClick={() => { run(false) }}>{t(pending ? 'consolidating' : 'consolidateNow')}</Button>
    </div>
    <p role="status">{t(status.revision > status.completed ? 'consolidationQueued' : 'consolidationIdle')}</p>
    {status.lastRunAt === undefined ? null : <p>{t('consolidationLastRun', { count: status.changes ?? 0 })}
      {' '}<time dateTime={status.lastRunAt}>{new Date(status.lastRunAt).toLocaleString()}</time></p>}
    {status.failure === undefined ? null : <p role="alert">{t('consolidationFailure', {
      stage: t(`reviewStage.${status.failure.stage}`), reason: status.failure.message, count: status.failures, max: status.maxFailures,
    })}</p>}
    {failure === undefined ? null : <p role="alert">{t('memoryEditFailed', { reason: failure })}</p>}
  </section>
}
