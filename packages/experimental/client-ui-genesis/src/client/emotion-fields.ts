/** Affect field order and lossless editable numeric drafts. @module */
import type { EmotionCurrent, Mood, Needs } from '@deepseek-ai/dsh-experimental-genesis/types'

/** Independent immediate feelings. */
export const currentFields = ['happiness', 'sadness', 'anger', 'fear', 'tenderness', 'gratitude', 'longing', 'frustration', 'disappointment'] as const
/** Continuous slow mood dimensions. */
export const moodFields = ['valence', 'arousal'] as const
/** Independent need estimates and gradual loneliness. */
export const needsFields = ['socialDesire', 'socialSatisfaction', 'relationshipQuality', 'recentInteraction', 'solitudePreference', 'exploration', 'autonomy', 'creativity', 'loneliness'] as const
/**
 * Preserve numeric precision in editable drafts.
 * @param values - Complete numeric fields.
 * @param divisor - Unit conversion.
 * @returns Text keyed by the original fields.
 */
export function emotionTexts<K extends string>(values: Record<K, number>, divisor = 1): Record<K, string> {
  return Object.fromEntries(Object.entries<number>(values).map(([key, value]) => [key, String(value / divisor)])) as Record<K, string>
}
/**
 * Parse native-validated drafts at submission.
 * @param values - Nonempty finite numeric drafts.
 * @param multiplier - Storage-unit conversion.
 * @returns Numeric fields; the Host validates the complete wire input.
 */
export function emotionNumbers<K extends string>(values: Record<K, string>, multiplier = 1): Record<K, number> {
  return Object.fromEntries(Object.entries<string>(values).map(([key, value]) => [key, Number(value) * multiplier])) as Record<K, number>
}
/** Affect values accepted by readouts. */
export type AffectValues = EmotionCurrent | Mood | Needs
