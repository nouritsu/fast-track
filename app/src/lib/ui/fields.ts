// Fixed-width text for status lines and charts: numbers padded to their width,
// fields dashed at their normal width while there is nothing to show, ASCII bars.
// Nothing on screen shifts when a value changes.

/** `value` right-aligned in `width` characters. */
export const pad = (value: number | string, width: number): string => String(value).padStart(width, ' ')

/** `text` with every character a dash except its frame (the characters in `keep`). */
export const dashes = (text: string, keep = '[]%·:'): string =>
  [...text].map((ch) => (keep.includes(ch) ? ch : '-')).join('')

/** A bar of `cells` for a fraction from 0 to 1: [#####.......]. */
export function bar(fraction: number, cells = 12): string {
  const filled = Math.round(Math.min(1, Math.max(0, fraction)) * cells)
  return `[${'#'.repeat(filled).padEnd(cells, '.')}]`
}

/** A span of time as mm:ss, or h:mm:ss from an hour on. */
export function duration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const [h, m, s] = [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60]
  const two = (n: number) => String(n).padStart(2, '0')
  return h ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`
}

/** A time of day as HH:MM. */
export const clock = (at: Date): string =>
  `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`

/** The status block's right title: weekday and time of day. */
export const daytime = (at: Date): string =>
  `${new Intl.DateTimeFormat('en', { weekday: 'long' }).format(at)} ${clock(at)}`

const SPARKS = '▁▂▃▄▅▆▇█'

/** One block per value, scaled to the largest: ▁▃▅█▂. */
export function sparkline(values: number[]): string {
  const max = Math.max(0, ...values)
  return values.map((v) => SPARKS[max ? Math.round((Math.max(0, v) / max) * (SPARKS.length - 1)) : 0]).join('')
}

const HEAT = '.░▒▓█'

/** One heatmap cell: . for nothing, then ░▒▓█ by share of the largest value. */
export function heat(value: number, max: number): string {
  if (value <= 0 || max <= 0) return HEAT[0]
  return HEAT[Math.min(HEAT.length - 1, Math.ceil((value / max) * (HEAT.length - 1)))]
}
