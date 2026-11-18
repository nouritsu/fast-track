// Export and import. A backup holds every fast and the settings; importing merges
// fasts by id, so importing the same file twice never duplicates anything. On the
// phone, export writes Documents/FastTrack/.

import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import type { Fast } from './fasts'
import { toFast, toSettings, type Settings } from './store'
import { dayKey } from './time'

const FORMAT = 'fast-track-backup'
export const VERSION = 1
const FOLDER = 'FastTrack'

export interface Backup {
  format: typeof FORMAT
  version: typeof VERSION
  exported_at: string
  settings: Settings
  fasts: Fast[]
}

export function makeBackup(fasts: Fast[], settings: Settings, now = new Date()): Backup {
  return { format: FORMAT, version: VERSION, exported_at: now.toISOString(), settings, fasts }
}

export const backupName = (now = new Date()): string => `fast-track-${dayKey(now)}.json`

export class BackupError extends Error {}

/** Parses and checks a backup file; throws BackupError when it is not one. */
export function parseBackup(text: string): Backup {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new BackupError('not JSON')
  }
  const b = data as Partial<Backup>
  if (b?.format !== FORMAT) throw new BackupError('not a Fast Track backup')
  if (b.version !== VERSION) throw new BackupError(`backup version ${String(b.version)} is not supported`)
  if (!Array.isArray(b.fasts)) throw new BackupError('no fasts in it')
  const fasts = b.fasts.map(toFast)
  if (fasts.some((f) => f === null)) throw new BackupError('some fasts are malformed')
  return { ...(b as Backup), settings: toSettings(b.settings), fasts: fasts as Fast[] }
}

/** `incoming` added to `fasts` where their ids are new; returns the result and how many were added. */
export function mergeFasts(fasts: Fast[], incoming: Fast[]): { fasts: Fast[]; added: number } {
  const ids = new Set(fasts.map((f) => f.id))
  const fresh = incoming.filter((f) => !ids.has(f.id))
  return { fasts: [...fasts, ...fresh], added: fresh.length }
}

/** Saves the file where the user can reach it; returns where it went. */
export async function saveBackupFile(name: string, text: string, type = 'application/json'): Promise<string> {
  if (!Capacitor.isNativePlatform()) {
    // Development in a browser: an ordinary download.
    const url = URL.createObjectURL(new Blob([text], { type }))
    const link = Object.assign(document.createElement('a'), { href: url, download: name })
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return name
  }
  const write = () =>
    Filesystem.writeFile({
      path: `${FOLDER}/${name}`,
      data: text,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true,
    })
  try {
    await write()
  } catch {
    // Android 10 and older ask for storage access first; 11 and newer need none:
    // https://capacitorjs.com/docs/apis/filesystem#android
    await Filesystem.requestPermissions()
    await write()
  }
  return `Documents/${FOLDER}/${name}`
}
