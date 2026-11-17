// The scan-line flip (FlipBlock): a glowing line in the accent colour carries the
// block's title along the top border to the right edge, shuffling it into its
// mirror image, and the back comes in behind the line, every character scrambling
// as the line passes. After a hold, the line carries the title back to the left
// and the new face comes in behind it.

import { FRAME_MS, frame, sweepPool, type ShufflePlan } from './shuffle'

export const SWEEP_MS = 400 // one pass of the line; Block's title travels in the same time
export const SCRAMBLE_MS = 150 // a character settles this long after the line passed it
export const HOLD_MS = 400 // the back stays this long
// The line's centre sits this far in from either edge of the block's content: the
// title's 0.6ch padding plus half a character, so it runs under the title's first
// letter at the start and its last at the end.
export const REACH_CH = 1.1

/** The title as seen from the back: Timer → remiT. */
export function mirrored(title: string): string {
  return [...title].reverse().join('')
}

function textNodes(root: Node): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    if (node.data.trim()) nodes.push(node)
  }
  return nodes
}

/** The line runs across `root` in `sweepMs`, from the left or from the right,
 *  between `reach` px in from either edge: each character scrambles from the start
 *  and settles `scrambleMs` after the line has passed it. The flip clips away what
 *  the line has not reached yet. */
export function sweepIn(root: HTMLElement, sweepMs: number, scrambleMs: number, fromRight = false, reach = 0): void {
  const box = root.getBoundingClientRect()
  const span = box.width - 2 * reach
  if (span <= 0) return
  const range = document.createRange()
  const moving = textNodes(root).map((node) => {
    const lockAt: number[] = []
    let offset = 0
    for (const ch of node.data) {
      range.setStart(node, offset)
      range.setEnd(node, offset + ch.length)
      const rect = range.getBoundingClientRect()
      const x = Math.min(1, Math.max(0, (rect.left + rect.width / 2 - box.left - reach) / span))
      lockAt.push((fromRight ? 1 - x : x) * sweepMs + scrambleMs)
      offset += ch.length
    }
    const shuffle: ShufflePlan = { lockAt, duration: sweepMs + scrambleMs }
    return { node, target: node.data, shuffle, written: node.data }
  })
  const start = performance.now()
  let lastSwap = -Infinity
  const tick = (now: number) => {
    const elapsed = now - start
    const done = elapsed >= sweepMs + scrambleMs
    if (!done && now - lastSwap < FRAME_MS) return void requestAnimationFrame(tick)
    lastSwap = now
    for (const item of moving) {
      if (item.node.data !== item.written) continue // the app has written it since
      item.written = done ? item.target : frame(item.target, item.shuffle, elapsed, Math.random, sweepPool)
      item.node.data = item.written
    }
    if (!done) requestAnimationFrame(tick)
  }
  tick(start)
}
