<script lang="ts">
  import { shortDate, stepDay, stepHour, stepMinute } from '../fasting/time'
  import { two } from './fields'
  import Stepper from './Stepper.svelte'

  // A time set by its day, hour and minute, each a stepper, kept between `earliest`
  // and `latest`.
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

<Stepper
  label="Day"
  value={shortDate(at)}
  onStep={step(stepDay)}
  atStart={stepDay(at, -1) < earliest}
  atEnd={stepDay(at, 1) > latest}
/>
<Stepper
  label="Hour"
  value={two(date.getHours())}
  onStep={step(stepHour)}
  atStart={stepHour(at, -1) < earliest}
  atEnd={stepHour(at, 1) > latest}
/>
<Stepper label="Min" value={two(date.getMinutes())} onStep={step(stepMinute)} atStart={at <= earliest} atEnd={at >= latest} />
