/** Read-only Genesis status projection for authenticated Web settings. @module */
import type { LifeIdentity, LifeMemory, GrowthRecord, CapabilityState } from './model.ts'
import type { SessionId } from '@deepseek-ai/dsh-session'

/** A sampled view; historical Session observations never become current availability. */
export interface LifeStatus {
  identity: LifeIdentity
  sampledAt: string
  runtime: { platform: string; node: string; liveSessions: number }
  counts: { events: number; memories: number; growth: number }
  capabilities: Array<{ sessionId: SessionId; capability: CapabilityState }>
  memories: LifeMemory[]
  growth: GrowthRecord[]
  omitted: { capabilities: number; memories: number; growth: number }
}
