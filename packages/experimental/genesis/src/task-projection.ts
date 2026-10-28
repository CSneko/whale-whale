/** Replayable assignment identity and latest task settlement, separate from life memory. @module */
import { z } from 'zod'
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import type {} from './task-source.ts'

const schema = z.object({
  assignment: z.object({ requester: z.string(), requestId: z.string(), fingerprint: z.string() }).nullable(),
  open: z.boolean(),
  reason: z.object({ kind: z.string(), error: z.object({ message: z.string(), code: z.string(),
    status: z.number().optional(), providerRetryAfterMs: z.number().optional(),
    requestId: z.string().optional(), offloadImages: z.number().optional(),
  }).optional() }).nullable(),
  resultSeqs: z.array(z.number().int().nonnegative()),
})
/** Latest task outcome rebuilt from the session; result bodies remain in their original events. */
export type TaskProjection = z.infer<typeof schema>
declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionStateMap { genesisTask: TaskProjection }
  interface SessionProjectionMap { genesisTask: TaskProjection }
}
/** Assignment survives inbox admission and restart; status derives only from actual turn events. */
export const taskProjection = {
  key: 'genesisTask', stateVersion: 1, stateSchema: schema,
  init: () => ({ assignment: null, open: false, reason: null, resultSeqs: [] }),
  apply(state, event) {
    if (state.assignment === null) {
      const sources = event.type === 'user/message' ? [event.data.source]
        : event.type === 'agent/inbox/spliced' ? event.data.inserted.map(message => message.source) : []
      const source = sources.find(item => item.kind === 'genesis-task')
      if (source?.kind === 'genesis-task') return { ...state, assignment: {
        requester: source.requester, requestId: source.requestId, fingerprint: source.fingerprint } }
    }
    if (event.type === 'turn/start') return { ...state, open: true, reason: null, resultSeqs: [] }
    if (event.type === 'turn/end') return { ...state, open: false, reason: {
      kind: event.data.reason.kind, ...(event.data.reason.kind === 'error' ? { error: event.data.reason.error } : {}) } }
    if (event.type === 'assistant/message') return { ...state, resultSeqs: [...state.resultSeqs, event.seq] }
    return state
  },
  wire: { viewSchema: schema, view: state => state },
} satisfies ProjectionDefinition<'genesisTask'>
