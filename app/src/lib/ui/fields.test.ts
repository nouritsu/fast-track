import { describe, expect, it } from 'vitest'
import { bar, dashes, duration, heat, pad, sparkline } from './fields'

describe('fields', () => {
  it('pads and dashes at the same width', () => {
    expect(pad(7, 3)).toBe('  7')
    expect(dashes(pad(7, 3))).toBe('---')
    expect(dashes('04:12')).toBe('--:--')
    expect(dashes(bar(0.5))).toBe('[------------]')
  })

  it('draws bars, durations and charts', () => {
    expect(bar(0.5)).toBe('[######......]')
    expect(bar(2)).toBe('[############]')
    expect(duration(65_000)).toBe('01:05')
    expect(duration(3_725_000)).toBe('1:02:05')
    expect(sparkline([0, 4, 8])).toBe('▁▅█')
    expect([0, 1, 5, 10].map((v) => heat(v, 10)).join('')).toBe('.░▒█')
  })
})
