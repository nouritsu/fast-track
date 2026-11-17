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
  weights(options: { userId: number }): Promise<{ weights: ScaleWeight[] }>
}

const absent: ScaleStatus = { installed: false, granted: false }

const OpenScale = registerPlugin<OpenScalePlugin>('OpenScale', {
  web: {
    status: async () => absent,
    requestAccess: async () => absent,
    users: async () => ({ users: [] }),
    weights: async () => ({ weights: [] }),
  },
})

export const scaleStatus = (): Promise<ScaleStatus> => OpenScale.status().catch(() => absent)
export const askScale = (): Promise<ScaleStatus> => OpenScale.requestAccess().catch(() => absent)
export const scaleUsers = async (): Promise<ScaleUser[]> => (await OpenScale.users()).users

/** The user's weighings, oldest first; none when openScale cannot be read. */
export async function scaleWeights(userId: number): Promise<ScaleWeight[]> {
  try {
    const { weights } = await OpenScale.weights({ userId })
    return weights.filter((w) => Number.isFinite(w.at) && w.kg > 0).sort((a, b) => a.at - b.at)
  } catch {
    return []
  }
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
