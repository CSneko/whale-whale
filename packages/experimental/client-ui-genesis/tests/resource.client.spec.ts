import { expect, it, vi } from 'vitest'
import { StatusResource } from '../src/client/resource.ts'
import { statusFixture } from './status-fixture.client.ts'

it('reads initially and only on refresh; abort ends the owned wait and releases refresh listeners', async () => {
  const source = new StatusResource()
  const signal = new AbortController()
  const read = vi.fn(async () => ({ ok: true as const, value: statusFixture() }))
  const stream = source.open(read, signal.signal)[Symbol.asyncIterator]()
  expect((await stream.next()).value).toEqual({ ok: true, value: statusFixture() })
  const next = stream.next()
  source.refresh()
  expect((await next).value).toEqual({ ok: true, value: statusFixture() })
  expect(read).toHaveBeenCalledTimes(2)
  const last = stream.next()
  signal.abort()
  expect((await last).done).toBe(true)
  source.refresh()
  expect(read).toHaveBeenCalledTimes(2)
})

it('discards a late RPC result after resource cancellation', async () => {
  const source = new StatusResource()
  const control = new AbortController()
  const gate = Promise.withResolvers<{ ok: true; value: ReturnType<typeof statusFixture> }>()
  const stream = source.open(() => gate.promise, control.signal)[Symbol.asyncIterator]()
  const pending = stream.next()
  control.abort()
  gate.resolve({ ok: true, value: statusFixture() })
  expect((await pending).done).toBe(true)
})
