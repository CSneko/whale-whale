/** OpenAI-compatible embedding transport and semantic scoring. @module */
import { attributionHeaders, assertUsableApiKey } from '@deepseek-ai/dsh-llm'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import type { MemoryConfig } from './config.ts'
import { GenesisError } from './error.ts'
import type { MemoryEmbedding } from './model.ts'

/** A deployment-bound embedding space; endpoint/model/dimensions cannot share stale vectors. */
export class MemoryEmbeddings {
  /** Digest of the configured endpoint, model and dimensions. */
  readonly space: string
  private readonly headers: Record<string, string>
  /**
   * Validate the embedding space. Credentials are resolved per request so first-run configuration can finish before use.
   * @param config - Resolved embedding deployment and response limits.
   */
  constructor(private readonly config: MemoryConfig) {
    const url = new URL(config.embeddingUrl)
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
      throw new GenesisError('memory-provider', 'Configure an HTTP(S) embeddingUrl without embedded credentials.')
    }
    this.headers = { ...attributionHeaders(), 'content-type': 'application/json' }
    this.space = createHash('sha256').update(JSON.stringify([url.href, config.embeddingModel, config.embeddingDimensions])).digest('hex')
  }

  /**
   * Embed one bounded input, validating the response before indexing it.
   * @param text - Query or memory text.
   * @param signal - Operation deadline and caller cancellation.
   * @returns A nonzero finite vector in this deployment's space.
   */
  async embed(text: string, signal: AbortSignal): Promise<MemoryEmbedding> {
    signal.throwIfAborted()
    if (!text.trim() || text.length > this.config.inputChars) {
      throw new GenesisError('capacity', 'Embedding input is empty or exceeds memory.inputChars. Narrow the query.')
    }
    const response = await fetch(this.config.embeddingUrl, {
      method: 'POST', headers: { ...this.headers, ...(this.config.embeddingKeyEnv === undefined ? {} : {
        authorization: `Bearer ${assertUsableApiKey(process.env[this.config.embeddingKeyEnv] ?? '',
          'Genesis embeddings', this.config.embeddingKeyEnv)}`,
      }) }, signal, redirect: 'error',
      body: JSON.stringify({ model: this.config.embeddingModel, input: text, dimensions: this.config.embeddingDimensions }),
    })
    if (!response.ok) {
      await response.body?.cancel()
      throw new GenesisError('memory-provider', `Genesis embedding request failed (HTTP ${response.status}). Check the configured endpoint, model and credential.`)
    }
    // Bound the complete wire response before JSON decoding; vectors can otherwise exhaust memory.
    const limit = this.config.embeddingDimensions * 40 + this.config.outputChars
    if (response.body === null) throw new GenesisError('memory-provider', 'Embedding response has no body. Check the embedding service.')
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let json = ''
    let bytes = 0
    try {
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) break
        bytes += chunk.value.byteLength
        if (bytes > limit) throw new GenesisError('capacity', 'Embedding response exceeds the configured dimension budget.')
        json += decoder.decode(chunk.value, { stream: true })
      }
      json += decoder.decode()
    } finally { await reader.cancel() }
    const parsed = z.object({ data: z.tuple([z.object({
      index: z.literal(0), embedding: z.array(z.number()).length(this.config.embeddingDimensions),
    })]) }).parse(JSON.parse(json))
    const vector = parsed.data[0].embedding
    const norm = Math.hypot(...vector)
    if (!Number.isFinite(norm) || norm === 0) throw new GenesisError('memory-provider', 'Embedding response has an invalid vector. Check the embedding model.')
    return { space: this.space, vector: vector.map(value => value / norm) }
  }
}

/**
 * Compare equal-space vectors; incompatible durable vectors are never searched silently.
 * @param left - Query embedding.
 * @param right - Indexed embedding.
 * @returns Cosine similarity, or a typed refusal for incompatible dimensions/spaces.
 */
export function cosine(left: MemoryEmbedding, right: MemoryEmbedding): number {
  if (left.space !== right.space || left.vector.length !== right.vector.length) {
    throw new GenesisError('memory-provider', 'Memory vectors belong to different embedding spaces. Reindex before searching.')
  }
  const denominator = Math.hypot(...left.vector) * Math.hypot(...right.vector)
  if (!Number.isFinite(denominator) || denominator === 0) throw new GenesisError('memory-provider', 'Stored memory has an invalid embedding. Reindex before searching.')
  // Equal dimensions above guarantee the corresponding component exists.
  // oxlint-disable-next-line typescript/no-non-null-assertion
  return left.vector.reduce((sum, value, index) => sum + value * right.vector[index]!, 0) / denominator
}
