<script lang="ts">
  import type { Snippet } from 'svelte'
  import Block from './Block.svelte'

  // One page beside the Fast page: a block that fills the page's height, its
  // content scrolling inside the border.
  let { title, children }: { title: string; children: Snippet } = $props()
</script>

<Block {title} class="page-block">
  <div class="content">{@render children()}</div>
</Block>

<style>
  :global(.page-block) {
    height: 100%;
    box-sizing: border-box;
  }

  /* Scrolls up and down only: a sideways drag stays a page swipe. Inside a scroller
     the WebView ignores .pages' own pan-y, takes a sideways drag and cancels the swipe. */
  .content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    touch-action: pan-y;
    overscroll-behavior: contain;
    padding-top: 0.3em;
  }

  .content :global(p) {
    margin: 0.3em 0;
  }
</style>
