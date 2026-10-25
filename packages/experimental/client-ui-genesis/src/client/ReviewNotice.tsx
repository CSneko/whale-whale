/** Memory errors remain separate from completed chat replies. @module */
import { useEffect, useRef, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsRuntime, PropsLocale, InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ReviewOutcome } from '@deepseek-ai/dsh-experimental-genesis/types'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { operationFailure } from './operation-failure.ts'
import { ReviewDetails } from './ReviewDetails.tsx'
import css from './StatusPanel.module.css'

/** Latest-review retry supplied by the authenticated Host, retaining its specific error. */
export interface ReviewActions { retry(this: void, sessionId: SessionId, signal: AbortSignal): Promise<RemoteResult<void>> }

type SummaryProps = PropsLocale<'genesis'> & { review: ReviewOutcome }

/**
 * Display the latest review and its safe failure diagnostic in chat or Knowledge Base.
 * @param props - Review result and localized stage labels.
 * @returns Persistent feedback naming the operation and specific failure.
 */
export function ReviewSummary({ review, t }: SummaryProps) {
  return <><p role={review.state === 'failed' ? 'alert' : 'status'}>
    {t(review.state === 'failed' ? 'reviewFailed' : review.state === 'saved' ? 'reviewSaved' : 'reviewSkipped')}
    {review.state !== 'failed' ? null : <> {t('reviewFailureDetail', {
      stage: t(`reviewStage.${review.failure.stage}`),
      reason: operationFailure(new Error(review.failure.message), [], t('unknownError')),
    })}</>}
  </p><ReviewDetails review={review} t={t} /></>
}

function FailedReview({ review, retry, t }: PropsLocale<'genesis'> & ReviewActions & { review: Extract<ReviewOutcome, { state: 'failed' }> }) {
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<string>()
  const operation = useRef<AbortController>()
  useEffect(() => () => { operation.current?.abort() }, [])
  return <div className={css.panel}>
    <ReviewSummary review={review} t={t} />
    <Button variant="outline" size="sm" disabled={pending} onClick={() => {
      if (operation.current !== undefined) return
      const owned = new AbortController()
      operation.current = owned; setPending(true); setFailure(undefined)
      void retry(review.sessionId, owned.signal).then((result) => {
        if (owned.signal.aborted || result.ok) return
        const stage = result.error.code === 'genesis/review' ? `${t(`reviewStage.${result.error.details.stage}`)}: ` : ''
        setFailure(stage + operationFailure(result.error, [], t('unknownError')))
      }).catch((error: unknown) => {
        if (!owned.signal.aborted) setFailure(operationFailure(error, [], t('unknownError')))
      }).finally(() => {
        operation.current = undefined; if (!owned.signal.aborted) setPending(false)
      })
    }}>{t('retryMemory')}</Button>
    {failure === undefined ? null : <p role="alert">{t('retryMemoryFailed', { reason: failure })}</p>}
  </div>
}

/**
 * Report a failed review beside the owning conversation without blocking its composer.
 * @param props - Session identity, shared status resource and cancellable retry.
 * @returns An actionable retained warning only for the owning Session; a new failed turn resets retry feedback.
 */
export function ReviewNotice({ sessionId, useResource, retry, t }: PropsRuntime<'conversation.input.dock'> & PropsLocale<'genesis'> & InjectFace<ReviewActions>) {
  const review = useResource<'genesis'>('dsh-resource://genesis/status').value?.review
  return review?.state !== 'failed' || review.sessionId !== sessionId ? null
    : <FailedReview key={`${sessionId}:${review.turn}`} review={review} retry={retry} t={t} />
}
