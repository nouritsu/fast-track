// A block that unfolds below the one that opens it, in a column of panes (app.css
// .panes): it grows from nothing and pushes the blocks below it down, and folds back
// up when it closes. Its wrapper (.unfold) carries the column's gap inside it, so
// nothing jumps at either end.

import { cubicOut } from 'svelte/easing'
import { reducedMotion } from './shuffle'

const UNFOLD_MS = 240

export function unfold(node: HTMLElement) {
  const height = node.offsetHeight
  return {
    duration: reducedMotion() ? 0 : UNFOLD_MS,
    easing: cubicOut,
    css: (t: number) => `height: ${t * height}px; overflow: clip`,
  }
}
