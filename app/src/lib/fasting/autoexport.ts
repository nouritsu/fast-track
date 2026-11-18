// Regular exports. The app turns the schedule (schedule.ts) into the next few hundred
// run times and saves them; on Android an alarm (FastExport.java) writes the backup at
// each one, with the app closed too, and records how the last one went. Opening the
// app plans again from then, so the list never runs out for a schedule kept in use.

import { Preferences } from '@capacitor/preferences'
import { parseSchedule, upcomingRuns } from './schedule'
import type { Settings } from './store'

const PLAN_RUNS = 400
const PLAN_KEY = 'exportPlan'
const RESULT_KEY = 'autoExport'

/** The run times for `settings`, from `now`: none when regular exports are off or the
 *  expression does not read. */
export function exportRuns(settings: Settings, now: Date): number[] {
  if (!settings.exportOn) return []
  try {
    return upcomingRuns(parseSchedule(settings.exportEvery), now, PLAN_RUNS)
  } catch {
    return []
  }
}

export async function savePlan(runs: number[]): Promise<void> {
  await Preferences.set({ key: PLAN_KEY, value: JSON.stringify({ runs }) })
}

/** How the last regular export went, as FastExport.java recorded it. */
export interface ExportResult {
  at: string // ISO time
  path?: string
  error?: string
}

export async function lastResult(): Promise<ExportResult | null> {
  const { value } = await Preferences.get({ key: RESULT_KEY })
  if (!value) return null
  try {
    const result = JSON.parse(value) as ExportResult
    return typeof result.at === 'string' ? result : null
  } catch {
    return null
  }
}
