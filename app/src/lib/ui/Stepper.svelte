<script lang="ts">
  import { drag, stepsAt } from './drag'
  import { tick } from './haptics'
  import { hold } from './hold'

  // A field set with < > instead of typing, TUI style: a muted label, the value at a
  // fixed width, and the two glyph buttons, which repeat while held. A sideways swipe
  // across the row scrubs it: a step every STEP_PX, right for later, with a tick.
  const STEP_PX = 28
  let {
    label,
    value,
    width = 10,
    onStep,
    atStart = false,
    atEnd = false,
  }: {
    label: string
    value: string
    width?: number // the value's width in characters, so nothing moves as it changes
    onStep: (direction: -1 | 1) => void
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
        onStep(direction)
        taken += direction
        tick()
      }
    },
    onEnd: () => (taken = 0),
  }
</script>

<div class="stepper" use:drag={scrub}>
  <span class="label muted">{label}</span>
  <span class="setting" style:min-width="{width}ch">{value}</span>
  <button type="button" class="glyph" aria-label="{label} earlier" title="{label} earlier" disabled={atStart} use:hold={() => onStep(-1)}
    >&lt;</button
  >
  <button type="button" class="glyph" aria-label="{label} later" title="{label} later" disabled={atEnd} use:hold={() => onStep(1)}
    >&gt;</button
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

  .label {
    min-width: 5ch;
  }

  .setting {
    flex: 1;
    white-space: pre;
  }

</style>
