import { describe, expect, it } from 'vitest'
import { dashes, duration, hm, pad } from './fields'

describe('fields', () => {
  it('pads and dashes at the same width', () => {
    expect(pad(7, 3)).toBe('  7')
    expect(dashes(pad(7, 3))).toBe('---')
    expect(dashes('04:12')).toBe('--:--')
  })

  it('draws durations', () => {
    expect(duration(65_000)).toBe('01:05')
    expect(duration(3_725_000)).toBe('1:02:05')
    expect(hm(16 * 3_600_000 + 34 * 60_000 + 20_000)).toBe('16:34')
    expect(hm(59_000)).toBe('0:01')
  })
})
