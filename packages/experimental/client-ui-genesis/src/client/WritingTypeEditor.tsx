/** Captured category drafts retain revision conflicts until the operator explicitly reloads. @module */
import { useEffect, useId, useRef, useState } from 'react'
import { Button, Checkbox, Input, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { WritingCatalog, WritingType } from '@deepseek-ai/dsh-experimental-genesis/types'
import type { RecordsActions } from './RecordsPanel.tsx'
import { operationFailure } from './operation-failure.ts'
import css from './StatusPanel.module.css'
import recordCss from './RecordsPanel.module.css'

/**
 * Edit a category while retaining drafts after rejected saves.
 * @param props - Captured type, current catalog, authenticated save and close action.
 * @returns Category editor preserving the name and enabled choice after failure.
 */
export function WritingTypeEditor({ initial, catalog, saveType, close, t }: PropsLocale<'genesis'> & Pick<RecordsActions, 'saveType'> & {
  initial: WritingType | undefined; catalog: WritingCatalog; close: () => void
}) {
  const field = useId()
  const [draft, setDraft] = useState(() => ({ name: initial?.name ?? '', enabled: initial?.enabled ?? true, revision: initial?.revision ?? 0 }))
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<string>()
  const operation = useRef<AbortController>()
  useEffect(() => () => { operation.current?.abort() }, [])
  return <Modal open title={t(initial === undefined ? 'recordTypeAdd' : 'recordTypeEdit')} closeLabel={t('close')} onClose={close}>
    <form className={recordCss.form} onSubmit={(event) => {
      event.preventDefault(); if (!event.currentTarget.reportValidity() || operation.current !== undefined) return
      const owned = new AbortController(); operation.current = owned; setPending(true); setFailure(undefined)
      void saveType(initial?.id ?? null, draft.name, draft.enabled, draft.revision, owned.signal).then((result) => {
        if (owned.signal.aborted) return
        if (result.ok) close(); else setFailure(operationFailure(result.error, [], t('unknownError')))
      }).catch((error: unknown) => { if (!owned.signal.aborted) setFailure(operationFailure(error, [], t('unknownError'))) })
        .finally(() => { operation.current = undefined; if (!owned.signal.aborted) setPending(false) })
    }}>
      <fieldset className={css.modelFields} disabled={pending}>
        <label htmlFor={`${field}-name`}>{t('recordTypeName')}</label>
        <Input id={`${field}-name`} required maxLength={catalog.limits.typeChars} value={draft.name}
          onChange={(event) => { setDraft(current => ({ ...current, name: event.target.value })) }} />
        <Checkbox label={t('recordTypeEnabled')} checked={draft.enabled} onChange={(enabled) => { setDraft(current => ({ ...current, enabled })) }} />
        <div className={css.actions}>
          <Button type="submit" disabled={!draft.name.trim()}>{t(pending ? 'working' : 'recordSave')}</Button>
          {initial === undefined ? null : <Button variant="outline" onClick={() => {
            const latest = catalog.types.find(type => type.id === initial.id)
            if (latest !== undefined) { setDraft({ name: latest.name, enabled: latest.enabled, revision: latest.revision }); setFailure(undefined) }
          }}>{t('recordReload')}</Button>}
        </div>
      </fieldset>
      {failure === undefined ? null : <p role="alert">{t('recordsOperationFailed', { reason: failure })}</p>}
    </form>
  </Modal>
}
