<script lang="ts">
  import type { Snippet } from 'svelte'
  import Block from './Block.svelte'
  import type { IconName } from './Icon.svelte'

  // One page beside the Fast page: a block that fills the page's height, its
  // content scrolling inside the border.
  let { title, icon, children }: { title: string; icon?: IconName; children: Snippet } = $props()
</script>

<Block {title} {icon} class="page-block">
  <div class="scroller">{@render children()}</div>
</Block>

<style>
  :global(.page-block) {
    height: 100%;
    box-sizing: border-box;
  }
</style>
