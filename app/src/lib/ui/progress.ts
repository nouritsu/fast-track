// The goal's progress as a line of text under the timer: each filled cell in the
// colour of the stage it falls in. Shares are fractions of the goal, from 0 to 1.

export interface Run {
  text: string
  color: string | null // a stage's colour token, or null for the part still to come
}

/** The same progress as a line of text under the timer: `cells` blocks, each filled
 *  one in the colour of the stage it falls in, the rest light shade, grouped into
 *  runs of one colour so each run is one span. */
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
