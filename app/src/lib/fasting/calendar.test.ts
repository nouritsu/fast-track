import { describe, expect, it } from 'vitest'
import { dayTotals, foldLine, icsText, isoWeek, monthRows, monthSummary, rowWeek, toIcs, weekdayHeads, weekTotal } from './calendar'
import type { Fast } from './fasts'

const at = (iso: string) => new Date(iso).getTime()
const fast = (start: string, end: string, goal = 16, extra: Partial<Fast> = {}): Fast => ({
  id: `${start}/${end}`,
  start: at(start),
  end: at(end),
  goal,
  note: '',
  weight: null,
  ...extra,
})

describe('calendar grid', () => {
  it('lays out six weeks from any first weekday', () => {
    // November 2026 starts on a Sunday.
    expect(monthRows(2026, 10, 1)[0].days).toEqual([null, null, null, null, null, null, 1])
    expect(monthRows(2026, 10, 0)[0].days).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(monthRows(2026, 10, 6)[0].days).toEqual([null, 1, 2, 3, 4, 5, 6])
    for (const start of [0, 1, 6] as const) {
      const rows = monthRows(2027, 1, start)
      expect(rows).toHaveLength(6)
      expect(rows.flatMap((r) => r.days).filter((d) => d !== null)).toHaveLength(28)
    }
    expect(monthRows(2026, 10, 1)[0].start.getDate()).toBe(26) // Monday 26 October
  })

  it('names the weekdays from the first one', () => {
    expect(weekdayHeads(1)).toEqual(['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'])
    expect(weekdayHeads(0)[0]).toBe('Su')
    expect(weekdayHeads(6).slice(0, 2)).toEqual(['Sa', 'Su'])
  })

  it('numbers weeks as ISO 8601 does', () => {
    expect(isoWeek(new Date(2026, 10, 17))).toBe(47)
    expect(isoWeek(new Date(2027, 0, 1))).toBe(53) // a Friday: still the last week of 2026
    expect(isoWeek(new Date(2026, 0, 1))).toBe(1) // a Thursday
    expect(isoWeek(new Date(2024, 11, 30))).toBe(1) // a Monday in 2025's first week
    const rows = monthRows(2026, 10, 0) // Sunday first: each row's Thursday decides
    expect(rows.map(rowWeek).slice(0, 3)).toEqual([45, 46, 47])
  })
})

describe('calendar totals', () => {
  const fasts = [
    fast('2026-11-16T20:00', '2026-11-17T12:00'), // 16h, met
    fast('2026-11-17T13:00', '2026-11-17T20:00', 16), // 7h, short, same day
    fast('2026-11-18T20:00', '2026-11-19T15:00'), // 19h, met
  ]

  it('adds up each day and its deepest stage', () => {
    const days = dayTotals(fasts)
    expect(days.get('2026-11-17')).toEqual({ ms: 23 * 3_600_000, stage: 2 })
    expect(days.get('2026-11-19')).toEqual({ ms: 19 * 3_600_000, stage: 2 })
  })

  it('adds up a week row and sums up a month', () => {
    const row = monthRows(2026, 10, 1)[3] // Monday 16 to Sunday 22 November
    expect(weekTotal(fasts, row) / 3_600_000).toBe(42)
    expect(monthSummary(fasts, 2026, 10).count).toBe(3)
    expect(monthSummary(fasts, 2026, 11).count).toBe(0)
  })
})

describe('iCalendar export', () => {
  it('escapes text and folds long lines at 75 octets without splitting a character', () => {
    expect(icsText('a; b, c\\d\ne')).toBe('a\\; b\\, c\\\\d\\ne')
    const folded = foldLine(`DESCRIPTION:${'é'.repeat(60)}`)
    for (const line of folded.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    expect(folded.replace(/\r\n /g, '')).toBe(`DESCRIPTION:${'é'.repeat(60)}`)
  })

  it('writes one event per fast with its times, stage, goal and note', () => {
    const ics = toIcs([fast('2026-11-16T20:00Z', '2026-11-17T12:30Z', 16, { note: 'eggs, then coffee', weight: 72.6 })], 'kg', at('2026-11-18T09:00Z'))
    const lines = ics.split('\r\n')
    expect(lines[0]).toBe('BEGIN:VCALENDAR')
    expect(lines).toContain('DTSTART:20261116T200000Z')
    expect(lines).toContain('DTEND:20261117T123000Z')
    expect(lines).toContain('SUMMARY:Fast 16:30 · Ketosis')
    expect(ics).toContain('DESCRIPTION:103% of a 16h goal\\nWeight 72.6 kg\\nNote: eggs\\, then coffee')
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })
})
