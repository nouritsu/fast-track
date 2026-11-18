<script lang="ts">
  import { untrack } from 'svelte'
  import { dayClock, floorMinute, HOUR, MINUTE } from '../fasting/time'
  import { duration } from '../ui/fields'
  import Pane from '../ui/Pane.svelte'
  import TimeSteppers from '../ui/TimeSteppers.svelte'

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
</script>

<Pane title="Start time" {onClose}>
  <TimeSteppers at={shown} earliest={first} {latest} onChange={(t) => (at = t)} />
  <p class="fields">{duration(now - shown)} ago · ends {dayClock(shown + goal * HOUR)}</p>
  {#snippet action()}
    <button type="button" class="edge primary" onclick={() => onConfirm(shown)}
      ><span class="icon" aria-hidden="true">{moving ? '✓' : '▷'}</span>{moving ? 'Save' : 'Start'}</button
    >
  {/snippet}
</Pane>
