<script lang="ts">
  import type { Snippet } from 'svelte'
  import { drag, stepsAt } from './drag'
  import { tick } from './haptics'
  import { hold } from './hold'

  // A field set with < > instead of typing, TUI style: a muted label, the value at a
  // fixed width (or `children`, when it needs markup), and the two glyph buttons, which
  // repeat while held. A sideways swipe across the row scrubs it: a step every STEP_PX,
  // right for later, with a tick. `onStep` is told when a step is one of a repeat or a
  // scrub, not a tap.
  const STEP_PX = 28
  let {
    label,
    value = '',
    children,
    labelWidth = 5,
    width = 10,
    onStep,
    atStart = false,
    atEnd = false,
  }: {
    label: string
    value?: string
    children?: Snippet // in place of `value`
    labelWidth?: number // the label's width in characters
    width?: number // the value's width in characters, so nothing moves as it changes
    onStep: (direction: -1 | 1, repeating: boolean) => void
    atStart?: boolean
    atEnd?: boolean
  } = $props()

  let taken = 0 // steps the scrub has applied so far
  const scrub = {
    axis: 'x' as const,
    onStart: () => (taken = 0),
    onMove: (dx: number) => {
      const want = stepsAt(dx, STEP_PX)
      while (taken !== want) {
        const direction = want > taken ? 1 : -1
        if ((direction > 0 && atEnd) || (direction < 0 && atStart)) return
        onStep(direction, true)
        taken += direction
        tick()
      }
    },
    onEnd: () => (taken = 0),
  }
</script>

<div class="stepper" use:drag={scrub}>
  <span class="label muted" style:width="{labelWidth}ch">{label}</span>
  <span class="setting" style:min-width="{width}ch">{#if children}{@render children()}{:else}{value}{/if}</span>
  <button
    type="button"
    class="glyph"
    aria-label="{label} earlier"
    title="{label} earlier"
    disabled={atStart}
    use:hold={(repeating) => onStep(-1, repeating)}>&lt;</button
  >
  <button
    type="button"
    class="glyph"
    aria-label="{label} later"
    title="{label} later"
    disabled={atEnd}
    use:hold={(repeating) => onStep(1, repeating)}>&gt;</button
  >
</div>

<style>
  .stepper {
    touch-action: pan-y;
    display: flex;
    align-items: center;
    gap: 1ch;
    margin: 0.25em 0;
  }

  .setting {
    flex: 1;
    white-space: pre;
  }

</style>
