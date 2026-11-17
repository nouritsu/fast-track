import { describe, expect, it } from 'vitest'
import { stageCells } from './progress'

// A 16h goal: stages start at 0, 4, 12 and 24 hours.
const STARTS = [0, 4 / 16, 12 / 16, 24 / 16]
const COLORS = ['glucose', 'fat', 'ketosis', 'autophagy']

describe('progress line', () => {
  it('writes the same progress as coloured cells, one run per stage', () => {
    // 16h goal at 50%: 0–4h of 16 is 3 of 12 cells, 4–8h the next 3, the rest unfilled.
    expect(stageCells(STARTS, COLORS, 0.5, 12)).toEqual([
      { text: '███', color: 'glucose' },
      { text: '███', color: 'fat' },
      { text: '░░░░░░', color: null },
    ])
    expect(stageCells(STARTS, COLORS, 2, 12).map((r) => r.color)).toEqual(['glucose', 'fat', 'ketosis'])
    expect(stageCells(STARTS, COLORS, 0, 12)).toEqual([{ text: '░'.repeat(12), color: null }])
  })
})
