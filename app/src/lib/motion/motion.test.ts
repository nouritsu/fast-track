import { describe, expect, it } from 'vitest'
import { frame, plan, pool } from './shuffle'
import { mirrored } from './sweep'
import { typingDelay, typingPieces } from './typing'

describe('shuffle', () => {
  it('cycles letters within their case and digits among digits', () => {
    expect(pool('a')).toMatch(/^[a-z]+$/)
    expect(pool('Q')).toMatch(/^[A-Z]+$/)
    expect(pool('7')).toBe('0123456789')
    expect(pool(' ')).toBeNull()
    expect(pool(':')).toBeNull()
  })

  it('locks left to right and never runs past maxMs', () => {
    const shuffle = plan('00:42', 50, 700)
    expect(shuffle.lockAt).toEqual([50, 100, 0, 150, 200])
    expect(plan('x'.repeat(100), 50, 700).duration).toBe(700)
  })

  it('shows the text itself once every character has locked', () => {
    const shuffle = plan('Ready')
    expect(frame('Ready', shuffle, shuffle.duration)).toBe('Ready')
    expect(frame('Ready', shuffle, 0, () => 0)).toBe('Aaaaa')
  })
})

describe('typing', () => {
  it('types long text faster, within maxMs', () => {
    expect(typingDelay(10)).toBe(30)
    expect(typingDelay(100)).toBe(10)
  })

  it('keeps the highlight whole and shows the next character as the cursor', () => {
    const pieces = typingPieces('Started at 22:10.', [11, 16], 12)
    expect(pieces.map((p) => [p.text, p.mark, p.state])).toEqual([
      ['Started at ', false, 'typed'],
      ['2', true, 'typed'],
      ['2', true, 'cursor'],
      [':10', true, 'untyped'],
      ['.', false, 'untyped'],
    ])
  })
})

describe('sweep', () => {
  it('mirrors the title', () => {
    expect(mirrored('Timer')).toBe('remiT')
  })
})
