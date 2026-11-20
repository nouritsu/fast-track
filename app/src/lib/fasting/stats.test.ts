import { describe, expect, it } from 'vitest'
import type { Fast } from './fasts'
import {
  bestStreak,
  clockOfDay,
  dayGrid,
  dayStrip,
  daysIn,
  eatingWindow,
  goalStats,
  latestWeighing,
  lengthBands,
  median,
  priorWindow,
  records,
  spanName,
  spanWindow,
  stageReach,
  typicalClock,
  weekdays,
  weeklyRate,
  weighings,
  weightTrend,
  within,
} from './stats'
import { dayKey, HOUR } from './time'

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
const NOW = at('2026-11-18T15:00')

describe('spans', () => {
  it('covers the last days up to now, and the same days before them', () => {
    const window = spanWindow([], 30, NOW)
    expect(window).toEqual({ from: at('2026-10-20T00:00'), to: NOW })
    expect(daysIn(window)).toBe(30)
    const prior = priorWindow(window, 30)
    expect(prior?.from).toBe(at('2026-09-20T00:00'))
    expect(prior && daysIn(prior)).toBe(30)
    expect(priorWindow(window, 0)).toBeNull()
    expect(['30d', '1y', 'all']).toEqual([spanName(30), spanName(365), spanName(0)])
  })

  it('starts the whole history on the day the first fast ended', () => {
    const fasts = [fast('2026-11-01T20:00', '2026-11-02T12:00'), fast('2026-11-10T20:00', '2026-11-11T12:00')]
    expect(spanWindow(fasts, 0, NOW).from).toBe(at('2026-11-02T00:00'))
    expect(spanWindow([], 0, NOW).from).toBe(at('2026-11-18T00:00'))
  })

  it('takes the fasts that ended inside', () => {
    const window = spanWindow([], 30, NOW)
    const fasts = [fast('2026-10-19T20:00', '2026-10-20T00:00'), fast('2026-10-19T08:00', '2026-10-19T23:59')]
    expect(within(fasts, window)).toEqual([fasts[0]])
  })
})

describe('lengths and goals', () => {
  it('finds the median', () => {
    expect(median([])).toBe(0)
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 2, 3])).toBe(2.5)
  })

  it('counts fasts in bands of length, trimming empty ends', () => {
    const fasts = [
      fast('2026-11-01T20:00', '2026-11-02T10:30'), // 14:30
      fast('2026-11-02T20:00', '2026-11-03T12:00'), // 16:00
      fast('2026-11-03T20:00', '2026-11-04T12:59'), // 16:59
      fast('2026-11-04T20:00', '2026-11-05T16:00'), // 20:00
    ]
    expect(lengthBands(fasts)).toEqual([
      { name: '14–16h', count: 1 },
      { name: '16–18h', count: 2 },
      { name: '18–20h', count: 0 },
      { name: '20–24h', count: 1 },
    ])
    expect(lengthBands([fast('2026-11-01T08:00', '2026-11-02T10:00')])).toEqual([{ name: '24h+', count: 1 }])
    expect(lengthBands([])).toEqual([])
  })

  it('finds the longest run of days that met their goal, the latest of equals', () => {
    const met = (day: string) => fast(`${day}T00:00`, `${day}T17:00`)
    const fasts = [
      met('2026-11-01'),
      met('2026-11-02'),
      fast('2026-11-03T00:00', '2026-11-03T10:00'), // missed
      met('2026-11-04'),
      met('2026-11-05'),
    ]
    expect(bestStreak(fasts)).toEqual({ days: 2, from: '2026-11-04', to: '2026-11-05' })
    expect(bestStreak([...fasts, met('2026-11-06')])).toEqual({ days: 3, from: '2026-11-04', to: '2026-11-06' })
    expect(bestStreak([])).toEqual({ days: 0, from: null, to: null })
  })

  it('counts near misses and the average share of the goal', () => {
    const fasts = [
      fast('2026-11-01T20:00', '2026-11-02T10:24'), // 14:24 of 16h: 90%
      fast('2026-11-02T20:00', '2026-11-03T14:00'), // 18h: 112.5%
    ]
    expect(goalStats(fasts)).toEqual({ near: 1, progress: (0.9 + 1.125) / 2 })
  })

  it('lays the window out in weeks from the first weekday', () => {
    const window = { from: at('2026-11-04T00:00'), to: at('2026-11-18T15:00') } // Wed to Wed
    const fasts = [
      fast('2026-11-04T20:00', '2026-11-05T13:00'), // Thu, 17h, ketosis, met
      fast('2026-11-09T20:00', '2026-11-10T06:00'), // Tue, 10h, fat burning, missed
      fast('2026-11-11T20:00', '2026-11-12T11:00'), // Thu, 15h of 16h, a near miss
    ]
    const weeks = dayGrid(fasts, window, 1, 10)
    expect(weeks).toHaveLength(3)
    expect(dayKey(weeks[0].start)).toBe('2026-11-02') // a Monday
    expect(weeks[0].days.slice(0, 2)).toEqual([null, null])
    expect(weeks[0].days[3]).toEqual({ key: '2026-11-05', stage: 2, met: true, near: false })
    expect(weeks[1].days[1]).toEqual({ key: '2026-11-10', stage: 1, met: false, near: false })
    expect(weeks[1].days[2]).toEqual({ key: '2026-11-11', stage: null, met: false, near: false })
    expect(weeks[1].days[3]).toEqual({ key: '2026-11-12', stage: 2, met: false, near: true })
    expect(weeks[2].days.slice(3)).toEqual([null, null, null, null])
    expect(dayGrid(fasts, window, 1, 2)).toEqual(weeks.slice(1))
  })

  it('shares the fasts that reached each stage', () => {
    const fasts = [fast('2026-11-01T20:00', '2026-11-02T12:00'), fast('2026-11-02T20:00', '2026-11-03T04:00')]
    expect(stageReach(fasts)).toEqual([1, 1, 0.5, 0])
    expect(stageReach([])).toEqual([0, 0, 0, 0])
  })
})

describe('rhythm', () => {
  it('maps a day in slots to the stage of the fast under each', () => {
    const fasts = [fast('2026-11-16T20:00', '2026-11-17T12:30')]
    const strip = dayStrip(fasts, at('2026-11-17T00:00'), 24)
    expect(strip.slice(0, 3)).toEqual([1, 1, 1]) // 4.5h in at 00:30
    expect(strip[8]).toBe(2) // 12.5h in at 08:30
    expect(strip[12]).toBeNull() // 12:30, just ended
    expect(strip.slice(13).every((s) => s === null)).toBe(true)
  })

  it('finds the typical time of day round midnight', () => {
    const times = [at('2026-11-01T23:30'), at('2026-11-03T00:30')]
    const clock = typicalClock(times)
    expect(clock?.minutes).toBe(0)
    expect(clock?.spread).toBeCloseTo(30, 0)
    const one = typicalClock([at('2026-11-01T20:10')])
    expect(one?.minutes).toBe(20 * 60 + 10)
    expect(one?.spread).toBeCloseTo(0, 3)
    expect(typicalClock([])).toBeNull()
    expect(clockOfDay(20 * 60 + 5)).toBe('20:05')
  })

  it('averages the eating windows, leaving out days off', () => {
    const fasts = [
      fast('2026-11-03T20:00', '2026-11-04T12:00'),
      fast('2026-11-01T20:00', '2026-11-02T12:00'),
      fast('2026-11-02T18:00', '2026-11-03T12:00'), // 6h after the first
      fast('2026-11-08T20:00', '2026-11-09T12:00'), // days later
    ]
    expect(eatingWindow(fasts)).toBe(7 * HOUR) // (6h + 8h) / 2
    expect(eatingWindow(fasts.slice(0, 1))).toBeNull()
  })

  it('averages the fasts ending on each weekday', () => {
    const fasts = [
      fast('2026-11-15T20:00', '2026-11-16T12:00'), // Mon, 16h
      fast('2026-11-22T20:00', '2026-11-23T14:00'), // Mon, 18h
      fast('2026-11-18T20:00', '2026-11-19T10:00'), // Thu, 14h
    ]
    const days = weekdays(fasts, 1)
    expect(days.map((d) => d.head)).toEqual(['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'])
    expect(days.map((d) => d.hours)).toEqual([17, null, null, 14, null, null, null])
    expect(weekdays(fasts, 0)[1].head).toBe('Mo')
  })
})

describe('weight', () => {
  const window = { from: at('2026-11-01T00:00'), to: NOW }

  it('takes the weighings and the typed weights, not the scale twice', () => {
    const scale = [
      { at: at('2026-10-31T08:00'), kg: 81 },
      { at: at('2026-11-02T08:00'), kg: 80 },
    ]
    const fasts = [
      fast('2026-11-01T20:00', '2026-11-02T12:00', 16, { weight: 80, fromScale: true }),
      fast('2026-11-02T20:00', '2026-11-03T12:00', 16, { weight: 79.5 }),
    ]
    expect(weighings(fasts, scale, window)).toEqual([
      { at: at('2026-11-02T08:00'), kg: 80 },
      { at: at('2026-11-03T12:00'), kg: 79.5 },
    ])
    // Without openScale, the scale's weights saved in the fasts stand in.
    expect(weighings(fasts, [], window).map((w) => w.kg)).toEqual([80, 79.5])
  })

  it('finds the latest weighing, from a fast or the scale', () => {
    const scale = [{ at: at('2026-11-02T08:00'), kg: 80 }]
    const typed = fast('2026-11-02T20:00', '2026-11-03T12:00', 16, { weight: 79.5 })
    expect(latestWeighing([typed], scale)).toEqual({ at: at('2026-11-03T12:00'), kg: 79.5 })
    expect(latestWeighing([], scale)).toEqual(scale[0])
    expect(latestWeighing([fast('2026-11-02T20:00', '2026-11-03T12:00')], [])).toBeNull()
  })

  it('smooths the trend by the days between weighings', () => {
    const trend = weightTrend([
      { at: at('2026-11-01T08:00'), kg: 80 },
      { at: at('2026-11-02T08:00'), kg: 70 },
    ])
    expect(trend[0].kg).toBe(80)
    expect(trend[1].kg).toBeCloseTo(79, 6)
    expect(weightTrend([])).toEqual([])
  })

  it('fits the change a week', () => {
    const points = [0, 7, 14].map((d) => ({ at: at('2026-11-01T08:00') + d * 24 * HOUR, kg: 80 - d / 7 }))
    expect(weeklyRate(points)).toBeCloseTo(-1, 6)
    expect(weeklyRate(points.slice(0, 1))).toBeNull()
  })
})

describe('records', () => {
  it('finds the longest fast, the best streak and week, and the totals', () => {
    const fasts = [
      fast('2026-11-01T20:00', '2026-11-02T12:00'), // Mon, 16h
      fast('2026-11-02T20:00', '2026-11-03T20:00'), // Tue, 24h
      fast('2026-11-09T20:00', '2026-11-10T12:00'), // next Tue, 16h
    ]
    const r = records(fasts, 1)
    expect(r.longest).toBe(fasts[1])
    expect(r.streak).toEqual({ days: 2, from: '2026-11-02', to: '2026-11-03' })
    expect(r.week && dayKey(r.week.start)).toBe('2026-11-02')
    expect(r.week?.ms).toBe(40 * HOUR)
    expect(r.total).toBe(56 * HOUR)
    expect(r.first).toBe(fasts[0])
    expect(r.count).toBe(3)
    expect(records([], 1)).toMatchObject({ longest: null, week: null, first: null, total: 0 })
  })
})
