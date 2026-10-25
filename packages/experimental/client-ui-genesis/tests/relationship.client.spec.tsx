// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import type { RelationshipState } from '@deepseek-ai/dsh-experimental-genesis/types'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import { RelationshipPanel } from '../src/client/RelationshipPanel.tsx'
import { emotionFixture } from './emotion-fixture.client.ts'
import { en, zh } from '../src/client/locales.ts'
import type {} from '../src/client/mount.ts'

afterEach(cleanup)
function fixture() {
  const { props, status } = emotionFixture(true)
  const adjust = vi.fn().mockResolvedValue({ ok: true, value: 5 })
  const relationshipProps: ComponentProps<typeof RelationshipPanel> = { ...props, adjust }
  return { props: relationshipProps, status, adjust }
}

it('shows unknown relationship evidence and saves an explicit estimate without claiming a new person was recognized', async () => {
  const { props, adjust } = fixture()
  render(<RelationshipPanel {...props} />)
  expect(screen.getByText(zh.relationshipUnknown)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: zh.relationshipAdjust }))
  fireEvent.change(screen.getByLabelText(zh.relationshipLabel), { target: { value: '操作者甲' } })
  fireEvent.change(screen.getByRole('spinbutton', { name: zh['relationship.attachment'] }), { target: { value: '0.4' } })
  fireEvent.change(screen.getByLabelText(zh.emotionReason), { target: { value: '明确的人工设置' } })
  fireEvent.click(screen.getByRole('button', { name: zh.relationshipSave }))
  await vi.waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull() })
  expect(adjust).toHaveBeenCalledWith({ label: '操作者甲', reason: '明确的人工设置',
    values: { affection: 0, trust: 0.5, attachment: 0.4, familiarity: 0, feltSecurity: 0.5 } }, 4, expect.any(AbortSignal))
  expect(props.refresh).toHaveBeenCalled()
})

it('retains a rejected draft and reports confidence separately from strength until an explicit reload', async () => {
  const { props, status, adjust } = fixture()
  status.emotion!.relationship = { id: 'a4486bec-4d0f-46aa-a43f-21c9b76376ce' as RelationshipState['id'],
    scope: 'operator', label: 'operator', updatedAt: status.sampledAt,
    values: { affection: 0.2, trust: 0.7, attachment: 0.1, familiarity: 0.3, feltSecurity: 0.6 },
    origins: { affection: 'model-inference', trust: 'unknown', attachment: 'model-inference', familiarity: 'model-inference', feltSecurity: 'model-inference' },
    confidence: { affection: 0.5, trust: 0, attachment: 0.6, familiarity: 0.7, feltSecurity: 0.5 } }
  adjust.mockResolvedValue({ ok: false, error: new RemoteError('gateway/internal', 'Revision changed.', {}) })
  const view = render(<RelationshipPanel {...props} />)
  expect(screen.getAllByRole('meter')).toHaveLength(4)
  expect(screen.queryByRole('meter', { name: zh['relationship.trust'] })).toBeNull()
  expect(screen.getByText(zh.relationshipUncertain)).toBeTruthy()
  expect(screen.getByText(/解释置信度 60%/u)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: zh.relationshipAdjust }))
  fireEvent.change(screen.getByRole('spinbutton', { name: zh['relationship.attachment'] }), { target: { value: '0.8' } })
  fireEvent.change(screen.getByLabelText(zh.emotionReason), { target: { value: '保留这份草稿' } })
  fireEvent.click(screen.getByRole('button', { name: zh.relationshipSave }))
  await screen.findByRole('alert')
  status.emotion!.revision++
  status.emotion!.relationship.values.attachment = 0.3
  view.rerender(<RelationshipPanel {...props} />)
  expect(screen.getByRole('spinbutton', { name: zh['relationship.attachment'] })).toHaveProperty('value', '0.8')
  fireEvent.click(screen.getByRole('button', { name: zh.emotionReload }))
  expect(screen.getByRole('spinbutton', { name: zh['relationship.attachment'] })).toHaveProperty('value', '0.3')
  expect(screen.queryByText(en.relationshipUnknown)).toBeNull()
})
