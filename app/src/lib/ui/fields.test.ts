import { describe, expect, it } from 'vitest'
import { clock, dashes, duration, hm, overGoal, pad } from './fields'
import { hourOf, hours } from './hours.svelte'

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

describe('clock', () => {
  it('reads a time of day on 24 or 12 hours', () => {
    const at = new Date(2026, 10, 17, 0, 5)
    expect(clock(at)).toBe('00:05')
    hours.twelve = true
    expect([clock(at), clock(new Date(2026, 10, 17, 13, 30))]).toEqual(['12:05 AM', '1:30 PM'])
    expect([hourOf(0), hourOf(12), hourOf(23)]).toEqual(['12 AM', '12 PM', '11 PM'])
    hours.twelve = false
    expect(hourOf(7)).toBe('07')
  })
})
