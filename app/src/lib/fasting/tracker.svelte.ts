// The app's state: the history, the fast in progress and the settings, kept in
// step with storage, the scheduled alerts and the status notification. The rules live
// in fasts.ts; this only applies them and saves.

import { syncAlerts } from './alerts'
import { exportRuns, savePlan } from './autoexport'
import { mergeFasts } from './backup'
import { newestFirst, type Active, type Fast } from './fasts'
import { scaleStatus, scaleWeights, syncWeights, type ScaleRead, type ScaleWeight, type SyncReport } from './openscale'
import { refreshStatus } from './status'
import { DEFAULT_SETTINGS, load, saveActive, saveFasts, saveSettings, type Settings } from './store'

export class Tracker {
  fasts = $state<Fast[]>([]) // newest first
  active = $state<Active | null>(null)
  settings = $state<Settings>({ ...DEFAULT_SETTINGS })
  loaded = $state(false)
  scale = $state<ScaleWeight[]>([]) // weighings from openScale, oldest first
  scaleRead = $state<ScaleRead | null>(null) // how the last read of openScale went

  async load(): Promise<void> {
    const saved = await load()
    this.fasts = newestFirst(saved.fasts)
    this.active = saved.active
    this.settings = saved.settings
    this.loaded = true
    await this.#planExports()
    await this.loadScale()
  }

  /** Reads the chosen openScale user's weighings, or none when not connected. */
  async loadScale(): Promise<void> {
    const user = this.settings.scaleUser
    this.scaleRead = user !== null && (await scaleStatus()).granted ? await scaleWeights(user) : null
    this.scale = this.scaleRead?.weights ?? []
  }

  async start(at: number, goal = this.settings.goal): Promise<void> {
    this.active = { start: at, goal }
    await this.#saveActive()
  }

  async moveStart(at: number): Promise<void> {
    if (!this.active) return
    this.active = { ...this.active, start: at }
    await this.#saveActive()
  }

  /** The goal of the fast in progress, and of the ones after it. */
  async setGoal(goal: number): Promise<void> {
    if (this.active) {
      this.active = { ...this.active, goal }
      await this.#saveActive()
    }
    await this.setSettings({ goal })
  }

  /** Ends the fast in progress and returns it as saved. The fast is saved before the one
   *  in progress is cleared, so the app closing between the two loses nothing. */
  async end(at: number): Promise<Fast | null> {
    if (!this.active) return null
    const fast: Fast = { id: crypto.randomUUID(), start: this.active.start, end: at, goal: this.active.goal, note: '', weight: null }
    this.active = null
    await this.save(fast)
    await this.#saveActive()
    return fast
  }

  /** Puts an ended fast back in progress, for an End pressed by mistake. It is in
   *  progress before it leaves the history, so the app closing between the two loses nothing. */
  async resume(fast: Fast): Promise<void> {
    this.active = { start: fast.start, goal: fast.goal }
    await this.#saveActive()
    await this.remove(fast.id)
  }

  async cancel(): Promise<void> {
    this.active = null
    await this.#saveActive()
  }

  /** Adds `fast`, or replaces the one with its id. */
  async save(fast: Fast): Promise<void> {
    this.fasts = newestFirst([...this.fasts.filter((f) => f.id !== fast.id), fast])
    await saveFasts(this.fasts)
    await this.#notify()
  }

  /** Writes openScale's weights into the fasts without a typed one (openscale.ts). */
  async syncScale(): Promise<SyncReport> {
    await this.loadScale()
    const report = syncWeights(this.fasts, this.scale)
    if (report.changed.length) {
      const changed = new Map(report.changed.map((f) => [f.id, f]))
      this.fasts = this.fasts.map((f) => changed.get(f.id) ?? f)
      await saveFasts(this.fasts)
    }
    return report
  }

  async remove(id: string): Promise<void> {
    this.fasts = this.fasts.filter((f) => f.id !== id)
    await saveFasts(this.fasts)
    await this.#notify()
  }

  /** Merges imported fasts by id; returns how many were new. */
  async merge(incoming: Fast[]): Promise<number> {
    const { fasts, added } = mergeFasts(this.fasts, incoming)
    this.fasts = newestFirst(fasts)
    await saveFasts(this.fasts)
    await this.#notify()
    return added
  }

  async setSettings(patch: Partial<Settings>): Promise<void> {
    const alertsChanged = ('alerts' in patch && patch.alerts !== this.settings.alerts) || ('reminder' in patch && patch.reminder !== this.settings.reminder)
    this.settings = { ...this.settings, ...patch }
    await saveSettings(this.settings)
    if (alertsChanged) await syncAlerts(this.active, this.fasts, this.settings)
    if ('exportOn' in patch || 'exportEvery' in patch) await this.#planExports()
    else if ('status' in patch || 'colors' in patch) await refreshStatus()
    if ('scaleUser' in patch) await this.loadScale()
  }

  /** Saves the regular exports' next run times; the native side schedules the first. */
  async #planExports(): Promise<void> {
    await savePlan(exportRuns(this.settings, new Date()))
    await refreshStatus()
  }

  /** Plans the alerts and the reminder again, and redraws the status notification, after
   *  a fast changed. */
  async #notify(): Promise<void> {
    await syncAlerts(this.active, this.fasts, this.settings)
    await refreshStatus()
  }

  async #saveActive(): Promise<void> {
    await saveActive(this.active)
    await this.#notify()
  }
}
