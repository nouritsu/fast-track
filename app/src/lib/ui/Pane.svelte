<script lang="ts">
  import type { Snippet } from 'svelte'
  import Block from './Block.svelte'

  // A pane as tall as its content, hung just below its page: App slides the page up by
  // the pane's height to bring it in, pushing as much of the page's panel off the top
  // as it needs, and back down to put it away. Taller than the page, it scrolls inside.
  // Close is set into its bottom edge on the left; `action`, the pane's own primary
  // button (an edge button), on the right. Escape closes it too.
  let {
    title,
    onClose,
    children,
    action,
  }: { title: string; onClose: () => void; children: Snippet; action?: Snippet } = $props()

  // Content taller than the pane scrolls natively; otherwise a vertical drag on it
  // pulls the pane down (App's .hang).
  let content = $state<HTMLElement>()
  let scrolls = $state(false)

  $effect(() => {
    const el = content
    if (!el) return
    const measure = () => (scrolls = el.scrollHeight > el.clientHeight + 1)
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    measure()
    return () => observer.disconnect()
  })

  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') onClose()
  }
</script>

<svelte:window onkeydown={keydown} />

<div
  class="pane"
  role="dialog"
  aria-modal="true"
  aria-label={title}
>
  <Block {title}>
    <div class="content" class:scrolls bind:this={content}>{@render children()}</div>
    {#snippet actions()}
      <button type="button" class="edge" onclick={onClose}><span class="icon" aria-hidden="true">✕</span>Close</button>
      {#if action}{@render action()}{/if}
    {/snippet}
  </Block>
</div>

<style>
  /* The page's own padding: room for the title above and the buttons below. Within
     App's .hang it shrinks to the page's height at most, its content scrolling. */
  .pane {
    min-height: 0;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    padding: 1em 0.6em 1.3em;
  }

  .content {
    flex: 1;
    min-height: 0;
    touch-action: none;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-top: 0.3em;
  }

  .content.scrolls {
    touch-action: pan-y;
  }

  .content :global(p) {
    margin: 0.3em 0;
  }
</style>
