<script lang="ts">
  import type { DayRange } from '../fasting/stats'
  import { dayKey, MONTHS, noonOf, shortDate, stepDay, stepMonth } from '../fasting/time'
  import Block from '../ui/Block.svelte'
  import Icon from '../ui/Icon.svelte'
  import Stepper from '../ui/Stepper.svelte'

  // The days Stats covers when its span is a range: the first and the last, each a day, a
  // month and a year side by side, as the fast editor sets times. The first stays no later
  // than the last, and the last no later than today. It unfolds below Summary; Close
  // folds it away.
  let {
    range,
    today,
    onChange,
    onClose,
  }: { range: DayRange; today: string; onChange: (range: DayRange) => void; onClose: () => void } = $props()

  const ENDS = ['from', 'to'] as const
  const stepYear = (at: number, by: number) => stepMonth(at, 12 * by)

  /** Moves one end, keeping the first no later than the last and the last no later than today. */
  function move(end: keyof DayRange, step: (at: number, n: number) => number, by: -1 | 1) {
    const key = dayKey(step(noonOf(range[end]), by))
    if (end === 'from') onChange({ ...range, from: key > range.to ? range.to : key })
    else onChange({ ...range, to: key > today ? today : key < range.from ? range.from : key })
  }
</script>

{#snippet close()}
  <button type="button" class="edge quit" onclick={onClose}><span class="icon" aria-hidden="true"><Icon name="close" /></span>Close</button>
{/snippet}

<Block title="Range" icon="event" headingRight={close}>
  {#each ENDS as end (end)}
    {@const first = end === 'from'}
    {@const key = range[end]}
    <!-- No later than the other end, nor the last day than today. -->
    {@const atStart = !first && range.to === range.from}
    {@const atEnd = first ? range.from === range.to : range.to === today}
    <h3>{first ? 'From' : 'To'}</h3>
    <div class="steppers">
      <Stepper stacked label="Day" width={6} value={shortDate(noonOf(key)).slice(0, 6)} onStep={(by) => move(end, stepDay, by)} {atStart} {atEnd} />
      <Stepper stacked label="Month" width={3} value={MONTHS[Number(key.slice(5, 7)) - 1].slice(0, 3)} onStep={(by) => move(end, stepMonth, by)} {atStart} {atEnd} />
      <Stepper stacked label="Year" width={4} value={key.slice(0, 4)} onStep={(by) => move(end, stepYear, by)} {atStart} {atEnd} />
    </div>
  {/each}
</Block>

<style>
  h3:not(:first-of-type) {
    margin-top: 0.6em;
  }

  /* Day, month and year in a row, as the fast editor's day, hour and minute. */
  .steppers {
    display: flex;
    justify-content: space-between;
    margin: 0.2em 0;
  }
</style>
