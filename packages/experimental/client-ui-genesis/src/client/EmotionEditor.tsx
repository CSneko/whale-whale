/** Explicit operator emotion adjustment; drafts survive rejected or concurrent writes. @module */
import { useEffect, useId, useRef, useState } from 'react'
import { Button, Input, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { EmotionActions, EmotionSample } from './EmotionPanel.tsx'
import { moodFields, needsFields, currentFields, emotionTexts, emotionNumbers } from './emotion-fields.ts'
import { operationFailure } from './operation-failure.ts'
import css from './StatusPanel.module.css'
import emotionCss from './EmotionPanel.module.css'

/**
 * Edit absolute immediate and mood values with an operator-authored audit reason.
 * @param props - Captured/current samples, authenticated mutation and explicit close/reload callbacks.
 * @returns A cancellable modal that never overwrites its draft on automatic status refresh.
 */
export function EmotionEditor({ initial, latest, adjust, close, saved, t }: PropsLocale<'genesis'> & Pick<EmotionActions, 'adjust'> & {
  initial: EmotionSample; latest: EmotionSample; close: () => void; saved: () => void
}) {
  const id = useId()
  const [draft, setDraft] = useState(() => ({ current: emotionTexts(initial.current), mood: emotionTexts(initial.mood), needs: emotionTexts(initial.needs), reason: '' }))
  const [revision, setRevision] = useState(initial.revision)
  const [failure, setFailure] = useState<string>()
  const [pending, setPending] = useState(false)
  const operation = useRef<AbortController>()
  useEffect(() => () => { operation.current?.abort() }, [])
  return <Modal open className={emotionCss.dialog!} contentClassName={emotionCss.dialogContent!} title={t('emotionAdjust')} closeLabel={t('close')} onClose={close}>
    <form className={emotionCss.form} onSubmit={(event) => {
      event.preventDefault()
      if (!event.currentTarget.reportValidity()) return
      if (operation.current !== undefined || !draft.reason.trim()) return
      const owned = new AbortController(); operation.current = owned; setPending(true); setFailure(undefined)
      void adjust({ current: emotionNumbers(draft.current), mood: emotionNumbers(draft.mood), needs: emotionNumbers(draft.needs), reason: draft.reason }, revision, owned.signal).then((result) => {
        if (owned.signal.aborted) return
        if (result.ok) saved()
        else setFailure(operationFailure(result.error, [], t('unknownError')))
      }).catch((error: unknown) => { if (!owned.signal.aborted) setFailure(operationFailure(error, [], t('unknownError'))) })
        .finally(() => { operation.current = undefined; if (!owned.signal.aborted) setPending(false) })
    }}>
      <p className={css.secondary}>{t('emotionAdjustmentHint')}</p>
      <fieldset disabled={pending} className={css.modelFields}>
        {(['current', 'mood', 'needs'] as const).map(layer => <fieldset key={layer} className={css.modelFields}>
          <legend>{t(layer === 'current' ? 'emotionCurrent' : layer === 'mood' ? 'emotionMood' : 'emotionNeeds')}</legend>
          <div className={emotionCss.fields}>{(layer === 'current' ? currentFields : layer === 'mood' ? moodFields : needsFields).map(field => <label key={field} className={emotionCss.field} htmlFor={`${id}-${layer}-${field}`}>
            {t(`emotion.${field}`)}
            <Input id={`${id}-${layer}-${field}`} aria-label={t('emotionValueLabel', { layer: t(layer === 'current' ? 'emotionCurrent' : layer === 'mood' ? 'emotionMood' : 'emotionNeeds'), emotion: t(`emotion.${field}`) })}
              type="number" required min={field === 'valence' ? -1 : 0} max={1} step="any" value={(draft[layer] as Record<string, string>)[field]}
              onChange={(event) => { setDraft(current => ({ ...current, [layer]: { ...current[layer], [field]: event.target.value } })) }} />
          </label>)}</div>
        </fieldset>)}
        <label className={emotionCss.field} htmlFor={`${id}-reason`}>{t('emotionReason')}
          <Input id={`${id}-reason`} required maxLength={1000} value={draft.reason}
            onChange={(event) => { setDraft(current => ({ ...current, reason: event.target.value })) }} /></label>
        <div className={css.actions}>
          <Button type="submit" disabled={!draft.reason.trim()}>{t(pending ? 'working' : 'emotionSaveAdjustment')}</Button>
          <Button variant="outline" onClick={() => {
            setDraft({ current: emotionTexts(latest.current), mood: emotionTexts(latest.mood), needs: emotionTexts(latest.needs), reason: draft.reason }); setRevision(latest.revision); setFailure(undefined)
          }}>{t('emotionReload')}</Button>
        </div>
      </fieldset>
      {failure === undefined ? null : <p role="alert">{t('emotionOperationFailed', { reason: failure })}</p>}
    </form>
  </Modal>
}
