<script lang="ts">
  import { untrack } from 'svelte'
  import { dayClock, floorMinute, HOUR, MINUTE, shortDate, stepDay, stepHour, stepMinute } from '../fasting/time'
  import { duration, two } from '../ui/fields'
  import Pane from '../ui/Pane.svelte'
  import Stepper from '../ui/Stepper.svelte'

  // When the fast began: to start one that began earlier, or to move the start of the
  // one in progress. Never later than now, nor before the last fast ended.
  let {
    initial,
    earliest,
    goal,
    now,
    moving,
    onConfirm,
    onClose,
  }: {
    initial: number
    earliest: number // when the last fast ended: a fast cannot start before it
    goal: number
    now: number
    moving: boolean // the fast is already running: the button saves instead of starting
    onConfirm: (at: number) => void
    onClose: () => void
  } = $props()

  let at = $state(untrack(() => floorMinute(initial)))
  const latest = $derived(floorMinute(now))
  const first = $derived(Math.min(latest, Math.ceil(earliest / MINUTE) * MINUTE)) // the next whole minute
  const shown = $derived(Math.max(first, Math.min(at, latest)))

  const step = (move: (t: number, n: number) => number) => (direction: -1 | 1) =>
    (at = Math.max(first, Math.min(move(shown, direction), latest)))
  const date = $derived(new Date(shown))
</script>

<Pane title="Start time" {onClose}>
  <Stepper
    label="Day"
    value={shortDate(shown)}
    onStep={step(stepDay)}
    atStart={stepDay(shown, -1) < first}
    atEnd={stepDay(shown, 1) > latest}
  />
  <Stepper
    label="Hour"
    value={two(date.getHours())}
    onStep={step(stepHour)}
    atStart={stepHour(shown, -1) < first}
    atEnd={stepHour(shown, 1) > latest}
  />
  <Stepper label="Min" value={two(date.getMinutes())} onStep={step(stepMinute)} atStart={shown <= first} atEnd={shown >= latest} />
  <p class="fields">{duration(now - shown)} ago · ends {dayClock(shown + goal * HOUR)}</p>
  {#snippet action()}
    <button type="button" class="edge primary" onclick={() => onConfirm(shown)}
      ><span class="icon" aria-hidden="true">{moving ? '✓' : '▷'}</span>{moving ? 'Save' : 'Start'}</button
    >
  {/snippet}
</Pane>
