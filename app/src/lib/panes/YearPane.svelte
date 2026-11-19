<script lang="ts">
  import Icon from '../ui/Icon.svelte'
  import Pane from '../ui/Pane.svelte'

  // Which year the calendar shows: < year > a year at a time, or jumps of 5, 3 and 1
  // either way. Each change shows at once in the calendar above; Today goes back to
  // this month.
  let {
    year,
    onPick,
    onToday,
    onClose,
  }: { year: number; onPick: (year: number) => void; onToday: () => void; onClose: () => void } = $props()

  const FIRST = 1970
  const LAST = 2199
  const JUMPS = [-5, -3, -1, 1, 3, 5]
  const go = (by: number) => onPick(Math.min(LAST, Math.max(FIRST, year + by)))
</script>

<Pane title="Year" icon="event" {onClose}>
  <div class="year">
    <button type="button" class="glyph" aria-label="Previous year" disabled={year <= FIRST} onclick={() => go(-1)}>&lt;</button>
    <strong>{year}</strong>
    <button type="button" class="glyph" aria-label="Next year" disabled={year >= LAST} onclick={() => go(1)}>&gt;</button>
  </div>
  <div class="jumps">
    {#each JUMPS as by (by)}
      <button
        type="button"
        class="word"
        aria-label="{by > 0 ? 'Forward' : 'Back'} {Math.abs(by)} {Math.abs(by) === 1 ? 'year' : 'years'}"
        disabled={year + by < FIRST || year + by > LAST}
        onclick={() => go(by)}>{by > 0 ? `+${by}` : `-${-by}`}</button
      >
    {/each}
  </div>
  {#snippet action()}
    <button type="button" class="edge primary" onclick={onToday}><span class="icon" aria-hidden="true"><Icon name="today" /></span>Today</button>
  {/snippet}
</Pane>

<style>
  .year {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2ch;
    font-size: 1.3em;
    padding-top: 0.2em;
  }

  .jumps {
    display: flex;
    justify-content: space-between;
    padding: 0.4em 0 0.5em;
  }
</style>
