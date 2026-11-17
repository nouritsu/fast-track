// The app's state: the history, the fast in progress and the settings, kept in
// step with storage, the scheduled alerts and the status notification. The rules live
// in fasts.ts; this only applies them and saves.

import { syncAlerts } from './alerts'
import { mergeFasts } from './backup'
import { newestFirst, type Active, type Fast } from './fasts'
import { refreshStatus } from './status'
import { DEFAULT_SETTINGS, load, saveActive, saveFasts, saveSettings, type Settings } from './store'

export class Tracker {
  fasts = $state<Fast[]>([]) // newest first
  active = $state<Active | null>(null)
  settings = $state<Settings>({ ...DEFAULT_SETTINGS })
  loaded = $state(false)

  async load(): Promise<void> {
    const saved = await load()
    this.fasts = newestFirst(saved.fasts)
    this.active = saved.active
    this.settings = saved.settings
    this.loaded = true
    await refreshStatus()
  }

  async start(at: number): Promise<void> {
    this.active = { start: at, goal: this.settings.goal }
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

  /** Ends the fast in progress and returns it as saved. */
  async end(at: number): Promise<Fast | null> {
    if (!this.active) return null
    const fast: Fast = { id: crypto.randomUUID(), start: this.active.start, end: at, goal: this.active.goal, note: '', weight: null }
    this.active = null
    await this.#saveActive()
    await this.save(fast)
    return fast
  }

  async cancel(): Promise<void> {
    this.active = null
    await this.#saveActive()
  }

  /** Adds `fast`, or replaces the one with its id. */
  async save(fast: Fast): Promise<void> {
    this.fasts = newestFirst([...this.fasts.filter((f) => f.id !== fast.id), fast])
    await saveFasts(this.fasts)
    await refreshStatus()
  }

  async remove(id: string): Promise<void> {
    this.fasts = this.fasts.filter((f) => f.id !== id)
    await saveFasts(this.fasts)
    await refreshStatus()
  }

  /** Merges imported fasts by id; returns how many were new. */
  async merge(incoming: Fast[]): Promise<number> {
    const { fasts, added } = mergeFasts(this.fasts, incoming)
    this.fasts = newestFirst(fasts)
    await saveFasts(this.fasts)
    await refreshStatus()
    return added
  }

  async setSettings(patch: Partial<Settings>): Promise<void> {
    const alertsChanged = 'alerts' in patch && patch.alerts !== this.settings.alerts
    this.settings = { ...this.settings, ...patch }
    await saveSettings(this.settings)
    if (alertsChanged) await syncAlerts(this.active, this.settings.alerts)
    if ('status' in patch) await refreshStatus()
  }

  async #saveActive(): Promise<void> {
    await saveActive(this.active)
    await syncAlerts(this.active, this.settings.alerts)
    await refreshStatus()
  }
}
