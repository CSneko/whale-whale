/** Bounded, logged auxiliary inference shared by memory and emotion reviews. @module */
import type { Context } from '@deepseek-ai/cordis'
import { BlockAssembler, ReasoningEffortId, type LlmCallConfig } from '@deepseek-ai/dsh-llm'
import { appendPluginRecord, type Session, type SessionSeq } from '@deepseek-ai/dsh-session'
import type { MemoryConfig } from './config.ts'
import type { MemoryModelsSettings } from './status-types.ts'
import { endpointRequest, endpointResult, modelHeaders, modelJson } from './model-endpoint.ts'
import { GenesisError } from './error.ts'
import { participants, PARTICIPANT_GUIDANCE } from './participants.ts'
import { MEMORY_TIME_GUIDANCE } from './memory-time.ts'

/** Audit role; emotion decisions never use the memory question. */
export type AuxiliaryRole = 'decision' | 'writer' | 'emotion-decision' | 'emotion-writer' | 'interest-writer' | 'deliberation-writer'

type MemoryCallRecord = {
  version: 1
  phase: 'request'
  role: AuxiliaryRole
  config: LlmCallConfig
  system: string
  input: string
} | { version: 1; phase: 'response'; requestSeq: SessionSeq; text: string }

declare module '@deepseek-ai/dsh-session/types' {
  interface PluginRecordMap {
    /** Auxiliary memory and emotion inputs and outputs; retained for audit, never conversation context or replay state. */
    'plugin:genesis/memory-call': MemoryCallRecord
    /** Exact auxiliary HTTP inference inputs and bounded responses, excluding authorization. */
    'plugin:genesis/model-http': { version: 1; phase: 'request'; route: MemoryModelsSettings['decision'] | MemoryModelsSettings['writer']; body: object }
      | { version: 1; phase: 'response'; requestSeq: SessionSeq; body: unknown }
  }
}

/**
 * Call a captured auxiliary route; requests and complete responses are logged before publication.
 * @param ctx - Model and credential services.
 * @param session - Source inference audit log.
 * @param role - Independent memory or emotion operation.
 * @param system - Role-specific instructions, including the Jev question.
 * @param input - Bounded evidence and state.
 * @param signal - Owner cancellation and deadline.
 * @param models - Routes captured once for this review.
 * @param config - Complete input, output and token budgets.
 * @param criteria - Optional explicit yes/no descriptions for the decision endpoint.
 * @returns Untrusted decoded JSON; no state is changed by this function.
 */
export async function auxiliaryCall(ctx: Context, session: Session, role: AuxiliaryRole, system: string,
  input: Record<string, unknown>, signal: AbortSignal, models: MemoryModelsSettings, config: MemoryConfig,
  criteria?: { true: string; false: string }): Promise<unknown> {
  input = { ...input, participants: input['participants'] ?? participants(await ctx.genesis.snapshot()) }
  if (role === 'writer' || role === 'emotion-writer' || role === 'interest-writer' || role === 'deliberation-writer') system = `${system}\n\n${PARTICIPANT_GUIDANCE}`
  if (role === 'writer') system = `${system}\n\n${MEMORY_TIME_GUIDANCE}`
  const text = JSON.stringify(input)
  if (text.length > config.inputChars) throw new GenesisError('capacity', 'Memory review exceeds memory.inputChars. Increase the review budget; nothing was updated.')
  const route = models[role === 'decision' || role === 'emotion-decision' ? 'decision' : 'writer']
  if (route.kind !== 'provider') {
    const body = endpointRequest(route, system, input, config.maxTokens, role === 'emotion-decision' ? 'emotion' : 'remember', criteria)
    if (JSON.stringify(body).length > config.inputChars) throw new GenesisError('capacity', 'Memory HTTP request exceeds inputChars.')
    const headers = await modelHeaders(ctx, route)
    const requestSeq = appendPluginRecord(session, 'plugin:genesis/model-http', { version: 1, phase: 'request', route, body })
    const response = await fetch(route.url, { method: 'POST', headers, body: JSON.stringify(body), signal, redirect: 'error' })
    const raw = await modelJson(response, config.outputChars, 'memory.outputChars')
    signal.throwIfAborted()
    appendPluginRecord(session, 'plugin:genesis/model-http', { version: 1, phase: 'response', requestSeq, body: raw })
    return endpointResult(route, raw, role === 'emotion-decision' ? 'emotion' : 'remember')
  }
  const call = await ctx.llm.prepareCall({ provider: route.provider, model: route.model, maxTokens: config.maxTokens }, signal,
    (controls, model) => {
      if (config.reasoningEffort === 'provider-default') return controls
      if (config.reasoningEffort === 'auto') {
        const off = model.reasoning?.efforts.find(effort => effort.id === 'off')
        return off === undefined ? controls : { ...controls, reasoningEffort: off.id }
      }
      return { ...controls, reasoningEffort: ReasoningEffortId(config.reasoningEffort) }
    })
  const requestSeq = appendPluginRecord(session, 'plugin:genesis/memory-call', {
    version: 1, phase: 'request', role, config: call.config, system, input: text,
  })
  const assembler = new BlockAssembler()
  let chars = 0
  let finished = false
  for await (const chunk of call.stream({ ...call.config, system, signal, messages: [{ role: 'user', content: [{ type: 'text', text }] }] })) {
    signal.throwIfAborted()
    if (chunk.type === 'text-delta' || chunk.type === 'reasoning-delta') chars += chunk.text.length
    if (chunk.type === 'tool-call-delta') chars += chunk.argumentsDelta.length
    if (chars > config.outputChars) throw new GenesisError('capacity', 'Memory model response exceeds memory.outputChars. No changes were applied.')
    if (chunk.type === 'finish') finished = true
    assembler.push(chunk)
  }
  signal.throwIfAborted()
  if (!finished) throw new GenesisError('memory-provider', 'Memory model stream ended without a completion reason. Check service connectivity.')
  const finish = assembler.finish
  if (finish.kind === 'error' || finish.kind === 'aborted') {
    const code = /^[A-Z][A-Z0-9_]{0,63}$/u.test(finish.failure.code) ? finish.failure.code : 'PROVIDER_ERROR'
    const status = finish.failure.status === undefined ? '' : `; HTTP ${finish.failure.status}`
    throw new GenesisError('memory-provider', `Memory model request failed (${code}${status}). Check the configured provider, credential and quota.`)
  }
  if (finish.kind !== 'stop') throw new GenesisError('memory-provider',
    `Memory model did not complete JSON (finish: ${finish.kind}; memory.maxTokens=${config.maxTokens}; reasoningEffort=${call.config.reasoningEffort ?? 'provider-default'}). Reduce memory.reasoningEffort or increase memory.maxTokens; no changes were applied.`)
  const result = assembler.blocks().filter(block => block.type === 'text').map(block => block.text).join('')
  if (result.length > config.outputChars) throw new GenesisError('capacity', 'Memory model response exceeds memory.outputChars.')
  appendPluginRecord(session, 'plugin:genesis/memory-call', { version: 1, phase: 'response', requestSeq, text: result })
  return JSON.parse(result)
}
