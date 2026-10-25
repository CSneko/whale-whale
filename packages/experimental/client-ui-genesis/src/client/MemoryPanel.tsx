/** Independent memory browser and operator CRUD, separate from model/knowledge configuration. @module */
import { useEffect, useId, useRef, useState } from 'react'
import { Button, Input, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type { TypertClientRemote, RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { LifeMemory, MemoryKind } from '@deepseek-ai/dsh-experimental-genesis/types'
import { ConsolidationControls } from './ConsolidationControls.tsx'
import { MemoryEntry } from './MemoryEntry.tsx'
import { MemoryEditor } from './MemoryEditor.tsx'
import { MemoryOrganizer } from './MemoryOrganizer.tsx'
import { OperatorIdentity } from './OperatorIdentity.tsx'
import { ReviewSummary } from './ReviewNotice.tsx'
import { operationFailure } from './operation-failure.ts'
import css from './StatusPanel.module.css'

type MemoryRemote = TypertClientRemote['genesisMemory']
/** Authenticated mutation methods and bounded memory search supplied by the owning plugin. */
export interface MemoryActions {
  saveOperator: MemoryRemote['saveOperator']
  organize: MemoryRemote['organize']
  setConsolidation: MemoryRemote['setConsolidation']
  consolidate: MemoryRemote['consolidate']
  save: MemoryRemote['save']
  remove: MemoryRemote['deleteMemory']
  convert: MemoryRemote['convert']
  search(this: void, query: string, signal: AbortSignal): Promise<RemoteResult<LifeMemory[]>>
  refresh(this: void): void
}

/**
 * Browse, search, create, edit, delete and convert sourced candidate memories.
 * @param props - Shared resource, localized copy and authenticated version-fenced mutations.
 * @returns An independent settings page; failures retain the displayed data and drafts.
 */
export function MemoryPanel({ useResource, save, remove, convert, organize, saveOperator, setConsolidation, consolidate, search, refresh, t }: PropsRuntime<'settings.section'> &
  PropsLocale<'genesis'> & InjectFace<MemoryActions>) {
  const id = useId()
  const resource = useResource<'genesis'>('dsh-resource://genesis/status')
  const status = resource.value
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LifeMemory[]>()
  const [layer, setLayer] = useState<MemoryKind | 'all'>('all')
  const [editing, setEditing] = useState<{ memory: LifeMemory | undefined }>()
  const [selected, setSelected] = useState<LifeMemory[]>([])
  const [organizing, setOrganizing] = useState(false)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<string>()
  const operation = useRef<AbortController>()
  useEffect(() => () => { operation.current?.abort() }, [])
  const memories = (results ?? status?.memories ?? []).filter(memory => layer === 'all'
    || (memory.kind ?? (memory.category === 'procedural' ? 'non-declarative' : 'declarative')) === layer)
  const replace = (updated: LifeMemory) => {
    setResults((current) => {
      const items = current ?? status?.memories ?? []
      return items.some(item => item.id === updated.id) ? items.map(item => item.id === updated.id ? updated : item) : [updated, ...items]
    })
    refresh()
  }
  return <section className={css.panel} aria-labelledby={`${id}-title`}>
    <header className={css.header}>
      <h3 id={`${id}-title`}>{t('memoryPageTitle')}</h3>
      <div className={css.actions}>
        <Button size="sm" onClick={() => { setEditing({ memory: undefined }) }}>{t('addMemory')}</Button>
        <Button variant="outline" size="sm" onClick={() => {
          operation.current?.abort(); setPending(false); setResults(undefined); setFailure(undefined); refresh()
        }}>{t('refresh')}</Button>
      </div>
    </header>
    <p className={css.secondary}>{t('memoryDescription')}</p>
    {status?.operator === undefined ? null : <details>
      <summary>{t('operatorIdentityTitle')} · {status.operator.name || t('operatorIdentityUnset')}</summary>
      <OperatorIdentity profile={status.operator} saveOperator={saveOperator} t={t}
        saved={() => { setResults(undefined); setSelected([]); refresh() }} />
    </details>}
    {status?.consolidation === undefined ? null : <ConsolidationControls status={status.consolidation}
      setConsolidation={setConsolidation} consolidate={consolidate} refresh={refresh} t={t} />}
    {resource.status === 'loading' && status === undefined ? <div className={css.loading}><StateDot state="ongoing" /></div> : null}
    {resource.status === 'failed' ? <p role="alert">{t('failed')}</p> : null}
    {status?.review === undefined ? null : <ReviewSummary review={status.review} t={t} />}
    <div className={css.actions}>{(['all', 'declarative', 'non-declarative'] as const).map(kind =>
      <Button key={kind} variant="outline" size="sm" aria-pressed={layer === kind} onClick={() => { setLayer(kind) }}>
        {t(kind === 'all' ? 'allMemories' : `kind.${kind}`)}
      </Button>)}</div>
    <form className={css.search} onSubmit={(event) => {
      event.preventDefault(); operation.current?.abort()
      const owned = new AbortController()
      operation.current = owned; setPending(true); setFailure(undefined)
      void search(query, owned.signal).then((result) => {
        if (owned.signal.aborted) return
        if (result.ok) setResults(result.value)
        else setFailure(operationFailure(result.error, [], t('unknownError')))
      }).catch((error: unknown) => {
        if (!owned.signal.aborted) setFailure(operationFailure(error, [], t('unknownError')))
      }).finally(() => { if (!owned.signal.aborted) { operation.current = undefined; setPending(false) } })
    }}>
      <label htmlFor={`${id}-query`}>{t('searchMemories')}</label>
      <Input id={`${id}-query`} value={query} onChange={(event) => { setQuery(event.target.value) }} />
      <Button type="submit" disabled={pending}>{t('search')}</Button>
    </form>
    {failure === undefined ? null : <p role="alert">{t('memorySearchFailed', { reason: failure })}</p>}
    <p>{t('memoryCount', { count: status?.counts.memories ?? 0 })}</p>
    {status?.organization === undefined ? null : <div className={css.editor}>
      <p className={css.secondary}>{t('organizationSelectionHint', { count: status.organization.selectionLimit })}</p>
      <div className={css.actions}>
        <span>{t('selectedMemories', { count: selected.length })}</span>
        <Button size="sm" disabled={selected.length < 2} onClick={() => { setOrganizing(true) }}>{t('organizeMemories')}</Button>
        <Button variant="outline" size="sm" disabled={selected.length === 0} onClick={() => { setSelected([]) }}>{t('clearSelection')}</Button>
      </div>
    </div>}
    {memories.length === 0 ? <p>{t('emptyMemories')}</p> : <ul className={css.records}>
      {memories.map(memory => <MemoryEntry key={memory.id} memory={memory} convert={convert} remove={remove} t={t}
        operatorName={status?.operator?.name}
        selected={status?.organization === undefined ? undefined : selected.some(item => item.id === memory.id)}
        selectionDisabled={!selected.some(item => item.id === memory.id) && selected.length >= (status?.organization?.selectionLimit ?? 0)}
        select={(checked) => { setSelected(current => checked ? [...current.filter(item => item.id !== memory.id), memory] : current.filter(item => item.id !== memory.id)) }}
        edit={() => { setEditing({ memory }) }} converted={replace}
        removed={() => { setSelected(current => current.filter(item => item.id !== memory.id)); setResults(current => (current ?? status?.memories ?? []).filter(item => item.id !== memory.id)); refresh() }} />)}
    </ul>}
    <p className={css.secondary}>{t('boundedSearch')}</p>
    {editing === undefined ? null : <MemoryEditor initial={editing.memory} save={save} t={t}
      close={() => { setEditing(undefined) }} saved={(memory) => { replace(memory); setEditing(undefined) }} />}
    {!organizing || status?.organization === undefined ? null : <MemoryOrganizer sources={selected} maxResults={status.organization.maxResults}
      organize={organize} t={t} close={() => { setOrganizing(false); refresh() }} saved={(memories) => {
        setResults(current => [...memories, ...(current ?? status.memories).filter(item =>
          !selected.some(source => source.id === item.id) && !memories.some(memory => memory.id === item.id))])
        setSelected([]); setOrganizing(false); refresh()
      }} />}
  </section>
}
