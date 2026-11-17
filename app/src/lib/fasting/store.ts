// Where fasts live: Capacitor Preferences, which is the app's SharedPreferences on
// Android and localStorage in a browser during development. The history is a few
// kilobytes of JSON, read once at start and written whole on every change.

import { Preferences } from '@capacitor/preferences'
import { DEFAULT_GOAL, type Active, type Fast } from './fasts'

export interface Settings {
  goal: number // the next fast's goal, in hours
  alerts: boolean // notify when a stage begins and at the goal
  status: boolean // keep a notification showing the fast or eating window and the stage
  unit: 'kg' | 'lb'
  lastExport: string | null // ISO time of the last backup
}

export const DEFAULT_SETTINGS: Settings = { goal: DEFAULT_GOAL, alerts: true, status: true, unit: 'kg', lastExport: null }

export interface Saved {
  fasts: Fast[]
  active: Active | null
  settings: Settings
}

const KEYS = { fasts: 'fasts', active: 'active', settings: 'settings' } as const

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** A fast read from storage or a backup, or null when it is not one. */
export function toFast(v: unknown): Fast | null {
  const f = v as Partial<Fast> | null
  if (!f || typeof f.id !== 'string' || !isNumber(f.start) || !isNumber(f.end) || !isNumber(f.goal)) return null
  if (f.end <= f.start) return null
  return {
    id: f.id,
    start: f.start,
    end: f.end,
    goal: f.goal,
    note: typeof f.note === 'string' ? f.note : '',
    weight: isNumber(f.weight) && f.weight > 0 ? f.weight : null,
  }
}

export function toActive(v: unknown): Active | null {
  const a = v as Partial<Active> | null
  return a && isNumber(a.start) && isNumber(a.goal) ? { start: a.start, goal: a.goal } : null
}

export function toSettings(v: unknown): Settings {
  const s = (v ?? {}) as Partial<Settings>
  return {
    goal: isNumber(s.goal) && s.goal > 0 ? s.goal : DEFAULT_SETTINGS.goal,
    alerts: typeof s.alerts === 'boolean' ? s.alerts : DEFAULT_SETTINGS.alerts,
    status: typeof s.status === 'boolean' ? s.status : DEFAULT_SETTINGS.status,
    unit: s.unit === 'lb' ? 'lb' : 'kg',
    lastExport: typeof s.lastExport === 'string' ? s.lastExport : null,
  }
}

async function read(key: string): Promise<unknown> {
  const { value } = await Preferences.get({ key })
  if (value === null) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const write = (key: string, value: unknown) => Preferences.set({ key, value: JSON.stringify(value) })

export async function load(): Promise<Saved> {
  const [fasts, active, settings] = await Promise.all([read(KEYS.fasts), read(KEYS.active), read(KEYS.settings)])
  return {
    fasts: Array.isArray(fasts) ? fasts.map(toFast).filter((f) => f !== null) : [],
    active: toActive(active),
    settings: toSettings(settings),
  }
}

export const saveFasts = (fasts: Fast[]) => write(KEYS.fasts, fasts)
export const saveSettings = (settings: Settings) => write(KEYS.settings, settings)
export const saveActive = (active: Active | null) =>
  active ? write(KEYS.active, active) : Preferences.remove({ key: KEYS.active })
