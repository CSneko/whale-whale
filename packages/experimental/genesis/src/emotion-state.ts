/** Three-layer affect state, bounded proposals and elapsed-time recovery. @module */
import { z } from 'zod'
import type { EmotionConfig } from './config.ts'
import { relationshipSchema, appraisalSchema, relationshipDeltaSchema } from './relationship-state.ts'

const intensity = z.number().min(0).max(1)
const duration = z.number().min(1000).max(31536000000)
const signed = z.number().min(-1).max(1).optional()
/** Nine independent immediate intensities; mixed feelings need not sum to one. */
export const emotionCurrentSchema = z.strictObject({ happiness: intensity, sadness: intensity, anger: intensity,
  fear: intensity, tenderness: intensity, gratitude: intensity, longing: intensity, frustration: intensity, disappointment: intensity })
/** Nine immediate feelings, separate from mood and needs. */
export type EmotionCurrent = z.infer<typeof emotionCurrentSchema>
/** Two continuous long-term mood dimensions. */
export const moodSchema = z.strictObject({ valence: z.number().min(-1).max(1), arousal: intensity })
/** Valence ranges from negative to positive; arousal measures activation. */
export type Mood = z.infer<typeof moodSchema>
/** Independent needs and social evidence; loneliness is a gradual projection, never a writer delta. */
export const needsSchema = z.strictObject({ socialDesire: intensity, socialSatisfaction: intensity,
  relationshipQuality: intensity, recentInteraction: intensity, solitudePreference: intensity,
  exploration: intensity, autonomy: intensity, creativity: intensity, loneliness: intensity })
/** Persistent inclinations and fulfillment estimates; longing has its own immediate field. */
export type Needs = z.infer<typeof needsSchema>
/** Recovery half-lives for immediate feelings, in milliseconds. */
export const emotionHalfLivesSchema = z.strictObject({ happiness: duration, sadness: duration, anger: duration,
  fear: duration, tenderness: duration, gratitude: duration, longing: duration, frustration: duration, disappointment: duration })
/** Per-emotion decay durations. */
export type EmotionHalfLives = z.infer<typeof emotionHalfLivesSchema>
/** Slow recovery durations for the two mood dimensions. */
export const moodHalfLivesSchema = z.strictObject({ valence: duration, arousal: duration })
/** Mood recovery durations in milliseconds. */
export type MoodHalfLives = z.infer<typeof moodHalfLivesSchema>
/** Maximum retained dialogue exchanges. */
export const MAX_EMOTION_WINDOW_TURNS = 12
/** Operator policy, persisted on the same revision as the current state. */
export const emotionControlsSchema = z.strictObject({ enabled: z.boolean(),
  windowTurns: z.number().int().min(1).max(MAX_EMOTION_WINDOW_TURNS), maxDelta: intensity, maxMoodDelta: intensity,
  maxNeedsDelta: intensity, contextStep: z.number().min(0.001).max(1), relationshipEnabled: z.boolean(),
  maxRelationshipDelta: intensity, moodSupportTurns: z.number().int().min(1).max(12),
  importantEventThreshold: intensity, repetitionDiscount: intensity })
const recoverySchema = z.strictObject({ sensitivity: z.number().min(0).max(2), baseline: moodSchema,
  shortHalfLifeMs: emotionHalfLivesSchema, moodHalfLifeMs: moodHalfLivesSchema,
  needsHalfLifeMs: duration, interactionHalfLifeMs: duration })
/** Complete operator settings; mood recovery cannot be faster than any immediate feeling. */
export const emotionSettingsSchema = emotionControlsSchema.extend(recoverySchema.shape).superRefine((settings, context) => {
  if (Math.min(...Object.values(settings.moodHalfLifeMs)) < Math.max(...Object.values(settings.shortHalfLifeMs))) {
    context.addIssue({ code: 'custom', path: ['moodHalfLifeMs'], message: 'Mood recovery must be slower than immediate emotion recovery.' })
  }
})
/** Validated recovery and appraisal settings. */
export type EmotionSettings = z.infer<typeof emotionSettingsSchema>
/** Explicit operator replacement with an attributed audit reason. */
export const emotionAdjustmentSchema = z.strictObject({ current: emotionCurrentSchema, mood: moodSchema,
  needs: needsSchema, reason: z.string().trim().min(1).max(1000) })
/** Absolute state adjustment; it never counts as a new experience. */
export type EmotionAdjustment = z.infer<typeof emotionAdjustmentSchema>
/** Current generation only; old anchors require an operator's offline conversion. */
export const emotionStateSchema = recoverySchema.extend({ version: z.literal(3), revision: z.number().int().nonnegative(),
  updatedAt: z.iso.datetime(), controls: emotionControlsSchema.optional(), current: emotionCurrentSchema, mood: moodSchema,
  needs: needsSchema, relationship: relationshipSchema.nullable() })
/** Durable state; historical event payloads retain their original representation. */
export type EmotionState = z.infer<typeof emotionStateSchema>
/** Strict currently supported anchor. */
export type StoredEmotionState = EmotionState
/** Model proposals carry cited evidence and optional object attribution. */
export const emotionUpdateSchema = z.strictObject({
  delta: z.strictObject({ happiness: signed, sadness: signed, anger: signed, fear: signed, tenderness: signed,
    gratitude: signed, longing: signed, frustration: signed, disappointment: signed }),
  moodDelta: z.strictObject({ valence: signed, arousal: signed }),
  needsDelta: z.strictObject({ socialDesire: signed, socialSatisfaction: signed, relationshipQuality: signed,
    recentInteraction: signed, solitudePreference: signed, exploration: signed, autonomy: signed, creativity: signed }),
  targets: z.partialRecord(z.enum(['happiness', 'sadness', 'anger', 'fear', 'tenderness', 'gratitude', 'longing', 'frustration', 'disappointment']),
    z.string().trim().min(1).max(200)).optional(),
  appraisal: appraisalSchema, relationshipDelta: relationshipDeltaSchema.optional(),
  reason: z.string().trim().min(1).max(1000), sourceSeqs: z.array(z.number().int().nonnegative()).min(1).max(100),
})
/** Attributed model interpretation; never an established psychological fact. */
export type EmotionUpdate = z.infer<typeof emotionUpdateSchema>

/**
 * Calculate desired loneliness from connection gap, quality, contact and solitude preference.
 * @param needs - Current social inclinations and evidence estimates.
 * @returns Zero-to-one target, independent of object-directed longing.
 */
export function lonelinessTarget(needs: Needs): number {
  return needs.socialDesire * (1 - needs.solitudePreference)
    * ((1 - needs.socialSatisfaction) * 0.5 + (1 - needs.relationshipQuality) * 0.3 + (1 - needs.recentInteraction) * 0.2)
}

/**
 * Recover feelings quickly, mood slowly and loneliness continuously without inventing offline events.
 * @param state - Committed recovery anchor.
 * @param now - Observation time; backwards clocks leave the anchor unchanged.
 * @returns Detached sampled state; no model call or durable mutation occurs.
 */
export function emotionAt(state: EmotionState, now: string): EmotionState {
  const result = structuredClone(state)
  const duration = Math.max(0, Date.parse(now) - Date.parse(state.updatedAt))
  const elapsed = duration * state.sensitivity
  for (const key of Object.keys(state.current) as Array<keyof EmotionCurrent>) {
    result.current[key] *= 2 ** (-elapsed / state.shortHalfLifeMs[key])
  }
  for (const key of Object.keys(state.mood) as Array<keyof Mood>) {
    result.mood[key] = state.baseline[key] + (state.mood[key] - state.baseline[key]) * 2 ** (-elapsed / state.moodHalfLifeMs[key])
  }
  // Exact integration preserves the result when observation intervals are subdivided.
  const a = Math.LN2 / state.needsHalfLifeMs
  const b = Math.LN2 / state.interactionHalfLifeMs
  const p = 2 ** (-elapsed / state.needsHalfLifeMs)
  const q = 2 ** (-elapsed / state.interactionHalfLifeMs)
  const contactWeight = state.needs.socialDesire * (1 - state.needs.solitudePreference) * 0.2
  const targetWithoutContact = lonelinessTarget({ ...state.needs, recentInteraction: 0 })
  const rateDifference = a - b
  const integral = a === b ? a * elapsed * p : a > b
    ? a * q * -Math.expm1(-rateDifference * elapsed) / rateDifference
    : a * p * Math.expm1(rateDifference * elapsed) / rateDifference
  result.needs.recentInteraction *= q
  result.needs.loneliness = Math.max(0, Math.min(1, state.needs.loneliness * p
    + targetWithoutContact * (1 - p) - contactWeight * state.needs.recentInteraction * integral))
  if (duration > 0) result.updatedAt = now
  return result
}

/**
 * Initialize independent affect layers without changing life identity.
 * @param config - Resolved deployment settings.
 * @param now - Birth time of this projection.
 * @returns Strict version-three state.
 */
export function initialEmotion(config: EmotionConfig, now: string): EmotionState {
  return { version: 3, revision: 0, updatedAt: now, sensitivity: config.sensitivity,
    current: { happiness: 0, sadness: 0, anger: 0, fear: 0, tenderness: 0, gratitude: 0, longing: 0, frustration: 0, disappointment: 0 },
    mood: { ...config.baseline }, baseline: { ...config.baseline }, needs: { ...config.initialNeeds },
    shortHalfLifeMs: { ...config.shortHalfLifeMs }, moodHalfLifeMs: { ...config.moodHalfLifeMs },
    needsHalfLifeMs: config.needsHalfLifeMs, interactionHalfLifeMs: config.interactionHalfLifeMs, relationship: null }
}

/**
 * Quantize affect and expose advisory priorities through logged context.
 * @param state - Recovered current state.
 * @param step - Display resolution; full precision remains in storage.
 * @returns Bounded three-layer summary and willingness cues that confer no permissions.
 */
export function emotionContext(state: EmotionState, step: number): object {
  const round = (vector: object) => Object.fromEntries(Object.entries(vector)
    .map(([key, value]) => [key, Number(Math.max(-1, Math.min(1, Math.round(value / step) * step)).toFixed(6))]))
  return { version: state.version, current: round(state.current), mood: round(state.mood), needs: round(state.needs),
    priorities: round({ connect: lonelinessTarget(state.needs), explore: state.needs.exploration,
      chooseIndependently: state.needs.autonomy, create: state.needs.creativity,
      caution: Math.max(state.current.fear, state.current.frustration * (1 - state.mood.arousal)) }),
    relationship: state.relationship === null ? null : { id: state.relationship.id, scope: state.relationship.scope, label: state.relationship.label,
      values: round(state.relationship.values), confidence: round(state.relationship.confidence), origins: state.relationship.origins } }
}

/**
 * Resolve operator controls over deployment defaults with anchor-owned recovery settings.
 * @param config - Validated deployment defaults.
 * @param state - Current trusted anchor.
 * @returns Complete effective settings.
 */
export function resolveEmotion(config: EmotionConfig, state: EmotionState): EmotionSettings {
  return { enabled: true, windowTurns: config.windowTurns, maxDelta: config.maxDelta, maxMoodDelta: config.maxMoodDelta,
    maxNeedsDelta: config.maxNeedsDelta, contextStep: config.contextStep, relationshipEnabled: config.relationshipEnabled,
    maxRelationshipDelta: config.maxRelationshipDelta, moodSupportTurns: config.moodSupportTurns,
    importantEventThreshold: config.importantEventThreshold, repetitionDiscount: config.repetitionDiscount, ...state.controls,
    sensitivity: state.sensitivity, baseline: { ...state.baseline }, shortHalfLifeMs: { ...state.shortHalfLifeMs },
    moodHalfLifeMs: { ...state.moodHalfLifeMs }, needsHalfLifeMs: state.needsHalfLifeMs, interactionHalfLifeMs: state.interactionHalfLifeMs }
}
