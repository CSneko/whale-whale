/** Deployment-owned storage exclusion and context limits. @module */
import z from '@deepseek-ai/schemastery'
/** Validated, resolved Genesis plugin configuration. */
export interface Config {
  /** Enables naming, newborn conversations and persistent tool learning on the configured chat route. */
  awakening?: {
    /** Registered chat provider checked before the naming step. */
    provider: string
    /** Chat model identifier on the configured provider. */
    model: string
  } | undefined
  /** Local atomic backup; omitted resolves beside leasePath as leasePath + '.backup.json'. */
  backupPath?: string
  /** Enables independent review/writing models and semantic memory search. */
  memory?: MemoryConfig | undefined
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
/** Explicit routes and budgets for the optional long-term memory pipeline. */
export interface MemoryConfig {
  /** Registered Harness provider for the update/no-update decision. */
  decisionProvider: string
  /** Model identifier on the decision provider. */
  decisionModel: string
  /** Registered Harness provider for the separate memory writer. */
  writerProvider: string
  /** Model identifier on the independent writer provider. */
  writerModel: string
  /** OpenAI-compatible embeddings endpoint, including /embeddings. */
  embeddingUrl: string
  /** Model identifier accepted by the embedding endpoint. */
  embeddingModel: string
  /** Environment variable holding the embeddings credential; omitted for keyless local servers. */
  embeddingKeyEnv?: string
  /** Exact vector length requested and validated on every embedding response. */
  embeddingDimensions: number
  /** Deadline per review or recall, including model calls and embeddings. */
  timeoutMs: number
  /** Complete serialized auxiliary input and single embedding input character limit. */
  inputChars: number
  /** Auxiliary model response character limit; also bounds embedding-response metadata. */
  outputChars: number
  /** Output token limit for each decision or writer call. */
  maxTokens: number
  /** Maximum changes in one atomic writer plan. */
  maxChanges: number
  /** Whole-life count limit for the small prompt-resident memory layer. */
  maxImplicitMemories: number
  /** Minimum cosine similarity admitted into semantic recall results. */
  minSimilarity: number
}
/** Loader schema resolves every deployment-varying bound before plugin activation. */
export const Config: z<Partial<Config> & Pick<Config, 'leasePath'>, Config> = z.object({
  awakening: z.union([z.const(undefined), z.object({ provider: z.string().required(), model: z.string().required() })]),
  leasePath: z.string().required(),
  backupPath: z.string(),
  memory: z.union([z.const(undefined), z.object({
    decisionProvider: z.string().required(), decisionModel: z.string().required(),
    writerProvider: z.string().required(), writerModel: z.string().required(),
    embeddingUrl: z.string().required(), embeddingModel: z.string().required(),
    embeddingKeyEnv: z.string(),
    embeddingDimensions: z.number().step(1).min(1).max(65536).required(),
    timeoutMs: z.number().step(1).min(100).max(300000).default(30000),
    inputChars: z.number().step(1).min(512).max(1000000).default(24000),
    outputChars: z.number().step(1).min(128).max(1000000).default(24000),
    maxTokens: z.number().step(1).min(64).max(32000).default(4096),
    maxChanges: z.number().step(1).min(1).max(100).default(8),
    maxImplicitMemories: z.number().step(1).min(1).max(100).default(12),
    minSimilarity: z.number().min(-1).max(1).default(0.35),
  })]),
  maxRecords: z.number().step(1).min(20).max(1_000_000).default(20_000),
  maxStateChars: z.number().step(1).min(10000).max(100_000_000).default(10_000_000),
  identityChars: z.number().step(1).min(512).max(10000).default(1200),
  capabilityChars: z.number().step(1).min(256).max(100000).default(4000),
  memoryChars: z.number().step(1).min(256).max(100000).default(4000),
  growthChars: z.number().step(1).min(256).max(100000).default(2000),
  resultChars: z.number().step(1).min(512).max(1000000).default(16000),
  queryLimit: z.number().step(1).min(1).max(1000).default(20),
})
