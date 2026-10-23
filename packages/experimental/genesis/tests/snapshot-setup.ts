/** Keyless recorded-session setup; production naming is exercised through the real gateway integration test. */
import type { Context } from '@deepseek-ai/cordis'
import { LlmAdapter, type StreamChunk } from '@deepseek-ai/dsh-llm'
import type {} from '../src/index.ts'

class NoMemoryUpdate extends LlmAdapter {
  override async resolveModel(provider: string, model: string) { return { provider, id: model, name: model } }
  override async * stream(): AsyncIterable<StreamChunk> {
    const text = '{"update":false}'
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'text-delta', index: 0, text }
    yield { type: 'block-end', index: 0, block: { type: 'text', text } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}
export const name = 'snapshot-genesis-awakening'
export const inject = ['genesis', 'llm']
/** Prepare a named life with a separate keyless no-update reviewer for a recorded main conversation. */
export async function apply(ctx: Context): Promise<void> {
  ctx.llm.registerAdapter(['genesis-snapshot-reviewer'], new NoMemoryUpdate())
  await ctx.genesis.awaken('小芽')
}
