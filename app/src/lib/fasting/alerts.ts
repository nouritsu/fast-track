// Stage alerts: local notifications when a fast reaches a new stage and its goal,
// scheduled when it starts and rescheduled whenever its start or goal changes. They
// fire with the app closed; in a browser they only work while the page is open.

import { LocalNotifications } from '@capacitor/local-notifications'
import { milestones, type Active } from './fasts'
import { STAGES } from './stages'
import { HOUR } from './time'

export interface Alert {
  id: number
  at: number
  title: string
  body: string
}

// Notification ids are ours alone in this app: one per milestone.
const IDS = [1, 2, 3, 4]

/** The alerts still to come for `active` after `now`. */
export function plannedAlerts(active: Active, now: number): Alert[] {
  const goalAt = active.start + active.goal * HOUR
  return milestones(active)
    // A stage that begins at the goal is announced by the goal's alert alone.
    .filter((m) => m.stage === null || m.at !== goalAt)
    .map((m, i) => ({
      id: IDS[i],
      at: m.at,
      title: m.stage === null ? 'Goal reached' : STAGES[m.stage].name,
      body: m.stage === null ? `${active.goal} hours. End the fast when you're ready.` : STAGES[m.stage].alert,
    }))
    .filter((alert) => alert.at > now)
}

/** Asks for permission to notify; true when granted. */
export async function askAlerts(): Promise<boolean> {
  try {
    const { display } = await LocalNotifications.requestPermissions()
    return display === 'granted'
  } catch {
    return false
  }
}

/** Replaces the scheduled alerts with those for `active`, or none. */
export async function syncAlerts(active: Active | null, enabled: boolean, now = Date.now()): Promise<void> {
  try {
    await LocalNotifications.cancel({ notifications: IDS.map((id) => ({ id })) })
    if (!active || !enabled) return
    const { display } = await LocalNotifications.checkPermissions()
    if (display !== 'granted') return
    const alerts = plannedAlerts(active, now)
    if (!alerts.length) return
    await LocalNotifications.schedule({
      notifications: alerts.map((alert) => ({
        id: alert.id,
        title: alert.title,
        body: alert.body,
        schedule: { at: new Date(alert.at), allowWhileIdle: true },
      })),
    })
  } catch {
    // No notifications on this platform: the app works without them.
  }
}
