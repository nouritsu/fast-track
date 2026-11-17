<script lang="ts" module>
  export type Tone = '' | 'ok' | 'warn' | 'bad'
</script>

<script lang="ts">
  import type { Snippet } from 'svelte'

  // A ratatui-style block: a rounded 1px border with titles set into its top edge.
  // `heading` replaces the left title when it needs markup (a live value), and
  // `headingRight` the right one. `tone` fades the border, and a .value in the
  // title, to ok, warn or bad. `titleEnd` slides the left title to the right edge
  // (FlipBlock), and the right title steps aside meanwhile. `actions` are buttons
  // set into the bottom edge, the way the titles sit in the top one.
  let {
    title = '',
    titleRight = '',
    titleEnd = false,
    tone = '',
    heading,
    headingRight,
    actions,
    children,
    class: className = '',
  }: {
    title?: string
    titleRight?: string
    titleEnd?: boolean
    tone?: Tone
    heading?: Snippet
    headingRight?: Snippet
    actions?: Snippet
    children: Snippet
    class?: string
  } = $props()
</script>

<section
  class="block {className}"
  class:with-actions={actions}
  style:--block-border={tone ? `var(--${tone})` : undefined}
>
  {#if heading}
    <h2 class="title left" class:end={titleEnd}>{@render heading()}</h2>
  {:else if title}
    <h2 class="title left" class:end={titleEnd}>{title}</h2>
  {/if}
  {#if headingRight}
    <span class="title right" class:aside={titleEnd}>{@render headingRight()}</span>
  {:else if titleRight}
    <span class="title right" class:aside={titleEnd}>{titleRight}</span>
  {/if}
  {@render children()}
  {#if actions}<div class="actions">{@render actions()}</div>{/if}
</section>

<style>
  .block {
    position: relative;
    min-height: 0;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--block-border, var(--border));
    border-radius: var(--radius);
    padding: 0.7em 1ch 0.4em;
    transition: border-color 0.8s ease;
  }

  /* Room above the bottom edge for the buttons set into it. */
  .block.with-actions {
    padding-bottom: 1.3em;
  }

  .title {
    position: absolute;
    top: -0.62em;
    margin: 0;
    padding: 0 0.6ch;
    background: var(--bg);
    color: var(--accent);
    font: inherit;
    line-height: 1.2;
    white-space: nowrap;
  }

  /* Linear and 0.4 s, so the title moves with FlipBlock's scan line (SWEEP_MS). */
  .left {
    left: 1ch;
    transition:
      left 0.4s linear,
      transform 0.4s linear;
  }

  .left.end {
    left: calc(100% - 1ch);
    transform: translateX(-100%);
  }

  .right {
    right: 1ch;
    transition: opacity 0.2s ease;
  }

  .right.aside {
    opacity: 0;
  }

  /* The bottom edge's buttons: a row centred on the border line, each cutting the
     line with the page's background like a title. Their tap area reaches above and
     below the line. */
  .actions {
    position: absolute;
    left: 0.4ch;
    right: 0.4ch;
    bottom: 0;
    transform: translateY(50%);
    display: flex;
    justify-content: space-between;
    align-items: center;
    pointer-events: none;
  }

  .actions > :global(*) {
    pointer-events: auto;
  }
</style>
