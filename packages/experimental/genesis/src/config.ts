/** Deployment-owned storage exclusion and context limits. @module */
import z from '@deepseek-ai/schemastery'
/** Validated, resolved Genesis plugin configuration. */
export interface Config {
  /** Shared exclusive lease file for all processes accessing this life domain. */
  leasePath: string
  /** Maximum retained facts, memories, growth records and scope entries; exhaustion refuses writes. */
  maxRecords: number
  /** Maximum complete serialized snapshot characters. */
  maxStateChars: number
  /** Identity context character budget. */
  identityChars: number
  /** Capability context character budget. */
  capabilityChars: number
  /** Memory context character budget. */
  memoryChars: number
  /** Growth context character budget. */
  growthChars: number
  /** Complete model tool result budget, including wrappers. */
  resultChars: number
  /** Maximum records in a query response. */
  queryLimit: number
}
/** Loader schema resolves every deployment-varying bound before plugin activation. */
export const Config: z<Partial<Config> & Pick<Config, 'leasePath'>, Config> = z.object({
  leasePath: z.string().required(),
  maxRecords: z.number().step(1).min(20).max(1_000_000).default(20_000),
  maxStateChars: z.number().step(1).min(10000).max(100_000_000).default(10_000_000),
  identityChars: z.number().step(1).min(512).max(10000).default(1200),
  capabilityChars: z.number().step(1).min(256).max(100000).default(4000),
  memoryChars: z.number().step(1).min(256).max(100000).default(4000),
  growthChars: z.number().step(1).min(256).max(100000).default(2000),
  resultChars: z.number().step(1).min(512).max(1000000).default(16000),
  queryLimit: z.number().step(1).min(1).max(1000).default(20),
})
