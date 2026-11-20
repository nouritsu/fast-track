<script lang="ts">
  import { shortDate, stepDay, stepHour, stepMinute } from '../fasting/time'
  import { two } from './fields'
  import Stepper from './Stepper.svelte'

  // A time set by its day, hour and minute, side by side, each a stepper with its label
  // above, kept between `earliest` and `latest`.
  let {
    at,
    earliest = -Infinity,
    latest,
    onChange,
  }: { at: number; earliest?: number; latest: number; onChange: (at: number) => void } = $props()

  const date = $derived(new Date(at))
  const step = (move: (t: number, n: number) => number) => (direction: -1 | 1) =>
    onChange(Math.max(earliest, Math.min(move(at, direction), latest)))
</script>

<div class="steppers">
  <Stepper
    stacked
    label="Day"
    width={10}
    value={shortDate(at)}
    onStep={step(stepDay)}
    atStart={stepDay(at, -1) < earliest}
    atEnd={stepDay(at, 1) > latest}
  />
  <Stepper
    stacked
    label="Hour"
    width={2}
    value={two(date.getHours())}
    onStep={step(stepHour)}
    atStart={stepHour(at, -1) < earliest}
    atEnd={stepHour(at, 1) > latest}
  />
  <Stepper stacked label="Min" width={2} value={two(date.getMinutes())} onStep={step(stepMinute)} atStart={at <= earliest} atEnd={at >= latest} />
</div>

<style>
  /* The three in a row across the pane, the day the widest. */
  .steppers {
    display: flex;
    justify-content: space-between;
    margin: 0.2em 0;
  }
</style>
