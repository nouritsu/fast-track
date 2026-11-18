<script lang="ts">
  import { reducedMotion } from '../motion/shuffle'
  import { typingDelay, typingPieces } from '../motion/typing'

  // Text typed out left to right behind an accent block cursor; `hl` marks a span
  // [start, end) bold and underlined. The untyped rest holds its place, invisible.
  let { text, hl = [0, 0] }: { text: string; hl?: [number, number] } = $props()
  let typed = $state(0)

  $effect(() => {
    const length = text.length
    if (reducedMotion()) {
      typed = length
      return
    }
    typed = 0
    const delay = typingDelay(length)
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      typed = Math.min(length, Math.floor((now - start) / delay))
      if (typed < length) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  })

  const pieces = $derived(typingPieces(text, hl, typed))
</script>

{#each pieces as piece, i (i)}{#if piece.mark}<mark class={piece.state}>{piece.text}</mark>{:else}<span
      class={piece.state}>{piece.text}</span
    >{/if}{/each}

<style>
  mark {
    background: none;
    color: inherit;
    font-weight: 700;
    text-decoration: underline;
  }

  .untyped {
    visibility: hidden;
  }

  .cursor {
    background: var(--accent);
    color: transparent;
  }
</style>
