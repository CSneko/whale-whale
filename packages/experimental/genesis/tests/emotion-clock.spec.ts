/** Real persistent anchors exclude downtime without counting checkpoints twice. */
import { afterEach, expect, it, vi } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Config } from '../src/config.ts'
import { emotionAt, resolveEmotion } from '../src/emotion-state.ts'
import { openCore } from './harness.ts'

const disposers: Array<() => Promise<unknown>> = []
afterEach(async () => {
  try { for (const close of disposers.splice(0).reverse()) await close() } finally { vi.useRealTimers() }
})
const start = Date.parse('2026-10-27T00:00:00.000Z')
const hour = 3600000
const now = (elapsed: number) => { vi.setSystemTime(start + elapsed) }

async function fixture(offlineChanges: boolean) {
  vi.useFakeTimers({ toFake: ['Date'] })
  now(0)
  const root = await mkdtemp(join(tmpdir(), 'genesis-emotion-clock-'))
  disposers.push(() => rm(root, { recursive: true, force: true }))
  const emotion = Config({ leasePath: join(root, 'life.lock'), emotion: { offlineChanges } }).emotion!
  const opened = await openCore(root, 'json', { emotion })
  disposers.push(() => opened.close())
  const initial = (await opened.core.snapshot()).emotion!
  await opened.core.adjustEmotion({ current: { ...initial.current, happiness: 0.9 }, mood: initial.mood,
    needs: initial.needs, reason: 'Clock fixture adjustment.' }, initial.revision)
  return { ...opened, root, emotion, initial: (await opened.core.snapshot()).emotion! }
}

it.each([true, false])('persists running time, resumes after a month with offline changes %s, and does not replay elapsed time', async (offlineChanges) => {
  const first = await fixture(offlineChanges)
  now(hour)
  await first.core.checkpointEmotion()
  const revision = (await first.core.snapshot()).emotion!.revision
  now(2 * hour)
  await first.close()
  const stopped = emotionAt(first.initial, new Date(start + 2 * hour).toISOString())
  now(30 * 24 * hour)
  const second = await openCore(first.root, 'json', { emotion: first.emotion })
  disposers.push(() => second.close())
  const resumed = (await second.core.snapshot()).emotion!
  const expected = offlineChanges ? emotionAt(stopped, new Date(start + 30 * 24 * hour).toISOString()) : stopped
  expect(resumed.current.happiness).toBeCloseTo(expected.current.happiness, 10)
  expect(resumed.mood.valence).toBeCloseTo(expected.mood.valence, 10)
  expect(resumed.revision).toBe(revision)
  const sameTime = emotionAt(resumed, new Date().toISOString())
  expect(sameTime).toEqual(resumed)
  await second.close()
  const third = await openCore(first.root, 'json', { emotion: first.emotion })
  disposers.push(() => third.close())
  expect((await third.core.snapshot()).emotion).toEqual(resumed)
})

it('settles the old rules once when switching settings and starts the new clock policy at save time', async () => {
  const first = await fixture(false)
  now(hour)
  await first.core.configureEmotion({ ...resolveEmotion(first.emotion, first.initial), offlineChanges: true }, first.initial.revision)
  const switched = (await first.core.snapshot()).emotion!
  expect(switched.current.happiness).toBeCloseTo(emotionAt(first.initial, new Date().toISOString()).current.happiness, 10)
  expect(switched.controls).not.toHaveProperty('offlineChanges')
  await first.close()
  now(8 * hour)
  const second = await openCore(first.root, 'json', { emotion: first.emotion })
  disposers.push(() => second.close())
  const resumed = (await second.core.snapshot()).emotion!
  expect(resumed.offlineChanges).toBe(true)
  expect(resumed.current.happiness).toBeCloseTo(emotionAt(switched, new Date().toISOString()).current.happiness, 10)
  await second.core.configureEmotion({ ...resolveEmotion(first.emotion, resumed), offlineChanges: false }, resumed.revision)
  const paused = (await second.core.snapshot()).emotion!
  await second.close()
  now(24 * hour)
  const third = await openCore(first.root, 'json', { emotion: first.emotion })
  disposers.push(() => third.close())
  expect((await third.core.snapshot()).emotion!.current).toEqual(paused.current)
})

it('resumes a crash checkpoint conservatively instead of treating unknown downtime as online time', async () => {
  const first = await fixture(false)
  now(hour)
  await first.core.checkpointEmotion()
  const checkpoint = await first.core.snapshot()
  await first.core.checkpointEmotion()
  expect((await first.core.snapshot()).emotion).toEqual(checkpoint.emotion)
  const crashRoot = await mkdtemp(join(tmpdir(), 'genesis-emotion-crash-'))
  disposers.push(() => rm(crashRoot, { recursive: true, force: true }))
  await writeFile(join(crashRoot, 'genesis.json'), JSON.stringify({ unit: { name: 'genesis', version: 1 },
    global: null, tables: { states: { life: checkpoint } } }))
  now(30 * 24 * hour)
  const restored = await openCore(crashRoot, 'json', { emotion: first.emotion })
  disposers.push(() => restored.close())
  expect((await restored.core.snapshot()).emotion!.current).toEqual(checkpoint.emotion!.current)
  expect((await restored.core.snapshot()).emotion!.mood).toEqual(checkpoint.emotion!.mood)
})

it('accepts version-three anchors without the new fields, preserving identity and recording the settings upgrade', async () => {
  const first = await fixture(true)
  const legacy = await first.core.snapshot()
  delete legacy.emotion!.offlineChanges
  delete legacy.emotion!.moodEmotionScale
  delete legacy.emotion!.emotionMoodInfluence
  await first.close()
  await writeFile(join(first.root, 'genesis.json'), JSON.stringify({ unit: { name: 'genesis', version: 1 },
    global: null, tables: { states: { life: legacy } } }))
  const restored = await openCore(first.root, 'json', { emotion: first.emotion })
  disposers.push(() => restored.close())
  const after = await restored.core.snapshot()
  expect(after.identity).toEqual(legacy.identity)
  expect(after.emotion!.current).toEqual(legacy.emotion!.current)
  expect(after.emotion!.moodEmotionScale).toBe(first.emotion.moodEmotionScale)
  expect(after.events.filter(event => event.type === 'emotion.initialized')).toHaveLength(1)
  expect(after.events.some(event => event.type === 'emotion.configured' && event.payload['reason'] === 'startup-recovery-settings')).toBe(true)
})
