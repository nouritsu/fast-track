// The Stats page's numbers. Most cover a span of days ending today (the last 30, 90 or
// 365, or the whole history) and can be set against the same span just before it; the
// records cover everything. A fast belongs to the day it ended on, as everywhere in
// the app. Weights are openScale's weighings and the weights typed in.

import { weekdayHeads, type WeekStart } from './calendar'
import { deepestStage, fastLength, metGoal, progressOf, type Fast } from './fasts'
import type { ScaleWeight } from './openscale'
import { STAGES, stageIndex } from './stages'
import { dayKey, HOUR, stepDay } from './time'

const DAY = 24 * HOUR

/** The spans the Summary's corner offers, in days; 0 is the whole history. */
export const SPANS = [30, 90, 365, 0] as const
export type Span = (typeof SPANS)[number]

/** "30d", "1y", "all". */
export const spanName = (span: Span): string => (span === 365 ? '1y' : span ? `${span}d` : 'all')

/** Midnight at the start of the day `at` falls on. */
export function startOfDay(at: number): number {
  const d = new Date(at)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** A stretch of time, from midnight at its start to its end. */
export interface Window {
  from: number
  to: number
}

/** The span's days up to now, today the last of them. The whole history starts on the
 *  day the first fast ended (today, without any). */
export function spanWindow(fasts: Fast[], span: Span, now: number): Window {
  if (span) return { from: startOfDay(stepDay(now, 1 - span)), to: now }
  return { from: startOfDay(Math.min(now, ...fasts.map((f) => f.end))), to: now }
}

/** The same number of days just before the window, or null for the whole history. */
export const priorWindow = (window: Window, span: Span): Window | null =>
  span ? { from: startOfDay(stepDay(window.from, -span)), to: window.from - 1 } : null

/** The fasts that ended inside the window. */
export const within = (fasts: Fast[], window: Window): Fast[] =>
  fasts.filter((f) => f.end >= window.from && f.end <= window.to)

/** The window's calendar days, counting a part day as one. */
export const daysIn = (window: Window): number => Math.round((startOfDay(window.to) - window.from) / DAY) + 1

export function median(values: number[]): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

// Lengths ---------------------------------------------------------------------------

const EDGES = [12, 14, 16, 18, 20, 24] // hours
const BAND_NAMES = ['<12h', ...EDGES.slice(0, -1).map((e, i) => `${e}–${EDGES[i + 1]}h`), '24h+']

export interface Band {
  name: string
  count: number
}

/** How many fasts fall in each band of length: under 12h, two-hour bands to 20h,
 *  20–24h and a day or more. Empty bands at either end are left out. */
export function lengthBands(fasts: Fast[]): Band[] {
  const counts = BAND_NAMES.map(() => 0)
  for (const fast of fasts) {
    const i = EDGES.findIndex((edge) => fastLength(fast) < edge * HOUR)
    counts[i < 0 ? EDGES.length : i]++
  }
  const first = counts.findIndex((c) => c > 0)
  const last = counts.findLastIndex((c) => c > 0)
  return first < 0 ? [] : BAND_NAMES.slice(first, last + 1).map((name, k) => ({ name, count: counts[first + k] }))
}

// Goals -----------------------------------------------------------------------------

/** A run of days in a row, as day keys, or none. */
export interface Run {
  days: number
  from: string | null
  to: string | null
}

const noon = (key: string) => new Date(`${key}T12:00`)

/** The longest run of days in a row with a fast that met its goal ending on them; the
 *  latest of equal runs. */
export function bestStreak(fasts: Fast[]): Run {
  const met = new Set(fasts.filter(metGoal).map((f) => dayKey(f.end)))
  let best: Run = { days: 0, from: null, to: null }
  for (const key of met) {
    const day = noon(key)
    day.setDate(day.getDate() - 1)
    if (met.has(dayKey(day))) continue // not the first day of its run
    let days = 0
    let to = key
    for (day.setDate(day.getDate() + 1); met.has(dayKey(day)); day.setDate(day.getDate() + 1)) {
      to = dayKey(day)
      days++
    }
    if (days > best.days || (days === best.days && best.from !== null && key > best.from)) best = { days, from: key, to }
  }
  return best
}

export interface GoalStats {
  near: number // fasts that reached 90% of their goal but not all of it
  progress: number // the average share of the goal reached, from 0
}

export function goalStats(fasts: Fast[]): GoalStats {
  const shares = fasts.map((f) => progressOf(fastLength(f), f.goal))
  return {
    near: shares.filter((s) => s >= 0.9 && s < 1).length,
    progress: shares.length ? shares.reduce((a, b) => a + b, 0) / shares.length : 0,
  }
}

/** A day in the goal grid: the deepest stage its fasts reached and whether one met its
 *  goal, or a null stage without a fast. */
export interface GridDay {
  key: string
  stage: number | null
  met: boolean
}

/** A column of the grid: a week from the first weekday, null for days outside the window. */
export interface GridWeek {
  start: number
  days: (GridDay | null)[]
}

/** The first day of the week `at` falls in, at noon. */
function weekOf(at: number, weekStart: WeekStart): Date {
  const d = new Date(at)
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() - weekStart + 7) % 7))
  return d
}

/** The window's days as weeks from the first weekday, the latest `maxWeeks` of them. */
export function dayGrid(fasts: Fast[], window: Window, weekStart: WeekStart, maxWeeks: number): GridWeek[] {
  const days = new Map<string, { stage: number; met: boolean }>()
  for (const fast of fasts) {
    const key = dayKey(fast.end)
    const day = days.get(key)
    days.set(key, { stage: Math.max(day?.stage ?? 0, deepestStage(fast)), met: (day?.met ?? false) || metGoal(fast) })
  }
  const first = dayKey(window.from)
  const last = dayKey(window.to)
  const weeks: GridWeek[] = []
  for (const d = weekOf(window.from, weekStart); dayKey(d) <= last; ) {
    const week: GridWeek = { start: d.getTime(), days: [] }
    for (let i = 0; i < 7; i++, d.setDate(d.getDate() + 1)) {
      const key = dayKey(d)
      week.days.push(key < first || key > last ? null : { key, stage: null, met: false, ...days.get(key) })
    }
    weeks.push(week)
  }
  return weeks.slice(-Math.max(1, maxWeeks))
}

// Stages ----------------------------------------------------------------------------

/** The share of fasts that reached each stage. */
export const stageReach = (fasts: Fast[]): number[] =>
  STAGES.map((_, i) => (fasts.length ? fasts.filter((f) => deepestStage(f) >= i).length / fasts.length : 0))

// Rhythm ----------------------------------------------------------------------------

/** The day from midnight `day` in `slots` equal parts: the stage of the fast under each
 *  part's middle, or null while eating. A day of 23 or 25 hours keeps its slots. */
export function dayStrip(fasts: Pick<Fast, 'start' | 'end'>[], day: number, slots: number): (number | null)[] {
  const end = startOfDay(stepDay(day + 12 * HOUR, 1))
  const over = fasts.filter((f) => f.start < end && f.end > day)
  return Array.from({ length: slots }, (_, i) => {
    const at = day + ((i + 0.5) * (end - day)) / slots
    const fast = over.find((f) => f.start <= at && at < f.end)
    return fast ? stageIndex((at - fast.start) / HOUR) : null
  })
}

/** A typical time of day, in minutes after midnight, and how far the times stray from it. */
export interface Clock {
  minutes: number
  spread: number // minutes either side: the circular standard deviation
}

/** The typical time of day of `times`: a circular mean, so 23:30 and 00:30 make
 *  midnight, not noon. Null without times, or with times spread evenly round the clock. */
export function typicalClock(times: number[]): Clock | null {
  let x = 0
  let y = 0
  for (const t of times) {
    const d = new Date(t)
    const angle = ((d.getHours() * 60 + d.getMinutes()) / 1440) * 2 * Math.PI
    x += Math.cos(angle)
    y += Math.sin(angle)
  }
  const r = times.length ? Math.hypot(x, y) / times.length : 0
  if (r < 1e-6) return null
  const minutes = Math.round(((Math.atan2(y, x) / (2 * Math.PI)) * 1440 + 1440) % 1440) % 1440
  return { minutes, spread: (Math.sqrt(-2 * Math.log(Math.min(1, r))) * 1440) / (2 * Math.PI) }
}

/** The average time from one fast's end to the next one's start. Gaps over two days are
 *  time off fasting rather than an eating window, and are left out. */
export function eatingWindow(fasts: Fast[]): number | null {
  const sorted = [...fasts].sort((a, b) => a.start - b.start)
  const gaps: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].start - sorted[i - 1].end
    if (gap > 0 && gap <= 2 * DAY) gaps.push(gap)
  }
  return gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null
}

export interface Weekday {
  head: string // "Mo"
  hours: number | null // the average length of the fasts ending on it, or none
}

/** Each weekday's average fast, from the first day of the week. */
export function weekdays(fasts: Fast[], weekStart: WeekStart): Weekday[] {
  const sums = Array<number>(7).fill(0)
  const counts = Array<number>(7).fill(0)
  for (const fast of fasts) {
    const day = new Date(fast.end).getDay()
    sums[day] += fastLength(fast) / HOUR
    counts[day]++
  }
  return weekdayHeads(weekStart).map((head, i) => {
    const day = (weekStart + i) % 7
    return { head, hours: counts[day] ? sums[day] / counts[day] : null }
  })
}

// Weight ----------------------------------------------------------------------------

/** The weighings in the window, oldest first: openScale's and the weights typed in at a
 *  fast's end. Without openScale's weighings, the scale's weights saved in the fasts
 *  stand in for them. */
export function weighings(fasts: Fast[], scale: ScaleWeight[], window: Window): ScaleWeight[] {
  const inside = (at: number) => at >= window.from && at <= window.to
  const typed = fasts
    .filter((f) => f.weight !== null && (!f.fromScale || !scale.length) && inside(f.end))
    .map((f) => ({ at: f.end, kg: f.weight as number }))
  return [...scale.filter((w) => inside(w.at)), ...typed].sort((a, b) => a.at - b.at)
}

/** A trend through the weighings that daily swings of water barely move: each one pulls
 *  the trend a tenth of the way to it for every day since the one before. */
export function weightTrend(points: ScaleWeight[]): ScaleWeight[] {
  let trend = points[0]?.kg ?? 0
  let last = points[0]?.at ?? 0
  return points.map(({ at, kg }) => {
    trend += (1 - 0.9 ** Math.max(0, (at - last) / DAY)) * (kg - trend)
    last = at
    return { at, kg: trend }
  })
}

/** The change in kg a week along the straight line nearest the weighings, or null
 *  without a day between the first and the last. */
export function weeklyRate(points: ScaleWeight[]): number | null {
  if (points.length < 2 || points[points.length - 1].at - points[0].at < DAY) return null
  const t = points.map((p) => p.at / DAY)
  const meanT = t.reduce((a, b) => a + b, 0) / t.length
  const meanKg = points.reduce((a, p) => a + p.kg, 0) / points.length
  let num = 0
  let den = 0
  points.forEach((p, i) => {
    num += (t[i] - meanT) * (p.kg - meanKg)
    den += (t[i] - meanT) ** 2
  })
  return (num / den) * 7
}

// Records ---------------------------------------------------------------------------

export interface Records {
  longest: Fast | null
  streak: Run
  week: { start: number; ms: number } | null // the week with the most fasting
  total: number // ms
  first: Fast | null
  count: number
}

export function records(fasts: Fast[], weekStart: WeekStart): Records {
  const weeks = new Map<number, number>()
  for (const fast of fasts) {
    const start = weekOf(fast.end, weekStart).getTime()
    weeks.set(start, (weeks.get(start) ?? 0) + fastLength(fast))
  }
  let week: Records['week'] = null
  for (const [start, ms] of weeks) if (!week || ms > week.ms || (ms === week.ms && start > week.start)) week = { start, ms }
  const longest = fasts.reduce<Fast | null>((a, f) => (!a || fastLength(f) > fastLength(a) ? f : a), null)
  const first = fasts.reduce<Fast | null>((a, f) => (!a || f.start < a.start ? f : a), null)
  return {
    longest,
    streak: bestStreak(fasts),
    week,
    total: fasts.reduce((sum, f) => sum + fastLength(f), 0),
    first,
    count: fasts.length,
  }
}

/** Whole minutes after midnight as HH:MM. */
export const clockOfDay = (minutes: number): string =>
  `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
