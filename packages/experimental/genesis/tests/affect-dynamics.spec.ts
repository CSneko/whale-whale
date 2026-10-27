/** Continuous affect coupling preserves bounds and observation-independent evolution. */
import { expect, it } from 'vitest'
import { Config } from '../src/config.ts'
import { emotionAt, emotionStateSchema, initialEmotion } from '../src/emotion-state.ts'

const start = '2026-10-27T00:00:00.000Z'
const at = (ms: number) => new Date(Date.parse(start) + ms).toISOString()
const hour = 3600000

it('approaches positive mood-dependent feeling levels rather than resetting every feeling to zero', () => {
  const create = (valence: number) => initialEmotion(Config({ leasePath: '/unused.lock', emotion: {
    baseline: { valence, arousal: 0.5 }, emotionMoodInfluence: 0,
  } }).emotion!, start)
  const positive = emotionAt(create(0.8), at(24 * hour))
  const negative = emotionAt(create(-0.8), at(24 * hour))
  expect(positive.current.happiness).toBeCloseTo(0.14, 8)
  expect(negative.current.happiness).toBeCloseTo(0.06, 8)
  expect(negative.current.sadness).toBeGreaterThan(positive.current.sadness)
  for (const value of Object.values(positive.current)) expect(value).toBeGreaterThan(0)
  expect(positive.mood.valence).toBeCloseTo(0.8, 10)
})

it('accumulates sustained feelings into slow mood without instant replacement or autonomous feedback growth', () => {
  const config = Config({ leasePath: '/unused.lock', emotion: { baseline: { valence: 0, arousal: 0.5 } } }).emotion!
  const settled = emotionAt(initialEmotion(config, start), at(24 * 365 * hour))
  settled.updatedAt = start
  const pulse = structuredClone(settled)
  pulse.current.happiness = 0.9
  const instant = emotionAt(pulse, at(1))
  expect(Math.abs(instant.mood.valence - pulse.mood.valence)).toBeLessThan(1e-7)
  let sustained = structuredClone(pulse)
  for (let i = 1; i <= 36; i++) {
    sustained = emotionAt(sustained, at(i * hour / 6))
    sustained.current.happiness = 0.9
  }
  const transient = emotionAt(pulse, at(6 * hour))
  expect(sustained.mood.valence).toBeGreaterThan(transient.mood.valence + 0.005)
  const long = emotionAt(sustained, at(100 * 365 * 24 * hour))
  const later = emotionAt(long, at(101 * 365 * 24 * hour))
  for (const key of Object.keys(long.current) as Array<keyof typeof long.current>) {
    expect(later.current[key]).toBeCloseTo(long.current[key], 7)
  }
  expect(later.mood.valence).toBeCloseTo(long.mood.valence, 7)
  expect(emotionStateSchema.safeParse(later).success).toBe(true)
})

it('gives the same result for one interval and checkpoints, including unequal half-lives and loneliness', () => {
  const state = initialEmotion(Config({ leasePath: '/unused.lock', emotion: {} }).emotion!, start)
  state.current.anger = 0.95
  state.current.gratitude = 0.7
  state.mood.valence = -0.8
  state.needs.recentInteraction = 0.9
  const whole = emotionAt(state, at(36 * hour))
  let split = state
  for (let i = 1; i <= 72; i++) split = emotionAt(split, at(i * hour / 2))
  for (const key of Object.keys(whole.current) as Array<keyof typeof whole.current>) {
    expect(split.current[key]).toBeCloseTo(whole.current[key], 10)
  }
  expect(split.mood.valence).toBeCloseTo(whole.mood.valence, 10)
  expect(split.mood.arousal).toBeCloseTo(whole.mood.arousal, 10)
  expect(split.needs.loneliness).toBeCloseTo(whole.needs.loneliness, 10)
})

it('keeps saturated gains, extreme legal durations and long elapsed time finite and bounded', () => {
  const state = initialEmotion(Config({ leasePath: '/unused.lock', emotion: { moodEmotionScale: 1, emotionMoodInfluence: 0.5 } }).emotion!, start)
  for (const key of Object.keys(state.current) as Array<keyof typeof state.current>) {
    state.current[key] = 1
    state.shortHalfLifeMs[key] = 1000
  }
  state.moodHalfLifeMs = { valence: 31536000000, arousal: 31536000000 }
  state.mood = { valence: -1, arousal: 1 }
  const later = emotionAt(state, at(200 * 365 * 24 * hour))
  expect(emotionStateSchema.safeParse(later).success).toBe(true)
  expect(Number.isFinite(later.mood.valence)).toBe(true)
  for (const value of Object.values(later.current)) expect(value).toBeGreaterThanOrEqual(0)
  const incomplete = structuredClone(state)
  delete incomplete.offlineChanges
  expect(emotionStateSchema.safeParse(incomplete).success).toBe(false)
})
