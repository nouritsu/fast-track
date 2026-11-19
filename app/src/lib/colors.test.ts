import { describe, expect, it } from 'vitest'
import indexHtml from '../../index.html?raw'
import { ACCENTS, accentName, colorsCss, DEFAULT_COLORS, sameColors, stepAccent, toColors, type Colors } from './colors'
import { DEFAULT_SETTINGS, toSettings } from './fasting/store'
import { STAGES } from './fasting/stages'

describe('colours', () => {
  it('has the 14 Catppuccin accents, and defaults that are among them', () => {
    expect(ACCENTS).toHaveLength(14)
    expect(new Set(ACCENTS).size).toBe(14)
    expect(Object.values(DEFAULT_COLORS).every((c) => ACCENTS.includes(c))).toBe(true)
  })

  it('colours the accent and every stage', () => {
    expect(Object.keys(DEFAULT_COLORS)).toEqual(['accent', ...STAGES.map((s) => s.id)])
  })

  it('reads each colour on its own, falling back to its default', () => {
    expect(toColors(null)).toEqual(DEFAULT_COLORS)
    expect(toColors('mauve')).toEqual(DEFAULT_COLORS)
    expect(toColors({ accent: 'teal', fat: 'green' })).toEqual({ ...DEFAULT_COLORS, accent: 'teal', fat: 'green' })
    expect(toColors({ accent: 'Teal', glucose: 'orange', fat: 3, ketosis: null, autophagy: 'pink' })).toEqual({
      ...DEFAULT_COLORS,
      autophagy: 'pink',
    })
  })

  it('lets stages share a colour', () => {
    const same = { accent: 'sky', glucose: 'sky', fat: 'sky', ketosis: 'sky', autophagy: 'sky' }
    expect(toColors(same)).toEqual(same)
  })

  it('is part of the settings, validated key by key', () => {
    expect(DEFAULT_SETTINGS.colors).toEqual(DEFAULT_COLORS)
    expect(toSettings({}).colors).toEqual(DEFAULT_COLORS)
    expect(toSettings({ colors: { ketosis: 'maroon', accent: 'nope' } }).colors).toEqual({ ...DEFAULT_COLORS, ketosis: 'maroon' })
    expect(toSettings({ colors: 7 }).colors).toEqual(DEFAULT_COLORS)
  })

  it('steps through the palette and round its ends', () => {
    expect(stepAccent('mauve', 1)).toBe('red')
    expect(stepAccent('mauve', -1)).toBe('pink')
    expect(stepAccent('lavender', 1)).toBe('rosewater')
    expect(stepAccent('rosewater', -1)).toBe('lavender')
    const back = ACCENTS.reduce((c) => stepAccent(c, 1), 'peach' as (typeof ACCENTS)[number])
    expect(back).toBe('peach')
  })

  it('names a colour and compares sets of them', () => {
    expect(accentName('sapphire')).toBe('Sapphire')
    expect(sameColors(DEFAULT_COLORS, { ...DEFAULT_COLORS })).toBe(true)
    expect(sameColors(DEFAULT_COLORS, { ...DEFAULT_COLORS, fat: 'yellow' })).toBe(false)
  })

  it('points each variable at its colour in the palette, for any element with a theme', () => {
    expect(colorsCss(DEFAULT_COLORS)).toBe(
      ':root,[data-theme]{--accent:var(--ctp-mauve);--glucose:var(--ctp-blue);--fat:var(--ctp-peach);--ketosis:var(--ctp-red);--autophagy:var(--ctp-mauve)}',
    )
  })
})

// index.html paints the theme and colours before the page does, and cannot import
// from here: run its script against a stand-in page, and hold it to this module.
describe('the first paint (index.html)', () => {
  function paint(storage: Record<string, string>, dark = true) {
    const code = /<script>([\s\S]*?)<\/script>/.exec(indexHtml)![1]
    const root = { dataset: {} as Record<string, string> }
    const meta = { content: '' }
    const styles: { id: string; textContent: string }[] = []
    const document = {
      documentElement: root,
      querySelector: () => meta,
      createElement: () => ({ id: '', textContent: '' }),
      head: { append: (style: { id: string; textContent: string }) => styles.push(style) },
    }
    const localStorage = { getItem: (key: string) => storage[key] ?? null }
    new Function('document', 'localStorage', 'matchMedia', code)(document, localStorage, () => ({ matches: dark }))
    return { theme: root.dataset.theme, themeColor: meta.content, styles }
  }

  it('shows the saved theme, and System as the device is', () => {
    expect(paint({}).theme).toBe('mocha')
    expect(paint({ theme: 'latte' }, true).theme).toBe('latte')
    expect(paint({ theme: 'mocha' }, false).theme).toBe('mocha')
    expect(paint({ theme: 'system' }, true).theme).toBe('mocha')
    expect(paint({ theme: 'system' }, false).theme).toBe('latte')
    expect(paint({ theme: 'system' }, false).themeColor).toBe('#eff1f5')
    expect(paint({ theme: 'other' }, false).theme).toBe('mocha')
  })

  it('applies the same rule as the app does for the saved colours', () => {
    const colors: Colors = { accent: 'teal', glucose: 'sky', fat: 'yellow', ketosis: 'maroon', autophagy: 'lavender' }
    const { styles } = paint({ colors: JSON.stringify(colors) })
    expect(styles).toHaveLength(1)
    expect(styles[0].id).toBe('colors')
    expect(styles[0].textContent).toBe(colorsCss(colors))
  })

  it('adds no rule without saved colours, and takes only the valid ones', () => {
    expect(paint({}).styles).toHaveLength(0)
    expect(paint({ colors: 'not json' }).styles).toHaveLength(0)
    expect(paint({ colors: '{"accent":"orange"}' }).styles).toHaveLength(0)
    const { styles } = paint({ colors: '{"accent":"orange","fat":"green"}' })
    expect(styles[0].textContent).toBe(':root,[data-theme]{--fat:var(--ctp-green)}')
  })

  it('lists the same accents as the app', () => {
    const names = /const names = '([^']+)'/.exec(indexHtml)![1].split(' ')
    expect(names).toEqual([...ACCENTS])
  })
})
