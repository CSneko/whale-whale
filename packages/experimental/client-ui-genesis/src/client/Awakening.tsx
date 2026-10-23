/** Credential-first naming step; the shared Host life remains the source of initialization state. @module */
import { useEffect, useId, useRef, useState } from 'react'
import { Button, Input, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { StatusActions } from './StatusPanel.tsx'
import css from './StatusPanel.module.css'

type NamingProps = PropsLocale<'genesis'> & InjectFace<StatusActions> & { done?: () => void }

/**
 * Save a name only after Host route and embedding checks succeed; failures retain the user's input for retry.
 * @param props - Localized text, cancellable initialization action and optional completion.
 * @returns The naming form, with a bounded name and explicit pending/error feedback.
 */
export function NamingForm({ t, initialize, done }: NamingProps) {
  const id = useId()
  const [name, setName] = useState('')
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const controller = useRef<AbortController>()
  useEffect(() => () => { controller.current?.abort() }, [])
  const submit = async () => {
    if (controller.current !== undefined) return
    const operation = new AbortController()
    controller.current = operation
    setPending(true)
    setFailed(false)
    try {
      const saved = await initialize(name.trim(), operation.signal)
      if (operation.signal.aborted) return
      if (saved) done?.()
      else setFailed(true)
    } catch {
      // Transport failures use the same recoverable message as rejected initialization; no provider secrets reach the UI.
      if (!operation.signal.aborted) setFailed(true)
    } finally {
      controller.current = undefined
      if (!operation.signal.aborted) setPending(false)
    }
  }
  return <form className={css.naming} onSubmit={(event) => { event.preventDefault(); void submit() }}>
    <p>{t('namingDescription')}</p>
    <label htmlFor={id}>{t('name')}</label>
    <Input id={id} value={name} onChange={(event) => { setName(event.target.value) }}
      maxLength={200} required disabled={pending} data-modal-autofocus />
    {failed ? <p role="alert">{t('initializeFailed')}</p> : null}
    <Button type="submit" disabled={pending || !name.trim()}>{t(pending ? 'initializing' : 'startConversation')}</Button>
  </form>
}

type AwakeningProps = PropsRuntime<'settings.onboarding'> & PropsLocale<'genesis'> & InjectFace<StatusActions>

function NamingDialog(props: NamingProps & { configure: () => void }) {
  useEffect(() => {
    const root = document.getElementById('root')
    if (root === null) return
    const previous = root.inert
    root.inert = true
    return () => { root.inert = previous }
  }, [])
  return <Modal open title={props.t('awakeningTitle')} onClose={props.configure} headless className={css.dialog as string}>
    <h2>{props.t('awakeningTitle')}</h2>
    <NamingForm {...props} />
    <Button variant="outline" onClick={props.configure}>{props.t('configureApis')}</Button>
  </Modal>
}

/**
 * Wait for the existing API/account onboarding, then show naming before the first conversation.
 * @param props - Shared status resource, settings coordinator and initialization action.
 * @returns Naming dialog only when credentials are configured; normal Harness profiles complete without it.
 */
export function Awakening(props: AwakeningProps) {
  const resource = props.useResource<'genesis'>('dsh-resource://genesis/status')
  const phase = resource.value?.setup?.phase
  useEffect(() => {
    if (resource.status === 'live' && (phase === undefined || phase === 'ready')) props.complete()
  }, [resource.status, phase, props.complete])
  if (phase !== 'naming') return null
  return <NamingDialog t={props.t} refresh={props.refresh} initialize={props.initialize} done={props.complete}
    configure={() => { props.openSection('models'); props.complete() }} />
}
