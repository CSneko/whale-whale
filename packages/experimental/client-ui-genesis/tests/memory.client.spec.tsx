// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { brandString } from '@deepseek-ai/dsh-brand'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import type { LifeMemory } from '@deepseek-ai/dsh-experimental-genesis/types'
import { MemoryPanel } from '../src/client/MemoryPanel.tsx'
import { ManualMemory } from '../src/client/ManualMemory.tsx'
import { OperatorIdentity } from '../src/client/OperatorIdentity.tsx'
import { en } from '../src/client/locales.ts'
import { statusFixture } from './status-fixture.client.ts'
import type {} from '../src/client/mount.ts'
import { globalProps } from './global-props.client.ts'

beforeEach(() => { vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }) })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const t = (key: string, params?: Record<string, unknown>) => en[key as keyof typeof en].replace(/\{(\w+)\}/gu, (_match: string, key: string) => typeof params?.[key] === 'string' || typeof params?.[key] === 'number' ? `${params[key]}` : '')
const sample: LifeMemory = { id: brandString<LifeMemory['id']>('1ad3d042-eb44-4e98-8983-5c1ab187596a'),
  lifeId: statusFixture().identity.id, content: 'The user prefers oolong.', category: 'semantic', kind: 'declarative',
  importance: 0.8, confidence: 0.8, attribution: 'user-stated', sourceEventIds: [brandString<LifeMemory['sourceEventIds'][number]>('dbb27109-3b62-40bb-aa26-19dd0acc5355')],
  createdAt: '2026-10-23T00:00:00.000Z', updatedAt: '2026-10-23T00:00:00.000Z' }
function fixture() {
  const search = vi.fn().mockResolvedValue({ ok: true, value: [sample] })
  const save = vi.fn().mockResolvedValue({ ok: true, value: sample })
  const convert = vi.fn().mockResolvedValue({ ok: true, value: { ...sample, kind: 'non-declarative', updatedAt: '2026-10-23T00:00:01.000Z' } })
  const remove = vi.fn().mockResolvedValue({ ok: true, value: true })
  const props = { ...globalProps, t, search, save, convert, remove, refresh: vi.fn(), close() {},
    useResource: () => ({ status: 'live', value: { ...statusFixture(), memories: [sample] }, failure: undefined }),
  } as ComponentProps<typeof MemoryPanel>
  return { props, search, save, convert, remove }
}

it('owns memory search independently of Knowledge Base and retains sourced results with concrete query failures', async () => {
  const { props, search } = fixture()
  search.mockResolvedValueOnce({ ok: true, value: [sample] }).mockRejectedValueOnce(new Error('disconnected'))
  render(<MemoryPanel {...props} />)
  expect(screen.getByRole('heading', { name: en.memoryPageTitle })).toBeTruthy()
  expect(screen.queryByText(en.embeddingTitle)).toBeNull()
  fireEvent.change(screen.getByLabelText(en.searchMemories), { target: { value: 'oolong' } })
  fireEvent.click(screen.getByRole('button', { name: en.search }))
  await waitFor(() => { expect(search).toHaveBeenCalledWith('oolong', expect.any(AbortSignal)) })
  fireEvent.click(screen.getByRole('button', { name: en.search }))
  expect((await screen.findByRole('alert')).textContent).toContain('disconnected')
  expect(screen.getByText(sample.content)).toBeTruthy()
  expect(screen.getByText(sample.sourceEventIds[0]!)).toBeTruthy()
})

it('retains identity drafts after relabel failure, retries the displayed revision and reloads conflicts explicitly', async () => {
  const saveOperator = vi.fn().mockResolvedValueOnce({ ok: false, error: new RemoteError('genesis/review', 'Relabel model unavailable', { stage: 'writer', reason: 'memory-provider' }) })
    .mockResolvedValueOnce({ ok: true, value: 1 })
  const saved = vi.fn()
  const { rerender } = render(<OperatorIdentity profile={{ name: '', identity: '', revision: 0 }} saveOperator={saveOperator} saved={saved} t={t} />)
  fireEvent.change(screen.getByLabelText(en.operatorName), { target: { value: 'CrystalNeko' } })
  fireEvent.change(screen.getByLabelText(en.operatorIdentity), { target: { value: 'Creator of 小芽' } })
  fireEvent.click(screen.getByRole('button', { name: en.saveOperatorIdentity }))
  expect((await screen.findByRole('alert')).textContent).toContain('Relabel model unavailable')
  expect(screen.getByLabelText(en.operatorName)).toHaveProperty('value', 'CrystalNeko')
  fireEvent.click(screen.getByRole('button', { name: en.saveOperatorIdentity }))
  await waitFor(() => { expect(saved).toHaveBeenCalledTimes(1) })
  expect(saveOperator).toHaveBeenLastCalledWith({ name: 'CrystalNeko', identity: 'Creator of 小芽' }, 0, expect.any(AbortSignal))
  rerender(<OperatorIdentity profile={{ name: 'Other explicit name', identity: '', revision: 2 }} saveOperator={saveOperator} saved={saved} t={t} />)
  expect(screen.getByRole('button', { name: en.saveOperatorIdentity })).toHaveProperty('disabled', true)
  expect(screen.getByLabelText(en.operatorName)).toHaveProperty('value', 'CrystalNeko')
  fireEvent.click(screen.getByRole('button', { name: en.reloadOperatorIdentity }))
  expect(screen.getByLabelText(en.operatorName)).toHaveProperty('value', 'Other explicit name')
})

it('organizes a multi-selection with an explicit count, preserves failures, removes replaced rows and reuses its retry identity', async () => {
  const { props } = fixture()
  const second = { ...sample, id: brandString<LifeMemory['id']>('70cbb56c-338f-4b0a-8ec7-161a2ebec279'), content: 'The user requests gentle greetings.' }
  const result = { ...sample, id: brandString<LifeMemory['id']>('70cbb56c-338f-4b0a-8ec7-161a2ebec280'), content: 'Combined attributed interpretation.' }
  const organize = vi.fn().mockResolvedValueOnce({ ok: false, error: new RemoteError('genesis/review', 'Writer budget exhausted', { stage: 'writer', reason: 'memory-provider' }) })
    .mockResolvedValueOnce({ ok: true, value: [result] })
  render(<MemoryPanel {...props} organize={organize} useResource={(() => ({ status: 'live', value: {
    ...statusFixture(), organization: { selectionLimit: 20, maxResults: 8 }, memories: [sample, second],
  }, failure: undefined })) as typeof props.useResource} />)
  expect(screen.getByRole('button', { name: en.organizeMemories })).toHaveProperty('disabled', true)
  for (const checkbox of screen.getAllByRole('checkbox', { name: en.selectMemory })) fireEvent.click(checkbox)
  expect(organize).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: en.organizeMemories }))
  fireEvent.click(screen.getByRole('checkbox', { name: en.organizationAutomaticCount }))
  expect(screen.getByLabelText(en.organizationCount)).toHaveProperty('value', '1')
  fireEvent.click(screen.getByRole('button', { name: en.startOrganization }))
  expect((await screen.findByRole('alert')).textContent).toContain('Writer budget exhausted')
  expect(screen.getByLabelText(en.organizationCount)).toHaveProperty('value', '1')
  fireEvent.click(screen.getByRole('button', { name: en.startOrganization }))
  await screen.findByText(result.content)
  expect(organize.mock.calls[1]?.[0]).toEqual(organize.mock.calls[0]?.[0])
  expect(organize).toHaveBeenLastCalledWith({ id: expect.any(String), sources: [sample, second].map(({ id, updatedAt }) => ({ id, updatedAt })), targetCount: 1 }, expect.any(AbortSignal))
  expect(screen.queryByText(sample.content)).toBeNull()
  expect(screen.queryByText(second.content)).toBeNull()
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('keeps rejected edit drafts, fences the retry, and converts and deletes only the displayed version', async () => {
  const { props, save, convert, remove } = fixture()
  save.mockResolvedValueOnce({ ok: false, error: new RemoteError('genesis/operation', 'Memory changed; refresh.', { reason: 'configuration-conflict' }) })
    .mockResolvedValueOnce({ ok: true, value: { ...sample, content: 'The user prefers green tea.', updatedAt: '2026-10-23T00:00:00.100Z' } })
  render(<MemoryPanel {...props} />)
  fireEvent.click(screen.getByRole('button', { name: en.editMemory }))
  fireEvent.change(screen.getByLabelText(en.memoryContent), { target: { value: 'The user prefers green tea.' } })
  fireEvent.click(screen.getByRole('button', { name: en.saveMemory }))
  expect((await screen.findByRole('alert')).textContent).toContain('Memory changed; refresh.')
  expect(screen.getByLabelText(en.memoryContent)).toHaveProperty('value', 'The user prefers green tea.')
  fireEvent.click(screen.getByRole('button', { name: en.saveMemory }))
  await screen.findByText('The user prefers green tea.')
  expect(save).toHaveBeenLastCalledWith(sample.id, expect.objectContaining({ content: 'The user prefers green tea.' }), sample.updatedAt, expect.any(AbortSignal))
  fireEvent.click(screen.getByRole('button', { name: en.toImplicit }))
  await screen.findByRole('button', { name: en.toDeclarative })
  expect(convert).toHaveBeenCalledWith(sample.id, 'non-declarative', '2026-10-23T00:00:00.100Z', expect.any(AbortSignal))
  fireEvent.click(screen.getByRole('button', { name: en.deleteMemory }))
  expect(remove).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: en.confirmDeleteMemory }))
  await waitFor(() => { expect(screen.queryByText(sample.content)).toBeNull() })
  expect(remove).toHaveBeenCalledWith(sample.id, '2026-10-23T00:00:01.000Z', expect.any(AbortSignal))
})

it('allocates a stable ID for a new draft and retains it when saving fails', async () => {
  const { props, save } = fixture()
  save.mockResolvedValue({ ok: false, error: new RemoteError('genesis/operation', 'Storage unavailable', { reason: 'storage' }) })
  render(<MemoryPanel {...props} />)
  fireEvent.click(screen.getByRole('button', { name: en.addMemory }))
  fireEvent.change(screen.getByLabelText(en.memoryContent), { target: { value: 'Use a gentle tone.' } })
  fireEvent.click(screen.getAllByRole('button', { name: en['kind.non-declarative'] }).at(-1)!)
  fireEvent.click(screen.getByRole('button', { name: en.saveMemory }))
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', { name: en.saveMemory }))
  await waitFor(() => { expect(save).toHaveBeenCalledTimes(2) })
  expect(save.mock.calls[1]?.[0]).toBe(save.mock.calls[0]?.[0])
  expect(save).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ content: 'Use a gentle tone.', kind: 'non-declarative' }), null, expect.any(AbortSignal))
})

it('offers explicit per-reply destinations and shows the actual generation error', async () => {
  const generate = vi.fn().mockResolvedValueOnce({ ok: false, error: new RemoteError('genesis/review', 'HTTP 429 from writer', { stage: 'writer', reason: 'model' }) })
    .mockResolvedValueOnce({ ok: true, value: true })
  const props = { t, generate, messageId: 'reply-one', sessionId: 'life-session',
    useResource: () => ({ value: { lifePreset: 'life' } }),
    useSessions: (select: (state: unknown) => unknown) => select({ byId: { 'life-session': { projectionValues: { agentPreset: 'life' } } } }),
  } as ComponentProps<typeof ManualMemory>
  render(<ManualMemory {...props} />)
  fireEvent.click(screen.getByRole('button', { name: en.manualMemory }))
  fireEvent.click(screen.getByRole('button', { name: en['kind.non-declarative'] }))
  fireEvent.click(screen.getByRole('button', { name: en.manualGenerate }))
  expect((await screen.findByRole('alert')).textContent).toContain('HTTP 429 from writer')
  fireEvent.click(screen.getByRole('button', { name: en.manualGenerate }))
  await screen.findByRole('status')
  expect(generate).toHaveBeenLastCalledWith('reply-one', 'non-declarative', expect.any(AbortSignal))
  expect(screen.queryByRole('alert')).toBeNull()
  cleanup()
  render(<ManualMemory {...props} useSessions={((select: (state: unknown) => unknown) => select({
    byId: { 'life-session': { projectionValues: { agentPreset: 'standard' } } },
  })) as typeof props.useSessions} />)
  expect(screen.queryByRole('button', { name: en.manualMemory })).toBeNull()
})


it('separates current understanding, previous versions and experience time in the memory page', async () => {
  const { props } = fixture()
  const memory: LifeMemory = { ...sample, content: 'The user now prefers black tea.', experience: {
    sessionId: brandString<NonNullable<LifeMemory['experience']>['sessionId']>('experience-session'), startedAt: '2026-10-23T00:00:00.000Z', endedAt: '2026-10-23T00:01:00.000Z', topics: ['tea'] },
  category: 'episodic', history: [{ content: sample.content, category: 'semantic', importance: 0.8, confidence: 0.8,
    sourceEventIds: sample.sourceEventIds, recordedAt: sample.createdAt, supersededAt: '2026-10-23T00:01:00.000Z' }] }
  render(<MemoryPanel {...props} useResource={(() => ({ status: 'live', value: { ...statusFixture(), memories: [memory] }, failure: undefined })) as typeof props.useResource} />)
  expect(screen.getByText(en.currentUnderstanding)).toBeTruthy()
  expect(screen.getByText(memory.content)).toBeTruthy()
  fireEvent.click(screen.getByText(en.pastUnderstandings.replace('{count}', '1')))
  expect(await screen.findByText(sample.content)).toBeTruthy()
  expect(screen.getByText(en.historyHint)).toBeTruthy()
  expect(screen.getByText(en.experienceSpan)).toBeTruthy()
})

it('exposes persistent consolidation controls with specific writer failures and retry', async () => {
  const { props } = fixture()
  const setConsolidation = vi.fn().mockResolvedValue({ ok: true, value: undefined })
  const consolidate = vi.fn().mockResolvedValue({ ok: false, error: new RemoteError('genesis/review', 'HTTP 429 from memory writer', { stage: 'writer', reason: 'provider' }) })
  props.setConsolidation = setConsolidation
  props.consolidate = consolidate
  props.useResource = (() => ({ status: 'live', value: { ...statusFixture(), memories: [sample], consolidation: {
    enabled: true, revision: 2, completed: 1, failures: 1, maxFailures: 3, minHabitSupport: 3,
    requestedAt: sample.updatedAt, failure: { stage: 'writer', code: 'provider', message: 'HTTP 429 from memory writer' },
  } }, failure: undefined })) as ComponentProps<typeof MemoryPanel>['useResource']
  render(<MemoryPanel {...props} />)
  fireEvent.click(screen.getByRole('button', { name: en.consolidationEnabled }))
  await waitFor(() => { expect(setConsolidation).toHaveBeenCalledWith(false, expect.any(AbortSignal)) })
  fireEvent.click(screen.getByRole('button', { name: en.consolidateNow }))
  await waitFor(() => { expect(consolidate).toHaveBeenCalledWith(expect.any(AbortSignal)) })
  expect(screen.getAllByRole('alert').some(alert => alert.textContent?.includes('HTTP 429 from memory writer'))).toBe(true)
  expect(screen.getByText(sample.content)).toBeTruthy()
})
