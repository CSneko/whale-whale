/** Bounded, continuous coupling of immediate feelings and slow mood. @module */
import type { EmotionCurrent, EmotionState } from './emotion-state.ts'

// Qualitative simulation coordinates, not empirical estimates or event appraisals.
const profiles: Record<keyof EmotionCurrent, readonly [number, number]> = {
  happiness: [1, 1], sadness: [-1, -1], anger: [-1, 1], fear: [-1, 1],
  tenderness: [1, -1], gratitude: [1, -1], longing: [0, -1], frustration: [-1, 1], disappointment: [-1, -1],
}

function multiply(a: number[][], b: number[][]): number[][] {
  return a.map(row => b.map((_, j) => row.reduce((sum, value, k) => sum + value * entry(entry(b, k), j), 0)))
}

function entry<T>(values: readonly T[], index: number): T {
  const value = values[index]
  if (value === undefined) throw new RangeError('Affect matrix index is absent.')
  return value
}

/**
 * Integrate the coupled affine system without a step count proportional to elapsed time.
 * @param state - Validated anchor; missing coupling fields explicitly select legacy independent recovery.
 * @param elapsed - Nonnegative, sensitivity-scaled milliseconds.
 * @returns Detached immediate and mood values in their declared ranges.
 */
export function evolveAffect(state: EmotionState, elapsed: number): Pick<EmotionState, 'current' | 'mood'> {
  const spec = resolveDynamics(state)
  const fields = Object.keys(profiles) as Array<keyof EmotionCurrent>
  const current = { ...state.current }
  const mood = { ...state.mood }
  if (elapsed === 0) return { current, mood }
  if (spec.scale === 0 && spec.influence === 0) {
    for (const field of fields) current[field] *= 2 ** (-elapsed / state.shortHalfLifeMs[field])
    for (const field of ['valence', 'arousal'] as const) {
      mood[field] = state.baseline[field] + (mood[field] - state.baseline[field]) * 2 ** (-elapsed / state.moodHalfLifeMs[field])
    }
    return { current, mood }
  }
  const v = fields.length, a = v + 1, c = a + 1, size = c + 1
  const matrix = Array.from({ length: size }, () => Array<number>(size).fill(0))
  for (const [i, field] of fields.entries()) {
    const row = entry(matrix, i)
    const rate = Math.LN2 / state.shortHalfLifeMs[field]
    const [valence, activation] = profiles[field]
    row[i] = -rate
    row[v] = rate * spec.scale * valence / 2
    row[a] = rate * spec.scale * activation / 2
    row[c] = rate * spec.scale * (2 - valence - activation) / 4
  }
  for (const [index, field, coordinate, baseline] of [
    [v, 'valence', 0, (state.baseline.valence + 1) / 2],
    [a, 'arousal', 1, state.baseline.arousal],
  ] as const) {
    const row = entry(matrix, index)
    const rate = Math.LN2 / state.moodHalfLifeMs[field]
    const positive = fields.filter(key => profiles[key][coordinate] > 0).length
    const negative = fields.filter(key => profiles[key][coordinate] < 0).length
    row[index] = -rate
    row[c] = rate * ((1 - spec.influence) * baseline + spec.influence / 2)
    for (const [j, key] of fields.entries()) {
      const direction = profiles[key][coordinate]
      row[j] = rate * spec.influence * direction / (2 * (direction > 0 ? positive : negative))
    }
  }
  // Taylor scaling/squaring at norm <= 1/2; 18 terms put truncation below double precision.
  const norm = Math.max(...matrix.map(row => row.reduce((sum, value) => sum + Math.abs(value) * elapsed, 0)))
  const squares = Math.max(0, Math.ceil(Math.log2(norm * 2)))
  const scaled = matrix.map(row => row.map(value => value * elapsed / 2 ** squares))
  let term: number[][] = matrix.map((row, i) => row.map((_, j) => i === j ? 1 : 0))
  let result = term.map(row => [...row])
  for (let order = 1; order <= 18; order++) {
    term = multiply(term, scaled).map(row => row.map(value => value / order))
    result = result.map((row, i) => row.map((value, j) => value + entry(entry(term, i), j)))
  }
  for (let i = 0; i < squares; i++) result = multiply(result, result)
  const input = [...fields.map(key => state.current[key]), (state.mood.valence + 1) / 2, state.mood.arousal, 1]
  const values = result.map(row => Math.max(0, Math.min(1, row.reduce((sum, value, j) => sum + value * entry(input, j), 0))))
  for (const [i, key] of fields.entries()) current[key] = entry(values, i)
  mood.valence = 2 * entry(values, v) - 1
  mood.arousal = entry(values, a)
  return { current, mood }
}

function resolveDynamics(state: EmotionState) {
  return { scale: state.moodEmotionScale ?? 0, influence: state.emotionMoodInfluence ?? 0 }
}
