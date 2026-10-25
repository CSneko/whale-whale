/** Live appraisal timing and decision evidence shared by memory and emotion settings. @module */
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ReviewOutcome } from '@deepseek-ai/dsh-experimental-genesis/types'
import css from './StatusPanel.module.css'

/**
 * Distinguish an executed appraisal from a saved state change without treating probability as intensity.
 * @param props - Latest review and localized labels.
 * @returns Turn, optional completion time and the System One probability with its captured threshold.
 */
export function ReviewDetails({ review, t }: PropsLocale<'genesis'> & { review: ReviewOutcome }) {
  return <div className={css.secondary}>
    <p>{t('reviewTurn', { turn: String(review.turn) })}{review.completedAt === undefined ? null : <>{' · '}
      <time dateTime={review.completedAt}>{new Date(review.completedAt).toLocaleString()}</time></>}</p>
    {review.decision === undefined ? null : <p>{t('reviewDecision', {
      probability: `${(review.decision.probability * 100).toFixed(1)}%`,
      threshold: `${(review.decision.threshold * 100).toFixed(1)}%`,
    })}</p>}
  </div>
}
