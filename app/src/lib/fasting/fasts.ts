// Fasts and what the app works out from them: progress, stages, the streak, a summary,
// the eating window and weights. Plain functions over plain data.

import { STAGES, stageEnd, stageIndex } from './stages'
import { dayKey, HOUR, MINUTE } from './time'

/** A finished fast. Times are epoch ms; the goal is in hours; weight is in kg, typed in
 *  or, with fromScale, synced from openScale (openscale.ts), which a later sync may update. */
export interface Fast {
  id: string
  start: number
  end: number
  goal: number
  note: string
  weight: number | null
  fromScale?: boolean
}

/** The fast in progress. */
export interface Active {
  start: number
  goal: number
}

/** The goals the < > buttons step through: by the hour up to a day, then longer fasts. */
export const GOALS = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 30, 36, 42, 48, 60, 72] as const
export const DEFAULT_GOAL = 16

export function stepGoal(goal: number, direction: -1 | 1): number {
  const i = GOALS.findIndex((g) => g >= goal)
  // Off the list, start from between its neighbours, so one step lands on the next goal.
  const at = i < 0 ? GOALS.length : GOALS[i] === goal ? i : direction > 0 ? i - 1 : i
  return GOALS[Math.min(GOALS.length - 1, Math.max(0, at + direction))]
}

/** What a goal is called: "16:8 · eat within 8h". */
export function planName(goal: number): string {
  if (goal < 23) return `${goal}:${24 - goal} · eat within ${24 - goal}h`
  if (goal === 23) return '23:1 · one meal a day'
  if (goal === 24) return 'a full day'
  return 'extended fast'
}

export const fastLength = (fast: Pick<Fast, 'start' | 'end'>): number => fast.end - fast.start
export const metGoal = (fast: Fast): boolean => fastLength(fast) >= fast.goal * HOUR
export const deepestStage = (fast: Pick<Fast, 'start' | 'end'>): number => stageIndex(fastLength(fast) / HOUR)

/** Share of the goal reached, from 0, unbounded above. */
export const progressOf = (elapsedMs: number, goal: number): number => Math.max(0, elapsedMs) / (goal * HOUR)

/** Whole percent of the goal, as the action block shows it. */
export const percentOf = (elapsedMs: number, goal: number): number => Math.floor(progressOf(elapsedMs, goal) * 100)

/** Newest first, by end. */
export const newestFirst = (fasts: Fast[]): Fast[] => [...fasts].sort((a, b) => b.end - a.end)

/** The time a fast reaches each stage after the first, and its goal: what alerts and the
 *  "next" line announce. */
export function milestones(active: Active): { at: number; stage: number | null }[] {
  const stages = STAGES.slice(1).map((s, i) => ({ at: active.start + s.from * HOUR, stage: i + 1 }))
  return [...stages, { at: active.start + active.goal * HOUR, stage: null }].sort((a, b) => a.at - b.at)
}

/** Days in a row, up to today, with a fast that met its goal ending on them. Today
 *  without one yet does not break the streak. */
export function streak(fasts: Fast[], now: number): number {
  const met = new Set(fasts.filter(metGoal).map((f) => dayKey(f.end)))
  const day = new Date(now)
  if (!met.has(dayKey(day))) day.setDate(day.getDate() - 1)
  let count = 0
  while (met.has(dayKey(day))) {
    count++
    day.setDate(day.getDate() - 1)
  }
  return count
}

/** Hours spent in each stage, over all fasts. */
export function stageHours(fasts: Fast[]): number[] {
  const hours = STAGES.map(() => 0)
  for (const fast of fasts) {
    const length = fastLength(fast) / HOUR
    STAGES.forEach((stage, i) => {
      hours[i] += Math.max(0, Math.min(length, stageEnd(i)) - stage.from)
    })
  }
  return hours
}

export interface Summary {
  count: number
  total: number // ms
  average: number // ms
  longest: number // ms
  goalRate: number // 0 to 1
}

export function summarize(fasts: Fast[]): Summary {
  const lengths = fasts.map(fastLength)
  const total = lengths.reduce((sum, ms) => sum + ms, 0)
  return {
    count: fasts.length,
    total,
    average: fasts.length ? total / fasts.length : 0,
    longest: Math.max(0, ...lengths),
    goalRate: fasts.length ? fasts.filter(metGoal).length / fasts.length : 0,
  }
}

/** Time left in the eating window after the last fast: a day minus its goal. */
export function eatingLeft(fasts: Fast[], now: number): number {
  const last = newestFirst(fasts)[0]
  if (!last || last.goal >= 24) return 0
  return Math.max(0, last.end + (24 - last.goal) * HOUR - now)
}

/** The first of `fasts` other than `id` that shares time with [start, end). */
export function overlapping(fasts: Fast[], start: number, end: number, id = ''): Fast | null {
  return fasts.find((f) => f.id !== id && f.start < end && start < f.end) ?? null
}

/** The earliest a new fast can start: when the last one ended. */
export const earliestStart = (fasts: Fast[]): number => Math.max(-Infinity, ...fasts.map((f) => f.end))

/** Why a fast's times cannot be saved, or null when they can. */
export function invalidTimes(start: number, end: number, now: number): string | null {
  if (end > now + MINUTE) return 'The end is in the future.'
  if (end - start < MINUTE) return 'The end must come after the start.'
  return null
}

/** Weight in the unit the user reads: one decimal. */
export const KG_PER_LB = 0.45359237

export const weightNumber = (kg: number, unit: 'kg' | 'lb'): string => (unit === 'kg' ? kg : kg / KG_PER_LB).toFixed(1)

export const showWeight = (kg: number, unit: 'kg' | 'lb'): string => `${weightNumber(kg, unit)} ${unit}`

/** A typed weight ("71,4", "157.5") in kg, or null when it is not a weight. */
export function parseWeight(text: string, unit: 'kg' | 'lb'): number | null {
  const value = Number(text.trim().replace(',', '.'))
  if (!text.trim() || !Number.isFinite(value) || value <= 0 || value > 700) return null
  return unit === 'kg' ? value : value * KG_PER_LB
}

/** A change as a signed number to one decimal: "-1.6", "+0.4", "±0.0". */
export function signedNumber(value: number): string {
  const text = Math.abs(value).toFixed(1)
  return `${Number(text) === 0 ? '±' : value < 0 ? '-' : '+'}${text}`
}

// BMI -------------------------------------------------------------------------------

/** Body mass index: kg over the height in metres, squared. The same function gives the
 *  change in BMI from a change in kg. https://en.wikipedia.org/wiki/Body_mass_index */
export const bmi = (kg: number, cm: number): number => kg / (cm / 100) ** 2

/** A BMI, or a change in one, to one decimal. */
export const showBmi = (value: number): string => value.toFixed(1)

const CM_PER_INCH = 2.54
const HEIGHT_CM = { min: 100, max: 250, start: 170 }
const HEIGHT_IN = { min: 39, max: 98 }

const inchesOf = (cm: number): number => Math.round(cm / CM_PER_INCH)
const cmOf = (inches: number): number => Number((inches * CM_PER_INCH).toFixed(2))

/** The height a step from `cm` lands on, in cm: by the cm with kg, by the inch with lb.
 *  Unset, the first step in either direction sets 170 cm, to the nearest inch with lb. */
export function stepHeight(cm: number | null, direction: -1 | 1, unit: 'kg' | 'lb'): number {
  if (unit === 'kg') {
    return cm === null ? HEIGHT_CM.start : Math.min(HEIGHT_CM.max, Math.max(HEIGHT_CM.min, Math.round(cm) + direction))
  }
  const inches = cm === null ? inchesOf(HEIGHT_CM.start) : inchesOf(cm) + direction
  return cmOf(Math.min(HEIGHT_IN.max, Math.max(HEIGHT_IN.min, inches)))
}

/** Whether a step in `direction` has nowhere to go. */
export function heightAtLimit(cm: number | null, direction: -1 | 1, unit: 'kg' | 'lb'): boolean {
  if (cm === null) return false
  const [at, limit] = unit === 'kg' ? [Math.round(cm), HEIGHT_CM] : [inchesOf(cm), HEIGHT_IN]
  return direction < 0 ? at <= limit.min : at >= limit.max
}

/** A height as the stepper shows it, in whole units: "180 cm", "5′ 11″"; dashes when unset. */
export function showHeight(cm: number | null, unit: 'kg' | 'lb'): string {
  if (unit === 'kg') return cm === null ? '--- cm' : `${Math.round(cm)} cm`
  if (cm === null) return '-′ --″'
  const inches = inchesOf(cm)
  return `${Math.floor(inches / 12)}′ ${inches % 12}″`
}

/** BMI's formula in the weight's unit, with the numbers in it when there is a weight (kg)
 *  and a height (cm): "BMI = 80.6 kg / (1.80 m)² = 24.9", "BMI = 703 × 177.7 lb / (71 in)² = 24.8".
 *  The 703 is the metric formula's constant, rounded: https://en.wikipedia.org/wiki/Body_mass_index#Calculation */
export function bmiFormula(unit: 'kg' | 'lb', kg: number | null, cm: number | null): string {
  const filled = kg !== null && cm !== null
  const result = filled ? ` = ${showBmi(bmi(kg, cm))}` : ''
  if (unit === 'kg') return `BMI = ${filled ? `${weightNumber(kg, 'kg')} kg / (${(cm / 100).toFixed(2)} m)²` : 'kg / m²'}${result}`
  return `BMI = 703 × ${filled ? `${weightNumber(kg, 'lb')} lb / (${inchesOf(cm)} in)²` : 'lb / in²'}${result}`
}
