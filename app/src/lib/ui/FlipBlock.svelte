<script lang="ts" generics="T">
  import { tick, untrack, type Snippet } from 'svelte'
  import { reducedMotion } from '../motion/shuffle'
  import { HOLD_MS, mirrored, REACH_CH, SCRAMBLE_MS, SWEEP_MS, sweepIn } from '../motion/sweep'
  import Block, { type Tone } from './Block.svelte'
  import ShuffleText from './ShuffleText.svelte'

  // The main block with the scan-line flip (motion/sweep.ts). `face` draws the
  // block for a value. When `value` changes and `flips(from, to)` says so, the old
  // face stays until the back covers it: a glowing line carries the title to the
  // right edge, mirrored, the back coming in behind it; after a hold the line
  // carries the title back and the new face comes in. Other changes, and every
  // change under reduced motion, show at once. `header(value)` sits above the face,
  // under a split, and flips with it. `footer` sits under a split and stays put, as
  // do `actions` in the bottom edge and `headingRight`.
  let {
    title,
    value,
    flips = (from: T, to: T) => from !== to,
    face,
    header,
    back,
    footer,
    actions,
    headingRight,
    tone = '',
    class: className = '',
  }: {
    title: string
    value: T
    flips?: (from: T, to: T) => boolean
    face: Snippet<[T]>
    header?: Snippet<[T]>
    back: Snippet
    footer?: Snippet
    actions?: Snippet
    headingRight?: Snippet
    tone?: Tone
    class?: string
  } = $props()

  let shown = $state.raw(untrack(() => value)) // what the face draws
  let showBack = $state(false)
  let scanning = $state(false) // the line shows
  // The title, the line and the back's edge all move on this one flag, with the
  // same 0.4 s linear transition, so they start in the same frame and stay together.
  let titleEnd = $state(false)
  let held = $state(false) // the back covers the block edge to edge
  let flipping = false
  let faceEl = $state<HTMLElement>()
  let backEl = $state<HTMLElement>()

  $effect(() => {
    void value // follow the value
    untrack(sync)
  })

  /** Brings the face up to the value: a flip, or at once. A running flip lands on
   *  the latest value itself and calls this again when it is done. */
  function sync() {
    if (flipping) return
    if (flips(shown, value) && !reducedMotion()) void flip()
    else shown = value
  }

  async function flip() {
    flipping = true
    try {
      showBack = true
      await tick()
      await sweep(backEl, true)
      held = true
      await wait(HOLD_MS)
      shown = value
      held = false
      await tick()
      await sweep(faceEl, false)
    } finally {
      showBack = false
      held = false
      titleEnd = false
      scanning = false
      flipping = false
    }
    sync()
  }

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  /** One pass of the line: out to the right, the back comes in behind it; back to
   *  the left, the back peels away and shows the new face. */
  async function sweep(incoming: HTMLElement | undefined, out: boolean) {
    if (!incoming || !backEl) return
    const reach = REACH_CH * 0.5 * parseFloat(getComputedStyle(backEl).fontSize) // Iosevka's ch is half an em
    void getComputedStyle(backEl).clipPath // settle the back's starting edge, so it transitions from there
    sweepIn(incoming, SWEEP_MS, SCRAMBLE_MS, !out, reach)
    titleEnd = out
    scanning = true
    await wait(SWEEP_MS)
    scanning = false
  }
</script>

<Block {tone} {titleEnd} {actions} {headingRight} class={className}>
  {#snippet heading()}<ShuffleText text={titleEnd ? mirrored(title) : title} staggerMs={80} />{/snippet}
  <div class="turn" class:out={titleEnd} class:held style:--reach="{REACH_CH}ch">
    <div class="face" bind:this={faceEl}>
      {#if header}
        {@render header(shown)}
        <hr class="split" />
      {/if}
      <div class="stage">{@render face(shown)}</div>
    </div>
    {#if showBack}
      <div class="back" bind:this={backEl}>{@render back()}</div>
    {/if}
    <div class="scan" class:scanning></div>
  </div>
  {#if footer}
    <hr class="split" />
    {@render footer()}
  {/if}
</Block>

<style>
  .face {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .turn {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  /* The back covers the face from its left edge up to the line, --reach in from
     either edge. Its side margins keep its content inside the line's reach, so all
     of it comes in behind the line. */
  .back {
    position: absolute;
    inset: 0;
    padding-inline: 1.6ch;
    display: grid;
    place-items: center;
    background: var(--bg);
    container-type: inline-size;
    clip-path: inset(0 calc(100% - var(--reach)) 0 0);
    transition: clip-path 0.4s linear;
  }

  .out .back {
    clip-path: inset(0 var(--reach) 0 0);
  }

  .held .back {
    clip-path: none;
    transition: none;
  }

  /* The line: a bright bar in the accent colour, glowing. It reaches up to the
     title on the border and travels under it. */
  .scan {
    position: absolute;
    top: -0.15em;
    bottom: 0;
    left: var(--reach);
    width: 0.5ch;
    transform: translateX(-50%);
    background: var(--accent);
    box-shadow: 0 0 0.8em var(--accent);
    pointer-events: none;
    visibility: hidden;
    transition: left 0.4s linear;
  }

  .scan.scanning {
    visibility: visible;
  }

  .out .scan {
    left: calc(100% - var(--reach));
  }
</style>
