/** Revision-fenced emotion policy and recovery editor with explicit draft reload. @module */
import { useEffect, useId, useRef, useState } from 'react'
import { Button, Input, Modal, Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { EmotionSettings } from '@deepseek-ai/dsh-experimental-genesis/types'
import type { EmotionActions, EmotionSample } from './EmotionPanel.tsx'
import { moodFields, currentFields, emotionTexts, emotionNumbers } from './emotion-fields.ts'
import { operationFailure } from './operation-failure.ts'
import css from './StatusPanel.module.css'
import emotionCss from './EmotionPanel.module.css'

function settingsDraft(settings: EmotionSettings) {
  return { enabled: settings.enabled, sensitivity: String(settings.sensitivity), windowTurns: String(settings.windowTurns), maxDelta: String(settings.maxDelta),
    maxMoodDelta: String(settings.maxMoodDelta),
    relationshipEnabled: settings.relationshipEnabled, maxRelationshipDelta: String(settings.maxRelationshipDelta),
    moodSupportTurns: String(settings.moodSupportTurns), importantEventThreshold: String(settings.importantEventThreshold), repetitionDiscount: String(settings.repetitionDiscount),
    maxNeedsDelta: String(settings.maxNeedsDelta), needsHalfLifeMs: String(settings.needsHalfLifeMs), interactionHalfLifeMs: String(settings.interactionHalfLifeMs),
    contextStep: String(settings.contextStep), baseline: emotionTexts(settings.baseline),
    shortMinutes: emotionTexts(settings.shortHalfLifeMs, 60000), moodHours: emotionTexts(settings.moodHalfLifeMs, 3600000) }

}

/**
 * Edit automatic appraisal and per-field recovery without changing current intensities directly.
 * @param props - Captured/current samples, authenticated settings save and modal callbacks.
 * @returns A bounded scrollable form whose drafts survive failed saves and background refreshes.
 */
export function EmotionSettingsEditor({ initial, latest, saveSettings, close, saved, t }: PropsLocale<'genesis'> & Pick<EmotionActions, 'saveSettings'> & {
  initial: EmotionSample; latest: EmotionSample; close: () => void; saved: () => void
}) {
  const id = useId()
  const [draft, setDraft] = useState(() => settingsDraft(initial.settings))
  const [revision, setRevision] = useState(initial.revision)
  const [failure, setFailure] = useState<string>()
  const [pending, setPending] = useState(false)
  const operation = useRef<AbortController>()
  useEffect(() => () => { operation.current?.abort() }, [])
  return <Modal open className={emotionCss.dialog!} contentClassName={emotionCss.dialogContent!} title={t('emotionSettings')} closeLabel={t('close')} onClose={close}>
    <form className={emotionCss.form} onSubmit={(event) => {
      event.preventDefault()
      if (operation.current !== undefined || !event.currentTarget.reportValidity()) return
      const settings = { enabled: draft.enabled, sensitivity: Number(draft.sensitivity), windowTurns: Number(draft.windowTurns), maxDelta: Number(draft.maxDelta),
        maxMoodDelta: Number(draft.maxMoodDelta), relationshipEnabled: draft.relationshipEnabled,
        maxRelationshipDelta: Number(draft.maxRelationshipDelta), moodSupportTurns: Number(draft.moodSupportTurns),
        importantEventThreshold: Number(draft.importantEventThreshold), repetitionDiscount: Number(draft.repetitionDiscount),
        maxNeedsDelta: Number(draft.maxNeedsDelta), needsHalfLifeMs: Number(draft.needsHalfLifeMs), interactionHalfLifeMs: Number(draft.interactionHalfLifeMs),
        contextStep: Number(draft.contextStep), baseline: emotionNumbers(draft.baseline),
        shortHalfLifeMs: emotionNumbers(draft.shortMinutes, 60000), moodHalfLifeMs: emotionNumbers(draft.moodHours, 3600000) }
      if (Math.min(...Object.values(settings.moodHalfLifeMs)) < Math.max(...Object.values(settings.shortHalfLifeMs))) {
        setFailure(t('emotionRecoveryInvalid')); return
      }
      const owned = new AbortController(); operation.current = owned; setPending(true); setFailure(undefined)
      void saveSettings(settings, revision, owned.signal).then((result) => {
        if (owned.signal.aborted) return
        if (result.ok) saved()
        else setFailure(operationFailure(result.error, [], t('unknownError')))
      }).catch((error: unknown) => { if (!owned.signal.aborted) setFailure(operationFailure(error, [], t('unknownError'))) })
        .finally(() => { operation.current = undefined; if (!owned.signal.aborted) setPending(false) })
    }}>
      <p className={css.secondary}>{t('emotionSettingsHint')}</p>
      <fieldset className={css.modelFields} disabled={pending}>
        <div className={css.header}><span>{t('emotionAutomatic')}</span><Switch label={t('emotionAutomatic')} checked={draft.enabled} onChange={(enabled) => { setDraft(current => ({ ...current, enabled })) }} /></div>
        <p className={css.secondary}>{t('emotionPauseHint')}</p>
        <div className={css.header}><span>{t('relationshipAutomatic')}</span><Switch label={t('relationshipAutomatic')} checked={draft.relationshipEnabled}
          onChange={(relationshipEnabled) => { setDraft(current => ({ ...current, relationshipEnabled })) }} /></div>
        <div className={emotionCss.field}>
          <label htmlFor={`${id}-sensitivity`}>{t('emotionSetting.sensitivity')}</label>
          <Input id={`${id}-sensitivity`} type="number" required min={0} max={2} step="any" value={draft.sensitivity}
            aria-describedby={`${id}-sensitivity-hint`}
            onChange={(event) => { setDraft(current => ({ ...current, sensitivity: event.target.value })) }} />
          <span id={`${id}-sensitivity-hint`} className={css.secondary}>{t('emotionSensitivityHint')}</span>
        </div>
        <div className={emotionCss.fields}>
          {(['windowTurns', 'maxDelta', 'maxMoodDelta', 'maxNeedsDelta', 'contextStep', 'maxRelationshipDelta', 'moodSupportTurns', 'importantEventThreshold', 'repetitionDiscount'] as const).map(field => <label key={field} className={emotionCss.field} htmlFor={`${id}-${field}`}>
            {t(`emotionSetting.${field}`)}
            <Input id={`${id}-${field}`} type="number" required value={draft[field]} min={(field === 'windowTurns' || field === 'moodSupportTurns') ? 1 : field === 'contextStep' ? 0.001 : 0}
              max={(field === 'windowTurns' || field === 'moodSupportTurns') ? 12 : 1} step={(field === 'windowTurns' || field === 'moodSupportTurns') ? 1 : 'any'}
              onChange={(event) => { setDraft(current => ({ ...current, [field]: event.target.value })) }} />
          </label>)}
        </div>
        <fieldset className={css.modelFields}>
          <legend>{t('emotionBaseline')}</legend>
          <p className={css.secondary}>{t('emotionBaselineHint')}</p>
          <div className={emotionCss.fields}>{moodFields.map(field => <label key={field} className={emotionCss.field} htmlFor={`${id}-baseline-${field}`}>
            {t(`emotion.${field}`)}
            <Input id={`${id}-baseline-${field}`} aria-label={t('emotionBaselineLabel', { emotion: t(`emotion.${field}`) })}
              type="number" required min={field === 'valence' ? -1 : 0} max={1} step="any" value={draft.baseline[field]}
              onChange={(event) => { setDraft(current => ({ ...current, baseline: { ...current.baseline, [field]: event.target.value } })) }} />
          </label>)}</div>
        </fieldset>
        <fieldset className={css.modelFields}>
          <legend>{t('emotionRecovery')}</legend>
          <p className={css.secondary}>{t('emotionRecoveryHint')}</p>
          <div className={emotionCss.fields}>{currentFields.map(field => <label className={emotionCss.field} key={field}>
            {t('emotionShortLabel', { emotion: t(`emotion.${field}`) })}
            <Input type="number" required min={1 / 60} max={525600} step="any" value={draft.shortMinutes[field]}
              onChange={(event) => { setDraft(current => ({ ...current, shortMinutes: { ...current.shortMinutes, [field]: event.target.value } })) }} />
          </label>)}
          {moodFields.map(field => <label className={emotionCss.field} key={field}>
            {t('emotionMoodLabel', { emotion: t(`emotion.${field}`) })}
            <Input type="number" required min={1 / 3600} max={8760} step="any" value={draft.moodHours[field]}
              onChange={(event) => { setDraft(current => ({ ...current, moodHours: { ...current.moodHours, [field]: event.target.value } })) }} />
          </label>)}
          {(['needsHalfLifeMs', 'interactionHalfLifeMs'] as const).map(field => <label className={emotionCss.field} key={field}>
            {t(`emotionSetting.${field}`)}
            <Input type="number" required min={1000} max={31536000000} step="any" value={draft[field]}
              onChange={(event) => { setDraft(current => ({ ...current, [field]: event.target.value })) }} />
          </label>)}</div>
        </fieldset>
        <div className={css.actions}>
          <Button type="submit">{t(pending ? 'working' : 'emotionSaveSettings')}</Button>
          <Button variant="outline" onClick={() => { setDraft(settingsDraft(latest.settings)); setRevision(latest.revision); setFailure(undefined) }}>{t('emotionReload')}</Button>
        </div>
      </fieldset>
      {failure === undefined ? null : <p role="alert">{t('emotionOperationFailed', { reason: failure })}</p>}
    </form>
  </Modal>
}
