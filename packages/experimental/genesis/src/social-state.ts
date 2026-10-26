/** Persistent proactive-conversation receipts; no separate motivation inventory. @module */
import { z } from 'zod'
import { brandString, type Branded } from '@deepseek-ai/dsh-brand'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { LifeEventId } from './model.ts'
import type { DecisionId } from './agency-state.ts'

/** Identity shared by an opportunity, its internal notice and its assistant receipt. */
export type InteractionId = Branded<'GenesisInteractionId'>
/** Delivery state is separate from the character's decision to speak. */
export const interactionSchema = z.strictObject({
  id: z.uuid().transform(brandString<InteractionId>), key: z.string().min(1).max(300),
  sourceEventId: z.uuid().transform(brandString<LifeEventId>),
  createdAt: z.iso.datetime(), status: z.enum(['pending', 'dispatching', 'sent', 'skipped', 'uncertain']),
  sessionId: z.string().min(1).transform(brandString<SessionId>).optional(),
  decisionId: z.uuid().transform(brandString<DecisionId>).optional(),
  reason: z.string().min(1).max(800).optional(), note: z.string().max(2000).optional(),
  dispatchedAt: z.iso.datetime().optional(), sentAt: z.iso.datetime().optional(),
  message: z.string().optional(), messageSeq: z.number().int().nonnegative().optional(),
}).refine(item => item.status !== 'sent' || (item.sentAt !== undefined && item.message !== undefined
  && item.messageSeq !== undefined && item.sessionId !== undefined && item.decisionId !== undefined), 'Missing assistant delivery receipt')
/** Versioned optional projection; existing lives initialize it only on explicit enablement. */
export const initiativeSchema = z.strictObject({ version: z.literal(1), records: z.array(interactionSchema) })
/** One durable opportunity and its observed delivery outcome. */
export type InteractionRecord = z.infer<typeof interactionSchema>
