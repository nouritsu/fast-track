// Alerts: local notifications when a fast reaches a new stage and its goal (or only its
// goal), and a reminder when the eating window after a fast closes. They are planned
// again whenever a fast or the settings change, and fire with the app closed; in a
// browser they only work while the page is open.

import { LocalNotifications } from '@capacitor/local-notifications'
import { milestones, newestFirst, type Active, type Fast } from './fasts'
import { STAGES } from './stages'
import { HOUR } from './time'

/** Which alerts a fast gives: each stage and the goal, the goal alone, or none. */
export type AlertChoice = 'all' | 'goal' | 'off'
export const ALERT_CHOICES: AlertChoice[] = ['all', 'goal', 'off']

export interface Alert {
  id: number
  at: number
  title: string
  body: string
}

// Notification ids are ours alone in this app: one per milestone, and the reminder.
const IDS = [1, 2, 3, 4]
const REMINDER = 5

/** The alerts still to come for `active` after `now`: all of them, or the goal's alone. */
export function plannedAlerts(active: Active, now: number, choice: AlertChoice = 'all'): Alert[] {
  if (choice === 'off') return []
  const goalAt = active.start + active.goal * HOUR
  return milestones(active)
    // A stage that begins at the goal is announced by the goal's alert alone.
    .filter((m) => m.stage === null || (choice === 'all' && m.at !== goalAt))
    .map((m, i) => ({
      id: IDS[i],
      at: m.at,
      title: m.stage === null ? 'Goal reached' : STAGES[m.stage].name,
      body: m.stage === null ? `${active.goal} hours. End the fast when you're ready.` : STAGES[m.stage].alert,
    }))
    .filter((alert) => alert.at > now)
}

/** The reminder when the eating window after the latest fast closes (a day less its goal),
 *  while no fast is in progress; null when it has closed or there is none. */
export function plannedReminder(fasts: Fast[], active: Active | null, now: number): Alert | null {
  const last = newestFirst(fasts)[0]
  if (active || !last || last.goal >= 24) return null
  const at = last.end + (24 - last.goal) * HOUR
  return at > now ? { id: REMINDER, at, title: 'Eating window closed', body: 'Time to start the next fast.' } : null
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

/** Replaces the scheduled alerts and reminder with those the fasts and settings call for. */
export async function syncAlerts(
  active: Active | null,
  fasts: Fast[],
  settings: { alerts: AlertChoice; reminder: boolean },
  now = Date.now(),
): Promise<void> {
  try {
    await LocalNotifications.cancel({ notifications: [...IDS, REMINDER].map((id) => ({ id })) })
    const reminder = settings.reminder ? plannedReminder(fasts, active, now) : null
    const alerts = [...(active ? plannedAlerts(active, now, settings.alerts) : []), ...(reminder ? [reminder] : [])]
    if (!alerts.length) return
    const { display } = await LocalNotifications.checkPermissions()
    if (display !== 'granted') return
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
