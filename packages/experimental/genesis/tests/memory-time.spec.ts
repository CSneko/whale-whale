import { describe, expect, it } from 'vitest'
import { brandString } from '@deepseek-ai/dsh-brand'
import { SessionId } from '@deepseek-ai/dsh-session'
import { memoryDayAnchor, memoryTimeText, readMemory, relativeMemoryTime } from '../src/memory-time.ts'
import type { LifeMemory, LifeId, MemoryId, LifeEventId } from '../src/model.ts'
import { organizationPlan } from '../src/organization.ts'

const zone = 'Asia/Manila'
const now = new Date('2026-10-26T04:00:00.000Z')

describe('relative memory calendar', () => {
  it.each([
    ['2026-10-26', '今天'], ['2026-10-25', '昨天'], ['2026-10-24', '前天'],
    ['2026-10-23', '上周'], ['2026-10-01', '这个月'], ['2026-09-15', '上个月'],
    ['2026-07-01', '3个月前'], ['2026-04-01', '半年前'], ['2025-08-01', '去年'],
    ['2026-W44', '这周'], ['2026-W43', '上周'], ['2026-10', '这个月'], ['2025', '去年'],
    ['2026-10-27', '明天'], ['2027', '明年'], ['2026-02-30', '时间无法读取'], ['2026-W54', '时间无法读取'],
  ])('renders %s as %s without inventing finer precision', (value, expected) => {
    expect(relativeMemoryTime(value, now, zone)).toBe(expected)
  })

  it('uses local calendar days over a week or year boundary, including DST', () => {
    expect(relativeMemoryTime('2026-10-25', new Date('2026-10-25T16:01:00Z'), zone)).toBe('昨天')
    expect(relativeMemoryTime('2025-12-31', new Date('2026-01-01T02:00:00Z'), zone)).toBe('昨天')
    expect(relativeMemoryTime('2026-03-08', new Date('2026-03-09T04:01:00Z'), 'America/New_York')).toBe('昨天')
  })

  it('validates explicit markers without interpreting words, numbers or unmarked dates', () => {
    const prose = '说明年龄，说明年纪，今天谈过茶。版本 2026-10，生日为2026年10月24日。'
    expect(memoryTimeText(prose)).toBe(prose)
    expect(memoryDayAnchor(now, zone)).toBe('{{time:2026-10-26}}')
    expect(memoryTimeText('生日是{{date:--02-29}}。')).toContain('{{date:--02-29}}')
    for (const text of ['{{time:昨天}}', '{{time:2026-02-30}}', '{{time:2026-10-01',
      '{{date:--02-30}}', '{{date:2026-02-29}}', '{{time:--10-24}}', '{{date:2026-10-24']) {
      expect(() => memoryTimeText(text)).toThrow()
    }
  })

  it('renders ordinary experience times relatively and retains important exact dates without mutating storage', () => {
    const memory: LifeMemory = {
      id: brandString<MemoryId>('996dd0c6-a39f-4104-8b32-c1d11c1366ac'),
      lifeId: brandString<LifeId>('4c66d61e-5a8b-4ff6-9bf5-c5d473a235d0'),
      category: 'episodic', content: '{{time:2026-10-25}}聊过茶；{{time:2026-09-15}}曾读书。说明年龄，说明年纪。',
      importance: 0.5, confidence: 0.5, sourceEventIds: [brandString<LifeEventId>('08db7341-4f31-4bab-bf20-a62493448755')],
      createdAt: '2026-10-25T01:00:00Z', updatedAt: '2026-10-26T01:00:00Z',
      experience: { sessionId: SessionId('fixture'),
        startedAt: '2026-10-25T01:00:00Z', endedAt: '2026-10-25T01:30:00Z', topics: ['{{time:2026-10}}的茶'] },
      history: [{ category: 'episodic', content: '{{time:2026-10-24}}聊过茶', importance: 0.5, confidence: 0.5,
        sourceEventIds: [], recordedAt: '2026-10-24T01:00:00Z', supersededAt: '2026-10-25T01:00:00Z' }],
    }
    const before = structuredClone(memory)
    const reading = JSON.stringify(readMemory(memory, now, zone))
    expect(reading).toContain('昨天聊过茶；上个月曾读书')
    expect(reading).toContain('说明年龄，说明年纪。')
    expect(reading).toContain('前天聊过茶')
    expect(reading).not.toMatch(/2026|time:|T01:/u)
    expect(memory).toEqual(before)
    const organized = organizationPlan({ memories: [{ evidenceIds: ['m1'], category: 'semantic',
      content: '聊过茶。', confidence: 0.5, importance: 0.5 }] }, [{ ...memory, content: '聊过茶。' }], 1, 1, zone)
    expect(organized[0]!.input.content).toContain('{{time:2026-10-25}}')
    const precise = { ...memory, content: '生日为{{date:--10-24}}，纪念日是{{date:2026-10-23}}。{{time:2026-10-25}}聊过茶。' }
    const preciseReading = JSON.stringify(readMemory(precise, now, zone))
    expect(preciseReading).toContain('生日为10月24日，纪念日是2026年10月23日。昨天聊过茶。')
    expect(preciseReading).not.toContain('{{')
    const retained = organizationPlan({ memories: [{ evidenceIds: ['m1'], category: 'semantic',
      content: '生日与茶的回忆。', confidence: 0.5, importance: 0.5 }] }, [precise], 1, 1, zone)
    expect(retained[0]!.input.content).toContain('{{date:--10-24}}')
    expect(retained[0]!.input.content).toContain('{{date:2026-10-23}}')
  })
})
