// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NamingForm, LifeSetupButton } from '../src/client/Awakening.tsx'
import { en } from '../src/client/locales.ts'
import type {} from '../src/client/mount.ts'

afterEach(cleanup)
const dictionary: Readonly<Record<string, string>> = en
it('keeps a failed name for retry and starts conversation only after initialization succeeds', async () => {
  const initialize = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
  const done = vi.fn()
  render(<NamingForm t={key => dictionary[key] ?? key} refresh={() => {}} initialize={initialize}
    startConversation={vi.fn()} done={done} />)
  fireEvent.change(screen.getByLabelText(en.name), { target: { value: '小芽' } })
  fireEvent.click(screen.getByRole('button', { name: en.startConversation }))
  await screen.findByRole('alert')
  expect(done).not.toHaveBeenCalled()
  expect(screen.getByLabelText(en.name)).toHaveProperty('value', '小芽')
  fireEvent.click(screen.getByRole('button', { name: en.startConversation }))
  await waitFor(() => { expect(done).toHaveBeenCalledOnce() })
  expect(initialize).toHaveBeenLastCalledWith('小芽', expect.any(AbortSignal))
})


it('requires an explicit initialization click and removes the action after the first conversation completes', () => {
  const actions = { t: (key: string) => en[key as keyof typeof en] ?? key, refresh() {}, initialize: vi.fn(), startConversation: vi.fn() }
  const view = render(<LifeSetupButton {...actions} setup={{ phase: 'naming' }} />)
  expect(screen.queryByLabelText(en.name)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: en.initializeLife }))
  expect(screen.getByLabelText(en.name)).toBeTruthy()
  view.rerender(<LifeSetupButton {...actions} setup={{ phase: 'ready' }} />)
  expect(screen.queryByRole('button', { name: en.initializeLife })).toBeNull()
  expect(screen.queryByRole('dialog')).toBeNull()
})
