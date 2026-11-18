// Fixed-width text for status lines and charts: numbers padded to their width,
// fields dashed at their normal width while there is nothing to show, block
// characters for bars. Nothing on screen shifts when a value changes.

/** `value` right-aligned in `width` characters. */
export const pad = (value: number | string, width: number): string => String(value).padStart(width, ' ')

/** `n` as two digits: "07". */
export const two = (n: number): string => String(n).padStart(2, '0')

/** `text` with every character a dash except its frame (the characters in `keep`). */
export const dashes = (text: string, keep = '[]%·:'): string =>
  [...text].map((ch) => (keep.includes(ch) ? ch : '-')).join('')

/** A span of time as mm:ss, or h:mm:ss from an hour on. */
export function duration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const [h, m, s] = [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60]
  return h ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`
}

/** A span of time to the nearest minute as h:mm: "16:34". */
export function hm(ms: number): string {
  const minutes = Math.round(Math.max(0, ms) / 60_000)
  return `${Math.floor(minutes / 60)}:${two(minutes % 60)}`
}

/** A time of day as HH:MM. */
export const clock = (at: Date): string => `${two(at.getHours())}:${two(at.getMinutes())}`
