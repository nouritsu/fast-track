import { describe, expect, it } from 'vitest'
import { apportion, spread, stageCells } from './progress'

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

  it('hatches the shortfall of a near miss in the colours of the stages it would have reached', () => {
    // 16h goal at 75%: 9 of 12 cells filled, the last 3 (12–16h, ketosis) hatched.
    expect(stageCells(STARTS, COLORS, 0.75, 12, true)).toEqual([
      { text: '███', color: 'glucose' },
      { text: '██████', color: 'fat' },
      { text: '╱╱╱', color: 'ketosis', hatched: true },
    ])
  })

  it('spreads cells over runs by their spans, exactly and at least one each', () => {
    expect(spread([4, 8, 12, 12], 36)).toEqual([4, 8, 12, 12])
    const wide = spread([4, 8, 12, 12], 42)
    expect(wide.reduce((a, b) => a + b, 0)).toBe(42)
    expect(wide).toEqual([5, 9, 14, 14])
    expect(spread([1, 100], 3)).toEqual([1, 2])
  })
})

describe('apportion', () => {
  it('shares cells by size, exactly, with none for nothing', () => {
    expect(apportion([92, 184, 105, 0], 40)).toEqual([10, 19, 11, 0])
    expect(apportion([1, 1, 1], 10).reduce((a, b) => a + b, 0)).toBe(10)
    expect(apportion([0, 0], 5)).toEqual([0, 0])
  })
})
