/** Real Cordis Loader composition exercises prompt logging and native tool execution without a key. */
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import { SessionId } from '@deepseek-ai/dsh-session'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
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

const disposers: Array<() => Promise<unknown>> = []
afterEach(async () => {
  const failures: unknown[] = []
  for (const dispose of disposers.splice(0).reverse()) {
    try { await dispose() } catch (error) { failures.push(error) }
  }
  if (failures.length) throw new AggregateError(failures, 'Genesis integration teardown')
})
async function boot(root: string, enabled = true) {
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
