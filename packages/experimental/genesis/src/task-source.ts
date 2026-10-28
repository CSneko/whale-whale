/** Durable attribution for explicit work assigned by Life to an ordinary session. @module */
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { ContextFormed } from '@deepseek-ai/dsh-llm'

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    /** Assignment provenance; never a human-authored message or a life-state snapshot. @persistenceAttribution */
    'genesis-task': {
      kind: 'genesis-task'
      requester: SessionId
      requestId: string
      fingerprint: string
    } & ContextFormed
  }
}
