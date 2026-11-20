import { describe, expect, it, vi } from 'vitest'

// The pure logic never touches Capacitor, but alerts.ts and backup.ts import it.
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: {} }))
vi.mock('@capacitor/filesystem', () => ({ Directory: {}, Encoding: {}, Filesystem: {} }))
vi.mock('@capacitor/core', () => ({ registerPlugin: () => ({}), Capacitor: { isNativePlatform: () => false } }))

import { plannedAlerts } from './alerts'
import { backupName, BackupError, makeBackup, mergeFasts, parseBackup, writeFailure } from './backup'
import { emptyReason, scaleWeightFor, syncWeights, weightOf } from './openscale'
import {
  bmi,
  bmiFormula,
  completeMeal,
  earliestStart,
  eatingLeft,
  endedBy,
  goalTone,
  heightAtLimit,
  invalidTimes,
  milestones,
  overlapping,
  parseWeight,
  pastGoal,
  pastMeals,
  percentOf,
  planName,
  showBmi,
  showHeight,
  showWeight,
  signedNumber,
  soFar,
  stageHours,
  stepGoal,
  stepHeight,
  streak,
  summarize,
  timeInDeepest,
  type Fast,
} from './fasts'
import { stageIndex, stageSpan, STAGES } from './stages'
import { DEFAULT_SETTINGS, toFast, toSettings } from './store'
import { dayKey, dayRange, HOUR, stepDay, stepMinute } from './time'

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

  it('cites at least two NCBI records for every stage', () => {
    for (const stage of STAGES) {
      expect(stage.sources.length).toBeGreaterThanOrEqual(2)
      for (const source of stage.sources) {
        expect(source.url).toMatch(/^https:\/\/(pubmed\.ncbi\.nlm\.nih\.gov\/\d+|www\.ncbi\.nlm\.nih\.gov\/books\/NBK\d+)\/$/)
        expect(source.title && source.who && source.where).toBeTruthy()
      }
    }
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

  it('colours a share of the goal: met, half or more, less', () => {
    expect([1.03, 1, 0.99, 0.5, 0.49, 0].map(goalTone)).toEqual(['ok', 'ok', 'warn', 'warn', 'bad', 'bad'])
  })

  it('times a past fast in its deepest stage and against its goal', () => {
    const f = fast('2026-11-17T18:33', '2026-11-18T11:03') // 16:30, in Ketosis since 12h
    expect(timeInDeepest(f) / HOUR).toBe(4.5)
    expect(pastGoal(f) / HOUR).toBe(0.5)
    expect(pastGoal(fast('2026-11-17T18:00', '2026-11-18T08:40')) / HOUR).toBeCloseTo(-4 / 3)
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

  it('counts down the eating window after the last fast', () => {
    expect(eatingLeft(fasts, at('2026-11-17T12:00'))).toBe(6 * HOUR) // window of 8h from 10:00
    expect(eatingLeft(fasts, at('2026-11-17T19:00'))).toBe(0)
    expect(eatingLeft([fast('2026-11-15T00:00', '2026-11-17T00:00', 48)], at('2026-11-17T01:00'))).toBe(0)
  })
})

describe('openScale weights', () => {
  const f = fast('2026-11-16T20:00', '2026-11-17T17:30') // ends in the evening
  const weights = [
    { at: at('2026-11-16T07:00'), kg: 72.9 }, // the morning before: neither during nor near
    { at: at('2026-11-17T07:00'), kg: 72.1 }, // during the fast, 10.5h before its end
    { at: at('2026-11-17T18:00'), kg: 72.6 }, // half an hour after it ended, eaten since
  ]

  it('takes the last weighing during the fast, over one nearer its end', () => {
    expect(scaleWeightFor(f, weights)?.kg).toBe(72.1)
  })

  it('falls back to the weighing closest to the end, within 12 hours', () => {
    const short = fast('2026-11-17T08:00', '2026-11-17T17:30')
    expect(scaleWeightFor(short, weights)?.kg).toBe(72.6)
    expect(scaleWeightFor(short, weights.slice(0, 1))).toBeNull()
    expect(scaleWeightFor(f, [])).toBeNull()
  })

  it('lets a typed-in weight win over the scale', () => {
    expect(weightOf(f, weights)).toEqual({ kg: 72.1, scale: true })
    expect(weightOf({ ...f, weight: 70 }, weights)).toEqual({ kg: 70, scale: false })
    expect(weightOf({ ...f, weight: 72.1, fromScale: true }, [])).toEqual({ kg: 72.1, scale: true })
    expect(weightOf(f, [])).toBeNull()
  })

  it('says why a read of openScale gave no weighings', () => {
    const read = { weights: [], rows: 0, seen: [], error: null }
    expect(emptyReason({ ...read, weights }, 1)).toBeNull()
    expect(emptyReason(read, 1)).toMatch(/no measurements for user 1/)
    expect(emptyReason({ ...read, rows: 214, seen: ['builtin.fat'] }, 1)).toMatch(/214 measurements for user 1, none with a weight. Their values: builtin.fat/)
    expect(emptyReason({ ...read, rows: -1 }, 1)).toMatch(/did not answer/)
    expect(emptyReason({ ...read, rows: -1, error: 'denied' }, 1)).toMatch(/could not be read: denied/)
  })

  it('syncs the scale into fasts without a typed weight, and only those', () => {
    const typed = { ...f, id: 'typed', weight: 70 }
    const synced = { ...f, id: 'synced', weight: 73, fromScale: true }
    const empty = { ...f, id: 'empty' }
    const lonely = fast('2026-10-01T20:00', '2026-10-02T12:00')
    const report = syncWeights([typed, synced, empty, lonely], weights)
    expect([report.filled, report.updated, report.typed, report.unmatched]).toEqual([1, 1, 1, 1])
    expect(report.changed.map((c) => [c.id, c.weight, c.fromScale])).toEqual([
      ['synced', 72.1, true],
      ['empty', 72.1, true],
    ])
    expect(syncWeights(report.changed, weights).changed).toEqual([]) // nothing left to do
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

  it('refuses times that cannot be, and plans the ones still to come', () => {
    expect(invalidTimes(now - HOUR, now)).toBeNull()
    expect(invalidTimes(now, now + HOUR)).toBeNull()
    expect(invalidTimes(now, now - HOUR)).toMatch(/after the start/)
  })

  it('remembers the meals fasts were broken with, and completes one being typed', () => {
    const meals = pastMeals([
      fast('2026-11-10T20:00', '2026-11-11T12:00', 16, { brokeWith: 'Eggs and toast' }),
      fast('2026-11-11T20:00', '2026-11-12T12:00', 16, { brokeWith: 'Chicken salad' }),
      fast('2026-11-12T20:00', '2026-11-13T12:00', 16, { brokeWith: 'eggs and toast ' }),
      fast('2026-11-13T20:00', '2026-11-14T12:00', 16, { brokeWith: 'Cheese omelette' }),
      fast('2026-11-14T20:00', '2026-11-15T12:00'),
    ])
    // Eggs twice, written last in lower case; then the later of the two used once.
    expect(meals).toEqual(['eggs and toast', 'Cheese omelette', 'Chicken salad'])
    expect(completeMeal('EGG', meals)).toBe('eggs and toast')
    expect(completeMeal('ch', meals)).toBe('Cheese omelette')
    expect(completeMeal('chi', meals)).toBe('Chicken salad')
    expect(completeMeal('Chicken salad', meals)).toBeNull()
    expect(completeMeal(' ', meals)).toBeNull()
    expect(completeMeal('soup', meals)).toBeNull()
  })

  it('counts only the fasts that have ended, and tracks a planned one so far', () => {
    const done = fast('2026-11-16T20:00', '2026-11-17T11:00')
    const planned = fast('2026-11-17T11:30', '2026-11-18T04:00')
    const all = [planned, done]
    expect(endedBy(all, now)).toEqual([done])
    const history = [done]
    expect(endedBy(history, now)).toBe(history)
    expect(soFar(planned, now)).toEqual({ start: planned.start, end: now })
    expect(soFar(planned, at('2026-11-17T10:00'))).toEqual({ start: planned.start, end: planned.start })
    expect(soFar(done, now)).toEqual({ start: done.start, end: done.end })
  })

  it('reads weights in either unit and shows them in one decimal', () => {
    expect(parseWeight('71,4', 'kg')).toBeCloseTo(71.4)
    expect(parseWeight('157.5', 'lb')).toBeCloseTo(71.44, 2)
    expect(parseWeight('', 'kg')).toBeNull()
    expect(parseWeight('heavy', 'kg')).toBeNull()
    expect(showWeight(71.44, 'lb')).toBe('157.5 lb')
  })
})

describe('BMI', () => {
  it('is the weight over the height in metres, squared, to one decimal when shown', () => {
    expect(bmi(80.6, 180)).toBeCloseTo(24.877, 3)
    expect(showBmi(bmi(80.6, 180))).toBe('24.9')
    expect(showBmi(bmi(70, 175))).toBe('22.9')
    expect(showBmi(bmi(80.6, 180.34))).toBe('24.8') // 71 inches
    expect(showBmi(bmi(-3.1, 180))).toBe('-1.0') // a change in weight gives the change in BMI
  })

  it('signs a change to one decimal', () => {
    expect([-1.04, 0.44, 0, 0.04, -0.04, 12.35].map(signedNumber)).toEqual(['-1.0', '+0.4', '±0.0', '±0.0', '±0.0', '+12.3'])
  })

  it('steps the height by the cm, or by the inch, within limits', () => {
    expect(stepHeight(180, 1, 'cm')).toBe(181)
    expect(stepHeight(180, -1, 'cm')).toBe(179)
    expect(stepHeight(100, -1, 'cm')).toBe(100)
    expect(stepHeight(250, 1, 'cm')).toBe(250)
    expect(stepHeight(180.34, 1, 'in')).toBe(182.88) // 71 inches to 72
    expect(stepHeight(180, -1, 'in')).toBe(177.8) // 70.87 inches to 70
    expect(stepHeight(250, 1, 'in')).toBe(248.92) // 98 inches, the top
    expect(stepHeight(100, -1, 'in')).toBe(99.06) // 39 inches, the bottom, not stepped up
    expect(stepHeight(null, 1, 'cm')).toBe(170)
    expect(stepHeight(null, -1, 'cm')).toBe(170)
    expect(stepHeight(null, 1, 'in')).toBe(170.18) // 67 inches
    expect(heightAtLimit(100, -1, 'cm')).toBe(true)
    expect(heightAtLimit(100, 1, 'cm')).toBe(false)
    expect(heightAtLimit(250, 1, 'cm')).toBe(true)
    expect(heightAtLimit(99.06, -1, 'in')).toBe(true)
    expect(heightAtLimit(248.92, 1, 'in')).toBe(true)
    expect(heightAtLimit(null, -1, 'cm')).toBe(false)
  })

  it('shows the height in cm, or in feet and inches', () => {
    expect(showHeight(180, 'cm')).toBe('180 cm')
    expect(showHeight(180.34, 'cm')).toBe('180 cm')
    expect(showHeight(180.34, 'in')).toBe('5′ 11″')
    expect(showHeight(182.88, 'in')).toBe('6′ 0″')
    expect(showHeight(null, 'cm')).toBe('--- cm')
    expect(showHeight(null, 'in')).toBe('-′ --″')
  })

  it('writes the formula in the unit, with numbers once there is a weight and a height', () => {
    expect(bmiFormula('kg', 'cm', 80.6, 180)).toBe('BMI = 80.6 kg / (1.80 m)² = 24.9')
    expect(bmiFormula('lb', 'in', 80.6, 180.34)).toBe('BMI = 703 × 177.7 lb / (71 in)² = 24.8')
    expect(bmiFormula('kg', 'cm', null, 180)).toBe('BMI = kg / m²')
    expect(bmiFormula('lb', 'in', 80.6, null)).toBe('BMI = 703 × lb / in²')
    // Mixed: the imperial measure in metric, and the metric formula.
    expect(bmiFormula('lb', 'cm', 80.6, 180)).toBe('BMI = 80.6 kg / (1.80 m)² = 24.9')
    expect(bmiFormula('kg', 'in', 80.6, 180.34)).toBe('BMI = 80.6 kg / (1.80 m)² = 24.8')
    expect(bmiFormula('lb', 'cm', null, null)).toBe('BMI = kg / m²')
  })

  it('gives the height its own unit, which follows the weight unit in older settings', () => {
    expect(toSettings({ unit: 'lb' }).heightUnit).toBe('in')
    expect(toSettings({ unit: 'kg' }).heightUnit).toBe('cm')
    expect(toSettings({ unit: 'lb', heightUnit: 'cm' }).heightUnit).toBe('cm')
    expect(toSettings({ unit: 'kg', heightUnit: 'in' }).heightUnit).toBe('in')
  })
})

describe('time', () => {
  it('steps days by the calendar and minutes onto fives', () => {
    expect(dayKey(stepDay(at('2026-11-30T08:00'), 1))).toBe('2026-12-01')
    expect(new Date(stepMinute(at('2026-11-17T06:32'), 1)).getMinutes()).toBe(35)
    expect(new Date(stepMinute(at('2026-11-17T06:32'), -1)).getMinutes()).toBe(30)
    expect(new Date(stepMinute(at('2026-11-17T06:30'), -1)).getMinutes()).toBe(25)
  })

  it('writes a range of days without repeating its month or year', () => {
    const now = at('2026-11-20T12:00')
    expect(dayRange(at('2026-10-20T12:00'), at('2026-10-27T12:00'), now)).toEqual(['20', '27 Oct'])
    expect(dayRange(at('2026-09-28T12:00'), at('2026-10-05T12:00'), now)).toEqual(['28 Sep', '5 Oct'])
    expect(dayRange(at('2025-09-28T12:00'), at('2025-10-05T12:00'), now)).toEqual(['28 Sep', '5 Oct 2025'])
    expect(dayRange(at('2025-12-28T12:00'), at('2026-01-03T12:00'), now)).toEqual(['28 Dec 2025', '3 Jan'])
  })
})

describe('storage and backup', () => {
  it('reads back what it wrote and drops what is broken', () => {
    const f = fast('2026-11-14T20:00', '2026-11-15T12:30', 16, { note: 'eggs', weight: 71.4 })
    expect(toFast(JSON.parse(JSON.stringify(f)))).toEqual(f)
    expect(toFast({ ...f, end: f.start - 1 })).toBeNull()
    expect(toFast({ id: 'x' })).toBeNull()
    expect(toFast({ ...f, fromScale: true })).toEqual({ ...f, fromScale: true })
    expect(toFast({ ...f, weight: null, fromScale: true })).not.toHaveProperty('fromScale')
    expect(toFast({ ...f, brokeWith: 'Eggs' })).toEqual({ ...f, brokeWith: 'Eggs' })
    expect(toFast({ ...f, brokeWith: ' ' })).not.toHaveProperty('brokeWith')
    expect(toFast({ ...f, brokeWith: 3 })).not.toHaveProperty('brokeWith')
    expect(toSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(toSettings({ unit: 'lb', goal: 18 })).toMatchObject({ unit: 'lb', goal: 18, alerts: true, status: true })
    expect(toSettings({ status: false }).status).toBe(false)
    expect(toSettings({ exportOn: true, exportEvery: ' ' })).toMatchObject({ exportOn: true, exportEvery: 'daily' })
    expect(toSettings({}).cloudBackup).toBe(false)
    expect(toSettings({ cloudBackup: true }).cloudBackup).toBe(true)
    expect(toSettings({ scaleUser: 2 }).scaleUser).toBe(2)
    expect(toSettings({ scaleUser: 'me' }).scaleUser).toBeNull()
    expect(toSettings({ statsSpan: 90 }).statsSpan).toBe(90)
    expect(toSettings({ statsSpan: 7 }).statsSpan).toBe(30)
  })

  it('reads the export and BMI settings, and keeps them off and unset by default', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ keepOneFile: false, bmi: false, height: null })
    expect(toSettings({ keepOneFile: true, bmi: true, height: 180 })).toMatchObject({ keepOneFile: true, bmi: true, height: 180 })
    expect(toSettings({ keepOneFile: 'yes', bmi: 1, height: '180' })).toMatchObject({ keepOneFile: false, bmi: false, height: null })
    expect(toSettings({ height: 0 }).height).toBeNull()
    expect(toSettings({ height: -170 }).height).toBeNull()
  })

  it('names exports by the day, or as the one file that each replaces', () => {
    const now = new Date(2026, 10, 18, 9, 30)
    expect(backupName(now)).toBe('fast-track-2026-11-18.json')
    expect(backupName(now, false)).toBe('fast-track-2026-11-18.json')
    expect(backupName(now, true)).toBe('fast-track.json')
  })

  it('says in a sentence why a file left by an earlier install cannot be replaced', () => {
    const where = 'Documents/FastTrack/fast-track.json'
    const message = writeFailure(new Error("'writeFile' failed with: /storage/emulated/0/Documents/FastTrack/fast-track.json: open failed: EACCES (Permission denied)"), where)
    expect(message).toBe(`cannot replace ${where}, which an earlier install left; delete it in a file manager`)
    expect(writeFailure(new Error('Unable to do file operation, user denied permission request.'), where)).toMatch(/denied permission request/)
    expect(writeFailure('disk full', where)).toBe('disk full')
  })

  it('imports a backup from before these settings, with them at their defaults', () => {
    const old = {
      format: 'fast-track-backup',
      version: 1,
      exported_at: '2026-11-01T08:00:00.000Z',
      settings: { goal: 18, unit: 'lb', cloudBackup: true },
      fasts: [fast('2026-10-30T20:00', '2026-10-31T12:30')],
    }
    const backup = parseBackup(JSON.stringify(old))
    expect(backup.fasts).toHaveLength(1)
    expect(backup.settings).toMatchObject({ goal: 18, unit: 'lb', cloudBackup: true, keepOneFile: false, bmi: false, height: null })
    expect(parseBackup(JSON.stringify({ ...old, settings: undefined })).settings).toEqual(DEFAULT_SETTINGS)
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
