// Times and dates as the app shows and steps them. Everything is local time;
// stored times are epoch milliseconds.

import { clock, two } from '../ui/fields'

export const MINUTE = 60_000
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const format = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en', options)
const WEEKDAY = format({ weekday: 'short' })
const WEEKDAY_LONG = format({ weekday: 'long' })
const MONTH = format({ month: 'short' })

/** A local calendar day as YYYY-MM-DD, for grouping fasts by day. */
export function dayKey(at: number | Date): string {
  const d = new Date(at)
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`
}

const sameDay = (a: number, b: number): boolean => dayKey(a) === dayKey(b)

/** Noon on the day a day key names: inside that day whatever DST does to its ends. */
export const noonOf = (key: string): number => new Date(`${key}T12:00`).getTime()

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

/** Two days as the ends of a range, the first without the month and year it shares with
 *  the second: ["20", "27 Oct"], ["28 Sep", "5 Oct"]. */
export function dayRange(from: number, to: number, now: number): [string, string] {
  const [a, b] = [new Date(from), new Date(to)]
  const sameMonth = a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
  return [sameMonth ? String(a.getDate()) : dayMonth(from, b.getFullYear() === a.getFullYear() ? to : now), dayMonth(to, now)]
}

export const floorMinute =(at: number): number => Math.floor(at / MINUTE) * MINUTE

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
