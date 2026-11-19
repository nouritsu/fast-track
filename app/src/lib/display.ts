// Text size, motion and haptics. Each can follow the system, which on Android is the
// phone's font size, its "Remove animations" and its touch feedback (SystemPrefs.java;
// in a browser, the reduced-motion media query and nothing else). index.html applies the
// last text scale and motion before the first paint, from the copy kept here.

import { registerPlugin } from '@capacitor/core'

export type TextSize = 'system' | 'small' | 'normal' | 'large'
export const TEXT_SIZES: TextSize[] = ['system', 'small', 'normal', 'large']
export type Switchable = 'system' | 'on' | 'off'
export const SWITCHABLE: Switchable[] = ['system', 'on', 'off']

const BASE_PX = 16
const SCALES: Record<Exclude<TextSize, 'system'>, number> = { small: 0.875, normal: 1, large: 1.125 }
const STORAGE_KEY = 'display'

/** What Android says; a browser leaves these at their defaults. */
export interface SystemPrefs {
  fontScale: number
  animations: boolean
  haptics: boolean
}

const BROWSER: SystemPrefs = { fontScale: 1, animations: true, haptics: true }
const Plugin = registerPlugin<{ get(): Promise<SystemPrefs> }>('SystemPrefs', { web: { get: async () => BROWSER } })

export async function systemPrefs(): Promise<SystemPrefs> {
  try {
    return await Plugin.get()
  } catch {
    return BROWSER
  }
}

/** The text's scale for a choice: the phone's font scale for System. */
export const textScale = (size: TextSize, system: SystemPrefs): number => (size === 'system' ? system.fontScale : SCALES[size])

/** Whether motion is held still: Off, or System when the phone or the browser asks for less. */
export const stillFor = (motion: Switchable, system: SystemPrefs, reduce: boolean): boolean =>
  motion === 'off' || (motion === 'system' && (reduce || !system.animations))

/** Whether to vibrate: On, or System when the phone's touch feedback is on. */
export const buzzFor = (haptics: Switchable, system: SystemPrefs): boolean => haptics === 'on' || (haptics === 'system' && system.haptics)

const REDUCE = '(prefers-reduced-motion: reduce)'
export const reduceQuery = (): MediaQueryList => matchMedia(REDUCE)

/** Sets the text's scale and motion on the page (data-still holds the animations; see
 *  reducedMotion), and keeps them for the next start's first paint. */
export function applyDisplay(scale: number, still: boolean): void {
  const root = document.documentElement
  root.style.fontSize = `${BASE_PX * scale}px`
  root.toggleAttribute('data-still', still)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ scale, still }))
  } catch {
    // no storage: the next start paints at the normal size until the settings load
  }
}
