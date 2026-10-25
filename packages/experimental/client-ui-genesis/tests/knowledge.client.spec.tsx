// @vitest-environment jsdom
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { KnowledgePanel } from '../src/client/KnowledgePanel.tsx'
import { en } from '../src/client/locales.ts'
import { statusFixture } from './status-fixture.client.ts'
import type {} from '../src/client/mount.ts'

afterEach(cleanup)

function fixture() {
  const status = { ...statusFixture(), embedding: { url: 'https://embedding.example/embeddings',
    model: 'first-model', dimensions: 3, keyRef: 'GENESIS_UI_FIXTURE_KEY', revision: 1,
    keyConfigured: false, keyWritable: true } }
  const save = vi.fn().mockResolvedValueOnce({ ok: false, error: new RemoteError('gateway/internal', 'Configuration revision changed; reload before saving.', {}) }).mockResolvedValue({ ok: true, value: 2 })
  const credential = vi.fn().mockResolvedValue({ ok: true, value: undefined })
  const test = vi.fn().mockResolvedValue({ ok: true, value: undefined })
  const props = {
    close() {}, refresh: vi.fn(), save, credential, test,
    t: (key: keyof typeof en, params?: Record<string, unknown>) => en[key].replace('{reason}', typeof params?.reason === 'string' ? params.reason : ''),
    useResource: () => ({ status: 'live', value: status }),
  } as ComponentProps<typeof KnowledgePanel>
  return { props, save, credential, test }
}

it('keeps endpoint drafts after refusal, fences saves and stores the password separately without echoing it', async () => {
  const { props, save, credential, test } = fixture()
  render(<KnowledgePanel {...props} />)
  fireEvent.change(screen.getByLabelText(en.embeddingModel), { target: { value: 'my-model' } })
  fireEvent.change(screen.getByLabelText(en.apiKey), { target: { value: 'fixture-secret' } })
  expect(screen.getByLabelText(en.apiKey).getAttribute('type')).toBe('password')
  fireEvent.click(screen.getByRole('button', { name: en.saveConfiguration }))
  await screen.findByRole('alert')
  expect(screen.getByLabelText(en.embeddingModel)).toHaveProperty('value', 'my-model')
  expect(JSON.stringify(save.mock.calls)).not.toContain('fixture-secret')
  fireEvent.click(screen.getByRole('button', { name: en.saveConfiguration }))
  await screen.findByText(en.saved)
  expect(save).toHaveBeenLastCalledWith({ url: 'https://embedding.example/embeddings',
    model: 'my-model', dimensions: 3, keyRef: 'GENESIS_UI_FIXTURE_KEY' }, 1, expect.any(AbortSignal))
  fireEvent.click(screen.getByRole('button', { name: en.saveKey }))
  await screen.findByText(en.credentialSaved)
  expect(credential).toHaveBeenCalledWith('GENESIS_UI_FIXTURE_KEY', 'fixture-secret')
  expect(screen.getByLabelText(en.apiKey)).toHaveProperty('value', '')
  expect(screen.queryByText('fixture-secret')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: en.testSaved }))
  await screen.findByText(en.tested)
  expect(test).toHaveBeenCalledWith(expect.any(AbortSignal))
})

it('shows the embedding validation reason and replaces stale feedback after a successful retry', async () => {
  const { props, test } = fixture()
  test.mockResolvedValueOnce({ ok: false,
    error: new RemoteError('gateway/internal', 'data.0.embedding: too_small; minimum=3', {}) })
  render(<KnowledgePanel {...props} />)
  fireEvent.click(screen.getByRole('button', { name: en.testSaved }))
  expect((await screen.findByRole('alert')).textContent).toContain('data.0.embedding: too_small; minimum=3')
  fireEvent.click(screen.getByRole('button', { name: en.testSaved }))
  await screen.findByText(en.tested)
  expect(screen.queryByRole('alert')).toBeNull()
})
