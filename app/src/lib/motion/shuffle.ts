// The letter shuffle: every letter cycles random letters of its own case, every
// digit random digits, and each locks in place from left to right. Spaces and
// punctuation stay still. Add the content language's letters to the pools
// (German: ÄÖÜ and äöüß) so they shuffle too.

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const LOWER = 'abcdefghijklmnopqrstuvwxyz'
const DIGITS = '0123456789'
const MARKS = "_|/\\()',.-`" // what ASCII art is drawn with

export const FRAME_MS = 40 // glyphs change at most this often: a terminal's pace, not the display's
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

export interface ShufflePlan {
  lockAt: number[] // ms after the start at which each character is final
  duration: number
}

/** What a character cycles through, or nothing for spaces and punctuation. */
export function pool(ch: string): string | null {
  if (DIGITS.includes(ch)) return DIGITS
  if (ch.toLowerCase() === ch.toUpperCase()) return null
  return ch === ch.toLowerCase() ? LOWER : UPPER
}

/** What a character scrambles through as a scan line passes it: letters and
 *  digits as in the shuffle, ASCII-art marks among themselves. */
export function sweepPool(ch: string): string | null {
  return pool(ch) ?? (MARKS.includes(ch) ? MARKS : null)
}

/** Characters lock `staggerMs` apart, compressed so the whole text takes at most `maxMs`. */
export function plan(text: string, staggerMs = 50, maxMs = 700): ShufflePlan {
  const chars = [...text]
  const moving = chars.filter(pool).length
  const stagger = moving ? Math.min(staggerMs, maxMs / moving) : 0
  let locked = 0
  const lockAt = chars.map((ch) => (pool(ch) ? stagger * ++locked : 0))
  return { lockAt, duration: stagger * moving }
}

/** The text as shown `elapsed` ms into the shuffle. */
export function frame(
  text: string,
  shuffle: ShufflePlan,
  elapsed: number,
  random: () => number = Math.random,
  pick: (ch: string) => string | null = pool,
): string {
  return [...text]
    .map((ch, i) => {
      const chars = pick(ch)
      if (!chars || elapsed >= shuffle.lockAt[i]) return ch
      return chars[Math.floor(random() * chars.length)]
    })
    .join('')
}

/** Runs `shuffle` over `text`, calling `show` with each frame (at most every
 *  FRAME_MS) and last with `text` itself. Returns a function that stops it. */
export function runShuffle(text: string, shuffle: ShufflePlan, show: (text: string) => void, onDone?: () => void): () => void {
  const start = performance.now()
  let lastSwap = -Infinity
  let raf = 0
  const tick = (now: number) => {
    const elapsed = now - start
    if (elapsed >= shuffle.duration) {
      show(text)
      onDone?.()
      return
    }
    if (now - lastSwap >= FRAME_MS) {
      show(frame(text, shuffle, elapsed))
      lastSwap = now
    }
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(raf)
}
