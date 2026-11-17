// Weights from openScale (OpenScalePlugin.java reads its content provider). A fast takes
// the weighing closest to its end, within WINDOW_HOURS either side, unless a weight was
// typed in for it, which always wins.

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

/** The weighing closest to the fast's end within the window, or null. */
export function scaleWeightFor(fast: Pick<Fast, 'end'>, weights: ScaleWeight[], windowHours = WINDOW_HOURS): ScaleWeight | null {
  let best: ScaleWeight | null = null
  for (const w of weights) {
    const off = Math.abs(w.at - fast.end)
    if (off <= windowHours * HOUR && (!best || off < Math.abs(best.at - fast.end))) best = w
  }
  return best
}

/** A fast's weight and where it came from: typed in, from openScale, or none. */
export function weightOf(fast: Fast, weights: ScaleWeight[]): { kg: number; scale: boolean } | null {
  if (fast.weight !== null) return { kg: fast.weight, scale: false }
  const w = scaleWeightFor(fast, weights)
  return w ? { kg: w.kg, scale: true } : null
}
