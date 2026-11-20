<script lang="ts">
  import { untrack } from 'svelte'
  import { dayClock, floorMinute, HOUR, MINUTE } from '../fasting/time'
  import { duration } from '../ui/fields'
  import Icon from '../ui/Icon.svelte'
  import Pane from '../ui/Pane.svelte'
  import TimeSteppers from '../ui/TimeSteppers.svelte'

  // When the fast begins: to start one that began earlier or begins later, or to move
  // the start of the one in progress. Never before the last fast ended.
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
  const first = $derived(Math.ceil(earliest / MINUTE) * MINUTE) // the next whole minute
  const shown = $derived(Math.max(first, at))
  const when = $derived(shown > now ? `in ${duration(shown - now)}` : `${duration(now - shown)} ago`)
</script>

<Pane title="Start time" icon="schedule" {onClose}>
  <TimeSteppers at={shown} earliest={first} latest={Infinity} onChange={(t) => (at = t)} />
  <p class="fields">{when} · ends {dayClock(shown + goal * HOUR)}</p>
  {#snippet action()}
    <button type="button" class="edge primary" onclick={() => onConfirm(shown)}
      ><span class="icon" aria-hidden="true"><Icon name={moving ? 'check' : 'play_arrow'} /></span>{moving ? 'Save' : 'Start'}</button
    >
  {/snippet}
</Pane>
