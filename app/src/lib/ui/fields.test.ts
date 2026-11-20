import { describe, expect, it } from 'vitest'
import { dashes, duration, hm, overGoal, pad } from './fields'

describe('fields', () => {
  it('pads and dashes at the same width', () => {
    expect(pad(7, 3)).toBe('  7')
    expect(dashes(pad(7, 3))).toBe('---')
    expect(dashes('04:12')).toBe('--:--')
  })

  it('draws durations', () => {
    expect(duration(65_000)).toBe('01:05')
    expect(duration(3_725_000)).toBe('1:02:05')
    expect(hm(16 * 3_600_000 + 4 * 60_000 + 20_000)).toBe('16h 04m')
    expect(hm(7 * 3_600_000)).toBe('7h')
    expect(hm(59_000)).toBe('1m')
    expect(hm(0)).toBe('0m')
    expect(overGoal(30 * 60_000)).toBe('30m over')
    expect(overGoal(-80 * 60_000)).toBe('1h 20m short')
    expect(overGoal(-20_000)).toBe('on goal')
  })
})
