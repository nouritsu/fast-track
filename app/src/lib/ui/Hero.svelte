<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import { plan, reducedMotion, runShuffle } from '../motion/shuffle'

  // The screen's main word or number: bold, fitted to the width of the nearest
  // .stage between 1.5x and 3x the base size; nothing else on the screen scales.
  // With `animate` it shuffles in when it mounts and calls onDone once the last
  // letter locks; later changes show at once (a ticking clock).
  let { text, animate = false, onDone }: { text: string; animate?: boolean; onDone?: () => void } = $props()

  let shuffled = $state<string | null>(untrack(() => animate) ? '' : null) // the frame while it shuffles
  const shown = $derived(shuffled ?? text)

  onMount(() => {
    if (!animate || reducedMotion()) {
      shuffled = null
      onDone?.()
      return
    }
    const target = text
    return runShuffle(
      target,
      plan(target),
      (frame) => (shuffled = frame),
      () => {
        shuffled = null
        onDone?.()
      },
    )
  })
</script>

<span class="hero" style:--chars={text.length}>{shown}</span>

<style>
  .hero {
    display: block;
    width: 100%;
    text-align: center;
    white-space: nowrap;
    font-weight: 700;
    line-height: 1.15;
    font-size: clamp(1.5rem, calc(100cqi / (var(--chars) * 0.56)), 3rem);
  }
</style>
