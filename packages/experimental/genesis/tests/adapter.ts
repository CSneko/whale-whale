/** Scripted model is the only substituted runtime in integration tests. */
import { LlmAdapter, ToolCallId, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'

export class ScriptedModel extends LlmAdapter {
  readonly requests: GenerateOptions[] = []
  constructor(private readonly calls: Array<{ name: string; args: object } | string>) { super() }
  override async resolveModel(provider: string, model: string) { return { provider, id: model, name: model } }
  override async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options)
    const call = this.calls.shift()
    if (call === undefined) throw new Error('Genesis scripted model exhausted')
    if (typeof call === 'string') {
      yield { type: 'block-start', index: 0, blockType: 'text' }
      yield { type: 'text-delta', index: 0, text: call }
      yield { type: 'block-end', index: 0, block: { type: 'text', text: call } }
      yield { type: 'finish', reason: { kind: 'stop' } }
    } else {
      const id = ToolCallId(`genesis-call-${this.requests.length}`)
      const args = JSON.stringify(call.args)
      yield { type: 'block-start', index: 0, blockType: 'tool-call' }
      yield { type: 'tool-call-delta', index: 0, id, name: call.name, argumentsDelta: args }
      yield { type: 'block-end', index: 0, block: { type: 'tool-call', id, name: call.name, arguments: args } }
      yield { type: 'finish', reason: { kind: 'tool-calls' } }
    }
  }
}
