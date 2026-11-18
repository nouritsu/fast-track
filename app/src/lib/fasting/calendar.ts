// The calendar's arithmetic: months as six week rows from any first weekday, ISO week
// numbers, each day's and week's fasting hours, a month's summary, and
// the fasts as an iCalendar (.ics) file for other calendar apps. A fast belongs to the
// day it ended on, as everywhere in the app.

import { deepestStage, fastLength, percentOf, showWeight, summarize, type Fast, type Summary } from './fasts'
import { STAGES } from './stages'
import { dayKey, HOUR } from './time'

/** The weekday a week starts on, as Date.getDay counts: Sunday 0, Monday 1, Saturday 6. */
export type WeekStart = 0 | 1 | 6
export const WEEK_STARTS: WeekStart[] = [1, 0, 6]
const NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export const weekStartName = (start: WeekStart): string => DAY_NAMES[start]

/** The two-letter weekday heads, from the first day of the week. */
export const weekdayHeads = (start: WeekStart): string[] => Array.from({ length: 7 }, (_, i) => NAMES[(start + i) % 7])

export interface WeekRow {
  start: Date // the row's first day, perhaps in the month before
  days: (number | null)[] // the month's day numbers, null outside it
}

/** Six week rows for any month, so the grid keeps its height from month to month. */
export function monthRows(year: number, month: number, start: WeekStart): WeekRow[] {
  const lead = (new Date(year, month, 1).getDay() - start + 7) % 7
  const length = new Date(year, month + 1, 0).getDate()
  return Array.from({ length: 6 }, (_, w) => {
    const first = new Date(year, month, 1 - lead + w * 7)
    const days = Array.from({ length: 7 }, (_, d) => {
      const n = 1 - lead + w * 7 + d
      return n >= 1 && n <= length ? n : null
    })
    return { start: first, days }
  })
}

/** The ISO 8601 week number of a date: weeks start on Monday, and week 1 holds the
 *  year's first Thursday. */
export function isoWeek(at: Date): number {
  const d = new Date(Date.UTC(at.getFullYear(), at.getMonth(), at.getDate()))
  const weekday = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - weekday) // the Thursday of its week
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1)
  return Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7)
}

/** A row's week number: the ISO week of its Thursday, whatever day the row starts on. */
export function rowWeek(row: WeekRow): number {
  const thursday = new Date(row.start)
  thursday.setDate(thursday.getDate() + ((4 - row.start.getDay() + 7) % 7))
  return isoWeek(thursday)
}

export interface DayTotal {
  ms: number // fasting time of the fasts ending that day
  stage: number // the deepest stage they reached
}

export function dayTotals(fasts: Fast[]): Map<string, DayTotal> {
  const days = new Map<string, DayTotal>()
  for (const fast of fasts) {
    const key = dayKey(fast.end)
    const day = days.get(key) ?? { ms: 0, stage: 0 }
    days.set(key, { ms: day.ms + fastLength(fast), stage: Math.max(day.stage, deepestStage(fast)) })
  }
  return days
}

/** Whole hours, as a day's cell or a week's total shows them. */
export const hoursOf = (ms: number): number => Math.round(ms / HOUR)

/** The fasting time of the fasts ending in the row's seven days. */
export function weekTotal(fasts: Fast[], row: WeekRow): number {
  const from = row.start.getTime()
  const to = new Date(row.start.getFullYear(), row.start.getMonth(), row.start.getDate() + 7).getTime()
  return fasts.filter((f) => f.end >= from && f.end < to).reduce((sum, f) => sum + fastLength(f), 0)
}

/** The month's fasts in numbers. */
export function monthSummary(fasts: Fast[], year: number, month: number): Summary {
  const prefix = dayKey(new Date(year, month, 1)).slice(0, 7)
  return summarize(fasts.filter((f) => dayKey(f.end).startsWith(prefix)))
}

// iCalendar (RFC 5545) ------------------------------------------------------------

const stamp = (at: number) => new Date(at).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

/** Text with the characters iCalendar reserves escaped. */
export const icsText = (text: string): string =>
  text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** A content line folded at 75 octets, continuation lines starting with a space,
 *  never splitting a character. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder()
  const parts: string[] = []
  let part = ''
  let bytes = 0
  for (const ch of line) {
    const size = encoder.encode(ch).length
    if (bytes + size > (parts.length ? 74 : 75)) {
      parts.push(part)
      part = ''
      bytes = 0
    }
    part += ch
    bytes += size
  }
  parts.push(part)
  return parts.join('\r\n ')
}

const hm = (ms: number) => {
  const minutes = Math.round(ms / 60_000)
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`
}

/** The fasts as an iCalendar file: one event each, from start to end, named for its
 *  length and deepest stage, with the goal, weight and note in the description. */
export function toIcs(fasts: Fast[], unit: 'kg' | 'lb', now = Date.now()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Fast Track//Fasts//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Fasts']
  for (const fast of [...fasts].sort((a, b) => a.start - b.start)) {
    const length = fastLength(fast)
    const about = [
      `${percentOf(length, fast.goal)}% of a ${fast.goal}h goal`,
      fast.weight !== null && `Weight ${showWeight(fast.weight, unit)}`,
      fast.note && `Note: ${fast.note}`,
    ].filter(Boolean)
    lines.push(
      'BEGIN:VEVENT',
      `UID:${fast.id}@fast-track`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(fast.start)}`,
      `DTEND:${stamp(fast.end)}`,
      `SUMMARY:${icsText(`Fast ${hm(length)} · ${STAGES[deepestStage(fast)].name}`)}`,
      `DESCRIPTION:${icsText(about.join('\n'))}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join('\r\n') + '\r\n'
}
