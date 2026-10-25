/** Global operator identity with atomic, wording-only legacy memory relabeling. @module */
import { useEffect, useId, useRef, useState } from 'react'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { MemoryActions } from './MemoryPanel.tsx'
import { operationFailure } from './operation-failure.ts'
import css from './StatusPanel.module.css'

/**
 * Edit one shared explicit identity without discarding conflicted drafts.
 * @param props - Current profile and version-fenced, atomic identity/relabel action.
 * @returns Inline settings with concrete errors and explicit conflict reload.
 */
export function OperatorIdentity({ profile, saveOperator, saved, t }: PropsLocale<'genesis'> & Pick<MemoryActions, 'saveOperator'> & {
  profile: { name: string; identity: string; revision: number }
  saved: () => void
}) {
  const field = useId()
  const [draft, setDraft] = useState(profile)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<string>()
  const operation = useRef<AbortController>()
  useEffect(() => () => { operation.current?.abort() }, [])
  const conflict = profile.revision !== draft.revision
  return <form className={css.modelFields} onSubmit={(event) => {
    event.preventDefault()
    if (operation.current !== undefined || conflict || !draft.name.trim()) return
    const owned = new AbortController()
    operation.current = owned; setPending(true); setFailure(undefined)
    void saveOperator({ name: draft.name, identity: draft.identity }, draft.revision, owned.signal).then((result) => {
      if (owned.signal.aborted) return
      if (result.ok) { setDraft(current => ({ ...current, revision: result.value })); saved() }
      else setFailure(operationFailure(result.error, [], t('unknownError')))
    }).catch((error: unknown) => {
      if (!owned.signal.aborted) setFailure(operationFailure(error, [], t('unknownError')))
    }).finally(() => { operation.current = undefined; if (!owned.signal.aborted) setPending(false) })
  }}>
    <h4>{t('operatorIdentityTitle')}</h4>
    <p className={css.secondary}>{t('operatorIdentityHint')}</p>
    <label htmlFor={`${field}-name`}>{t('operatorName')}</label>
    <Input id={`${field}-name`} value={draft.name} required maxLength={200} disabled={pending}
      onChange={(event) => { setDraft(current => ({ ...current, name: event.target.value })) }} />
    <label htmlFor={`${field}-identity`}>{t('operatorIdentity')}</label>
    <Input id={`${field}-identity`} value={draft.identity} maxLength={800} disabled={pending}
      onChange={(event) => { setDraft(current => ({ ...current, identity: event.target.value })) }} />
    {conflict ? <p role="alert">{t('operatorIdentityConflict')}</p> : null}
    {failure === undefined ? null : <p role="alert">{t('operatorIdentityFailed', { reason: failure })}</p>}
    <div className={css.actions}>
      <Button type="submit" disabled={pending || conflict || !draft.name.trim()}>{t(pending ? 'operatorIdentitySaving' : 'saveOperatorIdentity')}</Button>
      {conflict ? <Button type="button" variant="outline" disabled={pending} onClick={() => { setDraft(profile); setFailure(undefined) }}>{t('reloadOperatorIdentity')}</Button> : null}
    </div>
  </form>
}
