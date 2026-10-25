// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import { ReviewNotice, ReviewSummary } from '../src/client/ReviewNotice.tsx'
import { en } from '../src/client/locales.ts'
import { statusFixture } from './status-fixture.client.ts'
import type {} from '../src/client/mount.ts'

afterEach(cleanup)

it('distinguishes an executed no-update decision with its turn, completion time, probability and threshold', () => {
  const { props, sessionId } = fixture()
  render(<ReviewSummary t={props.t} review={{ state: 'skipped', sessionId, turn: 7,
    completedAt: '2026-10-24T00:00:00.000Z', decision: { probability: 0.06, threshold: 0.5 } }} />)
  expect(screen.getByRole('status').textContent).toContain(en.reviewSkipped)
  expect(screen.getByText(/Appraised turn 7/u).querySelector('time')).toHaveProperty('dateTime', '2026-10-24T00:00:00.000Z')
  expect(screen.getByText('Update probability 6.0%; trigger threshold 50.0%')).toBeTruthy()
})

function fixture() {
  const status = statusFixture()
  const sessionId = SessionId('failed-review')
  status.review = { state: 'failed', sessionId, turn: 1,
    failure: { stage: 'decision', code: 'genesis/operation', message: 'Decision endpoint failed (HTTP 401).' } }
  const retry = vi.fn().mockResolvedValue({ ok: false, error: new RemoteError('genesis/review',
    'Writer endpoint failed (HTTP 429).', { stage: 'writer', reason: 'genesis/operation' }) })
  const props = {
    sessionId, retry,
    useResource: () => ({ status: 'live', value: status }),
    t: (key: keyof typeof en, params?: Record<string, unknown>) => en[key].replace(/\{(\w+)\}/gu,
      (_match, name: string) => typeof params?.[name] === 'string' ? params[name] : ''),
  } as ComponentProps<typeof ReviewNotice>
  return { props, status, retry, sessionId }
}

it('shows the original failed stage and the actual reason returned by a retry', async () => {
  const { props, retry, sessionId } = fixture()
  render(<ReviewNotice {...props} />)
  expect(screen.getByRole('alert').textContent).toContain('Decision model: Decision endpoint failed (HTTP 401)')
  fireEvent.click(screen.getByRole('button', { name: en.retryMemory }))
  await screen.findByText(/Memory update model:.*HTTP 429/u)
  expect(retry).toHaveBeenCalledWith(sessionId, expect.any(AbortSignal))
})

it('reports unavailable evidence and resets retry feedback for another failed turn', async () => {
  const { props, status, retry, sessionId } = fixture()
  retry.mockResolvedValueOnce({ ok: false,
    error: new RemoteError('gateway/internal', 'A newer turn replaced the failed memory evidence.', {}) })
  const view = render(<ReviewNotice {...props} />)
  fireEvent.click(screen.getByRole('button', { name: en.retryMemory }))
  await screen.findByText(/A newer turn replaced/u)
  status.review = { state: 'failed', sessionId, turn: 2,
    failure: { stage: 'embedding', code: 'genesis/operation', message: 'Expected 3072 vector dimensions.' } }
  view.rerender(<ReviewNotice {...props} />)
  expect(screen.queryByText(/A newer turn replaced/u)).toBeNull()
  expect(screen.getByRole('alert').textContent).toContain('Embedding service: Expected 3072')
  view.rerender(<ReviewNotice {...props} sessionId={SessionId('unrelated')} />)
  expect(screen.queryByRole('alert')).toBeNull()
})
