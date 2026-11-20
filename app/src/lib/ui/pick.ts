// Reading a chart by touch: a tap, or a sideways drag across it, picks what lies under
// the finger, at `x` and `y` from the chart's top left. The press is kept from the
// page's swipe; a drag that goes up or down is left to scroll the page.

import { lockAxis } from './drag'

/** `tap` is true for a press that did not move, which may also unpick. */
export type OnPick = (x: number, y: number, tap: boolean) => void

export function pick(node: Element, onPick: OnPick) {
  let current = onPick
  let press: { id: number; x: number; y: number; sideways: boolean } | null = null

  const at = (event: PointerEvent, tap: boolean) => {
    const box = node.getBoundingClientRect()
    current(event.clientX - box.left, event.clientY - box.top, tap)
  }

  const down = (event: Event) => {
    const e = event as PointerEvent
    if (e.button !== 0) return
    e.stopPropagation()
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, sideways: false }
  }

  const move = (event: Event) => {
    const e = event as PointerEvent
    if (!press || e.pointerId !== press.id) return
    if (!press.sideways) {
      const axis = lockAxis(e.clientX - press.x, e.clientY - press.y)
      if (!axis) return
      if (axis === 'y') return void (press = null)
      press.sideways = true
      try {
        node.setPointerCapture(press.id)
      } catch {
        // a synthetic or finished pointer: follow it without capture
      }
    }
    at(e, false)
  }

  const up = (event: Event) => {
    const e = event as PointerEvent
    if (!press || e.pointerId !== press.id) return
    if (!press.sideways) at(e, true)
    press = null
  }

  const cancel = () => (press = null)

  node.addEventListener('pointerdown', down)
  node.addEventListener('pointermove', move)
  node.addEventListener('pointerup', up)
  node.addEventListener('pointercancel', cancel)
  return {
    update(next: OnPick) {
      current = next
    },
    destroy() {
      node.removeEventListener('pointerdown', down)
      node.removeEventListener('pointermove', move)
      node.removeEventListener('pointerup', up)
      node.removeEventListener('pointercancel', cancel)
    },
  }
}
