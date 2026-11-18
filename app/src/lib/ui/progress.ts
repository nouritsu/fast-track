// The goal's progress as a line of text under the timer: each filled cell in the
// colour of the stage it falls in. Shares are fractions of the goal, from 0 to 1.

export interface Run {
  text: string
  color: string | null // a stage's colour token, or null for the part still to come
}

/** The goal's progress in `cells` blocks under the timer: each filled one in the colour
 *  of the stage it falls in, the rest light shade, grouped into runs of one colour so
 *  each run is one span. */
export function stageCells(starts: number[], colors: string[], progress: number, cells = 24): Run[] {
  const filled = Math.round(Math.min(1, Math.max(0, progress)) * cells)
  const runs: Run[] = []
  for (let i = 0; i < cells; i++) {
    const at = (i + 0.5) / cells // the middle of the cell, as a share of the goal
    let stage = 0
    starts.forEach((from, s) => {
      if (at >= from) stage = s
    })
    const color = i < filled ? colors[stage] : null
    const text = i < filled ? '█' : '░'
    const last = runs.at(-1)
    if (last && last.color === color) last.text += text
    else runs.push({ text, color })
  }
  return runs
}

/** `cells` shared among `values` by size, the total exact (largest remainders take the
 *  cells rounding leaves over), and a value of nothing getting none. */
export function apportion(values: number[], cells: number): number[] {
  const total = values.reduce((a, b) => a + Math.max(0, b), 0)
  if (total <= 0) return values.map(() => 0)
  const exact = values.map((v) => (Math.max(0, v) / total) * cells)
  const counts = exact.map(Math.floor)
  const order = exact.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0])
  for (let k = 0, left = cells - counts.reduce((a, b) => a + b, 0); k < left; k++) counts[order[k][1]]++
  return counts
}

/** `cells` shared among runs as their `spans` are, the total exact: one cell each,
 *  then the rest apportioned. */
export const spread = (spans: number[], cells: number): number[] =>
  apportion(spans, Math.max(0, cells - spans.length)).map((count) => count + 1)
