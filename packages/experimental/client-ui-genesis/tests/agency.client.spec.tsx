// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import type { ComponentProps } from 'react'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { AgencyStatus, LifeGoalId, MotivationId, DecisionId } from '@deepseek-ai/dsh-experimental-genesis/types'
import { AgencyPanel } from '../src/client/AgencyPanel.tsx'
import { en, zh } from '../src/client/locales.ts'
import type {} from '../src/client/mount.ts'

afterEach(cleanup)
function fixture(chinese = false) {
  const goal = brandString<LifeGoalId>('f3a02434-b8c7-448e-b13d-ec2cfd611120')
  const motivation = brandString<MotivationId>('f3a02434-b8c7-448e-b13d-ec2cfd611121')
  const decision = brandString<DecisionId>('f3a02434-b8c7-448e-b13d-ec2cfd611122')
  const source = brandString<AgencyStatus['goals'][number]['sourceEventIds'][number]>('f3a02434-b8c7-448e-b13d-ec2cfd611123')
  const sessionId = brandString<AgencyStatus['sessions'][number]['id']>('life-ui-fixture')
  const at = '2026-10-26T00:00:00.000Z'
  const sample: AgencyStatus = { enabled: true, revision: 2, sampledAt: at, sessions: [{ id: sessionId, idle: true }],
    omitted: { motivations: 0, goals: 0, decisions: 0, sessions: 0 },
    motivations: [{ id: motivation, content: 'Study memory retrieval', reason: 'A recorded experience raised this question.', strength: 0.5,
      currentStrength: 0.4, status: 'active', createdAt: at, updatedAt: at, interestIds: [], memoryIds: [], sourceEventIds: [source] }],
    goals: [{ id: goal, content: 'Compare two retrieval approaches', reason: 'Resolve an experience-grounded question.', origin: 'autonomous',
      motivationIds: [motivation], memoryIds: [], sourceEventIds: [source], priority: 0.7, status: 'active',
      nextAction: 'Review two recorded examples.', failures: 1, createdAt: at, updatedAt: at, historyOmitted: 0,
      history: [{ timestamp: at, status: 'active', nextAction: 'Review two recorded examples.', reason: 'Create a bounded comparison.', decisionId: decision }] }],
    decisions: [{ id: decision, key: 'ui-fixture', sessionId, trigger: 'event', sourceEventIds: [source], createdAt: at,
      selected: 0, reason: 'A small comparison is worthwhile.', goalIds: [goal], motivationIds: [motivation],
      candidates: [{ disposition: 'wait', action: 'Wait for an available example.', reason: 'The evidence is incomplete.',
        factors: { motivation: 0.5, interest: 0.3, commitment: 0.6, emotion: 0.2, needs: 0.4, benefit: 0.7, cost: 0.2,
          risk: 0.1, urgency: 0.2, relationship: 0.5, context: 0.7 }, goalIds: [goal], motivationIds: [motivation] }],
      outcome: { status: 'waiting', sourceEventIds: [], recordedAt: at } }],
  }
  const dictionary: Readonly<Record<string, string>> = chinese ? zh : en
  const setGoalStatus = vi.fn().mockResolvedValue({ ok: true, value: undefined })
  const deliberate = vi.fn().mockResolvedValue({ ok: true, value: undefined })
  const refresh = vi.fn()
  const props = { setGoalStatus, deliberate, refresh,
    t: (key: string, params?: Record<string, string | number>) => {
      let text: string = dictionary[key] ?? key
      for (const [name, value] of Object.entries(params ?? {})) text = text.replace(`{${name}}`, String(value))
      return text
    },
    useResource: () => ({ status: 'live', value: sample, failure: undefined }),
  } as ComponentProps<typeof AgencyPanel>
  return { sample, props, setGoalStatus, deliberate, refresh }
}

it('shows localized motivations, life goals, decision alternatives and results while retaining a failed-refresh sample', () => {
  const { sample, props } = fixture(true)
  render(<AgencyPanel {...props} useResource={(() => ({ status: 'failed', value: sample,
    failure: new RemoteError('gateway/internal', 'unavailable', {}) })) as typeof props.useResource} />)
  expect(screen.getByText(zh.agencyTitle)).toBeTruthy()
  expect(screen.getByText('Study memory retrieval')).toBeTruthy()
  expect(screen.getByRole('meter')).toHaveProperty('value', 0.4)
  expect(screen.getByText('Compare two retrieval approaches')).toBeTruthy()
  expect(screen.getByText(zh['agencyOutcome.waiting'])).toBeTruthy()
  expect(screen.getByText(zh.agencyCandidates)).toBeTruthy()
  expect(screen.getByRole('alert').textContent).toBe(zh.failed)
  expect(screen.queryByRole('button', { name: zh['agencyGoal.completed'] })).toBeNull()
})

it('requires an operator reason and retains a rejected draft across refresh until revision is explicitly adopted', async () => {
  const { sample, props, setGoalStatus } = fixture()
  setGoalStatus.mockResolvedValueOnce({ ok: false, error: new Error('Goal changed; refresh.') })
  const view = render(<AgencyPanel {...props} />)
  fireEvent.click(screen.getByRole('button', { name: en.agencyPause }))
  expect(screen.getByRole('button', { name: en.agencySave })).toHaveProperty('disabled', true)
  fireEvent.change(screen.getByLabelText(en.agencyReason), { target: { value: 'Wait for resources.' } })
  fireEvent.click(screen.getByRole('button', { name: en.agencySave }))
  await screen.findByRole('alert')
  expect(setGoalStatus).toHaveBeenCalledWith(sample.goals[0]!.id, 'paused', 2, 'Wait for resources.', expect.any(AbortSignal))
  sample.revision = 3
  view.rerender(<AgencyPanel {...props} />)
  expect(screen.getByLabelText(en.agencyReason)).toHaveProperty('value', 'Wait for resources.')
  expect(screen.getByRole('button', { name: en.agencySave })).toHaveProperty('disabled', true)
  fireEvent.click(screen.getByRole('button', { name: en.agencyReload }))
  fireEvent.click(screen.getByRole('button', { name: en.agencySave }))
  await vi.waitFor(() => expect(setGoalStatus).toHaveBeenLastCalledWith(sample.goals[0]!.id, 'paused', 3, 'Wait for resources.', expect.any(AbortSignal)))
})

it('dispatches explicit autonomous deliberation only to an idle Session and disables controls when unavailable', async () => {
  const { sample, props, deliberate } = fixture()
  const view = render(<AgencyPanel {...props} />)
  fireEvent.click(screen.getByRole('button', { name: en.agencyRun }))
  await vi.waitFor(() => expect(deliberate).toHaveBeenCalledWith(sample.sessions[0]!.id, expect.any(AbortSignal)))
  await screen.findByRole('button', { name: en.agencyRun })
  sample.sessions[0]!.idle = false
  view.rerender(<AgencyPanel {...props} />)
  expect(screen.getByRole('button', { name: en.agencyRun })).toHaveProperty('disabled', true)
  expect(screen.getByText(en.agencyNoSession)).toBeTruthy()
  sample.enabled = false
  view.rerender(<AgencyPanel {...props} />)
  expect(screen.getByText(en.agencyDisabled)).toBeTruthy()
  expect(screen.queryByRole('button', { name: en.agencyPause })).toBeNull()
})

it('cancels an admitted UI request when the page unmounts', () => {
  const { props, deliberate } = fixture()
  deliberate.mockReturnValueOnce(new Promise(() => {}))
  const view = render(<AgencyPanel {...props} />)
  fireEvent.click(screen.getByRole('button', { name: en.agencyRun }))
  const signal: AbortSignal = deliberate.mock.calls[0]![1]
  view.unmount()
  expect(signal.aborted).toBe(true)
})
