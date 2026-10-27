import { expect, it } from 'vitest'
import { z } from 'zod'
import { statusFailure } from '../src/status-error.ts'
import { GenesisError } from '../src/error.ts'
import { deliberationPlanSchema } from '../src/agency-state.ts'

it('retains the HTTP diagnostic and configuration conflict without leaking the contained response cause', () => {
  const failure = statusFailure(new GenesisError('memory-provider', 'Embedding request failed (HTTP 401). Check the API key.',
    { cause: new Error('private provider response') }))
  expect(failure).toMatchObject({ code: 'genesis/operation', details: { reason: 'memory-provider' } })
  expect(failure.message).toContain('HTTP 401')
  expect(failure.message).not.toContain('private provider response')
  expect(statusFailure(new GenesisError('configuration-conflict', 'Settings changed; reload before saving.')).message).toContain('Settings changed')
})

it('reports the field and numeric constraint without copying untrusted field names or input values', () => {
  const result = z.strictObject({ dimensions: z.number().min(1) }).safeParse({ dimensions: 0, 'private-secret': 'private-value' })
  if (result.success) throw new Error('Expected invalid fixture')
  const failure = statusFailure(result.error)
  expect(failure.message).toContain('dimensions: too_small; minimum=1')
  expect(failure.message).not.toContain('private-secret')
  expect(failure.message).not.toContain('private-value')
})

it('exposes transport cause codes and timeout separately from the fetch wrapper', () => {
  const cause = Object.assign(new Error('private connection diagnostic'), { code: 'ECONNREFUSED' })
  expect(statusFailure(new TypeError('fetch failed', { cause })).message).toContain('ECONNREFUSED')
  expect(statusFailure(new DOMException('private timeout diagnostic', 'TimeoutError')).message).toContain('timed out')
  expect(statusFailure(new GenesisError('storage', 'Write outcome is uncertain.', {
    cause: Object.assign(new Error('private storage path'), { code: 'EACCES' }),
  })).message).toContain('EACCES')
  expect(statusFailure(new SyntaxError('private malformed JSON')).message).toContain('invalid JSON')
})

it('identifies the deliberation collection and unknown-field count while retaining raw keys only in the cause', () => {
  const result = deliberationPlanSchema.safeParse({ motivations: [{ 'private-key': 'private-value' }] })
  if (result.success) throw new Error('Expected invalid fixture')
  const failure = statusFailure(result.error)
  expect(failure.message).toContain('motivations.0: unrecognized_keys; unknown fields=1')
  expect(failure.message).toContain('inspect the logged auxiliary response')
  expect(failure.message).not.toContain('private-key')
  expect(failure.message).not.toContain('private-value')
  expect(failure.cause).toBe(result.error)
})
