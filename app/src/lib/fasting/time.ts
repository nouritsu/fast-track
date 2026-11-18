// Times and dates as the app shows and steps them. Everything is local time;
// stored times are epoch milliseconds.

import { clock } from '../ui/fields'

export const MINUTE = 60_000
export const HOUR = 60 * MINUTE

const two = (n: number) => String(n).padStart(2, '0')
const format = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en', options)
const WEEKDAY = format({ weekday: 'short' })
const WEEKDAY_LONG = format({ weekday: 'long' })
const MONTH = format({ month: 'short' })
const MONTH_LONG = format({ month: 'long' })

/** A local calendar day as YYYY-MM-DD, for grouping fasts by day. */
export function dayKey(at: number | Date): string {
  const d = new Date(at)
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`
}

export const sameDay = (a: number, b: number): boolean => dayKey(a) === dayKey(b)

/** "Tue 06:30". */
export const dayClock = (at: number): string => `${WEEKDAY.format(at)} ${clock(new Date(at))}`

/** "06:30" on the same day as `now`, else "Tue 06:30". */
export const nearClock = (at: number, now: number): string => (sameDay(at, now) ? clock(new Date(at)) : dayClock(at))

/** "Tue 17 Nov". */
export const shortDate = (at: number): string => {
  const d = new Date(at)
  return `${WEEKDAY.format(d)} ${two(d.getDate())} ${MONTH.format(d)}`
}

/** "Monday 16 Nov". */
export const longDate = (at: number): string => {
  const d = new Date(at)
  return `${WEEKDAY_LONG.format(d)} ${d.getDate()} ${MONTH.format(d)}`
}

/** "12 Sep", or "12 Sep 2025" outside the year of `now`. */
export const dayMonth = (at: number, now: number): string => {
  const d = new Date(at)
  const year = d.getFullYear() === new Date(now).getFullYear() ? '' : ` ${d.getFullYear()}`
  return `${d.getDate()} ${MONTH.format(d)}${year}`
}

/** "November 2026". */
export const monthTitle = (year: number, month: number): string =>
  `${MONTH_LONG.format(new Date(year, month, 1))} ${year}`

export const floorMinute = (at: number): number => Math.floor(at / MINUTE) * MINUTE

/** The same time of day `days` later; DST-safe, unlike adding 24 hours. */
export function stepDay(at: number, days: number): number {
  const d = new Date(at)
  d.setDate(d.getDate() + days)
  return d.getTime()
}

export const stepHour = (at: number, hours: number): number => at + hours * HOUR

/** Moves by `steps` of `size` minutes, landing on a multiple of `size`. */
export function stepMinute(at: number, steps: number, size = 5): number {
  const d = new Date(floorMinute(at))
  const snapped = steps > 0 ? Math.floor(d.getMinutes() / size) * size : Math.ceil(d.getMinutes() / size) * size
  d.setMinutes(snapped + steps * size)
  return d.getTime()
}

/** Six weeks for every month, Monday first, with null for days outside it: always six,
 *  so the calendar keeps its height from month to month. */
export function monthGrid(year: number, month: number): (number | null)[][] {
  const first = (new Date(year, month, 1).getDay() + 6) % 7 // Monday is 0
  const days = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  while (cells.length < 6 * 7) cells.push(null)
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7))
}
