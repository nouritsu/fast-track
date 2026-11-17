// Weights from openScale (OpenScalePlugin.java reads its content provider). A fast's
// weight is its fasted one: the last weighing during the fast, else the one closest to
// its end within WINDOW_HOURS either side. A weight typed in always wins; Sync writes
// the scale's into the fasts (marked fromScale) so they last without openScale too.

import { registerPlugin } from '@capacitor/core'
import type { Fast } from './fasts'
import { HOUR } from './time'

export const WINDOW_HOURS = 12

export interface ScaleWeight {
  at: number // epoch ms
  kg: number
}

export interface ScaleUser {
  id: number
  name: string
}

export interface ScaleStatus {
  installed: boolean
  granted: boolean
}

interface OpenScalePlugin {
  status(): Promise<ScaleStatus>
  requestAccess(): Promise<ScaleStatus>
  users(): Promise<{ users: ScaleUser[] }>
  weights(options: { userId: number }): Promise<{ weights: ScaleWeight[]; rows: number; seen: string[] }>
}

const absent: ScaleStatus = { installed: false, granted: false }

const OpenScale = registerPlugin<OpenScalePlugin>('OpenScale', {
  web: {
    status: async () => absent,
    requestAccess: async () => absent,
    users: async () => ({ users: [] }),
    weights: async () => ({ weights: [], rows: 0, seen: [] }),
  },
})

export const scaleStatus = (): Promise<ScaleStatus> => OpenScale.status().catch(() => absent)
export const askScale = (): Promise<ScaleStatus> => OpenScale.requestAccess().catch(() => absent)
export const scaleUsers = async (): Promise<ScaleUser[]> => (await OpenScale.users()).users

/** What a read of openScale gave: the weighings, oldest first, and how it went. */
export interface ScaleRead {
  weights: ScaleWeight[]
  rows: number // measurements openScale returned; -1 when it did not answer
  seen: string[] // the identities of their values
  error: string | null
}

export async function scaleWeights(userId: number): Promise<ScaleRead> {
  try {
    const { weights, rows, seen } = await OpenScale.weights({ userId })
    const valid = weights.filter((w) => Number.isFinite(w.at) && w.kg > 0).sort((a, b) => a.at - b.at)
    return { weights: valid, rows, seen, error: null }
  } catch (error) {
    return { weights: [], rows: -1, seen: [], error: error instanceof Error ? error.message : String(error) }
  }
}

/** Why a read gave no weighings, in a sentence, or null when it gave some. */
export function emptyReason(read: ScaleRead, user: number): string | null {
  if (read.weights.length) return null
  if (read.error) return `openScale could not be read: ${read.error}.`
  if (read.rows < 0) return 'openScale did not answer.'
  if (!read.rows) return `openScale has no measurements for user ${user}. Is your data under another openScale user?`
  return `openScale returned ${read.rows} measurements for user ${user}, none with a weight. Their values: ${read.seen.join(', ') || 'none'}.`
}

/** The fast's weighing: the last one during it, else the one closest to its end within
 *  the window, or null. `weights` are oldest first. */
export function scaleWeightFor(
  fast: Pick<Fast, 'start' | 'end'>,
  weights: ScaleWeight[],
  windowHours = WINDOW_HOURS,
): ScaleWeight | null {
  let during: ScaleWeight | null = null
  let near: ScaleWeight | null = null
  for (const w of weights) {
    if (w.at >= fast.start && w.at <= fast.end) during = w
    const off = Math.abs(w.at - fast.end)
    if (off <= windowHours * HOUR && (!near || off < Math.abs(near.at - fast.end))) near = w
  }
  return during ?? near
}

/** A fast's weight and whether it came from the scale: saved, matched now, or none. */
export function weightOf(fast: Fast, weights: ScaleWeight[]): { kg: number; scale: boolean } | null {
  if (fast.weight !== null) return { kg: fast.weight, scale: fast.fromScale === true }
  const w = scaleWeightFor(fast, weights)
  return w ? { kg: w.kg, scale: true } : null
}

export interface SyncReport {
  changed: Fast[] // the fasts to save
  filled: number // had no weight, now have the scale's
  updated: number // had an older weight from the scale
  typed: number // kept, as typed in
  unmatched: number // no weighing during the fast or near its end
}

/** Writes the scale's weights into fasts without a typed one: every fast's own weighing,
 *  marked fromScale. Typed weights stay as they are. */
export function syncWeights(fasts: Fast[], weights: ScaleWeight[]): SyncReport {
  const report: SyncReport = { changed: [], filled: 0, updated: 0, typed: 0, unmatched: 0 }
  for (const fast of fasts) {
    if (fast.weight !== null && !fast.fromScale) {
      report.typed++
      continue
    }
    const w = scaleWeightFor(fast, weights)
    if (!w) {
      report.unmatched++
      continue
    }
    const kg = Math.round(w.kg * 100) / 100
    if (fast.weight === kg && fast.fromScale) continue
    if (fast.weight === null) report.filled++
    else report.updated++
    report.changed.push({ ...fast, weight: kg, fromScale: true })
  }
  return report
}
