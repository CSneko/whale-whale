// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { brandString } from '@deepseek-ai/dsh-brand'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import type { WritingCatalog, WritingEntry, WritingSearch } from '@deepseek-ai/dsh-experimental-genesis/types'
import { RecordsPanel } from '../src/client/RecordsPanel.tsx'
import { en, zh } from '../src/client/locales.ts'
import type {} from '../src/client/records-resources.ts'
import { globalProps } from './global-props.client.ts'

afterEach(cleanup)
function fixture() {
  const entry: WritingEntry = { id: brandString<WritingEntry['id']>('a'.repeat(64)), title: 'First diary', content: 'My private writing.',
    typeId: brandString<WritingEntry['typeId']>('diary'), createdAt: '2026-10-24T00:00:00.000Z', updatedAt: '2026-10-24T00:00:00.000Z',
    revision: 1, updatedBy: 'agent', fileName: `diary/2026/10/20261024T000000000Z_${'a'.repeat(64)}.md`,
    source: { sessionId: brandString<WritingEntry['source']['sessionId']>('writing-session'), callId: brandString<WritingEntry['source']['callId']>('writing-call') } }
  const catalog: WritingCatalog = { types: [{ id: entry.typeId, name: '日记', enabled: true, revision: 1 }],
    count: 1, revision: 1, limits: { titleChars: 200, contentChars: 100000, typeChars: 80 } }
  const search: WritingSearch = { items: [{ ...entry, truncated: false, matchedFields: [] }], total: 1, nextOffset: null, revision: 1 }
  const edit = vi.fn().mockResolvedValueOnce({ ok: false, error: new RemoteError('genesis/operation', 'Record changed; reload.', { reason: 'configuration-conflict' }) })
    .mockResolvedValue({ ok: true, value: 2 })
  const remove = vi.fn().mockResolvedValue({ ok: true, value: undefined })
  const saveType = vi.fn().mockResolvedValue({ ok: true, value: { id: 'new-type', name: '随笔', enabled: true, revision: 1 } })
  const dictionary: Readonly<Record<string, string>> = zh
  const props: ComponentProps<typeof RecordsPanel> = { ...globalProps, close() {}, edit, remove, saveType, refresh: vi.fn(),
    t: (key, params) => (dictionary[key] ?? key).replace(/\{(\w+)\}/gu, (_match: string, name: string) => String(params?.[name] ?? '')),
    useResource: ((address: string) => ({ status: 'live', failure: undefined, value: address.includes('genesis-records/') ? catalog
      : address.includes('genesis-record-search/') ? search : entry })) as ComponentProps<typeof RecordsPanel>['useResource'],
  }
  return { props, entry, catalog, edit, remove, saveType }
}

it('reads full text, retains a rejected draft across refresh, and saves only the explicitly reloaded revision', async () => {
  const { props, entry, edit } = fixture()
  const view = render(<RecordsPanel {...props} />)
  fireEvent.click(screen.getByRole('button', { name: zh.recordOpen }))
  expect(screen.getByRole('dialog').textContent).toContain(entry.content)
  fireEvent.click(screen.getByRole('button', { name: zh.recordEdit }))
  fireEvent.change(screen.getByLabelText(zh.recordContent), { target: { value: 'My retained draft' } })
  fireEvent.click(screen.getByRole('button', { name: zh.recordSave }))
  await screen.findByRole('alert')
  expect(screen.getByLabelText(zh.recordContent)).toHaveProperty('value', 'My retained draft')
  entry.revision = 2; entry.content = 'Saved elsewhere'
  view.rerender(<RecordsPanel {...props} />)
  expect(screen.getByLabelText(zh.recordContent)).toHaveProperty('value', 'My retained draft')
  expect(screen.getByText(zh.recordChanged)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: zh.recordReload }))
  expect(screen.getByLabelText(zh.recordContent)).toHaveProperty('value', 'Saved elsewhere')
  fireEvent.click(screen.getByRole('button', { name: zh.recordSave }))
  await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull() })
  expect(edit).toHaveBeenLastCalledWith(entry.id, expect.objectContaining({ content: 'Saved elsewhere' }), 2, expect.any(AbortSignal))
})

it('creates a type and requires explicit deletion confirmation while disclosing independent Session logs', async () => {
  const { props, entry, remove, saveType } = fixture()
  render(<RecordsPanel {...props} />)
  fireEvent.click(screen.getByText(zh.recordTypes))
  fireEvent.click(screen.getByRole('button', { name: zh.recordTypeAdd }))
  fireEvent.change(screen.getByLabelText(zh.recordTypeName), { target: { value: '随笔' } })
  fireEvent.click(screen.getByRole('button', { name: zh.recordSave }))
  await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull() })
  expect(saveType).toHaveBeenCalledWith(null, '随笔', true, 0, expect.any(AbortSignal))
  fireEvent.click(screen.getByRole('button', { name: zh.recordOpen }))
  fireEvent.click(screen.getByRole('button', { name: zh.recordDelete }))
  expect(remove).not.toHaveBeenCalled()
  expect(screen.getByText(zh.recordDeleteHint)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: zh.recordDeleteConfirm }))
  await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull() })
  expect(remove).toHaveBeenCalledWith(entry.id, 1, expect.any(AbortSignal))
  expect(en.recordsTitle).toBe('Her writings')
})
