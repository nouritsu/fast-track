<script lang="ts">
  import { MONTHS } from '../fasting/time'
  import Icon from '../ui/Icon.svelte'
  import Pane from '../ui/Pane.svelte'

  // Which month the calendar shows: the twelve as buttons, the shown one lit; picking
  // one shows it and closes. Today goes back to this month.
  let {
    month,
    onPick,
    onToday,
    onClose,
  }: { month: number; onPick: (month: number) => void; onToday: () => void; onClose: () => void } = $props()
</script>

<Pane title="Month" icon="calendar_month" {onClose}>
  <div class="months">
    {#each MONTHS as name, i (name)}
      <button type="button" class="word" class:lit={i === month} aria-pressed={i === month} onclick={() => onPick(i)}>{name.slice(0, 3)}</button>
    {/each}
  </div>
  {#snippet action()}
    <button type="button" class="edge primary" onclick={onToday}><span class="icon" aria-hidden="true"><Icon name="today" /></span>Today</button>
  {/snippet}
</Pane>

<style>
  .months {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.4em 1ch;
    justify-items: center;
    padding: 0.3em 0 0.5em;
  }

  /* The month shown, lit like a pressed button. */
  .lit,
  .lit::before,
  .lit::after {
    background: var(--accent);
    color: var(--bg) !important;
  }
</style>
