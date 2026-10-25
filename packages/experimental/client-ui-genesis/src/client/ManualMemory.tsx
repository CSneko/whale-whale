/** Per-reply operator memory generation with explicit destination and retained diagnostics. @module */
import { useEffect, useRef, useState } from 'react'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { MessageId } from '@deepseek-ai/dsh-api-remotes/client'
import type { MemoryKind } from '@deepseek-ai/dsh-experimental-genesis/types'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import { operationFailure } from './operation-failure.ts'
import css from './StatusPanel.module.css'

/** One reply's authenticated operation; evidence comes from the Host projection. */
export interface ManualMemoryActions {
  generate(this: void, messageId: MessageId, kind: MemoryKind, signal: AbortSignal): Promise<RemoteResult<boolean>>
}

/**
 * Open a destination chooser for a completed assistant reply; generation does not send another chat message.
 * @param props - Durable reply identity, localized copy and cancellable generation.
 * @returns A compact action and a dismissible modal retaining its selected layer and error.
 */
export function ManualMemory({ messageId, generate, t }: PropsRuntime<'conversation.chat.assistant-actions'> &
  PropsLocale<'genesis'> & InjectFace<ManualMemoryActions>) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<MemoryKind>('declarative')
  const [pending, setPending] = useState(false)
  const [outcome, setOutcome] = useState<'manualSaved' | 'manualEmpty'>()
  const [failure, setFailure] = useState<string>()
  const operation = useRef<AbortController>()
  useEffect(() => () => { operation.current?.abort() }, [])
  return <>
    <Button size="sm" variant="ghost" onClick={() => { setOpen(true) }}>
      {t(pending ? 'manualPending' : failure !== undefined ? 'manualFailedLabel' : outcome === 'manualSaved' ? 'manualSaved' : 'manualMemory')}
    </Button>
    <Modal open={open} onClose={() => { setOpen(false) }} title={t('manualTitle')} closeLabel={t('close')}>
      <p>{t('manualDescription')}</p>
      <div className={css.actions}>
        {(['declarative', 'non-declarative'] as const).map(value => <Button key={value} variant="outline" disabled={pending}
          aria-pressed={kind === value} onClick={() => { setKind(value); setOutcome(undefined); setFailure(undefined) }}>
          {t(`kind.${value}`)}
        </Button>)}
      </div>
      <p className={css.secondary}>{t(kind === 'declarative' ? 'declarativeHint' : 'implicitHint')}</p>
      <Button disabled={pending} onClick={() => {
        if (operation.current !== undefined) return
        const owned = new AbortController()
        operation.current = owned; setPending(true); setOutcome(undefined); setFailure(undefined)
        void generate(messageId, kind, owned.signal).then((result) => {
          if (owned.signal.aborted) return
          if (result.ok) setOutcome(result.value ? 'manualSaved' : 'manualEmpty')
          else setFailure(operationFailure(result.error, [], t('unknownError')))
        }).catch((error: unknown) => {
          if (!owned.signal.aborted) setFailure(operationFailure(error, [], t('unknownError')))
        }).finally(() => {
          operation.current = undefined; if (!owned.signal.aborted) setPending(false)
        })
      }}>{t(pending ? 'manualPending' : 'manualGenerate')}</Button>
      {outcome === undefined ? null : <p role="status">{t(outcome)}</p>}
      {failure === undefined ? null : <p role="alert">{t('manualFailed', { reason: failure })}</p>}
    </Modal>
  </>
}
