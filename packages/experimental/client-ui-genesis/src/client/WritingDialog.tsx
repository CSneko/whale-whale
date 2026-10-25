/** Full-text reading and versioned operator edits; record text remains uninterpreted data. @module */
import { useEffect, useId, useRef, useState } from 'react'
import { brandString } from '@deepseek-ai/dsh-brand'
import { Button, Input, Modal, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { WritingCatalog, WritingDraft, WritingEntry, WritingId, WritingTypeId } from '@deepseek-ai/dsh-experimental-genesis/types'
import type { RecordsActions } from './RecordsPanel.tsx'
import { operationFailure } from './operation-failure.ts'
import css from './StatusPanel.module.css'
import recordCss from './RecordsPanel.module.css'

type EditorProps = PropsLocale<'genesis'> & Pick<RecordsActions, 'edit' | 'remove' | 'refresh'> & {
  catalog: WritingCatalog; close: () => void
}

/**
 * Read full text and explicitly edit or delete the current record.
 * @param props - Record id, shared read resource and authenticated mutations.
 * @returns Dismissible viewer retaining old data on query failure.
 */
export function WritingDialog({ id, catalog, useResource, edit, remove, refresh, close, t }: EditorProps & {
  id: WritingId
} & Pick<PropsRuntime<'settings.section'>, 'useResource'>) {
  const resource = useResource<'genesis-record'>(`dsh-resource://genesis-record/${id}`)
  return <Modal open className={recordCss.dialog!} contentClassName={recordCss.dialogContent!} title={t('recordOpen')} closeLabel={t('close')} onClose={close}>
    {resource.status === 'failed' ? <p role="alert">{t('recordsQueryFailed')}</p> : null}
    {resource.value === undefined && resource.status === 'loading' ? <div className={css.loading} role="status" aria-label={t('recordOpen')}><StateDot state="ongoing" /></div> : null}
    {resource.value === undefined ? null : <WritingEditor entry={resource.value} {...{ catalog, edit, remove, refresh, close, t }} />}
  </Modal>
}

function WritingEditor({ entry, catalog, edit, remove, refresh, close, t }: EditorProps & { entry: WritingEntry }) {
  const field = useId()
  const [draft, setDraft] = useState<{ value: WritingDraft; revision: number }>()
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<string>()
  const operation = useRef<AbortController>()
  useEffect(() => () => { operation.current?.abort() }, [])
  const copy = () => { setDraft({ value: { title: entry.title, content: entry.content, typeId: entry.typeId }, revision: entry.revision }); setFailure(undefined); setConfirming(false) }
  const run = async (work: (signal: AbortSignal) => Promise<RemoteResult<unknown>>) => {
    if (operation.current !== undefined) return
    const owned = new AbortController(); operation.current = owned; setPending(true); setFailure(undefined)
    try {
      const result = await work(owned.signal)
      if (owned.signal.aborted) return
      if (result.ok) { close(); refresh() } else setFailure(operationFailure(result.error, [], t('unknownError')))
    } catch (error) { if (!owned.signal.aborted) setFailure(operationFailure(error, [], t('unknownError'))) }
    finally { operation.current = undefined; if (!owned.signal.aborted) setPending(false) }
  }
  const update = (change: Partial<WritingDraft>) => { setDraft(current => current === undefined ? current : { ...current, value: { ...current.value, ...change } }) }
  return <div className={recordCss.form}>
    <div className={`${css.secondary} ${recordCss.metadata}`}>
      <p>{t('recordCreated', { time: new Date(entry.createdAt).toLocaleString() })}</p>
      <p>{t('recordUpdated', { time: new Date(entry.updatedAt).toLocaleString() })}{' · '}{t(entry.updatedBy === 'operator' ? 'recordOperatorEdited' : 'recordAgentAuthored')}</p>
      <p>{entry.fileName}</p>
      <p>{t('recordSource', { session: entry.source.sessionId, call: entry.source.callId })}</p>
    </div>
    {draft === undefined ? <>
      <h4>{entry.title}</h4>
      <p>{catalog.types.find(type => type.id === entry.typeId)?.name ?? entry.typeId}</p>
      <pre className={recordCss.text}>{entry.content}</pre>
      <div className={css.actions}>
        <Button variant="outline" disabled={pending} onClick={copy}>{t('recordEdit')}</Button>
        <Button variant="outline" disabled={pending} onClick={() => { setConfirming(true) }}>{t('recordDelete')}</Button>
      </div>
    </> : <form className={recordCss.form} onSubmit={(event) => {
      event.preventDefault(); if (event.currentTarget.reportValidity()) void run(signal => edit(entry.id, draft.value, draft.revision, signal))
    }}>
      <p className={css.secondary}>{t('recordEditHint')}</p>
      {draft.revision !== entry.revision ? <p role="status">{t('recordChanged')}</p> : null}
      <fieldset className={css.modelFields} disabled={pending}>
        <label htmlFor={`${field}-title`}>{t('recordTitle')}</label>
        <Input id={`${field}-title`} required maxLength={catalog.limits.titleChars} value={draft.value.title} onChange={(event) => { update({ title: event.target.value }) }} />
        <label htmlFor={`${field}-type`}>{t('recordType')}</label>
        <select id={`${field}-type`} className={recordCss.select} value={draft.value.typeId}
          onChange={(event) => { update({ typeId: brandString<WritingTypeId>(event.target.value) }) }}>
          {catalog.types.map(type => <option key={type.id} value={type.id} disabled={!type.enabled && type.id !== entry.typeId}>{type.name}{type.enabled ? '' : ` · ${t('recordTypeDisabled')}`}</option>)}
        </select>
        <label htmlFor={`${field}-content`}>{t('recordContent')}</label>
        <textarea id={`${field}-content`} className={recordCss.body} required maxLength={catalog.limits.contentChars} value={draft.value.content}
          onChange={(event) => { update({ content: event.target.value }) }} />
        <div className={css.actions}>
          <Button type="submit" disabled={!draft.value.title.trim() || !draft.value.content.trim()}>{t(pending ? 'working' : 'recordSave')}</Button>
          <Button variant="outline" onClick={() => { refresh(); copy() }}>{t('recordReload')}</Button>
          <Button variant="outline" onClick={() => { setDraft(undefined); setFailure(undefined) }}>{t('cancel')}</Button>
        </div>
      </fieldset>
    </form>}
    {!confirming ? null : <div className={recordCss.form}>
      <p>{t('recordDeleteHint')}</p>
      <div className={css.actions}>
        <Button disabled={pending} onClick={() => { void run(signal => remove(entry.id, entry.revision, signal)) }}>{t('recordDeleteConfirm')}</Button>
        <Button variant="outline" disabled={pending} onClick={() => { setConfirming(false) }}>{t('cancel')}</Button>
      </div>
    </div>}
    {failure === undefined ? null : <p role="alert">{t('recordsOperationFailed', { reason: failure })}</p>}
  </div>
}
