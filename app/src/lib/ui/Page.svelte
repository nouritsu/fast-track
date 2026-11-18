<script lang="ts">
  import type { Snippet } from 'svelte'
  import Block from './Block.svelte'

  // One page beside the Fast page: a block that fills the page's height, its
  // content scrolling inside the border.
  let { title, children }: { title: string; children: Snippet } = $props()
</script>

<Block {title} class="page-block">
  <div class="scroller">{@render children()}</div>
</Block>

<style>
  :global(.page-block) {
    height: 100%;
    box-sizing: border-box;
  }
</style>
