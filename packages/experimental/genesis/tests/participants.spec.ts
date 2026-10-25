/** Role relabeling accepts identity substitutions without accepting rewritten facts. @module */
import { expect, it } from 'vitest'
import { brandString } from '@deepseek-ai/dsh-brand'
import { relabelPlan } from '../src/participants.ts'
import type { LifeMemory, LifeId, MemoryId, LifeEventId } from '../src/model.ts'

const memory: LifeMemory = { id: brandString<MemoryId>('d8269cdc-5771-4200-9bc6-1d7be97c25ca'),
  lifeId: brandString<LifeId>('742fe398-c561-4266-901b-07e20214abf8'), category: 'semantic', content: '用户喜欢茶。助手感谢用户。',
  confidence: 0.6, importance: 0.5, sourceEventIds: [brandString<LifeEventId>('b611c487-c8f3-4f0f-bf01-1b4af4f4014e')],
  createdAt: '2026-10-24T00:00:00.000Z', updatedAt: '2026-10-24T00:00:00.000Z' }
const names = { character: { name: '小芽', named: true }, operator: { name: 'CrystalNeko', identity: '创造者', configured: true } }

it('changes only selected participant labels, preserves source data and refuses arbitrary or overlapping replacements', () => {
  const replacement = (before: string, occurrence: number, participant: string) => ({ field: 'content', before, occurrence, participant })
  const result = relabelPlan({ memories: [{ id: memory.id, replacements: [replacement('用户', 0, 'operator'),
    replacement('助手', 0, 'character'), replacement('用户', 1, 'operator')] }] }, [memory], names)[0]!
  expect(result).toEqual({ ...memory, content: 'CrystalNeko喜欢茶。小芽感谢CrystalNeko。' })
  expect(memory.content).toBe('用户喜欢茶。助手感谢用户。')
  expect(() => relabelPlan({ memories: [{ id: memory.id, replacements: [replacement('喜欢茶', 0, 'operator')] }] }, [memory], names)).toThrow('only generic')
  expect(() => relabelPlan({ memories: [{ id: memory.id, replacements: [replacement('用户', 0, 'operator'), replacement('用户', 0, 'operator')] }] }, [memory], names)).toThrow('overlap')
})
