// Where fasts live: Capacitor Preferences, which is the app's SharedPreferences on
// Android and localStorage in a browser during development. The history is a few
// kilobytes of JSON, read once at start and written whole on every change.

import { Preferences } from '@capacitor/preferences'
import { DEFAULT_COLORS, toColors, type Colors } from '../colors'
import { SWITCHABLE, TEXT_SIZES, type Switchable, type TextSize } from '../display'
import { PAGE_IDS, STATS_PANES, toOrder, toSubset, type PageId, type StatsPane } from '../layout'
import { WEEK_STARTS, type WeekStart } from './calendar'
import { DEFAULT_GOAL, type Active, type Fast, type HeightUnit } from './fasts'
import { SPANS, type Span } from './stats'

export interface Settings {
  goal: number // the next fast's goal, in hours
  alerts: boolean // notify when a stage begins and at the goal
  status: boolean // keep a notification showing the fast or eating window and the stage
  unit: 'kg' | 'lb'
  lastExport: string | null // ISO time of the last backup
  exportOn: boolean // regular exports (autoexport.ts)
  exportEvery: string // when, as a systemd calendar expression (schedule.ts)
  scaleUser: number | null // the openScale user whose weights to read (openscale.ts), or none
  weekStart: WeekStart // the calendar's first weekday (calendar.ts)
  weekNumbers: boolean // ISO week numbers before each week
  weekTotals: boolean // each week's fasting hours after it
  statsSpan: Span // the days Stats covers (stats.ts); 0 is all of them
  cloudBackup: boolean // Android's backup to the Google account (FastBackupAgent.java)
  keepOneFile: boolean // exports replace one fast-track.json instead of making a file a day (backup.ts, FastExport.java)
  bmi: boolean // show BMI, from the latest weight and the height (fasts.ts)
  height: number | null // in cm, whichever unit it is shown in; none until set
  heightUnit: HeightUnit // the height's own unit, cm or feet and inches (fasts.ts)
  colors: Colors // the accent and the stages' colours, by Catppuccin name (colors.ts; FastColors.java reads them)
  pages: PageId[] // every page, in the tabs' order (layout.ts)
  hiddenPages: PageId[] // the ones left off the tabs; never Fast or Options
  startPage: PageId // the page the app opens on
  statsPanes: StatsPane[] // Stats' panes below Summary, in order
  hiddenStats: StatsPane[] // the ones put away
  textSize: TextSize // display.ts; System follows the phone's font size
  motion: Switchable // animations; System follows the phone and the browser
  haptics: Switchable // vibration; System follows the phone's touch feedback
}

export const DEFAULT_SETTINGS: Settings = {
  goal: DEFAULT_GOAL,
  alerts: true,
  status: true,
  unit: 'kg',
  lastExport: null,
  exportOn: false,
  exportEvery: 'daily',
  scaleUser: null,
  weekStart: 1,
  weekNumbers: false,
  weekTotals: true,
  statsSpan: 30,
  cloudBackup: false,
  keepOneFile: false,
  bmi: false,
  height: null,
  heightUnit: 'cm',
  colors: { ...DEFAULT_COLORS },
  pages: [...PAGE_IDS],
  hiddenPages: [],
  startPage: 'fast',
  statsPanes: [...STATS_PANES],
  hiddenStats: [],
  textSize: 'system',
  motion: 'system',
  haptics: 'system',
}

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
    ...(f.fromScale === true && isNumber(f.weight) ? { fromScale: true } : {}),
  }
}

function toActive(v: unknown): Active | null {
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
    exportOn: typeof s.exportOn === 'boolean' ? s.exportOn : DEFAULT_SETTINGS.exportOn,
    exportEvery: typeof s.exportEvery === 'string' && s.exportEvery.trim() ? s.exportEvery : DEFAULT_SETTINGS.exportEvery,
    scaleUser: isNumber(s.scaleUser) ? s.scaleUser : null,
    weekStart: WEEK_STARTS.includes(s.weekStart as WeekStart) ? (s.weekStart as WeekStart) : DEFAULT_SETTINGS.weekStart,
    weekNumbers: typeof s.weekNumbers === 'boolean' ? s.weekNumbers : DEFAULT_SETTINGS.weekNumbers,
    weekTotals: typeof s.weekTotals === 'boolean' ? s.weekTotals : DEFAULT_SETTINGS.weekTotals,
    statsSpan: SPANS.includes(s.statsSpan as Span) ? (s.statsSpan as Span) : DEFAULT_SETTINGS.statsSpan,
    cloudBackup: s.cloudBackup === true,
    keepOneFile: s.keepOneFile === true,
    bmi: s.bmi === true,
    height: isNumber(s.height) && s.height > 0 ? s.height : null,
    // Before it had its own unit, the height followed the weight's.
    heightUnit: s.heightUnit === 'in' || (s.heightUnit === undefined && s.unit === 'lb') ? 'in' : 'cm',
    colors: toColors(s.colors),
    pages: toOrder(s.pages, PAGE_IDS),
    hiddenPages: toSubset(s.hiddenPages, ['calendar', 'stats', 'info']),
    startPage: PAGE_IDS.includes(s.startPage as PageId) ? (s.startPage as PageId) : DEFAULT_SETTINGS.startPage,
    statsPanes: toOrder(s.statsPanes, STATS_PANES),
    hiddenStats: toSubset(s.hiddenStats, STATS_PANES),
    textSize: TEXT_SIZES.includes(s.textSize as TextSize) ? (s.textSize as TextSize) : DEFAULT_SETTINGS.textSize,
    motion: SWITCHABLE.includes(s.motion as Switchable) ? (s.motion as Switchable) : DEFAULT_SETTINGS.motion,
    haptics: SWITCHABLE.includes(s.haptics as Switchable) ? (s.haptics as Switchable) : DEFAULT_SETTINGS.haptics,
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
