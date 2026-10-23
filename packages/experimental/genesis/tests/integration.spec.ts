/** Real Cordis Loader composition exercises prompt logging and native tool execution without a key. */
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import { SessionId, pluginRecordOf } from '@deepseek-ai/dsh-session'
import { createUserMessage, ToolCallId } from '@deepseek-ai/dsh-llm'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, expect, it } from 'vitest'
import { z } from 'zod'
import { stateSchema } from '../src/model.ts'
import { ScriptedModel } from './adapter.ts'
import * as Genesis from '../src/index.ts'
import type { MemoryConfig } from '../src/config.ts'
import { createServer } from 'node:http'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { LifeMemoryEngine } from '../src/memory.ts'

const disposers: Array<() => Promise<unknown>> = []
afterEach(async () => {
  const failures: unknown[] = []
  for (const dispose of disposers.splice(0).reverse()) {
    try { await dispose() } catch (error) { failures.push(error) }
  }
  if (failures.length) throw new AggregateError(failures, 'Genesis integration teardown')
})
async function boot(root: string, enabled = true, memory?: MemoryConfig, awakening = false) {
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    "- name: '@deepseek-ai/dsh-llm'",
    "- name: '@deepseek-ai/dsh-session'",
    "- name: '@deepseek-ai/dsh-session-projection'",
    "- name: '@deepseek-ai/dsh-system-prompt'",
    "- name: '@deepseek-ai/dsh-tools'",
    "- name: '@deepseek-ai/dsh-agent'",
    "- name: '@deepseek-ai/dsh-storage'",
    "- name: '@deepseek-ai/dsh-storage-json'", '  config:', `    root: ${JSON.stringify(root)}`,
    "- name: '@deepseek-ai/dsh-storage-domain'", '  config:', '    backend: json',
    "- name: '@deepseek-ai/dsh-experimental-genesis'", `  disabled: ${!enabled}`, '  config:', `    leasePath: ${JSON.stringify(join(root, 'writer.lock'))}`,
    ...(memory === undefined ? [] : [`    memory: ${JSON.stringify(memory)}`]),
    ...(awakening ? ['    awakening: { provider: fixture, model: chat }'] : []),
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
  const disk = z.object({ tables: z.object({ states: z.object({ life: stateSchema }) }) })
    .parse(JSON.parse(await readFile(join(root, 'genesis.json'), 'utf8')))
  expect(disk.tables.states.life.identity.id).toBe(initial.identity.id)
  expect(disk.tables.states.life.events.filter((event: { type: string }) => event.type === 'life.created')).toHaveLength(1)
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
  let malformed = false
  const server = createServer((request, response) => {
    void (async () => {
      let body = ''
      for await (const chunk of request) body += String(chunk)
      const input = z.object({ input: z.string(), dimensions: z.literal(3), model: z.literal('fixture-embedding') }).parse(JSON.parse(body)).input
      requests.push(input)
      const embedding = malformed ? [0] : /oolong|warm drink/u.test(input) ? [1, 0, 0] : /gentle/u.test(input) ? [0, 1, 0] : [0, 0, 1]
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ data: [{ index: 0, embedding }] }))
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
    timeoutMs: 5000, inputChars: 24000, outputChars: 24000, maxTokens: 4096, maxChanges: 8,
    maxImplicitMemories: 4, minSimilarity: 0.8,
  }
  return { config, requests, breakResponse() { malformed = true } }
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
  expect((await execute('genesis_recall', { query: 'oolong' })).isError).toBe(true)
  const unknown = await execute('learn', { name: 'unavailable' })
  expect(unknown.isError).toBe(true)
  expect(JSON.stringify(unknown)).not.toContain('genesis_recall')
  agent.followup(createUserMessage({ content: [{ type: 'text', text: '你好！Remember I prefer oolong. Please use a gentle tone. Private introduction marker.' }], source: { kind: 'user' } }))
  await agent.whenIdle()
  expect(model.requests[0]?.tools?.map(tool => tool.name)).toEqual(['learn'])
  expect(JSON.stringify(model.requests[0])).not.toContain('genesis_recall')
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
  expect(JSON.stringify(reader.requests[0])).not.toContain('The user prefers oolong.')
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
  const audit = agent.session.ownEvents().map(pluginRecordOf).filter(record => record?.type === 'plugin:genesis/memory-call')
  expect(audit).toHaveLength(4)
  expect(JSON.stringify(audit)).toContain('The user prefers oolong.')
  const reviewed = state.events.find(event => event.type === 'memory.reviewed')!
  const engine = new LifeMemoryEngine(first, first.genesis, Genesis.Config({ leasePath: join(root, 'writer.lock'), memory: embeddings.config }), embeddings.config)
  for (const event of agent.session.ownEvents()) engine.observe(agent.session.id, event)
  await engine.review(agent, 1, new AbortController().signal)
  await engine.close()
  expect(writer.requests).toHaveLength(1)
  expect((await first.genesis.snapshot()).events.filter(event => event.id === reviewed.id)).toHaveLength(1)
  expect(stateSchema.parse(JSON.parse(await readFile(join(root, 'writer.lock.backup.json'), 'utf8')))).toEqual(state)
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
  expect(JSON.stringify(reader.requests[0])).not.toContain('The user prefers oolong.')
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
  expect(after.events.filter(event => event.type === 'memory.reviewed')).toEqual([])
  expect(agent.session.ownEvents().some(event => event.type === 'turn/end' && event.data.reason.kind === 'error')).toBe(true)
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
  expect((await ctx.genesis.snapshot()).events.filter(event => event.type === 'memory.reviewed')).toEqual([])
})
