import { describe, expect, it } from 'vitest'
import { buzzFor, stillFor, textScale, twelveFor } from './display'
import { DEFAULT_SETTINGS, toSettings } from './fasting/store'
import { moveIn, PAGE_IDS, shownPages, startPageOf, STATS_PANES, toOrder, toSubset } from './layout'

describe('layout', () => {
  it('reads an order, keeping known ids once and adding missing ones at the end', () => {
    expect(toOrder(['info', 'fast', 'info', 'nope'], PAGE_IDS)).toEqual(['info', 'fast', 'calendar', 'stats', 'options'])
    expect(toOrder(undefined, PAGE_IDS)).toEqual([...PAGE_IDS])
  })

  it('keeps only allowed ids in a subset', () => {
    expect(toSubset(['stats', 'fast', 'stats'], ['calendar', 'stats', 'info'])).toEqual(['stats'])
    expect(toSubset('stats', ['stats'])).toEqual([])
  })

  it('moves an id one place, and not past the ends', () => {
    expect(moveIn(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c'])
    expect(moveIn(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c'])
  })

  it('never hides Fast or Options, and opens on a page that shows', () => {
    const shown = shownPages(['options', 'fast', 'info', 'stats', 'calendar'], ['fast', 'info'])
    expect(shown).toEqual(['options', 'fast', 'stats', 'calendar'])
    expect(startPageOf('info', shown)).toBe('options')
    expect(startPageOf('stats', shown)).toBe('stats')
  })

  it('checks the layout and display settings', () => {
    const s = toSettings({ pages: ['info'], hiddenPages: ['options', 'info'], startPage: 'nope', statsPanes: ['records'], textSize: 'huge', motion: 'off' })
    expect(s.pages).toEqual(['info', 'fast', 'calendar', 'stats', 'options'])
    expect(s.hiddenPages).toEqual(['info'])
    expect(s.startPage).toBe(DEFAULT_SETTINGS.startPage)
    expect(s.statsPanes).toEqual(['records', ...STATS_PANES.filter((p) => p !== 'records')])
    expect([s.textSize, s.motion, s.haptics]).toEqual(['system', 'off', 'system'])
  })
})

describe('display', () => {
  const phone = { fontScale: 1.3, animations: false, haptics: false, clock24: true }

  it('sizes text by the phone for System, else by the choice', () => {
    expect(textScale('system', phone)).toBe(1.3)
    expect(textScale('large', phone)).toBe(1.125)
  })

  it('holds motion still when asked, by the setting, the phone or the browser', () => {
    expect(stillFor('system', phone, false)).toBe(true)
    expect(stillFor('system', { ...phone, animations: true }, true)).toBe(true)
    expect(stillFor('system', { ...phone, animations: true }, false)).toBe(false)
    expect(stillFor('on', phone, true)).toBe(false)
    expect(stillFor('off', { ...phone, animations: true }, false)).toBe(true)
  })

  it('vibrates when on, or for System when the phone gives touch feedback', () => {
    expect(buzzFor('system', phone)).toBe(false)
    expect(buzzFor('system', { ...phone, haptics: true })).toBe(true)
    expect(buzzFor('on', phone)).toBe(true)
    expect(buzzFor('off', { ...phone, haptics: true })).toBe(false)
  })

  it('reads times on 12 hours for 12h, or for System when the phone does', () => {
    expect(twelveFor('system', phone)).toBe(false)
    expect(twelveFor('system', { ...phone, clock24: false })).toBe(true)
    expect(twelveFor('12h', phone)).toBe(true)
    expect(twelveFor('24h', { ...phone, clock24: false })).toBe(false)
  })
})
