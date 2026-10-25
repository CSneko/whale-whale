/** Stable calendar anchors, selective exact-date retention and structural marker rendering. @module */
import { GenesisError } from './error.ts'
import type { LifeMemory } from './model.ts'

const DAY = 86400000
const markers = /\{\{((?:time|date):[^{}]+)\}\}/gu


/** Calendar precision belongs to the evidence; unknown dates must not acquire invented days. */
export const MEMORY_TIME_GUIDANCE = 'Distinguish dates worth remembering exactly from ordinary experience time. Use {{date:YYYY-MM-DD}} for explicitly evidenced birthdays, anniversaries, appointments, deadlines or an explicit request to remember an exact date. Use {{date:--MM-DD}} for an annual birthday or anniversary when no year is known; never invent a birth year. Exact date anchors remain precise during recall. For ordinary experiences, use {{time:YYYY-MM-DD}}, {{time:YYYY-Www}} (ISO Monday week), {{time:YYYY-MM}} or {{time:YYYY}}; recall renders these relatively. Other supported calendar precisions may also use date anchors when exact retention is justified. Preserve the precision supported by evidence, existing exact dates and event tense during synthesis. Do not make ordinary event dates exact merely because a storage timestamp is available. Never store deictic dates such as today, yesterday, last week, 今年 or 明年 outside anchors. Resolve them relative to the timestamp of the cited message in clock.timeZone, not the time of this model call or memory update. Storage timestamps do not establish when the described event happened. Determine time expressions from the entire sentence. Substrings in ordinary words such as 明年 in 说明年龄 are not dates; preserve those words, model names and version numbers unchanged. If evidence cannot date an event, explicitly say its time is unknown; never guess. Keep an explicitly stated time of day beside the date anchor. A summary of the supplied interaction may use its actual source-message date.'

function dateKey(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-')
}
function dateNumber(value: string): number { return Date.parse(`${value}T00:00:00.000Z`) / DAY }
function dayKey(value: number): string { return new Date(value * DAY).toISOString().slice(0, 10) }
function monday(value: number): number { return value - ((new Date(value * DAY).getUTCDay() + 6) % 7) }
function weekKey(value: number): string {
  const start = monday(value)
  const year = new Date((start + 3) * DAY).getUTCFullYear()
  return `${year}-W${String((start - monday(dateNumber(`${year}-01-04`))) / 7 + 1).padStart(2, '0')}`
}
function anchor(value: string): { first: number; precision: 'day' | 'week' | 'month' | 'year' } | undefined {
  if (/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    const first = dateNumber(value)
    if (Number.isFinite(first) && dayKey(first) === value) return { first, precision: 'day' }
  } else if (/^\d{4}-W\d{2}$/u.test(value)) {
    const year = value.slice(0, 4), week = Number(value.slice(6))
    const first = monday(dateNumber(`${year}-01-04`)) + (week - 1) * 7
    if (Number.isFinite(first) && weekKey(first) === value) return { first, precision: 'week' }
  } else if (/^\d{4}(-\d{2})?$/u.test(value)) {
    const first = dateNumber(value.length === 4 ? `${value}-01-01` : `${value}-01`)
    if (Number.isFinite(first) && dayKey(first).startsWith(value)) return { first, precision: value.length === 4 ? 'year' : 'month' }
  }
  return undefined
}
function annualDate(value: string): boolean {
  return /^--\d{2}-\d{2}$/u.test(value) && anchor(`2000-${value.slice(2)}`)?.precision === 'day'
}
function exactDate(value: string): string {
  if (annualDate(value)) return `${Number(value.slice(2, 4))}月${Number(value.slice(5))}日`
  const parsed = anchor(value)
  if (parsed === undefined) return '时间无法读取'
  if (parsed.precision === 'week') return `${value.slice(0, 4)}年第${Number(value.slice(6))}周`
  return value.split('-').map((part, index) => `${Number(part)}${['年', '月', '日'][index]}`).join('')
}

/**
 * Validate explicit time/date markup without interpreting or modifying ordinary prose.
 * @param text - Candidate prose, including habit cues and experience topics.
 * @returns The unchanged prose, or a structural time-marker error.
 */
export function memoryTimeText(text: string): string {
  const rest = text.replace(markers, (_match: string, marker: string) => {
    const value = marker.slice(5)
    if (anchor(value) === undefined && !(marker.startsWith('date:') && annualDate(value))) {
      throw new GenesisError('invalid-source', 'Memory contains an invalid time anchor. Use a real ISO date, week, month or year; exact annual dates use date:--MM-DD.')
    }
    return ''
  })
  if (rest.includes('{{time:') || rest.includes('{{date:')) {
    throw new GenesisError('invalid-source', 'Memory contains an unanchored or incomplete date. Use time calendar anchors for ordinary experiences, date anchors for exact dates, or explicitly unknown time.')
  }
  return text
}

/**
 * Format a known structured timestamp as an ordinary day anchor; no prose is searched.
 * @param at - Actual source timestamp.
 * @param timeZone - Calendar zone for that source.
 * @returns A stable day marker.
 */
export function memoryDayAnchor(at: Date, timeZone: string): string {
  return `{{time:${dateKey(at, timeZone)}}}`
}

/**
 * Render a stable anchor using the finest supported calendar interval, without an absolute date.
 * @param value - ISO day, week, month or year, without marker braces.
 * @param now - Retrieval time.
 * @param timeZone - Deployment calendar zone, including DST transitions.
 * @returns Relative Chinese time, or an explicit unreadable-time label.
 */
export function relativeMemoryTime(value: string, now: Date, timeZone: string): string {
  const parsed = anchor(value)
  if (parsed === undefined) return '时间无法读取'
  const today = dateNumber(dateKey(now, timeZone)), age = today - parsed.first
  if (parsed.precision === 'day') {
    if (age >= -2 && age <= 2) return ['后天', '明天', '今天', '昨天', '前天'][age + 2]!
  }
  if (parsed.precision === 'day' || parsed.precision === 'week') {
    const weeks = (monday(today) - monday(parsed.first)) / 7
    if (weeks >= -1 && weeks <= 1) return ['下周', '这周', '上周'][weeks + 1]!
    if (parsed.precision === 'week' && weeks === 2) return '两周前'
  }
  const current = new Date(today * DAY), past = new Date(parsed.first * DAY)
  const years = current.getUTCFullYear() - past.getUTCFullYear()
  if (parsed.precision !== 'year') {
    const months = years * 12 + current.getUTCMonth() - past.getUTCMonth()
    if (months >= -1 && months <= 1) return ['下个月', '这个月', '上个月'][months + 1]!
    if (months > 1 && months < 12) return months === 6 ? '半年前' : `${months}个月前`
    if (months < -1 && months > -12) return `${-months}个月后`
  }
  return years === 0 ? '今年' : years === 1 ? '去年' : years === -1 ? '明年' : years > 1 ? `${years}年前` : `${-years}年后`
}

/**
 * Prepare character memory reads, retaining selected exact dates and rendering ordinary experience time relatively.
 * @param memory - Stable sourced memory.
 * @param now - One retrieval instant shared by the entire result.
 * @param timeZone - Deployment calendar zone.
 * @returns Serializable reading without embeddings; date anchors remain exact, time anchors and record timestamps become relative.
 */
export function readMemory(memory: LifeMemory, now: Date, timeZone: string): object {
  const prose = (text: string) => text.split(markers).map((part, index) => index % 2 === 1
    ? part.startsWith('date:') ? exactDate(part.slice(5)) : relativeMemoryTime(part.slice(5), now, timeZone)
    : part).join('')
  const timestamp = (value: string) => relativeMemoryTime(dateKey(new Date(value), timeZone), now, timeZone)
  const habit = (value: NonNullable<LifeMemory['habit']>) => ({ ...value, cue: prose(value.cue), response: prose(value.response) })
  const { embedding: _embedding, ...view } = memory
  return { ...view, content: prose(memory.content), createdAt: timestamp(memory.createdAt), updatedAt: timestamp(memory.updatedAt),
    ...(memory.habit === undefined ? {} : { habit: habit(memory.habit) }),
    ...(memory.experience === undefined ? {} : { experience: { ...memory.experience,
      startedAt: timestamp(memory.experience.startedAt), endedAt: timestamp(memory.experience.endedAt), topics: memory.experience.topics.map(prose) } }),
    ...(memory.history === undefined ? {} : { history: memory.history.map(version => ({ ...version,
      content: prose(version.content), recordedAt: timestamp(version.recordedAt), supersededAt: timestamp(version.supersededAt),
      ...(version.habit === undefined ? {} : { habit: habit(version.habit) }) })) }) }
}
