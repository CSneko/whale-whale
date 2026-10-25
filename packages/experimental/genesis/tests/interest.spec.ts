import { afterEach, expect, it } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SessionId } from '@deepseek-ai/dsh-session'
import { Config } from '../src/config.ts'
import type { InterestDialogue } from '../src/interest-projection.ts'
import type { InterestProposal } from '../src/interest.ts'
import { readBackup } from '../src/backup.ts'
import { openCore } from './harness.ts'

const disposers: Array<() => Promise<unknown>> = []
afterEach(async () => { for (const dispose of disposers.splice(0).reverse()) await dispose() })

function exchange(turn: number, user: string, assistant: string): InterestDialogue['turns'][number] {
  const seq = turn * 10
  return { turn, startSeq: seq, completed: true, overflow: false, tools: [], messages: [
    { role: 'user', seq: seq + 1, timestamp: '2026-10-25T00:00:00.000Z', text: user },
    { role: 'assistant', seq: seq + 2, timestamp: '2026-10-25T00:00:01.000Z', text: assistant },
  ] }
}

it('forms a lasting interest only after independent contact, actual creation and a self-initiated return; replay and restart retain it', async () => {
  const root = await mkdtemp(join(tmpdir(), 'genesis-interest-'))
  disposers.push(() => rm(root, { recursive: true, force: true }))
  const interest = Config({ leasePath: join(root, 'life.lock'), interest: {} }).interest!
  const first = await openCore(root, 'json', { interest })
  disposers.push(() => first.close())
  const session = SessionId('painting-conversation')
  const one = exchange(1, 'What is watercolor painting?', 'We can look at watercolor techniques together.')
  const proposal = (turn: number, signal: InterestProposal['signal'], id?: InterestProposal['id']): InterestProposal => ({
    ...(id === undefined ? {} : { id }), topic: 'watercolor painting', signal, selfInitiated: signal === 'return',
    reason: `Observed ${signal} in the exchange.`, sourceSeqs: [turn * 10 + 1, turn * 10 + 2],
  })
  await first.core.reviewInterest(session, one, [proposal(1, 'contact')])
  const contacted = (await first.core.snapshot()).interests![0]!
  expect(contacted.stage).toBe('contact')
  await first.core.reviewInterest(session, one, [proposal(1, 'curiosity', contacted.id)])
  expect((await first.core.snapshot()).interests![0]).toEqual(contacted)
  const two = exchange(2, 'Try painting a small sky.', 'I made a small sky study: ' + 'blue washes and soft cloud edges. '.repeat(4))
  await first.core.reviewInterest(session, two, [proposal(2, 'exploration', contacted.id)])
  expect((await first.core.snapshot()).interests![0]?.stage).toBe('exploring')
  const three = exchange(3, 'What would you like to do now?', 'I would like to revisit watercolor and compare two washes.')
  await first.core.reviewInterest(session, three, [proposal(3, 'return', contacted.id)])
  const formed = await first.core.snapshot()
  expect(formed.interests![0]?.stage).toBe('enduring')
  expect(formed.interests![0]?.evidence).toHaveLength(3)
  expect(formed.events.filter(event => event.type === 'interest.changed')).toHaveLength(3)
  expect(formed.events.filter(event => event.type === 'interest.reviewed')).toHaveLength(3)
  await first.close()
  const second = await openCore(root, 'json', { interest })
  disposers.push(() => second.close())
  expect((await second.core.snapshot()).interests).toEqual(formed.interests)
  await second.close()
  const primary = join(root, 'genesis.json')
  const disk = { unit: { name: 'genesis', version: 1 }, global: null, tables: {
    states: { life: JSON.parse(JSON.stringify(await readBackup(join(root, 'life.lock.backup.json')))) },
  } }
  delete disk.tables.states.life.interests[0].evidence
  await writeFile(primary, JSON.stringify(disk))
  await expect(openCore(root, 'json', { interest })).rejects.toThrow()
  expect((await readFile(join(root, 'life.lock.backup.json'), 'utf8')).length).toBeGreaterThan(0)
})

it('rejects unsupported exploration and wrong exchange references without changing interests', async () => {
  const root = await mkdtemp(join(tmpdir(), 'genesis-interest-denial-'))
  disposers.push(() => rm(root, { recursive: true, force: true }))
  const interest = Config({ leasePath: join(root, 'life.lock'), interest: {} }).interest!
  const opened = await openCore(root, 'json', { interest })
  disposers.push(() => opened.close())
  const session = SessionId('interest-denial')
  const turn = exchange(1, 'Paint something.', 'I might try later.')
  const before = await opened.core.snapshot()
  const proposed: InterestProposal = { topic: 'painting', signal: 'exploration', selfInitiated: false,
    reason: 'Attempted to paint.', sourceSeqs: [11, 12] }
  await expect(opened.core.reviewInterest(session, turn, [proposed])).rejects.toThrow('Exploration requires')
  await expect(opened.core.reviewInterest(session, turn, [{ ...proposed, signal: 'curiosity', sourceSeqs: [12] }]))
    .rejects.toThrow('real user')
  await expect(opened.core.reviewInterest(session, turn, [{ ...proposed, signal: 'return', selfInitiated: true }]))
    .rejects.toThrow('actual contact')
  expect((await opened.core.snapshot()).interests).toEqual(before.interests)
})

it('requires a new exploration followed by a return after an interest becomes dormant', async () => {
  const root = await mkdtemp(join(tmpdir(), 'genesis-interest-revival-'))
  disposers.push(() => rm(root, { recursive: true, force: true }))
  const interest = Config({ leasePath: join(root, 'life.lock'), interest: {} }).interest!
  const opened = await openCore(root, 'json', { interest })
  disposers.push(() => opened.close())
  const session = SessionId('interest-revival')
  const record = async (turn: number, signal: InterestProposal['signal'], user: string, assistant: string,
    id?: InterestProposal['id']) => {
    const proposal: InterestProposal = { ...(id === undefined ? {} : { id }), topic: 'watercolor painting', signal,
      selfInitiated: signal === 'return', reason: `Observed ${signal} in this exchange.`,
      sourceSeqs: [turn * 10 + 1, turn * 10 + 2] }
    await opened.core.reviewInterest(session, exchange(turn, user, assistant), [proposal])
    return (await opened.core.snapshot()).interests![0]!
  }
  const first = await record(1, 'contact', 'What is watercolor painting?', 'It uses pigment mixed with water.')
  await record(2, 'return', 'What would you like to revisit?', 'I would revisit watercolor painting.', first.id)
  const explored = await record(3, 'exploration', 'Please make a watercolor study.',
    'I made a small watercolor study: ' + 'blue washes and soft cloud edges. '.repeat(4), first.id)
  expect(explored.stage).toBe('exploring')
  expect((await record(4, 'return', 'What next?', 'I would revisit watercolor painting.', first.id)).stage).toBe('enduring')
  expect((await record(5, 'disinterest', 'How was that experience?', 'Watercolor painting feels frustrating now.', first.id)).stage).toBe('dormant')
  expect((await record(6, 'contact', 'Could we look at watercolor painting again?', 'We can look at it.', first.id)).stage).toBe('contact')
  expect((await record(7, 'exploration', 'Try another small study.',
    'I made another watercolor study: ' + 'layered color and wet edges. '.repeat(5), first.id)).stage).toBe('exploring')
  expect((await record(8, 'return', 'What next?', 'I would revisit watercolor painting.', first.id)).stage).toBe('enduring')
})
