import { describe, expect, it, vi } from 'vitest'

// The pure logic never touches Capacitor, but alerts.ts and backup.ts import it.
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: {} }))
vi.mock('@capacitor/filesystem', () => ({ Directory: {}, Encoding: {}, Filesystem: {} }))
vi.mock('@capacitor/core', () => ({ registerPlugin: () => ({}), Capacitor: { isNativePlatform: () => false } }))

import { plannedAlerts } from './alerts'
import { BackupError, makeBackup, mergeFasts, parseBackup } from './backup'
import { scaleWeightFor, weightOf } from './openscale'
import {
  deepestByDay,
  earliestStart,
  eatingLeft,
  invalidTimes,
  milestones,
  overlapping,
  parseWeight,
  percentOf,
  planName,
  showWeight,
  stageHours,
  stepGoal,
  streak,
  summarize,
  type Fast,
} from './fasts'
import { stageIndex, stageSpan, STAGES } from './stages'
import { DEFAULT_SETTINGS, toFast, toSettings } from './store'
import { dayKey, HOUR, monthGrid, stepDay, stepMinute } from './time'

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

describe('stages', () => {
  it('finds the stage by hours into the fast', () => {
    expect([0, 3.9, 4, 11.9, 12, 23.9, 24, 100].map(stageIndex)).toEqual([0, 0, 1, 1, 2, 2, 3, 3])
  })

  it('spells out each stage span', () => {
    expect(STAGES.map((_, i) => stageSpan(i))).toEqual(['0–4h', '4–12h', '12–24h', '24h+'])
  })
})

describe('goals', () => {
  it('steps through the list and stops at its ends', () => {
    expect(stepGoal(16, 1)).toBe(17)
    expect(stepGoal(16, -1)).toBe(15)
    expect(stepGoal(24, 1)).toBe(30)
    expect(stepGoal(12, -1)).toBe(12)
    expect(stepGoal(72, 1)).toBe(72)
  })

  it('lands on the neighbours of a goal that is not on the list', () => {
    expect(stepGoal(25, 1)).toBe(30)
    expect(stepGoal(25, -1)).toBe(24)
    expect(stepGoal(80, -1)).toBe(72)
  })

  it('names the plan', () => {
    expect(planName(16)).toBe('16:8 · eat within 8h')
    expect(planName(23)).toBe('23:1 · one meal a day')
    expect(planName(36)).toBe('extended fast')
  })
})

describe('progress', () => {
  it('counts whole percent of the goal, past 100', () => {
    expect(percentOf(8 * HOUR, 16)).toBe(50)
    expect(percentOf(16.7 * HOUR, 16)).toBe(104)
  })

  it('lists the stages to come and the goal, in time order', () => {
    const start = at('2026-11-17T06:00')
    const marks = milestones({ start, goal: 16 }).map((m) => [(m.at - start) / HOUR, m.stage])
    expect(marks).toEqual([
      [4, 1],
      [12, 2],
      [16, null],
      [24, 3],
    ])
  })
})

describe('alerts', () => {
  it('plans the alerts still ahead', () => {
    const start = at('2026-11-17T06:00')
    const alerts = plannedAlerts({ start, goal: 16 }, start + 5 * HOUR)
    expect(alerts.map((a) => a.title)).toEqual(['Ketosis', 'Goal reached', 'Autophagy'])
    expect(new Set(alerts.map((a) => a.id)).size).toBe(alerts.length)
  })

  it('announces a stage that begins at the goal once, as the goal', () => {
    const start = at('2026-11-17T06:00')
    expect(plannedAlerts({ start, goal: 24 }, start).map((a) => a.title)).toEqual(['Fat burning', 'Ketosis', 'Goal reached'])
  })
})

describe('history', () => {
  const fasts = [
    fast('2026-11-14T20:00', '2026-11-15T12:30'), // 16.5h, met
    fast('2026-11-15T20:00', '2026-11-16T13:00'), // 17h, met
    fast('2026-11-16T20:00', '2026-11-17T10:00'), // 14h, missed
  ]

  it('counts the streak of days that met their goal, sparing today', () => {
    expect(streak(fasts, at('2026-11-16T22:00'))).toBe(2)
    expect(streak(fasts, at('2026-11-17T22:00'))).toBe(2) // today missed: the streak ends yesterday
    expect(streak(fasts, at('2026-11-19T08:00'))).toBe(0)
  })

  it('sums hours in each stage', () => {
    expect(stageHours([fast('2026-11-14T00:00', '2026-11-14T14:00')])).toEqual([4, 8, 2, 0])
  })

  it('summarizes lengths and the goal rate', () => {
    const sum = summarize(fasts)
    expect(sum.count).toBe(3)
    expect(sum.longest).toBe(17 * HOUR)
    expect(sum.average).toBe(47.5 * HOUR / 3)
    expect(sum.goalRate).toBeCloseTo(2 / 3)
    expect(summarize([]).average).toBe(0)
  })

  it('marks each day with the deepest stage of the fasts ending on it', () => {
    const days = deepestByDay([...fasts, fast('2026-11-17T11:00', '2026-11-17T13:00')])
    expect(days.get('2026-11-17')).toBe(2)
    expect(days.get('2026-11-15')).toBe(2)
  })

  it('counts down the eating window after the last fast', () => {
    expect(eatingLeft(fasts, at('2026-11-17T12:00'))).toBe(6 * HOUR) // window of 8h from 10:00
    expect(eatingLeft(fasts, at('2026-11-17T19:00'))).toBe(0)
    expect(eatingLeft([fast('2026-11-15T00:00', '2026-11-17T00:00', 48)], at('2026-11-17T01:00'))).toBe(0)
  })
})

describe('openScale weights', () => {
  const f = fast('2026-11-16T20:00', '2026-11-17T12:00')
  const weights = [
    { at: at('2026-11-16T07:00'), kg: 72.9 }, // 29h before the end: too far
    { at: at('2026-11-17T07:30'), kg: 72.1 }, // 4.5h before
    { at: at('2026-11-17T13:00'), kg: 71.8 }, // 1h after: closest
  ]

  it('takes the weighing closest to the end of the fast, within the window', () => {
    expect(scaleWeightFor(f, weights)?.kg).toBe(71.8)
    expect(scaleWeightFor(f, weights.slice(0, 1))).toBeNull()
    expect(scaleWeightFor(f, [])).toBeNull()
  })

  it('lets a typed-in weight win over the scale', () => {
    expect(weightOf(f, weights)).toEqual({ kg: 71.8, scale: true })
    expect(weightOf({ ...f, weight: 70 }, weights)).toEqual({ kg: 70, scale: false })
    expect(weightOf(f, [])).toBeNull()
  })
})

describe('checks', () => {
  const now = at('2026-11-17T12:00')

  it('finds a fast that shares time, other than the one being edited', () => {
    const a = fast('2026-11-14T20:00', '2026-11-15T12:00')
    expect(overlapping([a], at('2026-11-15T11:00'), at('2026-11-15T20:00'))).toBe(a)
    expect(overlapping([a], at('2026-11-15T12:00'), at('2026-11-15T20:00'))).toBeNull() // touching is fine
    expect(overlapping([a], a.start, a.end, a.id)).toBeNull()
    expect(earliestStart([a])).toBe(a.end)
    expect(earliestStart([])).toBe(-Infinity)
  })

  it('refuses times that cannot be', () => {
    expect(invalidTimes(now - HOUR, now, now)).toBeNull()
    expect(invalidTimes(now, now + HOUR, now)).toMatch(/future/)
    expect(invalidTimes(now, now - HOUR, now)).toMatch(/after the start/)
  })

  it('reads weights in either unit and shows them in one decimal', () => {
    expect(parseWeight('71,4', 'kg')).toBeCloseTo(71.4)
    expect(parseWeight('157.5', 'lb')).toBeCloseTo(71.44, 2)
    expect(parseWeight('', 'kg')).toBeNull()
    expect(parseWeight('heavy', 'kg')).toBeNull()
    expect(showWeight(71.44, 'lb')).toBe('157.5 lb')
  })
})

describe('time', () => {
  it('steps days by the calendar and minutes onto fives', () => {
    expect(dayKey(stepDay(at('2026-11-30T08:00'), 1))).toBe('2026-12-01')
    expect(new Date(stepMinute(at('2026-11-17T06:32'), 1)).getMinutes()).toBe(35)
    expect(new Date(stepMinute(at('2026-11-17T06:32'), -1)).getMinutes()).toBe(30)
    expect(new Date(stepMinute(at('2026-11-17T06:30'), -1)).getMinutes()).toBe(25)
  })

  it('lays out a month Monday first', () => {
    const weeks = monthGrid(2026, 10) // November 2026 starts on a Sunday
    expect(weeks[0]).toEqual([null, null, null, null, null, null, 1])
    expect(weeks.at(-1)).toEqual([30, null, null, null, null, null, null])
    expect(weeks.flat().filter((d) => d !== null)).toHaveLength(30)
  })
})

describe('storage and backup', () => {
  it('reads back what it wrote and drops what is broken', () => {
    const f = fast('2026-11-14T20:00', '2026-11-15T12:30', 16, { note: 'eggs', weight: 71.4 })
    expect(toFast(JSON.parse(JSON.stringify(f)))).toEqual(f)
    expect(toFast({ ...f, end: f.start - 1 })).toBeNull()
    expect(toFast({ id: 'x' })).toBeNull()
    expect(toSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(toSettings({ unit: 'lb', goal: 18 })).toMatchObject({ unit: 'lb', goal: 18, alerts: true, status: true })
    expect(toSettings({ status: false }).status).toBe(false)
    expect(toSettings({ exportOn: true, exportEvery: ' ' })).toMatchObject({ exportOn: true, exportEvery: 'daily' })
    expect(toSettings({ scaleUser: 2 }).scaleUser).toBe(2)
    expect(toSettings({ scaleUser: 'me' }).scaleUser).toBeNull()
  })

  it('round-trips a backup and merges by id', () => {
    const a = fast('2026-11-14T20:00', '2026-11-15T12:30')
    const b = fast('2026-11-15T20:00', '2026-11-16T13:00')
    const backup = parseBackup(JSON.stringify(makeBackup([a, b], DEFAULT_SETTINGS)))
    expect(backup.fasts).toEqual([a, b])
    const merged = mergeFasts([a], backup.fasts)
    expect(merged.added).toBe(1)
    expect(merged.fasts).toHaveLength(2)
  })

  it('refuses files that are not backups', () => {
    expect(() => parseBackup('{')).toThrow(BackupError)
    expect(() => parseBackup('{"format":"other"}')).toThrow(/not a Fast Track backup/)
    expect(() => parseBackup('{"format":"fast-track-backup","version":1,"fasts":[{"id":1}]}')).toThrow(/malformed/)
  })
})
