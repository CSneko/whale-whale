// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { StatusPanel } from '../src/client/StatusPanel.tsx'
import { en, zh } from '../src/client/locales.ts'
import { statusFixture } from './status-fixture.client.ts'
import type {} from '../src/client/mount.ts'

afterEach(cleanup)
const fixture = (state: 'live' | 'failed' | 'loading' | 'none', chinese = false) => {
  const dictionary = chinese ? zh : en
  const refresh = vi.fn()
  const props = {
    t: (key: keyof typeof en, params?: Record<string, string | number>) => {
      let result: string = dictionary[key]
      for (const [name, value] of Object.entries(params ?? {})) result = result.replace(`{${name}}`, String(value))
      return result
    },
    refresh,
    useResource: () => ({ status: state, value: state === 'live' || state === 'failed' ? statusFixture() : undefined,
      failure: state === 'failed' ? { code: 'INTERNAL', message: 'unavailable' } : undefined }),
  } as ComponentProps<typeof StatusPanel>
  return { props, refresh }
}

it('shows persisted identity, creation time, counts and honest capability limitations in Chinese', () => {
  const { props, refresh } = fixture('live', true)
  render(<StatusPanel {...props} />)
  expect(screen.getByText(zh.unnamed)).toBeTruthy()
  expect(screen.getByText(statusFixture().identity.id)).toBeTruthy()
  expect(screen.getByText(zh.noCapabilities)).toBeTruthy()
  expect(screen.getByText(zh.limitations)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: zh.refresh }))
  expect(refresh).toHaveBeenCalledOnce()
})

it('keeps the last identity visible alongside a failed refresh and allows retry', () => {
  render(<StatusPanel {...fixture('failed').props} />)
  expect(screen.getByRole('alert').textContent).toBe(en.failed)
  expect(screen.getByText(statusFixture().identity.id)).toBeTruthy()
  expect(screen.getByRole('button', { name: en.refresh }).hasAttribute('disabled')).toBe(false)
})

it('shows a single loading state and an explicit unavailable state', () => {
  const view = render(<StatusPanel {...fixture('loading').props} />)
  expect(screen.getAllByRole('status')).toHaveLength(1)
  expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true)
  view.rerender(<StatusPanel {...fixture('none').props} />)
  expect(screen.getByText(en.unavailable)).toBeTruthy()
})
