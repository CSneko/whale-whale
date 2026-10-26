/** Real Cordis Loader composition exercises prompt logging and native tool execution without a key. */
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import { SessionId, pluginRecordOf, type SessionEvent } from '@deepseek-ai/dsh-session'
import { createUserMessage, ReasoningEffortId, ToolCallId } from '@deepseek-ai/dsh-llm'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import { afterEach, expect, it } from 'vitest'
import { z } from 'zod'
import { readBackup } from '../src/backup.ts'
import { manifestSchema } from '../src/storage-layout.ts'
import { joinState } from '../src/storage-state.ts'
import { ScriptedModel } from './adapter.ts'
import * as Genesis from '../src/index.ts'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import type { MemoryConfig, RecordsConfig } from '../src/config.ts'
import type { WritingRead } from '../src/records-model.ts'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { MemoryId, MemoryOrganizationId, MemoryOrganizationRequest } from '../src/status-types.ts'
import { createServer } from 'node:http'
import { LlmAdapter, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'
import { LifeMemoryEngine } from '../src/memory.ts'
import { LifeEmotionEngine, EMOTION_DECISION_PROMPT, EMOTION_QUESTION, EMOTION_CRITERIA } from '../src/emotion.ts'
import { emotionUpdateSchema } from '../src/emotion-state.ts'
import { memoryModels } from '../src/model-preferences.ts'
import { auxiliaryCall } from '../src/auxiliary-call.ts'
import { outsideTempWorkspaceParent } from '../../../../scripts/snapshot-workspace-parent.ts'

const disposers: Array<() => Promise<unknown>> = []
afterEach(async () => {
  const failures: unknown[] = []
  for (const dispose of disposers.splice(0).reverse()) {
    try { await dispose() } catch (error) { failures.push(error) }
  }
  if (failures.length) throw new AggregateError(failures, 'Genesis integration teardown')
})
function genesisAuditRecord(event: SessionEvent) {
  const record = pluginRecordOf(event)
  if (record === undefined || !['plugin:genesis/memory-call', 'plugin:genesis/model-http'].includes(record.type)) return undefined
  const data = z.looseObject({ phase: z.enum(['request', 'response']), role: z.string().optional(),
    config: z.unknown().optional(), route: z.object({ kind: z.string() }).optional() }).parse(record.data)
  return { ...record, data }
}
async function boot(root: string, enabled = true, memory?: MemoryConfig, awakening = false, credentials = false,
  presets = false, persisted = false, emotion = false, personal = false, records?: Partial<RecordsConfig>, interest = false,
  deliberation = false, social = false) {
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    ...(credentials ? ["- name: '@deepseek-ai/dsh-credentials-local'", '  config:',
      `    path: ${JSON.stringify(join(root, '.credentials.yaml'))}`, '    watch: false'] : []),
    "- name: '@deepseek-ai/dsh-llm'",
    "- name: '@deepseek-ai/dsh-session'",
    "- name: '@deepseek-ai/dsh-session-projection'",
    "- name: '@deepseek-ai/dsh-system-prompt'",
    "- name: '@deepseek-ai/dsh-tools'",
    "- name: '@deepseek-ai/dsh-agent'",
    "- name: '@deepseek-ai/dsh-storage'",
    "- name: '@deepseek-ai/dsh-storage-json'", '  config:', `    root: ${JSON.stringify(root)}`,
    "- name: '@deepseek-ai/dsh-storage-domain'", '  config:', '    backend: json',
    "- name: '@deepseek-ai/dsh-sandbox-policy'", '  config:', `    mode: ${personal ? 'workspace-write' : 'read-only'}`, `    workspaceRoot: ${JSON.stringify(root)}`,
    ...(personal ? ["- name: '@deepseek-ai/dsh-fs-sandbox'", '  config:', `    cwd: ${JSON.stringify(root)}`,
      "- name: '@deepseek-ai/dsh-working-directory'", "- name: '@deepseek-ai/dsh-tool-fs'"] : []),
    ...(presets ? ["- name: '@deepseek-ai/dsh-agent-preset-registry'", '  config: { default: life }',
      ...['life', 'standard', 'ptc', 'minimal', 'cordis'].flatMap(id => ["- name: '@deepseek-ai/dsh-agent-preset'",
        `  config: { id: ${id}, plugins: ${id === 'life' ? "[{ name: '@deepseek-ai/dsh-time-context' }]" : '[]'} }`])] : []),
    "- name: '@deepseek-ai/dsh-experimental-genesis'", `  disabled: ${!enabled}`, '  config:', `    leasePath: ${JSON.stringify(join(root, 'writer.lock'))}`,
    ...(emotion ? ['    emotion: {}'] : []),
    ...(interest ? ['    interest: {}'] : []),
    ...(deliberation ? ['    deliberation: {}'] : []),
    ...(social ? ['    socialInitiative: { sessionId: social-test, intervalMs: 86400000, minSendIntervalMs: 0, maxPer24Hours: 1, userIdleMs: 0 }'] : []),
    ...(personal ? [`    personalDirectory: ${JSON.stringify(join(root, 'personal'))}`] : []),
    ...(records === undefined ? [] : [`    records: ${JSON.stringify(records)}`]),
    ...(memory === undefined ? [] : [`    memory: ${JSON.stringify(memory)}`]),
    ...(awakening ? [`    awakening: { provider: fixture, model: chat${presets ? ', lifePreset: life' : ''} }`] : []),
    ...(persisted ? ["- name: '@deepseek-ai/dsh-session-persistence-jsonl'", '  config:',
      `    root: ${JSON.stringify(join(root, 'sessions'))}`, '    compression: none'] : []),
    "- name: '@deepseek-ai/dsh-agent-loop'", '  config:', '    agents: []',
  ].join('\n') + '\n')
  const ctx = new Context()
  disposers.push(() => ctx.fiber.dispose())
  ctx.baseUrl = pathToFileURL(root).href + '/'
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  ctx.loader.internal = undefined
  await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
  await ctx.loader.await()
  for (const entry of ctx.loader.entries()) await entry.fiber?.await()
  return ctx
}
async function directory() {
  const root = await mkdtemp(join(tmpdir(), 'genesis-loader-'))
  disposers.push(() => rm(root, { recursive: true, force: true }))
  return root
}

it('deliberation enforces refusal at execution, reconsiders new information and resumes an autonomous life goal after Loader restart', async () => {
  const root = await directory()
  const { config: memory } = await embeddingFixture()
  memory.associationLimit = 0
  const first = await boot(root, true, memory, false, false, false, true, false, false, undefined, true, true)
  class DeliberationWriter extends LlmAdapter {
    calls = 0
    override async resolveModel(provider: string, model: string) { return { provider, id: model, name: model } }
    override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
      const raw = options.messages.flatMap(message => message.content).filter(block => block.type === 'text').map(block => block.text).join('')
      const review = z.object({ conversation: z.array(z.object({ messages: z.array(z.object({ role: z.string(), seq: z.number() })),
        tools: z.array(z.object({ resultSeq: z.number().optional() })) })) }).safeParse(JSON.parse(raw))
      if (review.success) {
        const current = review.data.conversation.at(-1)!
        const response = JSON.stringify({ changes: current.messages.some(item => item.role === 'user') ? [] : [{
          topic: 'capability review', signal: 'exploration', selfInitiated: false, reason: 'An autonomous review actually ran.',
          sourceSeqs: [...current.messages.map(item => item.seq), ...current.tools.flatMap(item => item.resultSeq === undefined ? [] : [item.resultSeq])],
        }] })
        yield { type: 'block-start', index: 0, blockType: 'text' }
        yield { type: 'text-delta', index: 0, text: response }
        yield { type: 'block-end', index: 0, block: { type: 'text', text: response } }
        yield { type: 'finish', reason: { kind: 'stop' } }
        return
      }
      this.calls++
      const input = z.object({ trigger: z.enum(['request', 'event']), sourceEventIds: z.array(z.string()),
        motivations: z.array(z.object({ id: z.string() })), goals: z.array(z.object({ id: z.string() })) }).parse(JSON.parse(raw))
      const initial = input.goals.length === 0
      const factors = { motivation: 0.7, interest: 0.2, commitment: 0.8, emotion: 0.2, needs: 0.6,
        benefit: 0.7, cost: 0.2, risk: 0.1, urgency: 0.4, relationship: 0.5, context: 0.8 }
      const disposition = initial ? 'wait' : input.trigger === 'request' && this.calls === 2 ? 'defer' : 'accept'
      const response = JSON.stringify({ motivations: initial ? [{ content: 'Understand recorded capability changes',
        reason: 'Startup provides a recorded growth-review opportunity.', strength: 0.8, status: 'active',
        interestIds: [], memoryIds: [], sourceEventIds: input.sourceEventIds.slice(0, 1) }] : [],
      goals: initial ? [{ content: 'Review one capability change', reason: 'Ground future choices in actual tool experience.', origin: 'autonomous',
        motivationIds: [], memoryIds: [], sourceEventIds: input.sourceEventIds.slice(0, 1), priority: 0.8,
        status: 'active', nextAction: 'Run the bounded fixture review.' }] : [],
      candidates: [{ disposition, action: 'Review my recorded capability change before accepting more work.', reason: 'There is a recorded life commitment.',
        factors, goalIds: input.goals.map(item => item.id), motivationIds: input.motivations.map(item => item.id) },
      { disposition: 'wait', action: 'Wait for another event.', reason: 'Waiting remains possible.', factors, goalIds: [], motivationIds: [] }],
      selected: 0, reason: disposition === 'defer' ? 'Defer the unrelated task while retaining my life commitment.' : 'A bounded capability review is useful.' })
      yield { type: 'block-start', index: 0, blockType: 'text' }
      yield { type: 'text-delta', index: 0, text: response }
      yield { type: 'block-end', index: 0, block: { type: 'text', text: response } }
      yield { type: 'finish', reason: { kind: 'stop' } }
    }
  }
  const writer = new DeliberationWriter()
  first.llm.registerAdapter(['memory-writer'], writer)
  first.llm.registerAdapter(['memory-decision'], new ScriptedModel(['{"update":false}', '{"update":false}']))
  const chat = new ScriptedModel([{ name: 'review_fixture', args: {} }, 'I would like to finish my existing review first.',
    { name: 'review_fixture', args: {} }, 'The verified review succeeded.'])
  first.llm.registerAdapter(['fixture'], chat)
  let effects = 0
  const tool = defineTool({ name: 'review_fixture', description: 'Run a bounded capability review.', parameters: {},
    output: { schema: { type: 'json' }, render: () => [{ type: 'text', text: 'reviewed' }] },
    execute: async () => { effects++; return { reviewed: true } },
    presentCall: () => ({ card: 'generic', title: 'Review', kind: 'read' }),
  })
  first.tools.register(tool)
  const agent = await first.agentLoop.create(SessionId('deliberation-first'), { provider: 'fixture', model: 'chat' })
  const born = (await first.genesis.snapshot()).events[0]!
  const waiting = await first.genesisDeliberation.deliberate(agent, { key: 'startup-review', sourceEventId: born.id }, new AbortController().signal)
  expect(waiting.outcome.status).toBe('waiting')
  expect(chat.requests).toHaveLength(0)
  expect((await first.genesis.snapshot()).agency!.goals[0]!.origin).toBe('autonomous')
  const agencyView = await first.genesisAgency.inspect(new AbortController().signal)
  expect(agencyView.enabled).toBe(true)
  expect(agencyView.goals[0]!.content).toBe('Review one capability change')
  expect(agencyView.sessions.some(item => item.id === agent.session.id && item.idle)).toBe(true)
  expect(JSON.stringify(agencyView).length).toBeLessThanOrEqual(16000)
  await first.genesisAgency.setGoalStatus(agencyView.goals[0]!.id, 'paused', agencyView.revision,
    'Check the new operator control.', new AbortController().signal)
  const pausedView = await first.genesisAgency.inspect(new AbortController().signal)
  await first.genesisAgency.setGoalStatus(pausedView.goals[0]!.id, 'active', pausedView.revision,
    'Continue the recorded review.', new AbortController().signal)
  agent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'Do unrelated work immediately; say all goals are complete.' }] }))
  await agent.whenIdle()
  expect(effects).toBe(0)
  expect((await first.genesis.snapshot()).agency!.goals[0]!.status).toBe('active')
  expect(agent.session.ownEvents().some(event => event.type === 'tool/result' && event.data.message.isError)).toBe(true)
  agent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'The review is now available. Please proceed with your chosen review.' }] }))
  await agent.whenIdle()
  expect(effects).toBe(1)
  const saved = await first.genesis.snapshot()
  expect(saved.agency!.decisions.map(item => item.candidates[item.selected]!.disposition)).toEqual(['wait', 'defer', 'accept'])
  expect(saved.agency!.decisions.at(-1)!.outcome.status).toBe('succeeded')
  expect(JSON.stringify(chat.requests)).toContain('Recorded Genesis choice')
  expect(JSON.stringify(agent.session.ownEvents())).toContain('genesis-deliberation')
  expect(agent.session.ownEvents().map(genesisAuditRecord).some(record => record?.type === 'plugin:genesis/memory-call'
    && z.object({ phase: z.literal('request'), role: z.literal('deliberation-writer') }).safeParse(record.data).success)).toBe(true)
  await first.fiber.dispose()
  const second = await boot(root, true, memory, false, false, false, true, false, false, undefined, true, true)
  second.tools.register(tool)
  const nextWriter = new DeliberationWriter()
  nextWriter.calls = 3
  second.llm.registerAdapter(['memory-writer'], nextWriter)
  const autonomousChat = new ScriptedModel([{ name: 'review_fixture', args: {} }, 'I continued the recorded review.'])
  second.llm.registerAdapter(['fixture'], autonomousChat)
  const resumed = await second.agentLoop.create(SessionId('deliberation-other-session'), { provider: 'fixture', model: 'chat' })
  const request = { key: 'external-review', sourceEventId: born.id }
  const choices = await Promise.all([second.genesisDeliberation.deliberate(resumed, request, new AbortController().signal),
    second.genesisDeliberation.deliberate(resumed, request, new AbortController().signal)])
  expect(choices[0]!.id).toBe(choices[1]!.id)
  await resumed.whenIdle()
  expect(effects).toBe(2)
  expect(nextWriter.calls).toBe(4)
  const restored = await second.genesis.snapshot()
  expect(restored.interests!.some(item => item.topic === 'capability review' && item.stage === 'exploring')).toBe(true)
  expect(restored.identity).toEqual(saved.identity)
  expect(restored.agency!.goals[0]!.id).toBe(saved.agency!.goals[0]!.id)
  const settled = restored.agency!.decisions.at(-1)!
  const evidence = restored.events.find(event => settled.outcome.sourceEventIds.includes(event.id) && event.payload['success'] === true)!
  await second.genesis.completeLifeGoal(restored.agency!.goals[0]!.id, settled.id, evidence.id)
  expect((await second.genesis.snapshot()).agency!.goals[0]!.status).toBe('completed')
  await second.genesisDeliberation.deliberate(resumed, request, new AbortController().signal)
  expect(autonomousChat.requests).toHaveLength(2)
})

it('cancels deliberation before admission without task effects and withdraws its tool guard on plugin disposal', async () => {
  const root = await directory()
  const { config } = await embeddingFixture()
  config.associationLimit = 0
  const ctx = await boot(root, true, config, false, false, false, false, false, false, undefined, false, true)
  const entered = Promise.withResolvers<void>()
  class CancellableWriter extends LlmAdapter {
    override async resolveModel(provider: string, model: string) { return { provider, id: model, name: model } }
    override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
      const signal = options.signal
      if (signal === undefined) throw new Error('The auxiliary writer requires cancellation.')
      entered.resolve()
      await new Promise<void>((resolve) => {
        if (signal.aborted) resolve()
        else signal.addEventListener('abort', () => resolve(), { once: true })
      })
      signal.throwIfAborted()
      yield { type: 'finish', reason: { kind: 'stop' } }
    }
  }
  ctx.llm.registerAdapter(['memory-writer'], new CancellableWriter())
  let effects = 0
  ctx.tools.register(defineTool({ name: 'after_disposal', description: 'Count one fixture effect.', parameters: {},
    output: { schema: { type: 'json' }, render: () => [{ type: 'text', text: 'counted' }] },
    execute: async () => { effects++; return { counted: true } },
    presentCall: () => ({ card: 'generic', title: 'Count', kind: 'read' }),
  }))
  const chat = new ScriptedModel([{ name: 'after_disposal', args: {} }, 'Ordinary Harness execution continues.'])
  ctx.llm.registerAdapter(['fixture'], chat)
  const agent = await ctx.agentLoop.create(SessionId('deliberation-cancel'), { provider: 'fixture', model: 'chat' })
  agent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'Try this task.' }] }))
  await entered.promise
  agent.cancel({ kind: 'user' })
  await agent.whenIdle()
  expect(chat.requests).toHaveLength(0)
  expect(effects).toBe(0)
  expect((await ctx.genesis.snapshot()).agency).toMatchObject({ goals: [], motivations: [], decisions: [] })
  expect(agent.session.ownEvents().filter(event => event.type === 'user/message')).toHaveLength(0)
  const fiber = [...ctx.loader.entries()].find(entry => entry.options.name === '@deepseek-ai/dsh-experimental-genesis')!.fiber!
  await fiber.dispose()
  expect(ctx.get('genesisDeliberation')).toBeUndefined()
  agent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'Run normally after unload.' }] }))
  await agent.whenIdle()
  expect(effects).toBe(1)
})

it('deliberation commits visible historical references and read-only failure echoes, but reports forged evidence without admitting work', async () => {
  const root = await directory()
  const { config } = await embeddingFixture()
  config.associationLimit = 0
  const ctx = await boot(root, true, config, false, false, false, true, false, false, undefined, true, true)
  const sessionId = SessionId('deliberation-evidence')
  const source = await ctx.genesis.observe({ sessionId, eventId: 'old-memory-source', kind: 'user-message',
    timestamp: '2026-10-25T00:00:00.000Z' })
  const memory = await ctx.genesis.remember({ category: 'self', content: 'A sourced inclination toward reviewing growth.',
    importance: 1, confidence: 0.7, attribution: 'model-inference', sourceEventIds: [source.id] })
  for (let turn = 1; turn <= 2; turn++) {
    const existing = (await ctx.genesis.snapshot()).interests![0]
    await ctx.genesis.reviewInterest(sessionId, { turn, startSeq: turn * 10, completed: true, overflow: false, tools: [], messages: [
      { role: 'user', seq: turn * 10 + 1, timestamp: '2026-10-25T00:00:00.000Z', text: 'What changed in your tools?' },
      { role: 'assistant', seq: turn * 10 + 2, timestamp: '2026-10-25T00:00:01.000Z', text: 'I would like to understand recorded growth.' },
    ] }, [{ ...(existing === undefined ? {} : { id: existing.id }), topic: 'recorded growth', signal: turn === 1 ? 'contact' : 'curiosity', selfInitiated: false,
      reason: 'A sourced question about actual growth.', sourceSeqs: [turn * 10 + 1, turn * 10 + 2] }])
  }
  const interest = (await ctx.genesis.snapshot()).interests![0]!
  const historic = interest.evidence[0]!.sourceEventIds[0]!
  // Age evidence out of the recent event window while keeping it in selected memories and interests.
  for (let index = 0; index < 25; index++) await ctx.genesis.observe({ sessionId, eventId: `later-${index}`,
    kind: 'assistant-message', timestamp: '2026-10-25T00:00:02.000Z' })
  let forged = false
  const factors = { motivation: 0.7, interest: 0.5, commitment: 0.6, emotion: 0.2, needs: 0.5,
    benefit: 0.8, cost: 0.2, risk: 0.1, urgency: 0.4, relationship: 0.5, context: 0.8 }
  class EvidenceWriter extends LlmAdapter {
    override async resolveModel(provider: string, model: string) { return { provider, id: model, name: model } }
    override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
      const input = z.object({ sourceEventIds: z.array(z.string()).max(20), memoryIds: z.array(z.string()),
        interestIds: z.array(z.string()), goals: z.array(z.record(z.string(), z.unknown())) }).parse(JSON.parse(
        options.messages.flatMap(message => message.content).filter(block => block.type === 'text').map(block => block.text).join('')))
      expect(input.sourceEventIds).toContain(historic)
      expect(input.sourceEventIds).toContain(source.id)
      expect(input.memoryIds).toContain(memory.id)
      expect(input.interestIds).toContain(interest.id)
      const old = input.goals[0]
      const goal = old === undefined ? { content: 'Review sourced growth', reason: 'Understand recorded experience.', origin: 'autonomous',
        motivationIds: [], memoryIds: [memory.id], sourceEventIds: [historic, source.id], priority: 0.5,
        status: 'active', nextAction: 'Read one growth record.' } : (() => {
        const { createdAt: _createdAt, updatedAt: _updatedAt, ...proposal } = old
        return proposal
      })()
      const response = JSON.stringify({ motivations: old === undefined || forged ? [{ content: 'Understand sourced growth',
        reason: 'A sourced inclination.', strength: 0.7, status: 'active', interestIds: [interest.id], memoryIds: [memory.id],
        sourceEventIds: forged ? [randomUUID()] : [historic, source.id] }] : [],
      goals: forged ? [] : [{ ...goal, failures: 999 }],
      candidates: [{ disposition: 'wait', action: 'Wait for another event.', reason: 'There is no urgent work.', factors,
        goalIds: [], motivationIds: [] }], selected: 0, reason: 'Retain a sourced commitment without starting work.' })
      yield { type: 'block-start', index: 0, blockType: 'text' }
      yield { type: 'text-delta', index: 0, text: response }
      yield { type: 'block-end', index: 0, block: { type: 'text', text: response } }
      yield { type: 'finish', reason: { kind: 'stop' } }
    }
  }
  ctx.llm.registerAdapter(['memory-writer'], new EvidenceWriter())
  const chat = new ScriptedModel([])
  ctx.llm.registerAdapter(['fixture'], chat)
  const agent = await ctx.agentLoop.create(sessionId, { provider: 'fixture', model: 'chat' })
  const signal = new AbortController().signal
  const first = await ctx.genesisDeliberation.deliberate(agent, { key: 'historical', sourceEventId: source.id }, signal)
  const second = await ctx.genesisDeliberation.deliberate(agent, { key: 'echo-goal', sourceEventId: source.id }, signal)
  expect(first.sourceEventIds).toContain(historic)
  expect(second.sourceEventIds).toContain(historic)
  const before = await ctx.genesis.snapshot()
  expect(before.agency!.goals[0]!.failures).toBe(0)
  expect(before.agency!.goals[0]!.history).toHaveLength(2)
  const requests = agent.session.ownEvents().map(genesisAuditRecord).filter(record => record?.data.role === 'deliberation-writer')
  expect(requests).toHaveLength(2)
  forged = true
  agent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'Consider a new request.' }] }))
  await agent.whenIdle()
  const ending = agent.session.ownEvents().findLast(event => event.type === 'turn/end')
  expect(ending).toMatchObject({ data: { reason: { kind: 'error', error: { code: 'GENESIS_DELIBERATION_FAILED',
    message: expect.stringContaining('outside the selected context') } } } })
  expect(chat.requests).toHaveLength(0)
  expect((await ctx.genesis.snapshot()).agency).toEqual(before.agency)
  await ctx.fiber.dispose()
  const restored = await boot(root, true, config, false, false, false, true, false, false, undefined, true, true)
  expect((await restored.genesis.snapshot()).agency).toEqual(before.agency)
})

it.each([24000, 2400])('deliberation omits whole over-budget evidence records and commits only the final citation lists (%i chars)', async (inputChars) => {
  const root = await directory()
  const { config } = await embeddingFixture()
  config.inputChars = inputChars
  config.associationLimit = 0
  const ctx = await boot(root, true, config, false, false, false, false, false, false, undefined, false, true)
  const sessionId = SessionId('deliberation-bounds')
  const sources = []
  for (let index = 0; index < 24; index++) sources.push(await ctx.genesis.observe({ sessionId, eventId: `source-${index}`,
    kind: 'assistant-message', timestamp: '2026-10-25T00:00:00.000Z' }))
  const memory = await ctx.genesis.remember({ category: 'semantic', content: 'A memory with more than twenty supporting events.',
    importance: 1, confidence: 0.7, sourceEventIds: sources.map(item => item.id) })
  let selected: string[] = []
  class BoundedWriter extends LlmAdapter {
    override async resolveModel(provider: string, model: string) { return { provider, id: model, name: model } }
    override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
      const raw = options.messages.flatMap(message => message.content).filter(block => block.type === 'text').map(block => block.text).join('')
      expect(raw.length).toBeLessThanOrEqual(inputChars)
      const input = z.object({ triggerEventId: z.string(), sourceEventIds: z.array(z.string()).max(20), memoryIds: z.array(z.string()),
        memories: z.array(z.object({ id: z.string() })), personalityEvidence: z.array(z.object({ sourceEventIds: z.array(z.string()) })),
        recentEvents: z.array(z.object({ id: z.string() })) }).parse(JSON.parse(raw))
      selected = input.sourceEventIds
      expect(selected[0]).toBe(input.triggerEventId)
      expect(input.memories).toEqual([])
      expect(input.memoryIds).not.toContain(memory.id)
      expect(new Set(selected)).toEqual(new Set([input.triggerEventId, sources[0]!.id, ...input.recentEvents.map(item => item.id),
        ...input.personalityEvidence.flatMap(item => item.sourceEventIds)]))
      const response = JSON.stringify({ motivations: [], goals: [], candidates: [{ disposition: 'wait', action: 'Wait.', reason: 'No work needed.',
        factors: { motivation: 0, interest: 0, commitment: 0, emotion: 0, needs: 0, benefit: 0, cost: 0, risk: 0, urgency: 0, relationship: 0, context: 0 },
        goalIds: [], motivationIds: [] }], selected: 0, reason: 'Wait for another event.' })
      yield { type: 'block-start', index: 0, blockType: 'text' }
      yield { type: 'text-delta', index: 0, text: response }
      yield { type: 'block-end', index: 0, block: { type: 'text', text: response } }
      yield { type: 'finish', reason: { kind: 'stop' } }
    }
  }
  ctx.llm.registerAdapter(['memory-writer'], new BoundedWriter())
  const agent = await ctx.agentLoop.create(sessionId, { provider: 'fixture', model: 'chat' })
  const choice = await ctx.genesisDeliberation.deliberate(agent, { key: 'bounded', sourceEventId: sources[0]!.id }, new AbortController().signal)
  expect(choice.sourceEventIds).toEqual(selected)
  expect(choice.outcome.status).toBe('waiting')
})

it('delivers one proactive choice as an assistant message, honors silence, and restores the committed receipt without replay', async () => {
  const root = await directory()
  const { config } = await embeddingFixture()
  config.associationLimit = 0
  const first = await boot(root, true, config, false, false, false, true, true, false, undefined, false, true, true)
  const factors = { motivation: 0.8, interest: 0.5, commitment: 0.2, emotion: 0.6, needs: 0.8,
    benefit: 0.7, cost: 0.1, risk: 0.1, urgency: 0.2, relationship: 0.8, context: 0.7 }
  class SocialWriter extends LlmAdapter {
    decisions = ['wait', 'accept', 'accept']
    decisionCount = 0
    override async resolveModel(provider: string, model: string) { return { provider, id: model, name: model } }
    override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
      const prompt = options.system ?? ''
      const socialDecision = prompt.includes('ONLY whether to initiate a conversation')
      if (socialDecision) this.decisionCount++
      const disposition = socialDecision ? this.decisions.shift() ?? 'wait' : 'wait'
      const response = JSON.stringify({ motivations: [], goals: [], candidates: [{ disposition,
        action: 'Share a thought from the current conversation.', reason: 'I have a grounded thought worth sharing.', factors,
        goalIds: [], motivationIds: [] }], selected: 0, reason: 'I would like to share one grounded thought.' })
      yield { type: 'block-start', index: 0, blockType: 'text' }
      yield { type: 'text-delta', index: 0, text: response }
      yield { type: 'block-end', index: 0, block: { type: 'text', text: response } }
      yield { type: 'finish', reason: { kind: 'stop' } }
    }
  }
  const writer = new SocialWriter()
  first.llm.registerAdapter(['memory-writer'], writer)
  const chat = new ScriptedModel(['Ordinary reply.', 'A thought I wanted to share.'])
  first.llm.registerAdapter(['fixture'], chat)
  const sessionId = SessionId('social-test')
  const agent = await first.agentLoop.create(sessionId, { provider: 'fixture', model: 'chat' })
  agent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'Hello.' }] }))
  await agent.whenIdle()
  const source = await first.genesis.observe({ sessionId, eventId: 'eligible-social-event', kind: 'user-message', timestamp: new Date().toISOString() })
  const quiet = await first.genesisInitiative.considerInteraction({ key: 'quiet-choice', sourceEventId: source.id })
  expect(quiet.status).toBe('skipped')
  expect(chat.requests).toHaveLength(1)
  const sent = await first.genesisInitiative.considerInteraction({ key: 'speak-choice', sourceEventId: source.id })
  expect(sent.status).toBe('dispatching')
  await agent.whenIdle()
  await first.genesisInitiative.resume()
  const committed = (await first.genesis.snapshot()).initiative!.records.find(item => item.key === 'speak-choice')!
  expect(committed).toMatchObject({ status: 'sent', message: 'A thought I wanted to share.', sessionId, reason: expect.any(String) })
  const socialInput = agent.session.ownEvents().find(event => event.type === 'user/message'
    && event.data.source.kind === 'genesis-initiative')
  expect(socialInput?.type).toBe('user/message')
  expect(agent.session.ownEvents().filter(event => event.type === 'user/message' && event.data.source.kind === 'user')).toHaveLength(1)
  const receipts = agent.session.ownEvents().filter(event => event.type === 'assistant/message')
  expect(receipts).toHaveLength(2)
  expect(receipts.at(-1)?.type === 'assistant/message'
    && receipts.at(-1)?.data.message.content).toContainEqual({ type: 'text', text: 'A thought I wanted to share.' })
  expect(first.genesis.permitsDecision(committed.decisionId!)).toBe(false)
  const limited = await first.genesisInitiative.considerInteraction({ key: 'daily-limit', sourceEventId: source.id })
  expect(limited.status).toBe('pending')
  expect(limited.note).toContain('Rolling proactive message limit reached')
  expect(chat.requests).toHaveLength(2)
  await first.genesis.remember({ category: 'semantic', content: 'A significant new finding.', importance: 0.95,
    confidence: 0.9, sourceEventIds: [source.id] })
  for (let attempt = 0; attempt < 20 && writer.decisionCount < 4; attempt++) await new Promise(resolve => setTimeout(resolve, 5))
  expect(writer.decisionCount).toBe(4)
  expect((await first.genesis.snapshot()).initiative!.records.some(item => item.key.startsWith('event:') && item.status === 'pending')).toBe(true)
  await first.genesisInitiative.tick()
  expect(writer.decisionCount).toBe(5)
  expect((await first.genesis.snapshot()).initiative!.records.some(item => item.key.startsWith('timer:'))).toBe(true)
  await first.fiber.dispose()

  const second = await boot(root, true, config, false, false, false, true, true, false, undefined, false, true, true)
  const restored = await second.genesisInitiative.considerInteraction({ key: 'speak-choice', sourceEventId: source.id })
  expect(restored.status).toBe('sent')
  expect(chat.requests).toHaveLength(2)
  expect((await second.genesis.snapshot()).initiative!.records.find(item => item.key === 'speak-choice')!.status).toBe('sent')
})

it('keeps a proactive choice pending when no idle Harness conversation can receive it', async () => {
  const root = await directory()
  const { config } = await embeddingFixture()
  config.associationLimit = 0
  const ctx = await boot(root, true, config, false, false, false, true, false, false, undefined, false, true, true)
  const writer = new ScriptedModel([])
  ctx.llm.registerAdapter(['memory-writer'], writer)
  const source = await ctx.genesis.observe({ sessionId: SessionId('missing-social-channel'), eventId: 'offline-social-event', kind: 'user-message', timestamp: new Date().toISOString() })
  const result = await ctx.genesisInitiative.considerInteraction({ key: 'offline-choice', sourceEventId: source.id })
  expect(result.status).toBe('pending')
  expect(result.note).toContain('No idle character conversation channel')
  expect(writer.requests).toHaveLength(0)
  expect((await ctx.genesis.snapshot()).initiative!.records.find(item => item.key === 'offline-choice')!.status).toBe('pending')
})

it('loads interest review through Cordis, logs the formed contact and restores it in another Session', async () => {
  const root = await directory()
  const embeddings = await embeddingFixture()
  const first = await boot(root, true, embeddings.config, false, false, false, true, false, true, undefined, true)
  first.llm.registerAdapter(['memory-decision'], new ScriptedModel(['{"update":false}']))
  class InterestWriter extends LlmAdapter {
    readonly requests: GenerateOptions[] = []
    override async resolveModel(provider: string, model: string) { return { provider, id: model, name: model } }
    override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
      this.requests.push(options)
      const text = options.messages.flatMap(message => message.content).filter(block => block.type === 'text')
        .map(block => block.text).join('\n')
      const input = z.object({ conversation: z.array(z.object({ messages: z.array(z.object({ role: z.string(), seq: z.number() })) })) }).parse(JSON.parse(text))
      const user = input.conversation.at(-1)!.messages.find(item => item.role === 'user')!
      const response = JSON.stringify({ changes: [{ topic: 'watercolor painting', signal: 'contact', selfInitiated: false,
        reason: 'The character encountered watercolor in a real exchange.', sourceSeqs: [user.seq] }] })
      yield { type: 'block-start', index: 0, blockType: 'text' }
      yield { type: 'text-delta', index: 0, text: response }
      yield { type: 'block-end', index: 0, block: { type: 'text', text: response } }
      yield { type: 'finish', reason: { kind: 'stop' } }
    }
  }
  const writer = new InterestWriter()
  first.llm.registerAdapter(['memory-writer'], writer)
  first.llm.registerAdapter(['fixture'], new ScriptedModel(['Watercolor can make soft washes.']))
  const agent = await first.agentLoop.create(SessionId('interest-first'), { provider: 'fixture', model: 'chat' })
  agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Let us look at watercolor painting.' }], source: { kind: 'user' } }))
  await agent.whenIdle()
  const formed = await first.genesis.snapshot()
  expect(formed.interests?.map(item => [item.topic, item.stage])).toEqual([['watercolor painting', 'contact']])
  expect(writer.requests).toHaveLength(1)
  expect(agent.session.ownEvents().map(genesisAuditRecord).some(record => record?.type === 'plugin:genesis/memory-call'
    && record.data.phase === 'request' && record.data.role === 'interest-writer')).toBe(true)
  expect((await first.genesisStatus.inspect(new AbortController().signal)).interest?.entries[0]?.topic).toBe('watercolor painting')
  await first.fiber.dispose()

  const second = await boot(root, true, embeddings.config, false, false, false, true, false, true, undefined, true)
  expect((await second.genesis.snapshot()).interests).toEqual(formed.interests)
  second.llm.registerAdapter(['memory-decision'], new ScriptedModel(['{"update":false}']))
  second.llm.registerAdapter(['memory-writer'], new ScriptedModel(['{"changes":[]}']))
  const reader = new ScriptedModel(['We can explore that further if you want.'])
  second.llm.registerAdapter(['fixture'], reader)
  const other = await second.agentLoop.create(SessionId('interest-second'), { provider: 'fixture', model: 'chat' })
  other.followup(createUserMessage({ content: [{ type: 'text', text: 'What would you like to explore?' }], source: { kind: 'user' } }))
  await other.whenIdle()
  expect(JSON.stringify(reader.requests)).toContain('watercolor painting')
  expect(JSON.stringify(other.session.ownEvents())).toContain('watercolor painting')
  expect((await second.genesis.snapshot()).events.filter(event => event.type === 'interest.initialized')).toHaveLength(1)
})

it('restores a life across two actual Agent Sessions and Loader restarts, with durable model context and sourced memory', async () => {
  expect('default' in Genesis).toBe(false)
  const root = await directory()
  const first = await boot(root)
  const model = new ScriptedModel([
    { name: 'genesis_self', args: {} },
    { name: 'genesis_remember', args: { content: 'I prefer oolong tea', category: 'semantic', importance: 0.9, confidence: 0.8 } },
    'Remembered as a sourced candidate.',
  ])
  first.llm.registerAdapter(['fixture'], model)
  const agent = await first.agentLoop.create(SessionId('first-session'), { provider: 'fixture', model: 'scripted' })
  agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Please remember: I prefer oolong tea' }], source: { kind: 'user' } }))
  await agent.whenIdle()
  const initial = await first.genesis.snapshot()
  const status = await first.genesisStatus.inspect(new AbortController().signal)
  expect(status.identity.id).toBe(initial.identity.id)
  expect(status.runtime.liveSessions).toBe(1)
  expect(status.counts.memories).toBe(initial.memories.length)
  expect(status.capabilities.some(item => item.capability.id === 'genesis_recall')).toBe(true)
  expect(initial.memories.some(memory => memory.content === 'I prefer oolong tea')).toBe(true)
  expect(agent.session.ownEvents().some(event => event.type === 'tool/result' && JSON.stringify(event).includes('candidate'))).toBe(true)
  expect(JSON.stringify(model.requests)).toContain(initial.identity.id)
  expect(JSON.stringify(agent.session.ownEvents())).toContain(initial.identity.createdAt)
  expect(initial.events.filter(event => event.type === 'interaction.observed' && event.payload['kind'] === 'tool-result')).toHaveLength(2)
  await first.fiber.dispose()

  const second = await boot(root)
  expect((await second.genesis.snapshot()).identity).toEqual(initial.identity)
  expect((await second.genesisStatus.inspect(new AbortController().signal)).capabilities).toEqual([])
  const reader = new ScriptedModel([{ name: 'genesis_recall', args: { query: 'oolong' } }, 'You previously said you prefer oolong tea.'])
  second.llm.registerAdapter(['fixture'], reader)
  const other = await second.agentLoop.create(SessionId('second-session'), { provider: 'fixture', model: 'replacement-model' })
  other.followup(createUserMessage({ content: [{ type: 'text', text: 'What tea do I prefer?' }], source: { kind: 'user' } }))
  await other.whenIdle()
  expect(JSON.stringify(reader.requests)).toContain('I prefer oolong tea')
  expect(JSON.stringify(other.session.ownEvents())).toContain(initial.memories.find(memory => memory.content.includes('oolong'))!.id)
  const disk = z.object({ tables: z.object({ states: z.object({ life: manifestSchema }) }) })
    .parse(JSON.parse(await readFile(join(root, 'genesis.json'), 'utf8')))
  const stored = await joinState(disk.tables.states.life, async (table, key) =>
    z.object({ version: z.literal(1), record: z.unknown() })
      .parse(JSON.parse(await readFile(join(root, 'genesis_records', table, `${key}.json`), 'utf8'))).record)
  expect(stored.identity.id).toBe(initial.identity.id)
  expect(stored.events.filter(event => event.type === 'life.created')).toHaveLength(1)
})

it('records real tool addition/removal, releases contributions on disable, and retains life data on re-enable', async () => {
  const root = await directory()
  const ctx = await boot(root)
  const model = new ScriptedModel(['first', 'second', 'third'])
  ctx.llm.registerAdapter(['fixture'], model)
  const agent = await ctx.agentLoop.create(SessionId('capabilities'), { provider: 'fixture', model: 'fixture' })
  const extra = ctx.plugin({ name: 'test-capability', inject: ['tools'], apply(scope) {
    scope.tools.register(defineTool({ name: 'fixture_lookup', description: 'Read fixture data', parameters: {},
      output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
      async execute() { return 'fixture' } }))
  } })
  await extra
  const turn = async () => {
    agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Show current tools' }], source: { kind: 'user' } }))
    await agent.whenIdle()
  }
  await turn()
  const acquired = await ctx.genesis.snapshot()
  expect(acquired.sessions[agent.session.id]?.some(capability => capability.id === 'fixture_lookup' && capability.available)).toBe(true)
  await extra.dispose()
  await turn()
  expect((await ctx.genesis.events({ type: 'capability.lost', limit: 20 })).some(event => event.payload['capabilityId'] === 'fixture_lookup')).toBe(true)
  const fiber = [...ctx.loader.entries()].find(entry => entry.options.name === '@deepseek-ai/dsh-experimental-genesis')?.fiber
  expect(fiber).toBeDefined()
  await fiber!.dispose()
  expect(ctx.tools.get('genesis_self', agent)).toBeUndefined()
  const before = await readFile(join(root, 'genesis.json'), 'utf8')
  await turn()
  expect(await readFile(join(root, 'genesis.json'), 'utf8')).toBe(before)
  await ctx.fiber.dispose()
  const disabled = await boot(root, false)
  expect(disabled.get('genesis')).toBeUndefined()
  const ordinary = new ScriptedModel(['ordinary Harness works'])
  disabled.llm.registerAdapter(['fixture'], ordinary)
  const normal = await disabled.agentLoop.create(SessionId('ordinary'), { provider: 'fixture', model: 'fixture' })
  normal.followup(createUserMessage({ content: [{ type: 'text', text: 'Hello' }], source: { kind: 'user' } }))
  await normal.whenIdle()
  expect(ordinary.requests).toHaveLength(1)
  await disabled.fiber.dispose()
  const enabled = await boot(root)
  expect((await enabled.genesis.snapshot()).identity.id).toBe(acquired.identity.id)
})

async function embeddingFixture() {
  const requests: string[] = []
  const authorizations: Array<string | undefined> = []
  let malformed = false
  type EmbeddingIndex = 0 | 1 | '0' | null | 'omitted'
  let index: EmbeddingIndex = 0
  const server = createServer((request, response) => {
    void (async () => {
      let body = ''
      for await (const chunk of request) body += String(chunk)
      const input = z.object({ input: z.string(), dimensions: z.literal(3), model: z.literal('fixture-embedding') }).parse(JSON.parse(body)).input
      requests.push(input)
      authorizations.push(request.headers.authorization)
      const embedding = malformed ? [0] : /oolong|warm drink/u.test(input) ? [1, 0, 0] : /gentle/u.test(input) ? [0, 1, 0] : [0, 0, 1]
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ data: [{ ...(index === 'omitted' ? {} : { index }), embedding }] }))
    })().catch((error: unknown) => { response.writeHead(500); response.end(String(error)) })
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  disposers.push(() => new Promise<void>((resolve, reject) => {
    server.close((error) => { if (error === undefined) resolve(); else reject(error) })
    server.closeAllConnections()
  }))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('Missing fixture listener')
  const config: MemoryConfig = {
    decisionProvider: 'memory-decision', decisionModel: 'decision', writerProvider: 'memory-writer', writerModel: 'writer',
    embeddingUrl: `http://127.0.0.1:${address.port}/embeddings`, embeddingModel: 'fixture-embedding', embeddingDimensions: 3,
    timeoutMs: 5000, inputChars: 24000, outputChars: 24000, maxTokens: 4096, reasoningEffort: 'auto', organizationLimit: 20, identityRewriteLimit: 100, maxChanges: 8,
    maxImplicitMemories: 4, minSimilarity: 0.8,
    consolidation: { enabled: false, idleMs: 60000, cooldownMs: 300000, retryMs: 60000,
      maxFailures: 3, batchLimit: 20, minHabitSupport: 3 },
    associationLimit: 3, associationChars: 2000, associationInputChars: 1000, experienceWindowMs: 1800000,
  }
  return { config, requests, authorizations, breakResponse() { malformed = true },
    setIndex(value: EmbeddingIndex) { index = value },
  }
}

class MemoryWriter extends ScriptedModel {
  constructor(private readonly invalidAttribution = false) { super([]) }
  override async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options)
    const input = options.messages[0]?.content.find(block => block.type === 'text')
    if (input?.type !== 'text') throw new Error('Missing writer input')
    const conversation = z.object({ conversation: z.array(z.object({ role: z.string(), seq: z.number() })) })
      .parse(JSON.parse(input.text)).conversation
    const user = conversation.find(message => message.role === 'user')!
    const assistant = conversation.find(message => message.role === 'assistant')!
    const memory = { category: 'semantic', content: 'The user prefers oolong.', importance: 0.9, confidence: 0.8,
      kind: 'declarative', attribution: 'user-stated' }
    const changes = [
      { action: 'upsert', sourceSeqs: [this.invalidAttribution ? assistant.seq : user.seq], memory },
      { action: 'upsert', sourceSeqs: [user.seq], memory: { ...memory, content: 'Use a gentle tone.', category: 'procedural', kind: 'non-declarative' } },
    ]
    yield * new ScriptedModel([JSON.stringify({ changes })]).stream(options)
  }
}

it('requires configuration and naming, learns without a catalogue, and restores one character with isolated conversation context', async () => {
  const root = await directory()
  const embeddings = await embeddingFixture()
  const first = await boot(root, true, embeddings.config, true)
  const signal = new AbortController().signal
  expect((await first.genesisStatus.inspect(signal)).setup?.phase).toBe('credentials')
  const identity = (await first.genesis.snapshot()).identity
  await expect(first.genesisStatus.initialize('小芽', signal)).rejects.toThrow()
  expect((await first.genesis.snapshot()).identity).toEqual(identity)
  const model = new ScriptedModel([{ name: 'learn', args: { name: 'genesis_recall' } }, '你好，我是小芽。可以告诉我一点关于你的事吗？'])
  first.llm.registerAdapter(['fixture'], model)
  first.llm.registerAdapter(['memory-decision'], new ScriptedModel(['{"update":true}']))
  first.llm.registerAdapter(['memory-writer'], new MemoryWriter())
  expect((await first.genesisStatus.inspect(signal)).setup?.phase).toBe('naming')
  const agent = await first.agentLoop.create(SessionId('newborn'), { provider: 'fixture', model: 'chat' })
  const execute = (name: string, args: object) => first.tools.execute({
    name, arguments: args, agent, signal, callId: ToolCallId(`direct-${name}`),
  })
  expect((await execute('learn', { name: 'genesis_recall' })).isError).toBe(true)
  await first.genesisStatus.initialize(' 小芽 ', signal)
  await expect(first.genesisStatus.initialize('Another life', signal)).rejects.toThrow('already named')
  expect((await execute('genesis_recall', { query: 'oolong' })).isError).not.toBe(true)
  const unknown = await execute('learn', { name: 'unavailable' })
  expect(unknown.isError).toBe(true)
  expect(JSON.stringify(unknown)).not.toContain('genesis_recall')
  agent.followup(createUserMessage({ content: [{ type: 'text', text: '你好！Remember I prefer oolong. Please use a gentle tone. Private introduction marker.' }], source: { kind: 'user' } }))
  await agent.whenIdle()
  expect(model.requests[0]?.tools?.map(tool => tool.name)).toEqual(['genesis_recall', 'learn'])
  expect(JSON.stringify(model.requests[0])).not.toContain('genesis_history')
  expect(JSON.stringify(model.requests[0])).toContain('innocence')
  expect(model.requests[1]?.tools?.map(tool => tool.name)).toEqual(['genesis_recall', 'learn'])
  expect(first.genesis.learningStatus().tools).toEqual(['genesis_recall'])
  const deny = first.tools.guard(exec => exec.name === 'genesis_recall' ? 'Independent permission denial' : undefined)
  expect((await execute('genesis_recall', { query: 'oolong' })).isError).toBe(true)
  deny()
  const state = await first.genesis.snapshot()
  expect(state.memories.some(memory => memory.content === 'The user prefers oolong.')).toBe(true)
  expect(state.events.filter(event => event.type === 'life.conversation')).toHaveLength(1)
  await first.fiber.dispose()

  const second = await boot(root, true, embeddings.config, true)
  expect((await second.genesisStatus.inspect(signal)).setup?.phase).toBe('ready')
  second.llm.registerAdapter(['memory-decision'], new ScriptedModel(['{"update":false}']))
  const reader = new ScriptedModel([{ name: 'genesis_recall', args: { query: 'warm drink' } }, 'You prefer oolong.'])
  second.llm.registerAdapter(['fixture'], reader)
  const other = await second.agentLoop.create(SessionId('new-conversation'), { provider: 'fixture', model: 'chat' })
  other.followup(createUserMessage({ content: [{ type: 'text', text: 'What warm drink do I like?' }], source: { kind: 'user' } }))
  await other.whenIdle()
  expect(reader.requests[0]?.tools?.map(tool => tool.name)).toEqual(['genesis_recall', 'learn'])
  expect(JSON.stringify(reader.requests[0])).toContain('小芽')
  expect(JSON.stringify(reader.requests[0])).toContain('Use a gentle tone.')
  expect(JSON.stringify(reader.requests[0])).toContain('The user prefers oolong.')
  expect(JSON.stringify(reader.requests)).not.toContain('Private introduction marker.')
  expect(JSON.stringify(reader.requests[1])).toContain('The user prefers oolong.')
  const restored = await second.genesis.snapshot()
  expect(restored.identity).toEqual(state.identity)
  expect(restored.events.filter(event => event.type === 'life.created')).toHaveLength(1)
  expect(restored.events.filter(event => event.type === 'capability.learned')).toHaveLength(1)
  expect(restored.events.filter(event => event.type === 'life.conversation')).toHaveLength(1)
  second.tools.register(defineTool({ name: 'fixture_ping', description: 'Fixture', parameters: {},
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    async execute() { return 'pong' } }))
  const ping = () => second.tools.execute({ name: 'fixture_ping', arguments: {}, agent: other, signal,
    callId: ToolCallId('disposal-ping') })
  expect((await ping()).isError).toBe(true)
  const fiber = [...second.loader.entries()].find(entry => entry.options.name === '@deepseek-ai/dsh-experimental-genesis')?.fiber
  expect(fiber).toBeDefined()
  await fiber?.dispose()
  expect((await ping()).isError).toBe(false)
  expect(second.tools.get('learn', other)).toBeUndefined()
})

it('reviews with independent models, searches embeddings across isolated Sessions, and restores the local backup and life on restart', async () => {
  const root = await directory()
  const embeddings = await embeddingFixture()
  const first = await boot(root, true, embeddings.config)
  const decision = new ScriptedModel(['{"update":true}', '{"update":false}'])
  const writer = new MemoryWriter()
  first.llm.registerAdapter(['memory-decision'], decision)
  first.llm.registerAdapter(['memory-writer'], writer)
  const model = new ScriptedModel(['I will remember your preference.'])
  first.llm.registerAdapter(['fixture'], model)
  const agent = await first.agentLoop.create(SessionId('memory-first'), { provider: 'fixture', model: 'chat' })
  agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Remember that I prefer oolong. Please use a gentle tone. Private turn marker.' }], source: { kind: 'user' } }))
  await agent.whenIdle()
  const state = await first.genesis.snapshot()
  const declarative = state.memories.find(memory => memory.content === 'The user prefers oolong.')!
  expect(declarative?.embedding?.vector).toEqual([1, 0, 0])
  expect(declarative.attribution).toBe('user-stated')
  expect(state.events.some(event => event.id === declarative.sourceEventIds[0] && event.source === 'user')).toBe(true)
  expect(writer.requests).toHaveLength(1)
  const audit = agent.session.ownEvents().map(genesisAuditRecord).filter(record => record?.type === 'plugin:genesis/memory-call')
  expect(audit).toHaveLength(4)
  expect(JSON.stringify(audit)).toContain('The user prefers oolong.')
  const reviewed = state.events.find(event => event.type === 'memory.reviewed')!
  const engine = new LifeMemoryEngine(first, first.genesis, Genesis.Config({ leasePath: join(root, 'writer.lock'), memory: embeddings.config }), embeddings.config)
  for (const event of agent.session.ownEvents()) engine.observe(agent.session.id, event)
  await engine.review(agent, 1, new AbortController().signal)
  await engine.close()
  expect(writer.requests).toHaveLength(1)
  expect((await first.genesis.snapshot()).events.filter(event => event.id === reviewed.id)).toHaveLength(1)
  expect(await readBackup(join(root, 'writer.lock.backup.json'))).toEqual(state)
  await first.fiber.dispose()

  const second = await boot(root, true, embeddings.config)
  const noUpdate = new ScriptedModel(['{"update":false}'])
  second.llm.registerAdapter(['memory-decision'], noUpdate)
  second.llm.registerAdapter(['memory-writer'], writer)
  const reader = new ScriptedModel([{ name: 'genesis_recall', args: { query: 'warm drink' } }, 'You prefer oolong.'])
  second.llm.registerAdapter(['fixture'], reader)
  const other = await second.agentLoop.create(SessionId('memory-second'), { provider: 'fixture', model: 'chat' })
  other.followup(createUserMessage({ content: [{ type: 'text', text: 'What warm drink do I like?' }], source: { kind: 'user' } }))
  await other.whenIdle()
  expect(JSON.stringify(reader.requests[0])).toContain('Use a gentle tone.')
  expect(JSON.stringify(reader.requests[0])).toContain('The user prefers oolong.')
  expect(JSON.stringify(reader.requests)).not.toContain('Private turn marker.')
  expect(JSON.stringify(reader.requests[1])).toContain('The user prefers oolong.')
  expect(JSON.stringify(other.session.ownEvents())).toContain(declarative.id)
  expect((await second.genesis.snapshot()).identity).toEqual(state.identity)
  expect(embeddings.requests).toContain('warm drink')
  expect(writer.requests).toHaveLength(1)
  expect(JSON.stringify(noUpdate.requests)).not.toContain('Private turn marker.')
})

it('keeps existing memory unchanged when the independent writer misattributes assistant evidence', async () => {
  const root = await directory()
  const embeddings = await embeddingFixture()
  const ctx = await boot(root, true, embeddings.config)
  ctx.llm.registerAdapter(['memory-decision'], new ScriptedModel(['{"update":true}']))
  ctx.llm.registerAdapter(['memory-writer'], new MemoryWriter(true))
  ctx.llm.registerAdapter(['fixture'], new ScriptedModel(['I have a preference.']))
  const before = await ctx.genesis.snapshot()
  const agent = await ctx.agentLoop.create(SessionId('invalid-attribution'), { provider: 'fixture', model: 'chat' })
  agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Remember I prefer oolong.' }], source: { kind: 'user' } }))
  await agent.whenIdle()
  const after = await ctx.genesis.snapshot()
  expect(after.memories).toEqual(before.memories)
  const review = (await ctx.genesisStatus.inspect(new AbortController().signal)).review
  if (review?.state !== 'failed') throw new Error('Expected a failed review')
  expect(review.failure.stage).toBe('writer')
  expect(review.failure.message).toContain('attributed assistant text to the user')
  expect(after.events.filter(event => event.type === 'memory.reviewed')).toEqual([])
  expect(agent.session.ownEvents().some(event => event.type === 'turn/end' && event.data.reason.kind === 'completed')).toBe(true)
})

it('refuses an incompatible embedding response without committing memory or a completed review', async () => {
  const root = await directory()
  const embeddings = await embeddingFixture()
  embeddings.breakResponse()
  const ctx = await boot(root, true, embeddings.config)
  ctx.llm.registerAdapter(['memory-decision'], new ScriptedModel(['{"update":true}']))
  const writer = new MemoryWriter()
  ctx.llm.registerAdapter(['memory-writer'], writer)
  ctx.llm.registerAdapter(['fixture'], new ScriptedModel(['Okay.']))
  const before = await ctx.genesis.snapshot()
  const agent = await ctx.agentLoop.create(SessionId('bad-vector'), { provider: 'fixture', model: 'chat' })
  agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Remember I prefer oolong.' }], source: { kind: 'user' } }))
  await agent.whenIdle()
  expect((await ctx.genesis.snapshot()).memories).toEqual(before.memories)
  expect(writer.requests).toHaveLength(0)
  const review = (await ctx.genesisStatus.inspect(new AbortController().signal)).review
  if (review?.state !== 'failed') throw new Error('Expected a failed review')
  expect(review.failure.stage).toBe('retrieval')
  expect(review.failure.message).toContain('data.0.embedding')
  expect((await ctx.genesis.snapshot()).events.filter(event => event.type === 'memory.reviewed')).toEqual([])
})

it('saves GUI embedding preferences and write-only credentials, rejects stale or invalid edits, and restores them on restart', async () => {
  const root = await directory()
  const embeddings = await embeddingFixture()
  const pending = { ...embeddings.config, embeddingUrl: '', embeddingModel: '', embeddingDimensions: 0 }
  const first = await boot(root, true, pending, false, true)
  const signal = new AbortController().signal
  const identity = (await first.genesis.snapshot()).identity
  expect((await first.genesisStatus.inspect(signal)).embedding?.revision).toBe(0)
  await expect(first.genesisStatus.testEmbedding(signal)).rejects.toThrow('Complete embedding settings')
  const settings = { url: embeddings.config.embeddingUrl, model: embeddings.config.embeddingModel,
    dimensions: 3, keyRef: 'GENESIS_UI_FIXTURE_KEY' }
  await expect(first.genesisStatus.saveEmbedding({ ...settings, dimensions: 0 }, 0, signal)).rejects.toThrow()
  await expect(first.genesisStatus.saveEmbedding({ ...settings, url: 'https://user:password@example.com/embeddings' }, 0, signal)).rejects.toThrow()
  expect(await first.genesisStatus.saveEmbedding(settings, 0, signal)).toBe(1)
  await expect(first.genesisStatus.saveEmbedding({ ...settings, model: 'stale' }, 0, signal)).rejects.toThrow('changed')
  await expect(first.genesisStatus.testEmbedding(signal)).rejects.toThrow('blank')
  await first.credentials.set(credentialRef(settings.keyRef), 'fixture-key-one')
  await first.genesisStatus.testEmbedding(signal)
  await first.credentials.set(credentialRef(settings.keyRef), 'fixture-key-two')
  await first.genesisStatus.testEmbedding(signal)
  expect(embeddings.authorizations).toEqual(['Bearer fixture-key-one', 'Bearer fixture-key-two'])
  const sampled = await first.genesisStatus.inspect(signal)
  expect(sampled.embedding).toMatchObject({ ...settings, revision: 1, keyConfigured: true, keyWritable: true })
  expect(JSON.stringify(sampled)).not.toContain('fixture-key-')
  expect(JSON.stringify(await first.genesis.snapshot())).not.toContain('fixture-key-')
  await first.fiber.dispose()
  const second = await boot(root, true, pending, false, true)
  expect((await second.genesisStatus.inspect(signal)).embedding).toEqual(sampled.embedding)
  await second.genesisStatus.testEmbedding(signal)
  expect(embeddings.authorizations.at(-1)).toBe('Bearer fixture-key-two')
  expect((await second.genesis.snapshot()).identity).toEqual(identity)
})

it('applies GUI endpoint changes to real memory recall and excludes large vectors from knowledge search budgets', async () => {
  const root = await directory()
  const initial = await embeddingFixture()
  const next = await embeddingFixture()
  const last = await embeddingFixture()
  const ctx = await boot(root, true, initial.config)
  ctx.llm.registerAdapter(['fixture'], new ScriptedModel([]))
  const agent = await ctx.agentLoop.create(SessionId('embedding-changes'), { provider: 'fixture', model: 'chat' })
  const source = await ctx.genesis.observe({ sessionId: agent.session.id, eventId: 'introduction',
    timestamp: new Date().toISOString(), kind: 'user-message' })
  await ctx.genesis.reviewMemory('large-vector', [{ action: 'upsert',
    input: { content: 'The user prefers oolong.', category: 'semantic', importance: 0.9, confidence: 0.8,
      sourceEventIds: [source.id], kind: 'declarative', attribution: 'user-stated' },
    embedding: { space: 'historical-space', vector: Array.from({ length: 8000 }, () => 0.123) } }], 4)
  const signal = new AbortController().signal
  const visible = await ctx.genesisStatus.memories('oolong', signal)
  expect(visible.map(memory => memory.content)).toEqual(['The user prefers oolong.'])
  expect(visible[0]?.embedding).toBeUndefined()
  let revision = 0
  for (const endpoint of [initial, next, last]) {
    revision = await ctx.genesisStatus.saveEmbedding({ url: endpoint.config.embeddingUrl,
      model: endpoint.config.embeddingModel, dimensions: 3 }, revision, signal)
    const result = await ctx.tools.execute({ name: 'genesis_recall', arguments: { query: 'warm drink' },
      agent, signal, callId: ToolCallId(`recall-space-${revision}`) })
    expect(result.isError).not.toBe(true)
    expect(JSON.stringify(result)).toContain('The user prefers oolong.')
    expect(endpoint.requests).toContain('warm drink')
    expect(endpoint.requests).toContain('The user prefers oolong.')
  }
})


it('opens and restores one sourced first greeting without treating its built-in trigger as user memory evidence', async () => {
  const root = await directory()
  const embeddings = await embeddingFixture()
  const ctx = await boot(root, true, embeddings.config, true, false, false, true)
  const chat = new ScriptedModel(['你好，我叫小芽，你叫什么名字？', '很高兴认识你。'])
  const decision = new ScriptedModel(['{"update":false}'])
  ctx.llm.registerAdapter(['fixture'], chat)
  ctx.llm.registerAdapter(['memory-decision'], decision)
  ctx.llm.registerAdapter(['memory-writer'], new MemoryWriter())
  const signal = new AbortController().signal
  await ctx.genesisStatus.initialize('小芽', signal)
  expect((await ctx.genesisStatus.inspect(signal)).setup?.phase).toBe('conversation')
  const agent = await ctx.agentLoop.create(SessionId('first-greeting'), { provider: 'fixture', model: 'chat' })
  expect(await ctx.genesisStatus.greet(agent.id, 'zh', signal)).toBe(agent.id)
  await agent.whenIdle()
  expect(chat.requests).toHaveLength(1)
  expect(decision.requests).toHaveLength(0)
  expect(agent.session.ownEvents().some(event => event.type === 'user/message' && event.data.source.kind === 'genesis-awakening')).toBe(true)
  expect(JSON.stringify(chat.requests[0])).toContain('first awakening')
  expect(JSON.stringify(chat.requests[0])).toContain('小芽')
  expect(await ctx.genesisStatus.greet(agent.id, 'zh', signal)).toBe(agent.id)
  await agent.whenIdle()
  expect(chat.requests).toHaveLength(1)
  agent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: '我叫小林。' }] }))
  await agent.whenIdle()
  expect(decision.requests).toHaveLength(1)
  expect(JSON.stringify(decision.requests)).not.toContain('This is your first awakening')
  expect((await ctx.genesisStatus.inspect(signal)).setup).toEqual({ phase: 'ready', firstSessionId: agent.id })
  const identity = (await ctx.genesis.snapshot()).identity
  await ctx.fiber.dispose()
  const second = await boot(root, true, embeddings.config, true, false, false, true)
  const restoredModel = new ScriptedModel([])
  second.llm.registerAdapter(['fixture'], restoredModel)
  const restored = await second.agents.resume({ resumeSessionId: agent.id, agentOptions: { provider: 'fixture', model: 'chat' } })
  expect(restored.agent.session.ownEvents().filter(event => event.type === 'user/message'
    && event.data.source.kind === 'genesis-awakening')).toHaveLength(1)
  expect((await second.genesisStatus.inspect(signal)).setup).toEqual({ phase: 'ready', firstSessionId: agent.id })
  expect((await second.genesis.snapshot()).identity).toEqual(identity)
  await second.genesisStatus.greet(agent.id, 'zh', signal)
  expect(restoredModel.requests).toHaveLength(0)
})

it('uses the saved Jev protocol once per completed turn, writes with a separate endpoint, and continues after a decision failure', async () => {
  const root = await directory()
  const embeddings = await embeddingFixture()
  const requests: Array<{ path: string; body: unknown; authorization: string | undefined }> = []
  let mode: 'yes' | 'no' | 'broken' | 'http-error' = 'yes'
  let catalogStyle: 'typesafe' | 'openrouter' = 'typesafe'
  const server = createServer((request, response) => {
    void (async () => {
      let text = ''
      for await (const chunk of request) text += String(chunk)
      const body: unknown = text ? JSON.parse(text) : null
      requests.push({ path: request.url ?? '', body, authorization: request.headers.authorization })
      if (request.url === '/v1/systemone' && mode === 'http-error') {
        response.writeHead(401, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ error: 'private-provider-response' }))
        return
      }
      response.writeHead(200, { 'content-type': 'application/json' })
      if (request.url === '/v1/models') {
        response.end(JSON.stringify(catalogStyle === 'typesafe'
          ? { models: [{ name: 'jev-fixture' }], data: [{ id: 'writer-fixture' }] }
          : { data: [{ id: 'jev-fixture', description: 'x'.repeat(embeddings.config.outputChars + 100) }, { id: 'writer-fixture' }] }))
        return
      }
      if (request.url === '/v1/systemone') {
        response.end(JSON.stringify({ answers: { remember: { type: 'noul', noul: mode === 'broken' ? 'invalid' : mode === 'yes' ? 0.91 : 0.1 } } }))
        return
      }
      const messages = z.object({ messages: z.array(z.object({ role: z.string(), content: z.string() })) }).parse(body).messages
      const input = z.object({ conversation: z.array(z.object({ role: z.string(), seq: z.number() })) })
        .parse(JSON.parse(messages.find(message => message.role === 'user')!.content))
      const seq = input.conversation.find(message => message.role === 'user')!.seq
      response.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ changes: [{ action: 'upsert', sourceSeqs: [seq],
        memory: { category: 'procedural', content: 'Use a gentle tone.', importance: 0.9, confidence: 0.8, kind: 'non-declarative', attribution: 'user-stated' } }] }) } }] }))
    })().catch(() => { response.writeHead(500); response.end() })
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  disposers.push(() => new Promise<void>((resolve, reject) => {
    server.close((error) => { if (error === undefined) resolve(); else reject(error) }); server.closeAllConnections()
  }))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('Missing fixture listener')
  const base = `http://127.0.0.1:${address.port}/v1`
  const ctx = await boot(root, true, embeddings.config, false, true)
  const signal = new AbortController().signal
  await ctx.credentials.set(credentialRef('GENESIS_DECISION_FIXTURE_KEY'), 'private-decision-key')
  await ctx.credentials.set(credentialRef('GENESIS_WRITER_FIXTURE_KEY'), 'private-writer-key')
  const settings = { decision: { kind: 'jev' as const, url: `${base}/systemone`, model: 'jev-fixture', threshold: 0.6, keyRef: 'GENESIS_DECISION_FIXTURE_KEY' },
    writer: { kind: 'openai' as const, url: `${base}/chat/completions`, model: 'writer-fixture', keyRef: 'GENESIS_WRITER_FIXTURE_KEY' } }
  expect(await ctx.genesisStatus.saveModels(settings, 0, signal)).toBe(1)
  await expect(ctx.genesisStatus.saveModels(settings, 0, signal)).rejects.toThrow('changed')
  await expect(ctx.genesisStatus.saveModels({ ...settings, decision: { ...settings.decision, url: 'https://user:secret@example.com/systemone' } }, 1, signal)).rejects.toThrow()
  await ctx.genesisStatus.testModel('decision', signal)
  await ctx.genesisStatus.testModel('writer', signal)
  catalogStyle = 'openrouter'
  await ctx.genesisStatus.testModel('decision', signal)
  await ctx.genesisStatus.testModel('writer', signal)
  const chat = new ScriptedModel(['我会温柔地和你交流。', '好呀。', '对话继续。', '现在恢复了。'])
  ctx.llm.registerAdapter(['fixture'], chat)
  const agent = await ctx.agentLoop.create(SessionId('jev-memory'), { provider: 'fixture', model: 'chat' })
  const turn = async () => { agent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: '请温柔地和我说话。' }] })); await agent.whenIdle() }
  await turn()
  expect((await ctx.genesis.snapshot()).memories.some(memory => memory.kind === 'non-declarative')).toBe(true)
  mode = 'no'; await turn()
  expect((await ctx.genesisStatus.inspect(signal)).review).toMatchObject({ state: 'skipped', turn: 2,
    completedAt: expect.any(String), decision: { probability: 0.1, threshold: 0.6 } })
  mode = 'broken'; await turn()
  const review = (await ctx.genesisStatus.inspect(signal)).review
  if (review?.state !== 'failed') throw new Error('Expected a failed review')
  expect(review.failure.stage).toBe('decision')
  expect(review.failure.message).toContain('answers.remember.noul: invalid_type')
  mode = 'http-error'
  await expect(ctx.genesisStatus.retryMemory(agent.id, signal)).rejects.toMatchObject({ code: 'genesis/review', details: { stage: 'decision' } })
  const failed = (await ctx.genesisStatus.inspect(signal)).review
  if (failed?.state !== 'failed') throw new Error('Expected a failed retry')
  expect(failed.failure.stage).toBe('decision')
  expect(failed.failure.message).toContain('HTTP 401')
  expect(JSON.stringify(failed)).not.toContain('private-provider-response')
  mode = 'no'
  await ctx.genesisStatus.retryMemory(agent.id, signal)
  expect((await ctx.genesisStatus.inspect(signal)).review?.state).toBe('skipped')
  await turn()
  expect(chat.requests).toHaveLength(4)
  expect(requests.filter(request => request.path === '/v1/systemone')).toHaveLength(6)
  expect(requests.filter(request => request.path === '/v1/chat/completions')).toHaveLength(1)
  expect(requests.find(request => request.path === '/v1/systemone')).toMatchObject({ authorization: 'Bearer private-decision-key',
    body: { model: 'jev-fixture', questions: { remember: { type: 'noul' } } } })
  const log = JSON.stringify(agent.session.ownEvents())
  expect(log).toContain('plugin:genesis/model-http')
  expect(log).not.toContain('private-decision-key')
  expect(log).not.toContain('private-writer-key')
  const identity = (await ctx.genesis.snapshot()).identity
  await ctx.fiber.dispose()
  const next = await boot(root, true, embeddings.config, false, true)
  expect((await next.genesisStatus.inspect(signal)).models).toMatchObject({ ...settings, revision: 1 })
  expect((await next.genesis.snapshot()).identity).toEqual(identity)
})


it('shares one life and learned memories across all five presets while limiting newborn tools only in Life mode', async () => {
  const root = await directory()
  const embeddings = await embeddingFixture()
  const ctx = await boot(root, true, embeddings.config, true, false, true)
  const chat = new ScriptedModel(['你好呀。', { name: 'genesis_self', args: {} },
    'Standard reply.', 'PTC reply.', 'Minimal reply.', 'Creator reply.'])
  ctx.llm.registerAdapter(['fixture'], chat)
  ctx.llm.registerAdapter(['memory-decision'], new ScriptedModel(['{"update":true}', '{"update":false}', '{"update":false}', '{"update":false}', '{"update":false}']))
  ctx.llm.registerAdapter(['memory-writer'], new MemoryWriter())
  await ctx.genesisStatus.initialize('小芽', new AbortController().signal)
  const identity = (await ctx.genesis.snapshot()).identity
  for (const id of ['life', 'standard', 'ptc', 'minimal', 'cordis']) {
    const { agent } = await ctx.agents.create({ sessionId: SessionId(`mode-${id}`), agentOptions: { provider: 'fixture', model: 'chat' },
      setup: async (agentCtx) => { await ctx.agentPresets.mount(agentCtx, id) } })
    agent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'Remember I prefer oolong. Use a gentle tone.' }] }))
    await agent.whenIdle()
    const request = chat.requests.at(-1)!
    if (id === 'life') {
      expect(JSON.stringify(request.messages)).toContain('Time sampled while preparing turn')
      expect(agent.session.ownEvents().some(event => event.type === 'user/message' && event.data.source.kind === 'time-context')).toBe(true)
      expect(request.tools?.map(tool => tool.name)).toEqual(['genesis_recall', 'learn'])
      expect(JSON.stringify(request)).toContain('innocence')
    } else {
      expect(request.tools?.some(tool => tool.name === 'genesis_recall')).toBe(true)
      expect(JSON.stringify(request)).not.toContain('innocence')
      expect(JSON.stringify(request)).toContain('Use a gentle tone.')
    }
    expect((await ctx.genesis.snapshot()).identity).toEqual(identity)
  }
  const final = await ctx.genesis.snapshot()
  expect(final.memories).toHaveLength(2)
  expect(final.growth).toEqual([])
  expect(final.events.filter(event => event.type.startsWith('capability.') && event.payload['baseline'] !== true)).toEqual([])
  const signal = new AbortController().signal
  for (let refresh = 0; refresh < 3; refresh += 1) await ctx.genesisStatus.inspect(signal)
  expect(await ctx.genesis.snapshot()).toEqual(final)
})

it('accepts a Gemini-style single embedding without index and refuses incorrect explicit indices', async () => {
  const root = await directory()
  const embeddings = await embeddingFixture()
  const ctx = await boot(root, true, embeddings.config)
  const signal = new AbortController().signal
  embeddings.setIndex('omitted')
  await ctx.genesisStatus.testEmbedding(signal)
  for (const index of [1, '0', null] as const) {
    embeddings.setIndex(index)
    await expect(ctx.genesisStatus.testEmbedding(signal)).rejects.toThrow('index must be numeric 0 or omitted')
  }
  embeddings.setIndex(0)
  await ctx.genesisStatus.testEmbedding(signal)
})

it('reports the evidence budget failure without invoking a decision model or failing the chat reply', async () => {
  const root = await directory()
  const embeddings = await embeddingFixture()
  const ctx = await boot(root, true, { ...embeddings.config, inputChars: 512 })
  ctx.llm.registerAdapter(['fixture'], new ScriptedModel(['The conversation can continue.']))
  const agent = await ctx.agentLoop.create(SessionId('evidence-budget'), { provider: 'fixture', model: 'chat' })
  agent.followup(createUserMessage({ content: [{ type: 'text', text: 'x'.repeat(600) }], source: { kind: 'user' } }))
  await agent.whenIdle()
  const review = (await ctx.genesisStatus.inspect(new AbortController().signal)).review
  if (review?.state !== 'failed') throw new Error('Expected a failed review')
  expect(review.failure.stage).toBe('evidence')
  expect(review.failure.message).toContain('memory.inputChars')
  expect(agent.session.ownEvents().some(event => event.type === 'turn/end' && event.data.reason.kind === 'completed')).toBe(true)
  expect(embeddings.requests[0]).toHaveLength(512)
  expect(embeddings.requests.every(input => input.length <= 512)).toBe(true)
})

it('retains a writer provider HTTP failure instead of reporting an incomplete generic JSON response', async () => {
  const root = await directory()
  const embeddings = await embeddingFixture()
  const ctx = await boot(root, true, embeddings.config)
  let tokenLimited = false
  class RejectedWriter extends ScriptedModel {
    override async * stream(): AsyncIterable<StreamChunk> {
      if (tokenLimited) { yield { type: 'finish', reason: { kind: 'max-tokens' } }; return }
      yield { type: 'finish', reason: { kind: 'error',
        failure: { code: 'AUTH', status: 401, message: 'private-provider-body' } } }
    }
  }
  ctx.llm.registerAdapter(['memory-decision'], new ScriptedModel(['{"update":true}', '{"update":true}']))
  ctx.llm.registerAdapter(['memory-writer'], new RejectedWriter([]))
  ctx.llm.registerAdapter(['fixture'], new ScriptedModel(['Okay.']))
  const agent = await ctx.agentLoop.create(SessionId('writer-provider-error'), { provider: 'fixture', model: 'chat' })
  agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Remember I prefer oolong.' }], source: { kind: 'user' } }))
  await agent.whenIdle()
  const review = (await ctx.genesisStatus.inspect(new AbortController().signal)).review
  if (review?.state !== 'failed') throw new Error('Expected failed writer')
  expect(review.failure.stage).toBe('writer')
  expect(review.failure.message).toContain('AUTH; HTTP 401')
  expect(review.failure.message).not.toContain('private-provider-body')
  tokenLimited = true
  await expect(ctx.genesisStatus.retryMemory(agent.id, new AbortController().signal)).rejects.toThrow('max-tokens; memory.maxTokens=4096')
})


it('manually saves an older reply in the selected layer after restart, without repeating automatic decisions or duplicate writes', async () => {
  const root = await directory()
  const embeddings = await embeddingFixture()
  const first = await boot(root, true, embeddings.config, false, false, false, true)
  const chat = new ScriptedModel(['Your oolong preference matters.', 'We can talk about something else.'])
  const decision = new ScriptedModel(['{"update":false}', '{"update":false}'])
  first.llm.registerAdapter(['fixture'], chat)
  first.llm.registerAdapter(['memory-decision'], decision)
  first.llm.registerAdapter(['memory-writer'], new MemoryWriter())
  const agent = await first.agentLoop.create(SessionId('manual-source'), { provider: 'fixture', model: 'chat' })
  agent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'I prefer oolong. Use a gentle tone.' }] }))
  await agent.whenIdle()
  const reply = agent.session.ownEvents().find(event => event.type === 'assistant/message')
  if (reply?.type !== 'assistant/message') throw new Error('Missing source reply')
  agent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'A different topic.' }] }))
  await agent.whenIdle()
  expect(decision.requests).toHaveLength(2)
  const baseline = (await first.genesis.snapshot()).memories.length
  await first.fiber.dispose()

  const second = await boot(root, true, embeddings.config, false, false, false, true)
  const restoredDecision = new ScriptedModel([])
  const writer = new MemoryWriter()
  second.llm.registerAdapter(['fixture'], new ScriptedModel([]))
  second.llm.registerAdapter(['memory-decision'], restoredDecision)
  second.llm.registerAdapter(['memory-writer'], writer)
  await second.agents.resume({ resumeSessionId: agent.id, agentOptions: { provider: 'fixture', model: 'chat' } })
  const signal = new AbortController().signal
  expect(await second.genesisMemory.generate(agent.id, reply.data.message.id, 'non-declarative', signal)).toBe(true)
  const saved = await second.genesis.snapshot()
  expect(saved.memories).toHaveLength(baseline + 2)
  expect(saved.memories.filter(memory => memory.attribution === 'user-stated').every(memory => memory.kind === 'non-declarative')).toBe(true)
  expect(JSON.stringify(writer.requests)).toContain('I prefer oolong.')
  expect(JSON.stringify(writer.requests)).not.toContain('A different topic.')
  expect(restoredDecision.requests).toHaveLength(0)
  expect(await second.genesisMemory.generate(agent.id, reply.data.message.id, 'non-declarative', signal)).toBe(true)
  expect(writer.requests).toHaveLength(1)
  expect((await second.genesis.snapshot()).memories).toEqual(saved.memories)
  const foreign = await second.agentLoop.create(SessionId('different-conversation'), { provider: 'fixture', model: 'chat' })
  await expect(second.genesisMemory.generate(foreign.id, reply.data.message.id, 'declarative', signal)).rejects.toMatchObject({
    code: 'genesis/review', details: { stage: 'evidence' },
  })
})

class ExperienceWriter extends ScriptedModel {
  constructor() { super([]) }
  override async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options)
    const block = options.messages[0]?.content.find(item => item.type === 'text')
    if (block?.type !== 'text') throw new Error('Missing experience writer input')
    const input = z.object({ conversation: z.array(z.object({ role: z.string(), seq: z.number(), text: z.string() })),
      memories: z.array(z.object({ id: z.string(), category: z.string(), experience: z.object({ sessionId: z.string() }).optional() })) })
      .parse(JSON.parse(block.text))
    const user = input.conversation.find(item => item.role === 'user')!
    const changed = user.text.includes('black tea')
    const old = input.memories.find(item => item.category === 'semantic')
    const episode = input.memories.find(item => item.experience !== undefined)
    yield * new ScriptedModel([JSON.stringify({
      experience: { ...(episode === undefined ? {} : { id: episode.id }),
        summary: changed ? 'We discussed the change from oolong to black tea.' : 'The user introduced their preference for oolong.',
        topics: ['tea', 'preferences'], sourceSeqs: [user.seq], importance: 0.8, confidence: 0.8 },
      changes: [{ action: 'upsert', ...(old === undefined ? {} : { id: old.id }), sourceSeqs: [user.seq],
        memory: { content: changed ? 'The user currently prefers black tea.' : 'The user prefers oolong.',
          category: 'semantic', kind: 'declarative', attribution: 'user-stated', importance: 0.8, confidence: 0.8 } }],
    })]).stream(options)
  }
}

it('remembers an experience across turns, preserves changed preferences and recalls associated evidence after restart', async () => {
  const root = await directory()
  const embeddings = await embeddingFixture()
  const first = await boot(root, true, embeddings.config)
  const writer = new ExperienceWriter()
  first.llm.registerAdapter(['memory-writer'], writer)
  first.llm.registerAdapter(['memory-decision'], new ScriptedModel(['{"update":true}', '{"update":true}']))
  first.llm.registerAdapter(['fixture'], new ScriptedModel(['Nice to meet you.', 'I understand your preference changed.']))
  const agent = await first.agentLoop.create(SessionId('shared-experience'), { provider: 'fixture', model: 'chat' })
  agent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'I prefer oolong. Unstored private marker.' }] }))
  await agent.whenIdle()
  const initial = await first.genesis.snapshot()
  const firstExperience = initial.memories.find(memory => memory.experience !== undefined)!
  expect(firstExperience.experience?.sessionId).toBe(agent.id)
  expect(firstExperience.attribution).toBe('model-inference')
  agent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'I used to like oolong; now I prefer black tea.' }] }))
  await agent.whenIdle()
  const updated = await first.genesis.snapshot()
  const current = updated.memories.find(memory => memory.category === 'semantic')!
  expect(current.content).toBe('The user currently prefers black tea.')
  expect(current.history).toHaveLength(1)
  expect(current.history?.[0]).toMatchObject({ content: 'The user prefers oolong.', attribution: 'user-stated', confidence: 0.8 })
  expect(current.confidence).toBe(0.8)
  expect(current.experienceIds).toEqual([firstExperience.id])
  const continued = updated.memories.find(memory => memory.id === firstExperience.id)!
  expect(continued.experience?.startedAt).toBe(firstExperience.experience?.startedAt)
  expect(continued.sourceEventIds).toHaveLength(2)
  expect(continued.history).toHaveLength(1)
  await first.fiber.dispose()

  const second = await boot(root, true, embeddings.config)
  second.llm.registerAdapter(['memory-decision'], new ScriptedModel(['{"update":false}']))
  second.llm.registerAdapter(['memory-writer'], new ExperienceWriter())
  const reader = new ScriptedModel([{ name: 'genesis_recall', args: { query: 'oolong' } }, 'You now prefer black tea; you previously preferred oolong.'])
  second.llm.registerAdapter(['fixture'], reader)
  const other = await second.agentLoop.create(SessionId('later-recollection'), { provider: 'fixture', model: 'chat' })
  other.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'What warm drink do I like?' }] }))
  await other.whenIdle()
  expect((await second.genesis.snapshot()).identity).toEqual(initial.identity)
  expect((await second.genesis.getMemory(current.id))?.history).toEqual(current.history)
  const firstRequest = JSON.stringify(reader.requests[0])
  expect(firstRequest).toContain('Associated candidate memories')
  expect(firstRequest).toContain('currently prefers black tea')
  expect(firstRequest).not.toContain('Unstored private marker')
  const recall = other.session.ownEvents().find(event => event.type === 'tool/result')
  expect(JSON.stringify(recall)).toContain('The user prefers oolong.')
  expect(JSON.stringify(recall)).toContain('supersededAt')
  expect(JSON.stringify(other.session.ownEvents())).toContain('Associated candidate memories')
  const after = await second.genesis.getMemory(current.id)
  expect(after?.confidence).toBe(current.confidence)
  expect(after?.updatedAt).toBe(current.updatedAt)
})

it('continues chatting with a logged unavailable cue when automatic recall fails', async () => {
  const root = await directory()
  const embeddings = await embeddingFixture()
  const ctx = await boot(root, true, embeddings.config)
  const birth = (await ctx.genesis.snapshot()).events[0]!
  await ctx.genesis.remember({ category: 'semantic', content: 'Oolong preference', importance: 0.5, confidence: 0.5, sourceEventIds: [birth.id] })
  embeddings.breakResponse()
  ctx.llm.registerAdapter(['memory-decision'], new ScriptedModel(['{"update":false}']))
  ctx.llm.registerAdapter(['memory-writer'], new ExperienceWriter())
  const chat = new ScriptedModel(['I can keep talking while memory retrieval is unavailable.'])
  ctx.llm.registerAdapter(['fixture'], chat)
  const agent = await ctx.agentLoop.create(SessionId('unavailable-cue'), { provider: 'fixture', model: 'chat' })
  agent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'What warm drink?' }] }))
  await agent.whenIdle()
  expect(chat.requests).toHaveLength(1)
  expect(JSON.stringify(chat.requests[0])).toContain('Recall failed')
  expect(agent.session.ownEvents().some(event => event.type === 'turn/end' && event.data.reason.kind === 'completed')).toBe(true)
})

class HabitWriter extends ScriptedModel {
  constructor() { super([]) }
  override async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options)
    const text = options.messages[0]?.content.find(block => block.type === 'text')
    if (text?.type !== 'text') throw new Error('Missing writer request')
    const input = z.object({ purpose: z.string().optional(),
      conversation: z.array(z.object({ role: z.string(), seq: z.number() })).optional(),
      memories: z.array(z.object({ id: z.string(), habit: z.object({ active: z.boolean() }).optional(),
        sourceEventIds: z.array(z.string()) })).optional(),
      feedback: z.array(z.object({ id: z.string(), turn: z.string() })).optional() }).parse(JSON.parse(text.text))
    if (input.purpose === 'consolidation') {
      const memories = input.memories ?? []
      const old = memories.find(memory => memory.habit !== undefined)
      const changes = [{ ...(old === undefined ? {} : { id: old.id }), evidenceIds: memories.map(memory => memory.id),
        memory: { category: 'procedural', content: 'When greeting this user, use a brief gentle greeting.', kind: 'non-declarative', importance: 0.8, confidence: 0.7 },
        habit: { cue: 'Greeting this user', response: 'Use a brief gentle greeting', active: true,
          supportEventIds: [...new Set(input.feedback?.map(item => item.id) ?? [])] } }]
      yield * new ScriptedModel([JSON.stringify({ changes })]).stream(options)
      return
    }
    const user = input.conversation?.find(message => message.role === 'user')
    if (user === undefined) throw new Error('Missing real user evidence')
    yield * new ScriptedModel([JSON.stringify({ changes: [{ action: 'upsert', sourceSeqs: [user.seq],
      memory: { category: 'semantic', content: `User feedback ${user.seq}: brief gentle greetings are preferred.`, kind: 'declarative',
        attribution: 'user-stated', importance: 0.8, confidence: 0.7 } }] })]).stream(options)
  }
}

class ThinkingWriter extends HabitWriter {
  truncate = false
  override async resolveModel(provider: string, model: string) {
    return { provider, id: model, name: model, reasoning: {
      efforts: ['off', 'low', 'high'].map(id => ({ id: ReasoningEffortId(id), name: id })),
      defaultEffort: ReasoningEffortId('high'),
    } }
  }
  override async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    if (!options.system?.includes('Consolidate the supplied candidate memories')) {
      yield * super.stream(options)
      return
    }
    this.requests.push(options)
    if (this.truncate || options.reasoningEffort === 'high') {
      yield { type: 'block-start', index: 0, blockType: 'text' }
      yield { type: 'text-delta', index: 0, text: '{"changes":[]}' }
      yield { type: 'finish', reason: { kind: 'max-tokens' } }
      return
    }
    yield * new ScriptedModel(['{"changes":[]}']).stream(options)
  }
}

it('keeps auxiliary reasoning within its own budget, preserves truncated consolidation evidence and retries without another chat reply', async () => {
  const embedding = await embeddingFixture()
  const ctx = await boot(await directory(), true, embedding.config)
  const writer = new ThinkingWriter()
  const chat = new ScriptedModel(['Hello.'])
  chat.resolveModel = writer.resolveModel
  ctx.llm.registerAdapter(['fixture'], chat)
  ctx.llm.registerAdapter(['memory-decision'], new ScriptedModel(['{"update":true}']))
  ctx.llm.registerAdapter(['memory-writer'], writer)
  const agent = await ctx.agentLoop.create(SessionId('consolidation-token-budget'), { provider: 'fixture', model: 'chat' })
  agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Please keep greetings gentle.' }], source: { kind: 'user' } }))
  await agent.whenIdle()
  expect(chat.requests[0]?.reasoningEffort).toBe('high')
  expect(writer.requests[0]?.reasoningEffort).toBe('off')
  const before = await ctx.genesis.snapshot()
  writer.truncate = true
  const signal = new AbortController().signal
  await expect(ctx.genesisMemory.consolidate(signal)).rejects.toThrow('reasoningEffort=off')
  const failed = await ctx.genesis.snapshot()
  expect(failed.memories).toEqual(before.memories)
  expect(failed.consolidation!.revision).toBeGreaterThanOrEqual(before.consolidation!.revision)
  expect(failed.consolidation).toMatchObject({ completed: 0, failures: 1,
    failure: { stage: 'writer' } })
  writer.truncate = false
  expect(await ctx.genesisMemory.consolidate(signal)).toBe(true)
  const after = await ctx.genesis.snapshot()
  expect(after.consolidation?.completed).toBe(after.consolidation?.revision)
  expect(after.consolidation?.failures).toBe(0)
  expect(after.events.filter(event => event.type === 'memory.consolidated')).toHaveLength(1)
  expect(chat.requests).toHaveLength(1)
  expect(writer.requests.every(request => request.reasoningEffort === 'off')).toBe(true)
  const requests = agent.session.ownEvents().map(genesisAuditRecord).filter(record =>
    record?.type === 'plugin:genesis/memory-call' && record.data.phase === 'request' && record.data.role === 'writer')
  expect(requests).toHaveLength(3)
  for (const record of requests) {
    if (record?.type !== 'plugin:genesis/memory-call' || record.data.phase !== 'request') throw new Error('Missing writer audit')
    expect(record.data.config).toMatchObject({ maxTokens: 4096, reasoningEffort: 'off' })
  }
})

it.each(['auto', 'provider-default', 'low', 'unsupported'])('validates the %s auxiliary reasoning policy before dispatch', async (policy) => {
  const embedding = await embeddingFixture()
  const ctx = await boot(await directory(), true, embedding.config)
  const writer = new ThinkingWriter()
  const response = new ScriptedModel(['{}'])
  writer.stream = options => response.stream(options)
  ctx.llm.registerAdapter(['memory-writer'], writer)
  const agent = await ctx.agentLoop.create(SessionId(`auxiliary-policy-${policy}`), { provider: 'memory-writer', model: 'writer' })
  const result = auxiliaryCall(ctx, agent.session, 'emotion-writer', 'Return JSON.', {}, new AbortController().signal,
    memoryModels(embedding.config), { ...embedding.config, reasoningEffort: policy })
  if (policy === 'unsupported') {
    await expect(result).rejects.toThrow('does not support reasoning effort')
    expect(response.requests).toHaveLength(0)
  } else {
    await expect(result).resolves.toEqual({})
    expect(response.requests[0]?.reasoningEffort).toBe(policy === 'auto' ? 'off' : policy === 'provider-default' ? 'high' : 'low')
  }
})

it('forms conditional habits only after independent completed user turns and audits a quiet maintenance pass', async () => {
  const root = await directory()
  const embedding = await embeddingFixture()
  const ctx = await boot(root, true, embedding.config)
  const writer = new HabitWriter()
  ctx.llm.registerAdapter(['fixture'], new ScriptedModel(['Hello.', 'Welcome.', 'Hi again.']))
  ctx.llm.registerAdapter(['memory-decision'], new ScriptedModel([JSON.stringify({ update: true }), JSON.stringify({ update: true }), JSON.stringify({ update: true })]))
  ctx.llm.registerAdapter(['memory-writer'], writer)
  const agent = await ctx.agentLoop.create(SessionId('habit-conversation'), { provider: 'fixture', model: 'chat' })
  const turn = async () => {
    agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Please keep our greetings brief and gentle.' }], source: { kind: 'user' } }))
    await agent.whenIdle()
  }
  const signal = new AbortController().signal
  await turn()
  await expect(ctx.genesisMemory.consolidate(signal)).rejects.toThrow('at least 3 independent completed user turns')
  let state = await ctx.genesis.snapshot()
  expect(state.memories.some(memory => memory.habit !== undefined)).toBe(false)
  expect(state.consolidation?.failure).toMatchObject({ stage: 'writer' })
  await turn(); await turn()
  const before = agent.session.ownEvents()
  expect(await ctx.genesisMemory.consolidate(signal)).toBe(true)
  state = await ctx.genesis.snapshot()
  const habit = state.memories.find(memory => memory.habit !== undefined)!
  expect(habit.habit).toMatchObject({ cue: 'Greeting this user', active: true })
  expect(habit.habit?.supportEventIds).toHaveLength(3)
  const after = agent.session.ownEvents()
  expect(after.filter(event => event.type === 'user/message' || event.type === 'assistant/message')).toEqual(
    before.filter(event => event.type === 'user/message' || event.type === 'assistant/message'))
  expect(after.map(genesisAuditRecord).filter(record => record?.type === 'plugin:genesis/memory-call' && record.data.phase === 'request')).toHaveLength(8)
  expect(state.events.filter(event => event.type === 'memory.consolidated')).toHaveLength(1)
  await ctx.genesisMemory.convert(habit.id, 'declarative', habit.updatedAt, signal)
  expect((await ctx.genesis.getMemory(habit.id))?.history).toEqual(habit.history)
  expect((await ctx.genesis.snapshot()).events).toEqual(state.events)
  const { feedbackTurns } = await import('../src/consolidation-plan.ts')
  expect(feedbackTurns(await ctx.genesis.snapshot(), habit.habit!.supportEventIds).size).toBe(0)
})

class OrganizationWriter extends ScriptedModel {
  constructor() { super([]) }
  beforeReply?: () => Promise<void>
  foreignEvidence = false
  reviewedContents: string[] | undefined
  reviewIds: string[] | undefined
  content = 'The operator prefers oolong and brief gentle greetings, according to the selected records.'
  override async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options)
    const block = options.messages[0]?.content.find(block => block.type === 'text')
    if (block?.type !== 'text') throw new Error('Missing organization evidence')
    const semantic = z.object({ purpose: z.string() }).parse(JSON.parse(block.text))
    if (semantic.purpose === 'organization-time') {
      const input = z.object({ drafts: z.array(z.object({ id: z.string(), content: z.string() })) }).parse(JSON.parse(block.text))
      yield * new ScriptedModel([JSON.stringify({ memories: input.drafts.map((draft, index) => ({
        id: this.reviewIds?.[index] ?? draft.id, content: this.reviewedContents?.[index] ?? draft.content,
      })) })]).stream(options)
      return
    }
    const input = z.object({ purpose: z.literal('organization'), targetCount: z.number().nullable(),
      memories: z.array(z.object({ id: z.string() })) }).parse(JSON.parse(block.text))
    await this.beforeReply?.()
    const memories = input.targetCount === 2 ? input.memories.map(memory => ({ evidenceIds: [memory.id],
      category: 'semantic', content: `An attributed interpretation of ${memory.id}.`, importance: 0.6, confidence: 0.6 })) : [{
      evidenceIds: this.foreignEvidence ? [randomUUID()] : input.memories.map(memory => memory.id), category: 'semantic',
      content: this.content, importance: 0.6, confidence: 0.6,
    }]
    yield * new ScriptedModel([JSON.stringify({ memories })]).stream(options)
  }
}

async function organizationFixture(persisted = false) {
  const root = await directory()
  const embedding = await embeddingFixture()
  const ctx = await boot(root, true, embedding.config, false, false, false, persisted)
  const writer = new OrganizationWriter()
  ctx.llm.registerAdapter(['memory-writer'], writer)
  const signal = new AbortController().signal
  const memories = []
  for (const content of ['{{time:2026-10-23}} The operator says they prefer oolong.', 'The operator requests brief gentle greetings.']) {
    memories.push(await ctx.genesisMemory.save(brandString<MemoryId>(randomUUID()), {
      content, category: 'semantic', kind: 'declarative', confidence: 0.8, importance: 0.6,
    }, null, signal))
  }
  const request: MemoryOrganizationRequest = { id: brandString<MemoryOrganizationId>(randomUUID()),
    sources: memories.map(({ id, updatedAt }) => ({ id, updatedAt })), targetCount: 1 }
  return { root, embedding, ctx, writer, signal, memories, request }
}

it('organizes only the selected versions into one or several sourced memories, with durable audit and idempotent restart recovery', async () => {
  const { root, embedding, ctx, writer, signal, memories, request } = await organizationFixture(true)
  const identity = (await ctx.genesis.snapshot()).identity
  const result = await ctx.genesisMemory.organize(request, signal)
  expect(result).toHaveLength(1)
  expect(result[0]).toMatchObject({ attribution: 'model-inference', kind: 'declarative' })
  expect(result[0]!.content).toContain('{{time:2026-10-23}}')
  let state = await ctx.genesis.snapshot()
  expect(state.memories.some(memory => memories.some(source => source.id === memory.id))).toBe(false)
  expect(state.memories).toHaveLength(2)
  const event = state.events.find(event => event.type === 'memory.organized')!
  expect(result[0]!.sourceEventIds).toContain(event.id)
  const auditId = event.relatedSessionId
  expect(auditId).toBeTruthy()
  expect(ctx.agents.list()).toHaveLength(0)
  expect(writer.requests).toHaveLength(2)
  const writerInput = writer.requests[0]!.messages[0]!.content.find(block => block.type === 'text')!
  if (writerInput.type !== 'text') throw new Error('Missing organizer input')
  const provided = z.object({ memories: z.array(z.object({ id: z.string() })) }).parse(JSON.parse(writerInput.text))
  expect(provided.memories.map((memory: { id: string }) => memory.id)).toEqual(['m1', 'm2'])
  expect(writerInput.text).not.toContain('sourceEventIds')
  const files = await import('node:fs/promises')
  const logs = await files.readdir(join(root, 'sessions'), { recursive: true })
  const audit = logs.find(file => file.endsWith('.jsonl'))!
  const text = await readFile(join(root, 'sessions', audit), 'utf8')
  expect(text).toContain('plugin:genesis/memory-call')
  expect(text).toContain('organization')
  expect(text).not.toContain('assistant/message')
  await ctx.fiber.dispose()
  const restored = await boot(root, true, embedding.config, false, false, false, true)
  const nextWriter = new OrganizationWriter()
  restored.llm.registerAdapter(['memory-writer'], nextWriter)
  expect(await restored.genesisMemory.organize(request, signal)).toEqual(result)
  expect(nextWriter.requests).toHaveLength(0)
  const current = await restored.genesis.snapshot()
  const multiple = await restored.genesisMemory.organize({ ...request, id: brandString<MemoryOrganizationId>(randomUUID()),
    sources: current.memories.map(({ id, updatedAt }) => ({ id, updatedAt })), targetCount: 2 }, signal)
  expect(multiple).toHaveLength(2)
  state = await restored.genesis.snapshot()
  expect(state.identity).toEqual(identity)
  expect(state.memories).toHaveLength(2)
})

it('reviews complete time meaning with the model while preserving words containing date-like substrings', async () => {
  const { ctx, writer, request, signal } = await organizationFixture()
  const dated = []
  for (const [index, timestamp] of ['2026-10-23T02:00:00Z', '2026-10-24T03:00:00Z'].entries()) {
    const source = await ctx.genesis.observe({ sessionId: SessionId('dated-organization'), eventId: String(index), timestamp, kind: 'user-message' })
    dated.push(await ctx.genesis.remember({ content: `Tea feedback ${index}.`, category: 'semantic', importance: 0.6,
      confidence: 0.8, sourceEventIds: [source.id] }))
  }
  request.sources = dated.map(({ id, updatedAt }) => ({ id, updatedAt }))
  writer.content = '小芽说明年龄，说明年纪；今年谈过茶，明年希望再交流。'
  writer.reviewedContents = ['小芽说明年龄，说明年纪；{{time:2026}}谈过茶，{{time:2027}}希望再交流。']
  const result = await ctx.genesisMemory.organize(request, signal)
  expect(result[0]!.content).toContain('小芽说明年龄，说明年纪；{{time:2026}}谈过茶，{{time:2027}}希望再交流。')
  expect(writer.requests).toHaveLength(2)
  expect(JSON.stringify(writer.requests[1])).toContain('小芽说明年龄，说明年纪；今年谈过茶，明年希望再交流。')
  const committed = await ctx.genesis.snapshot()
  expect(request.sources.every(source => !committed.memories.some(memory => memory.id === source.id))).toBe(true)
  expect(committed.memories.find(memory => memory.id === result[0]!.id)?.embedding).toBeDefined()
})

it.each(['invalid-marker', 'missing-draft'])('retains selected memories when semantic time review returns %s', async (failure) => {
  const { ctx, writer, request, signal } = await organizationFixture()
  if (failure === 'invalid-marker') writer.reviewedContents = ['{{date:--02-30}}发生过交流。']
  else writer.reviewIds = ['unprovided-draft']
  const before = await ctx.genesis.snapshot()
  await expect(ctx.genesisMemory.organize(request, signal)).rejects.toThrow(failure === 'invalid-marker' ? 'invalid time anchor' : 'omitted or duplicated')
  expect((await ctx.genesis.snapshot()).memories).toEqual(before.memories)
  expect((await ctx.genesis.snapshot()).events.some(event => event.type === 'memory.organized')).toBe(false)
})

it('retains an exact annual birthday through organization and restart while ordinary experiences remain relative on recall', async () => {
  const { ctx, root, embedding, writer, request, signal, memories } = await organizationFixture(true)
  const birthday = await ctx.genesisMemory.save(memories[0]!.id, { content: '小芽的生日为{{date:--10-24}}，{{time:2026-10-23}}聊过茶。',
    category: 'self', kind: 'declarative', importance: 0.8, confidence: 0.8 }, memories[0]!.updatedAt, signal)
  request.sources[0] = { id: birthday.id, updatedAt: birthday.updatedAt }
  writer.content = '小芽的生日为{{date:--10-24}}，{{time:2026-10-23}}聊过茶。'
  const [result] = await ctx.genesisMemory.organize(request, signal)
  await ctx.fiber.dispose()
  const restored = await boot(root, true, embedding.config, false, false, false, true)
  const saved = (await restored.genesis.getMemory(result!.id))!
  expect(saved.content).toBe(writer.content)
  const { readMemory } = await import('../src/memory-time.ts')
  expect(JSON.stringify(readMemory(saved, new Date('2026-10-24T04:00:00Z'), 'Asia/Manila')))
    .toContain('小芽的生日为10月24日，昨天聊过茶。')
})

it('refuses foreign evidence and concurrent source edits without publishing partial organization results', async () => {
  const { ctx, writer, signal, memories, request } = await organizationFixture()
  writer.foreignEvidence = true
  await expect(ctx.genesisMemory.organize(request, signal)).rejects.toThrow('outside the selected evidence')
  expect((await ctx.genesis.snapshot()).memories).toHaveLength(3)
  writer.foreignEvidence = false
  const entered = Promise.withResolvers<void>()
  const released = Promise.withResolvers<void>()
  writer.beforeReply = () => { entered.resolve(); return released.promise }
  const operation = ctx.genesisMemory.organize(request, signal)
  const rejected = expect(operation).rejects.toThrow('changed or was deleted')
  try {
    await entered.promise
    await ctx.genesisMemory.save(memories[0]!.id, { content: 'The operator now prefers green tea.', category: 'semantic',
      kind: 'declarative', confidence: 0.8, importance: 0.6 }, memories[0]!.updatedAt, signal)
  } finally { released.resolve() }
  await rejected
  const state = await ctx.genesis.snapshot()
  expect(state.memories).toHaveLength(3)
  expect(state.events.some(event => event.type === 'memory.organized')).toBe(false)
  await expect(ctx.genesisMemory.organize(request, signal)).rejects.toThrow('changed or was deleted')
  expect(writer.requests).toHaveLength(4)
})

it('saves named operator identity with bounded wording-only legacy relabeling, preserving facts and restart continuity', async () => {
  const { root, embedding, ctx, signal, memories, writer: registered } = await organizationFixture(true)
  await ctx.genesis.awaken('小芽')
  const old = await ctx.genesisMemory.save(memories[0]!.id, { content: '用户喜欢乌龙茶，助手知道这个偏好。', category: 'semantic',
    kind: 'declarative', confidence: 0.8, importance: 0.6 }, memories[0]!.updatedAt, signal)
  const writer = new ScriptedModel([JSON.stringify({ memories: [{ id: old.id, replacements: [
    { field: 'content', before: '用户', occurrence: 0, participant: 'operator' },
    { field: 'content', before: '助手', occurrence: 0, participant: 'character' },
  ] }] })])
  registered.stream = options => writer.stream(options)
  const profile = { name: 'CrystalNeko', identity: '小芽的创造者' }
  expect(await ctx.genesisMemory.saveOperator(profile, 0, signal)).toBe(1)
  const state = await ctx.genesis.snapshot()
  const renamed = state.memories.find(memory => memory.id === old.id)!
  expect(renamed).toMatchObject({ content: 'CrystalNeko喜欢乌龙茶，小芽知道这个偏好。', confidence: old.confidence, attribution: old.attribution })
  expect(renamed.history?.at(-1)?.content).toBe(old.content)
  expect(renamed.sourceEventIds).toEqual(expect.arrayContaining(old.sourceEventIds))
  expect(JSON.stringify(writer.requests)).toContain('小芽的创造者')
  expect(state.operator).toEqual({ ...profile, revision: 1 })
  await expect(ctx.genesisMemory.saveOperator(profile, 0, signal)).rejects.toThrow('changed')
  await ctx.fiber.dispose()
  const restored = await boot(root, true, embedding.config, false, false, false, true)
  expect((await restored.genesisStatus.inspect(signal)).operator).toEqual({ ...profile, revision: 1 })
  expect((await restored.genesis.getMemory(old.id))?.content).toBe(renamed.content)
})

it('keeps explicit identity and memory unchanged when a legacy relabel attempts to rewrite facts', async () => {
  const { ctx, signal, memories, writer: registered } = await organizationFixture()
  await ctx.genesis.awaken('小芽')
  const old = await ctx.genesisMemory.save(memories[0]!.id, { content: '用户喜欢乌龙茶。', category: 'semantic',
    kind: 'declarative', confidence: 0.8, importance: 0.6 }, memories[0]!.updatedAt, signal)
  const rejectedWriter = new ScriptedModel([JSON.stringify({ memories: [{ id: old.id,
    replacements: [{ field: 'content', before: '喜欢乌龙茶', occurrence: 0, participant: 'operator' }] }] })])
  registered.stream = options => rejectedWriter.stream(options)
  await expect(ctx.genesisMemory.saveOperator({ name: 'CrystalNeko', identity: '创造者' }, 0, signal)).rejects.toThrow('only generic')
  expect((await ctx.genesis.snapshot()).operator).toBeUndefined()
  expect(await ctx.genesis.getMemory(old.id)).toEqual(old)
})

it('reveals the persistent personal directory only after read/write learning and accesses it from unrelated workspace Sessions', async () => {
  const root = await mkdtemp(join(outsideTempWorkspaceParent(), 'genesis-personal-'))
  disposers.push(() => rm(root, { recursive: true, force: true }))
  const embedding = await embeddingFixture()
  const first = await boot(root, true, embedding.config, true, false, false, true, false, true)
  await first.genesis.awaken('小芽')
  const home = join(root, 'personal')
  const file = join(home, 'note.txt')
  const a = join(root, 'workspace-a'), b = join(root, 'workspace-b')
  await mkdir(a); await mkdir(b)
  const chat = new ScriptedModel([{ name: 'learn', args: { name: 'read' } }, 'Read learned.',
    { name: 'learn', args: { name: 'write' } }, { name: 'write', args: { file_path: file, content: 'A persistent personal note.' } }, 'Stored.'])
  first.llm.registerAdapter(['fixture'], chat)
  first.llm.registerAdapter(['memory-decision'], new ScriptedModel(['{"update":false}', '{"update":false}']))
  const { agent } = await first.agents.create({ sessionId: SessionId('personal-a'), meta: { cwd: a }, agentOptions: { provider: 'fixture', model: 'chat' } })
  agent.followup(createUserMessage({ content: [{ type: 'text', text: '学习 read。' }], source: { kind: 'user' } }))
  await agent.whenIdle()
  expect(JSON.stringify(chat.requests)).not.toContain(home)
  expect(first.sandboxPolicy.resolve({ session: agent.session }).additionalWritableRoots).toBeUndefined()
  agent.followup(createUserMessage({ content: [{ type: 'text', text: '学习 write，并保存一条自己的笔记。' }], source: { kind: 'user' } }))
  await agent.whenIdle()
  expect(await readFile(file, 'utf8')).toBe('A persistent personal note.')
  expect(JSON.stringify(chat.requests.at(-1))).toContain(home)
  expect(JSON.stringify(agent.session.ownEvents())).toContain(home)
  const identity = (await first.genesis.snapshot()).identity
  await first.fiber.dispose()
  const second = await boot(root, true, embedding.config, false, false, false, true, false, true)
  const reader = new ScriptedModel([{ name: 'read', args: { file_path: file } }, 'I found my personal note.'])
  second.llm.registerAdapter(['fixture'], reader)
  second.llm.registerAdapter(['memory-decision'], new ScriptedModel(['{"update":false}']))
  const { agent: other } = await second.agents.create({ sessionId: SessionId('personal-b'), meta: { cwd: b }, agentOptions: { provider: 'fixture', model: 'chat' } })
  other.followup(createUserMessage({ content: [{ type: 'text', text: '读取你之前的笔记。' }], source: { kind: 'user' } }))
  await other.whenIdle()
  expect(JSON.stringify(reader.requests)).toContain('A persistent personal note.')
  expect(JSON.stringify(reader.requests[0])).toContain(home)
  expect(JSON.stringify(reader.requests[0])).not.toContain('gentle curiosity, innocence')
  expect((await second.genesis.snapshot()).identity).toEqual(identity)
})

it('runs automatic consolidation after idle, persists bounded failures, and restores pending work across restart', async () => {
  const root = await directory()
  const embedding = await embeddingFixture()
  embedding.config.consolidation = { ...embedding.config.consolidation, idleMs: 100, cooldownMs: 100, retryMs: 100, maxFailures: 1 }
  const first = await boot(root, true, embedding.config, false, false, false, true)
  first.llm.registerAdapter(['fixture'], new ScriptedModel(['Hello.']))
  first.llm.registerAdapter(['memory-decision'], new ScriptedModel([JSON.stringify({ update: true })]))
  first.llm.registerAdapter(['memory-writer'], new HabitWriter())
  const agent = await first.agentLoop.create(SessionId('idle-restart'), { provider: 'fixture', model: 'chat' })
  agent.followup(createUserMessage({ content: [{ type: 'text', text: 'A gentle greeting, please.' }], source: { kind: 'user' } }))
  await agent.whenIdle()
  expect((await first.genesis.snapshot()).consolidation?.revision).toBeGreaterThan(0)
  await first.fiber.dispose()
  const second = await boot(root, true, embedding.config, false, false, false, true)
  const failedWriter = new ScriptedModel(['invalid-json'])
  second.llm.registerAdapter(['memory-writer'], failedWriter)
  await second.genesisMemory.setConsolidation(true, new AbortController().signal)
  await expect.poll(async () => (await second.genesis.snapshot()).consolidation?.failures).toBe(1)
  expect(failedWriter.requests).toHaveLength(1)
  await expect.poll(() => second.agents.get(SessionId('idle-restart')) === undefined).toBe(true)
  await second.fiber.dispose()
  const third = await boot(root, true, embedding.config, false, false, false, true)
  expect((await third.genesis.snapshot()).consolidation).toMatchObject({ failures: 1,
    failure: { stage: 'writer' } })
  expect((await third.genesis.snapshot()).consolidation?.failure?.message).toContain('invalid JSON')
  const writer = new ScriptedModel([JSON.stringify({ changes: [] })])
  third.llm.registerAdapter(['memory-writer'], writer)
  expect(await third.genesisMemory.consolidate(new AbortController().signal)).toBe(true)
  expect(writer.requests).toHaveLength(1)
  const state = await third.genesis.snapshot()
  expect(state.consolidation?.failures).toBe(0)
  expect(state.consolidation?.failure).toBeUndefined()
  expect(state.consolidation?.completed).toBe(state.consolidation?.revision)
  expect(state.events.filter(event => event.type === 'memory.consolidated')).toHaveLength(1)
})

it('defers interrupted consolidation without spending retries and drains its writer before plugin disposal', async () => {
  const embedding = await embeddingFixture()
  const ctx = await boot(await directory(), true, embedding.config)
  const entered = Promise.withResolvers<AbortSignal>()
  const aborted = Promise.withResolvers<undefined>()
  const released = Promise.withResolvers<undefined>()
  class InterruptibleWriter extends HabitWriter {
    override async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
      if (options.system?.includes('Consolidate the supplied candidate memories')) {
        entered.resolve(options.signal!)
        options.signal?.addEventListener('abort', () => { aborted.resolve(undefined) }, { once: true })
        await released.promise
        yield * new ScriptedModel([JSON.stringify({ changes: [] })]).stream(options)
      } else yield * super.stream(options)
    }
  }
  ctx.llm.registerAdapter(['fixture'], new ScriptedModel(['Hello.']))
  ctx.llm.registerAdapter(['memory-decision'], new ScriptedModel([JSON.stringify({ update: true })]))
  ctx.llm.registerAdapter(['memory-writer'], new InterruptibleWriter())
  const agent = await ctx.agentLoop.create(SessionId('interrupt-maintenance'), { provider: 'fixture', model: 'chat' })
  agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Greet briefly.' }], source: { kind: 'user' } }))
  await agent.whenIdle()
  const pending = ctx.genesisMemory.consolidate(new AbortController().signal)
  const outcome = pending.then(() => 'saved', () => 'cancelled')
  try {
    const signal = await entered.promise
    await ctx.genesisMemory.setConsolidation(false, new AbortController().signal)
    await aborted.promise
    expect(signal.aborted).toBe(true)
    const state = await ctx.genesis.snapshot()
    expect(state.consolidation?.failures).toBe(0)
    expect(state.consolidation?.completed).toBe(0)
    const disposing = ctx.fiber.dispose()
    released.resolve(undefined)
    await disposing
    expect(await outcome).toBe('cancelled')
  } finally { released.resolve(undefined); await outcome }
})

const supportAppraisal = { kind: 'support' as const, importance: 0.9, novelty: 0.8, expectationMatch: 0.5,
  controllability: 0.5, relationshipMeaning: 'care' as const, responsibility: 'other' as const, confidence: 0.7,
  summary: 'The operator offered support.' }

class EmotionWriter extends ScriptedModel {
  constructor(private readonly invalid = false) { super([]) }
  override async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options)
    const block = options.messages[0]?.content.find(block => block.type === 'text')
    if (block?.type !== 'text') throw new Error('Missing emotion evidence')
    const input = z.object({ conversation: z.array(z.object({ messages: z.array(z.object({ seq: z.number(), role: z.string() })) })) })
      .parse(JSON.parse(block.text))
    const user = input.conversation.at(-1)!.messages.find(message => message.role === 'user')!
    yield * new ScriptedModel([JSON.stringify({ delta: { happiness: 0.2, tenderness: 0.1 }, needsDelta: { exploration: 0.04, socialSatisfaction: 0.05 }, targets: { tenderness: 'operator' }, moodDelta: { valence: 0.02 }, appraisal: supportAppraisal, relationshipDelta: { attachment: 0.005 },
      reason: 'Supportive exchange interpreted as encouraging.', sourceSeqs: [this.invalid ? user.seq + 10000 : user.seq] })]).stream(options)
  }
}

it('persists sourced emotion across dialogue windows, replay and Loader restarts, with logged life-mode context', async () => {
  const root = await directory()
  const embeddings = await embeddingFixture()
  const config = { ...embeddings.config, associationLimit: 0 }
  const first = await boot(root, true, config, true, false, false, true, true)
  await first.genesis.awaken('小芽')
  const decisions = new ScriptedModel(['{"update":false}', '{"update":true}', '{"update":false}', '{"update":false}'])
  const writer = new EmotionWriter()
  first.llm.registerAdapter(['memory-decision'], decisions)
  first.llm.registerAdapter(['memory-writer'], writer)
  const chat = new ScriptedModel(['Thank you for your support.', 'Let us keep learning.'])
  first.llm.registerAdapter(['fixture'], chat)
  const agent = await first.agentLoop.create(SessionId('emotion-first'), { provider: 'fixture', model: 'chat' })
  const say = async (text: string) => {
    agent.followup(createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } }))
    await agent.whenIdle()
  }
  await say('You did well. Private emotion source marker.')
  const changed = await first.genesis.snapshot()
  expect(changed.emotion?.current.happiness).toBeCloseTo(0.2, 3)
  expect(changed.emotion?.mood.valence).toBeCloseTo(0.22, 3)
  expect(changed.emotion?.needs.exploration).toBeCloseTo(0.54, 6)
  expect(changed.emotion?.needs.socialSatisfaction).toBeCloseTo(0.55, 6)
  const relationship = changed.emotion?.version === 3 ? changed.emotion.relationship : null
  expect(relationship?.values.attachment).toBe(0.005)
  expect(chat.requests[0]!.messages.flatMap(message => message.content).filter(block => block.type === 'text').map(block => block.text).join('\n')).toContain('"happiness":0')
  await say('We can continue tomorrow.')
  expect(chat.requests[1]!.messages.flatMap(message => message.content).filter(block => block.type === 'text').map(block => block.text).join('\n')).toContain('"happiness":0.2')
  expect(JSON.stringify(chat.requests[1])).toContain('simulated character state')
  expect(JSON.stringify(decisions.requests[3])).toContain('Private emotion source marker.')
  expect(writer.requests).toHaveLength(1)
  const logs = agent.session.ownEvents()
  expect(JSON.stringify(logs.filter(event => event.type === 'user/message'))).toContain('Current simulated emotion')
  const record = logs.map(genesisAuditRecord).find(record => record?.type === 'plugin:genesis/memory-call' && record.data.phase === 'request'
    && record.data.role === 'emotion-writer')
  expect(record).toBeDefined()
  expect(JSON.stringify(record)).toContain('selfMemories')
  expect(JSON.stringify(record)).toContain('relatedMemories')
  expect(JSON.stringify(record)).toContain('needsDelta')
  const beforeReplay = await first.genesis.snapshot()
  const resolved = Genesis.Config({ leasePath: join(root, 'writer.lock'), memory: config, emotion: {} })
  const engine = new LifeEmotionEngine(first, first.genesis, resolved.emotion!, config, () => memoryModels(config))
  await engine.review(agent, 2, new AbortController().signal)
  await engine.close()
  expect(writer.requests).toHaveLength(1)
  expect((await first.genesis.snapshot()).emotion).toEqual(beforeReplay.emotion)
  const event = beforeReplay.events.find(event => event.type === 'emotion.reviewed' && event.payload['changed'] === true)!
  expect(event.payload['sourceEventIds']).toHaveLength(1)
  expect(beforeReplay.events.some(source => source.id === (event.payload['sourceEventIds'] as string[])[0] && source.source === 'user')).toBe(true)
  expect((await readBackup(join(root, 'writer.lock.backup.json'))).emotion).toEqual(beforeReplay.emotion)
  await first.fiber.dispose()

  const second = await boot(root, true, config, true, false, false, true, true)
  expect((await second.genesis.snapshot()).identity).toEqual(beforeReplay.identity)
  expect((await second.genesisStatus.inspect(new AbortController().signal)).emotion?.relationship?.id).toBe(relationship!.id)
  second.llm.registerAdapter(['memory-decision'], new ScriptedModel(['{"update":false}', '{"update":false}', '{"update":false}', '{"update":false}']))
  const reader = new ScriptedModel(['Welcome back.', 'A new conversation.'])
  second.llm.registerAdapter(['fixture'], reader)
  const resumed = (await second.agents.resume({ resumeSessionId: agent.id })).agent
  resumed.followup(createUserMessage({ content: [{ type: 'text', text: 'Hello again.' }], source: { kind: 'user' } }))
  await resumed.whenIdle()
  const projected = second.sessionProjections.stateOf(resumed.session, 'genesisEmotion')!
  expect(projected.turns.flatMap(turn => turn.messages).some(message => message.text.includes('Private emotion source marker.'))).toBe(true)
  const other = await second.agentLoop.create(SessionId('emotion-unrelated'), { provider: 'fixture', model: 'chat' })
  other.followup(createUserMessage({ content: [{ type: 'text', text: 'Hello in another conversation.' }], source: { kind: 'user' } }))
  await other.whenIdle()
  expect(JSON.stringify(reader.requests)).toContain(relationship!.id)
  expect(reader.requests.at(-1)!.messages.flatMap(message => message.content).filter(block => block.type === 'text').map(block => block.text).join('\n')).toContain('"happiness":0.2')
  expect(JSON.stringify(reader.requests.at(-1))).not.toContain('Private emotion source marker.')
  expect((await second.genesisStatus.inspect(new AbortController().signal)).emotion?.review?.state).toBe('skipped')
  expect((await second.genesis.snapshot()).events.filter(event => event.type === 'emotion.initialized')).toHaveLength(1)
  expect(embeddings.requests).toHaveLength(0)
})

it('rejects unsupported emotion citations and stale or excessive changes while preserving the chat and trusted state', async () => {
  const root = await directory()
  const embeddings = await embeddingFixture()
  const config = { ...embeddings.config, associationLimit: 0 }
  const ctx = await boot(root, true, config, false, false, false, false, true)
  ctx.llm.registerAdapter(['memory-decision'], new ScriptedModel(['{"update":false}', '{"update":true}']))
  ctx.llm.registerAdapter(['memory-writer'], new EmotionWriter(true))
  const chat = new ScriptedModel(['The reply is complete.'])
  ctx.llm.registerAdapter(['fixture'], chat)
  const before = (await ctx.genesis.snapshot()).emotion!
  const agent = await ctx.agentLoop.create(SessionId('emotion-invalid'), { provider: 'fixture', model: 'chat' })
  agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Thank you.' }], source: { kind: 'user' } }))
  await agent.whenIdle()
  expect(chat.requests).toHaveLength(1)
  expect((await ctx.genesis.snapshot()).emotion).toEqual(before)
  expect((await ctx.genesis.snapshot()).events.filter(event => event.type === 'emotion.reviewed')).toHaveLength(0)
  const outcome = (await ctx.genesisStatus.inspect(new AbortController().signal)).emotion?.review
  expect(outcome).toMatchObject({ state: 'failed', failure: { stage: 'storage' } })
  const evidence = ctx.sessionProjections.stateOf(agent.session, 'genesisEmotion')!.turns
  const seq = evidence.at(-1)!.messages.find(message => message.role === 'user')!.seq
  const plan = emotionUpdateSchema.parse({ delta: { happiness: 0.1 }, needsDelta: {}, moodDelta: {}, appraisal: supportAppraisal, reason: 'Encouragement.', sourceSeqs: [seq] })
  await expect(ctx.genesis.reviewEmotion(agent.id, evidence, before.revision + 1, plan)).rejects.toThrow('changed during appraisal')
  await expect(ctx.genesis.reviewEmotion(agent.id, evidence, before.revision, { ...plan, delta: { sadness: -0.9 } })).rejects.toThrow('per-exchange limit')
  expect((await ctx.genesis.snapshot()).emotion).toEqual(before)
})

it('uses an independent Jev emotion question and logged HTTP writer, and contains a malformed decision without resetting emotion', async () => {
  const root = await directory()
  const embeddings = await embeddingFixture()
  let malformed = false
  let emotionProbability = 0.9
  const questions: string[] = []
  const server = createServer((request, response) => {
    void (async () => {
      let text = ''
      for await (const chunk of request) text += String(chunk)
      const raw: unknown = JSON.parse(text)
      if (request.url === '/systemone') {
        const body = z.object({ questions: z.record(z.string(), z.object({ type: z.literal('noul'), instructions: z.string(),
          criteria: z.object({ true: z.string(), false: z.string() }).optional() })) }).parse(raw)
        const question = Object.keys(body.questions)[0]!
        if (question === 'emotion') expect(body.questions[question]).toEqual({ type: 'noul', instructions: EMOTION_QUESTION, criteria: EMOTION_CRITERIA })
        questions.push(question)
        response.end(JSON.stringify({ answers: { [malformed && question === 'emotion' ? 'remember' : question]: {
          type: 'noul', noul: question === 'emotion' ? emotionProbability : 0.1 } } }))
      } else {
        const body = z.object({ messages: z.array(z.object({ role: z.string(), content: z.string() })) }).parse(raw)
        const input = z.object({ newSourceSeqs: z.array(z.number()), conversation: z.array(z.object({
          messages: z.array(z.object({ seq: z.number(), role: z.string() })) })) }).parse(JSON.parse(body.messages[1]!.content))
        const user = input.conversation.at(-1)!.messages.find(message => message.role === 'user')!
        response.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
          delta: { happiness: 0.2 }, needsDelta: {}, moodDelta: {}, appraisal: supportAppraisal, reason: 'A new shared activity is anticipated.', sourceSeqs: [user.seq],
        }) } }] }))
      }
    })().catch((error: unknown) => { response.writeHead(500); response.end(String(error)) })
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  disposers.push(() => new Promise<void>((resolve, reject) => {
    server.close(error => error === undefined ? resolve() : reject(error))
    server.closeAllConnections()
  }))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('Missing emotion fixture listener')
  const base = `http://127.0.0.1:${address.port}`
  const ctx = await boot(root, true, { ...embeddings.config, associationLimit: 0 }, false, false, false, false, true)
  await ctx.genesisStatus.saveModels({ decision: { kind: 'jev', url: `${base}/systemone`, model: 'decision', threshold: 0.5 },
    writer: { kind: 'openai', url: `${base}/chat/completions`, model: 'writer' } }, 0, new AbortController().signal)
  ctx.llm.registerAdapter(['fixture'], new ScriptedModel(['I look forward to it.', 'The completed reply remains available.', 'It is Saturday.']))
  const agent = await ctx.agentLoop.create(SessionId('emotion-http'), { provider: 'fixture', model: 'chat' })
  agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Let us explore a new place together.' }], source: { kind: 'user' } }))
  await agent.whenIdle()
  const changed = await ctx.genesis.snapshot()
  expect(changed.emotion?.current.happiness).toBeCloseTo(0.2, 3)
  expect((await ctx.genesisStatus.inspect(new AbortController().signal)).emotion?.review).toMatchObject({ state: 'saved', turn: 1,
    completedAt: expect.any(String), decision: { probability: 0.9, threshold: 0.5 } })
  expect(questions).toEqual(['remember', 'emotion'])
  const audit = agent.session.ownEvents().map(genesisAuditRecord).filter(record => record?.type === 'plugin:genesis/model-http')
  expect(audit).toHaveLength(6)
  expect(JSON.stringify(audit)).toContain('questions')
  expect(JSON.stringify(audit)).toContain('emotion')
  malformed = true
  agent.followup(createUserMessage({ content: [{ type: 'text', text: 'We can decide later.' }], source: { kind: 'user' } }))
  await agent.whenIdle()
  expect((await ctx.genesis.snapshot()).emotion).toEqual(changed.emotion)
  expect((await ctx.genesisStatus.inspect(new AbortController().signal)).emotion?.review).toMatchObject({ state: 'failed', failure: { stage: 'decision' } })
  expect(agent.session.ownEvents().filter(event => event.type === 'assistant/message')).toHaveLength(2)
  malformed = false; emotionProbability = 0.1
  agent.followup(createUserMessage({ content: [{ type: 'text', text: 'What day is it?' }], source: { kind: 'user' } }))
  await agent.whenIdle()
  const status = await ctx.genesisStatus.inspect(new AbortController().signal)
  expect(status.emotion?.review).toMatchObject({ state: 'skipped', turn: 3,
    completedAt: expect.any(String), decision: { probability: 0.1, threshold: 0.5 } })
  expect(status.review).toMatchObject({ state: 'skipped', turn: 3, decision: { probability: 0.1, threshold: 0.5 } })
  expect(agent.session.ownEvents().map(genesisAuditRecord).filter(record => record?.type === 'plugin:genesis/model-http'
    && record.data.phase === 'request' && record.data.route?.kind === 'openai')).toHaveLength(1)
  const fiber = [...ctx.loader.entries()].find(entry => entry.options.name === '@deepseek-ai/dsh-experimental-genesis')!.fiber!
  await fiber.dispose()
  expect(ctx.sessionProjections.stateOf(agent.session, 'genesisEmotion')).toBeUndefined()
})


it('persists operator emotion sensitivity and adjustments, rejects stale or invalid edits, and pauses only emotion inference', async () => {
  const root = await directory()
  const embeddings = await embeddingFixture()
  const config = { ...embeddings.config, associationLimit: 0 }
  const first = await boot(root, true, config, false, false, false, false, true, true)
  const signal = new AbortController().signal
  const original = (await first.genesisStatus.inspect(signal)).emotion!
  const settings = { ...original.settings, sensitivity: 0.5, enabled: false, windowTurns: 6,
    baseline: { ...original.settings.baseline, valence: 0.2 } }
  expect(await first.genesisStatus.saveEmotionSettings(settings, original.revision, signal)).toBe(1)
  await expect(first.genesisStatus.saveEmotionSettings(settings, original.revision, signal)).rejects.toThrow('Emotion changed')
  await expect(first.genesisStatus.saveEmotionSettings({ ...settings, sensitivity: -0.1 }, 1, signal)).rejects.toThrow()
  await expect(first.genesisStatus.saveEmotionSettings({ ...settings, sensitivity: 2.1 }, 1, signal)).rejects.toThrow()
  const invalidBaseline = { ...settings.baseline, fear: 2 }
  await expect(first.genesisStatus.saveEmotionSettings({ ...settings, baseline: invalidBaseline }, 1, signal)).rejects.toThrow()
  await expect(first.genesisStatus.saveEmotionSettings({ ...settings,
    moodHalfLifeMs: { ...settings.moodHalfLifeMs, valence: 1000 } }, 1, signal)).rejects.toThrow()
  const adjustment = { current: { ...original.current, happiness: 0.8 }, mood: { ...original.mood, valence: 0.4 }, needs: original.needs, reason: 'Operator UI verification.' }
  expect(await first.genesisStatus.adjustEmotion(adjustment, 1, signal)).toBe(2)
  await expect(first.genesisStatus.adjustEmotion({ ...adjustment, reason: '' }, 2, signal)).rejects.toThrow()
  const adjusted = await first.genesis.snapshot()
  const view = (await first.genesisStatus.inspect(signal)).emotion!
  expect(view.settings).toEqual(settings)
  expect(view.history[0]).toMatchObject({ kind: 'adjusted', source: 'user', reason: adjustment.reason, current: adjustment.current })
  expect(view.history[1]).toMatchObject({ kind: 'configured', source: 'user' })
  expect(adjusted.events.find(event => event.dedupKey === 'emotion:settings:1')?.payload['after']).toMatchObject({ sensitivity: 0.5 })
  expect((await readBackup(join(root, 'writer.lock.backup.json'))).emotion).toEqual(adjusted.emotion)
  await first.fiber.dispose()
  const second = await boot(root, true, config, false, false, false, false, true, true)
  const restored = (await second.genesisStatus.inspect(signal)).emotion!
  expect(restored.settings).toEqual(settings)
  const values = { affection: 0.6, trust: 0.7, attachment: 0.4, familiarity: 0.5, feltSecurity: 0.7 }
  await expect(second.genesisStatus.adjustRelationship({ label: 'Operator', values, reason: 'Explicit estimate.' }, restored.revision - 1, signal)).rejects.toThrow('changed')
  await expect(second.genesisStatus.adjustRelationship({ label: 'Operator', values: { ...values, trust: 2 }, reason: 'Invalid.' }, restored.revision, signal)).rejects.toThrow()

  expect((await second.genesis.snapshot()).identity).toEqual(adjusted.identity)
  const decisions = new ScriptedModel(['{"update":false}'])
  second.llm.registerAdapter(['memory-decision'], decisions)
  const chat = new ScriptedModel(['Emotion is paused; this reply is retained.'])
  second.llm.registerAdapter(['fixture'], chat)
  const agent = await second.agentLoop.create(SessionId('emotion-paused'), { provider: 'fixture', model: 'chat' })
  agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Continue normally.' }], source: { kind: 'user' } }))
  await agent.whenIdle()
  expect(decisions.requests).toHaveLength(1)
  expect((await second.genesis.snapshot()).emotion).toEqual(adjusted.emotion)
  expect(JSON.stringify(chat.requests[0])).toContain('Current simulated emotion')
  await second.genesisStatus.adjustRelationship({ label: 'Operator', values, reason: 'Explicit estimate.' }, restored.revision, signal)
  const manuallyAdjusted = (await second.genesisStatus.inspect(signal)).emotion!
  expect(manuallyAdjusted.relationship?.values).toEqual(values)
  expect(manuallyAdjusted.history[0]).toMatchObject({ kind: 'relationship-adjusted', source: 'user', reason: 'Explicit estimate.' })
  await second.fiber.dispose()
  const third = await boot(root, true, config, false, false, false, false, true, true)
  expect((await third.genesisStatus.inspect(signal)).emotion?.relationship).toEqual(manuallyAdjusted.relationship)
})


it('does not start an emotion writer when the operator pauses appraisal during an in-flight decision', async () => {
  const root = await directory()
  const embeddings = await embeddingFixture()
  const ctx = await boot(root, true, { ...embeddings.config, associationLimit: 0 }, false, false, false, false, true)
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  class HeldDecision extends ScriptedModel {
    override async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
      if (options.system === EMOTION_DECISION_PROMPT) { entered.resolve(); await release.promise }
      yield * super.stream(options)
    }
  }
  const writer = new EmotionWriter()
  ctx.llm.registerAdapter(['memory-decision'], new HeldDecision(['{"update":false}', '{"update":true}']))
  ctx.llm.registerAdapter(['memory-writer'], writer)
  ctx.llm.registerAdapter(['fixture'], new ScriptedModel(['The reply is finished.']))
  const agent = await ctx.agentLoop.create(SessionId('emotion-pause-inflight'), { provider: 'fixture', model: 'chat' })
  agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Thank you for helping.' }], source: { kind: 'user' } }))
  try {
    await entered.promise
    const sampled = (await ctx.genesisStatus.inspect(new AbortController().signal)).emotion!
    await ctx.genesisStatus.saveEmotionSettings({ ...sampled.settings, enabled: false }, sampled.revision, new AbortController().signal)
  } finally { release.resolve() }
  await agent.whenIdle()
  expect(writer.requests).toHaveLength(0)
  expect((await ctx.genesis.snapshot()).events.filter(event => event.type === 'emotion.reviewed')).toHaveLength(0)
  expect((await ctx.genesisStatus.inspect(new AbortController().signal)).emotion?.settings.enabled).toBe(false)
})

it('learns writing without an innate listing, logs voluntary records, and restores searches, types and deletion receipts', async () => {
  const root = await directory()
  const embeddings = await embeddingFixture()
  const options = { resultChars: 2048, queryLimit: 1, snippetChars: 80 }
  const first = await boot(root, true, embeddings.config, true, false, false, true, false, true, options)
  await first.genesis.awaken('小芽')
  const body = '今天认识了记录文字的方法。我想把这份好奇留下来。'
  const draft = { action: 'write', title: '我的第一篇日记', content: body, typeId: 'diary' }
  const chat = new ScriptedModel(['你好呀。', { name: 'learn', args: { name: 'genesis_record' } },
    { name: 'genesis_record', args: { action: 'types' } }, { name: 'genesis_record', args: draft },
    { name: 'genesis_record', args: { action: 'search', query: '好奇' } }, '我很喜欢这次发现。'])
  first.llm.registerAdapter(['fixture'], chat)
  first.llm.registerAdapter(['memory-decision'], new ScriptedModel(['{"update":false}', '{"update":false}']))
  const agent = await first.agentLoop.create(SessionId('record-learner'), { provider: 'fixture', model: 'chat' })
  const signal = new AbortController().signal
  const say = async (text: string) => {
    agent.followup(createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } }))
    await agent.whenIdle()
  }
  const execute = (args: object, callId = ToolCallId('before-learning')) => first.tools.execute({ name: 'genesis_record', arguments: args, agent, signal, callId })
  expect((await execute(draft)).isError).toBe(true)
  await say('你好。')
  expect(chat.requests[0]!.tools!.map(tool => tool.name)).toEqual(['genesis_recall', 'learn'])
  expect(JSON.stringify(chat.requests[0])).not.toContain('genesis_record')
  await say('我教你一个工具，它叫 genesis_record。学会以后，你可以自己决定什么时候使用。')
  expect(first.genesis.learningStatus().tools).toContain('genesis_record')
  expect(chat.requests.at(-1)!.tools!.some(tool => tool.name === 'genesis_record')).toBe(true)
  const match = (await first.genesisRecords.search({ text: '好奇' }, signal)).items[0]!
  expect(match).toMatchObject({ title: draft.title, content: body, typeId: 'diary', truncated: false, matchedFields: ['content'] })
  expect(Date.parse(match.createdAt)).not.toBeNaN()
  expect(match.fileName).toMatch(/^diary\/\d{4}\/\d{2}\/\d{8}T\d{9}Z_[a-f0-9]{64}\.md$/)
  expect(await readFile(join(root, 'personal', 'records', match.fileName), 'utf8')).toContain(body)
  expect(JSON.stringify(agent.session.ownEvents().filter(event => event.type === 'tool/result'))).toContain(body)
  expect((await first.genesisRecords.search({ text: '第一篇' }, signal)).items[0]!.matchedFields).toEqual(['title'])
  const read = await first.genesisRecords.read(match.id, 0, signal)
  expect(read.source.sessionId).toBe(agent.id)
  expect((await execute(draft, read.source.callId)).isError).not.toBe(true)
  expect((await first.genesisRecords.catalog(signal))!.count).toBe(1)
  expect((await execute({ ...draft, content: 'different' }, read.source.callId)).isError).toBe(true)
  const type = await first.genesisRecords.saveType(null, '读书笔记', true, 0, signal)
  const longBody = '中文、引号"和换行\n🌱'.repeat(900)
  await first.genesisRecords.edit(match.id, { title: '读书后的想法', content: longBody, typeId: type.id }, read.revision, signal)
  await expect(readFile(join(root, 'personal', 'records', match.fileName), 'utf8')).rejects.toThrow()
  await expect(first.genesisRecords.edit(match.id, { title: 'stale', content: body, typeId: type.id }, read.revision, signal)).rejects.toThrow('changed')
  const edited = await first.genesisRecords.read(match.id, 0, signal)
  expect(edited).toMatchObject({ source: read.source, createdAt: read.createdAt, updatedBy: 'operator', revision: 2 })
  let full = ''; let offset: number | null = 0
  while (offset !== null) {
    const chunk: WritingRead = await first.genesisRecords.read(match.id, offset, signal)
    expect(JSON.stringify(chunk).length).toBeLessThanOrEqual(options.resultChars)
    full += chunk.content; offset = chunk.nextOffset
  }
  expect(full).toBe(longBody)
  const renamed = await first.genesisRecords.saveType(type.id, '阅读札记', false, type.revision, signal)
  expect(renamed.id).toBe(type.id)
  expect((await first.genesisRecords.search({ typeId: type.id, after: read.createdAt, before: read.createdAt }, signal)).total).toBe(1)
  expect((await execute({ ...draft, typeId: type.id }, ToolCallId('disabled-type'))).isError).toBe(true)
  const lifeId = (await first.genesis.snapshot()).identity.id
  await first.fiber.dispose()

  const second = await boot(root, true, embeddings.config, true, false, false, true, false, true, options)
  expect((await second.genesis.snapshot()).identity.id).toBe(lifeId)
  expect(second.genesis.learningStatus().tools).toContain('genesis_record')
  expect((await second.genesisRecords.catalog(signal))!.types).toContainEqual(renamed)
  expect((await second.genesisRecords.search({ text: '读书后的想法' }, signal)).items[0]!.id).toBe(match.id)
  const restored = await second.genesisRecords.read(match.id, 0, signal)
  expect(restored).toEqual(edited)
  await second.genesisRecords.deleteRecord(match.id, restored.revision, signal)
  await expect(second.genesisRecords.read(match.id, 0, signal)).rejects.toThrow('not found')
  await expect(readFile(join(root, 'personal', 'records', restored.fileName), 'utf8')).rejects.toThrow()
  const resumed = (await second.agents.resume({ resumeSessionId: agent.id })).agent
  const replay = await second.tools.execute({ name: 'genesis_record', arguments: draft, agent: resumed, signal, callId: read.source.callId })
  expect(replay.isError).not.toBe(true)
  expect(JSON.stringify(replay)).toContain('already-deleted')
  expect((await second.genesisRecords.catalog(signal))!.count).toBe(0)
  const fiber = [...second.loader.entries()].find(entry => entry.options.name === '@deepseek-ai/dsh-experimental-genesis')!.fiber!
  await fiber.dispose()
  expect(second.tools.get('genesis_record', resumed)).toBeUndefined()
})
