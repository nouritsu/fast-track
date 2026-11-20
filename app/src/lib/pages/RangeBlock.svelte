<script lang="ts">
  import type { DayRange } from '../fasting/stats'
  import { dayKey, MONTHS, noonOf, shortDate, stepDay, stepMonth } from '../fasting/time'
  import Block from '../ui/Block.svelte'
  import Icon from '../ui/Icon.svelte'
  import Stepper from '../ui/Stepper.svelte'

  // The days Stats covers when its span is a range: the first and the last, each set by
  // month and day, as the fast editor sets times. The first stays no later than the last,
  // and the last no later than today. It unfolds below Summary; Close folds it away.
  let {
    range,
    today,
    onChange,
    onClose,
  }: { range: DayRange; today: string; onChange: (range: DayRange) => void; onClose: () => void } = $props()

  const ENDS = ['from', 'to'] as const
  const monthOf = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1].slice(0, 3)} ${key.slice(0, 4)}`
  const dayOf = (key: string) => shortDate(noonOf(key)).slice(0, 6) // "Mon 01"

  /** Moves one end, keeping the first no later than the last and the last no later than today. */
  function move(end: keyof DayRange, step: (at: number, n: number) => number, by: -1 | 1) {
    const key = dayKey(step(noonOf(range[end]), by))
    if (end === 'from') onChange({ ...range, from: key > range.to ? range.to : key })
    else onChange({ ...range, to: key > today ? today : key < range.from ? range.from : key })
  }
</script>

{#snippet close()}
  <button type="button" class="edge" onclick={onClose}><span class="icon" aria-hidden="true"><Icon name="close" /></span>Close</button>
{/snippet}

<Block title="Range" icon="event" headingRight={close}>
  {#each ENDS as end (end)}
    {@const first = end === 'from'}
    <h3>{first ? 'From' : 'To'}</h3>
    <Stepper
      label="Month"
      value={monthOf(range[end])}
      onStep={(by) => move(end, stepMonth, by)}
      atStart={!first && range.to === range.from}
      atEnd={first ? range.from === range.to : range.to === today}
    />
    <Stepper
      label="Day"
      value={dayOf(range[end])}
      onStep={(by) => move(end, stepDay, by)}
      atStart={!first && range.to === range.from}
      atEnd={first ? range.from === range.to : range.to === today}
    />
  {/each}
</Block>

<style>
  h3:not(:first-of-type) {
    margin-top: 0.6em;
  }
</style>
