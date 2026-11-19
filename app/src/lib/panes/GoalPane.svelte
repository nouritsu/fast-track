<script lang="ts">
  import { planName, type Active } from '../fasting/fasts'
  import { STAGES } from '../fasting/stages'
  import { dayClock, HOUR } from '../fasting/time'
  import GoalStepper from '../ui/GoalStepper.svelte'
  import Pane from '../ui/Pane.svelte'

  // The goal, in hours: of the fast in progress, and of the ones after it. Each step
  // applies at once.
  let {
    goal,
    active,
    onChange,
    onClose,
  }: { goal: number; active: Active | null; onChange: (goal: number) => void; onClose: () => void } = $props()

  const reached = $derived(STAGES.filter((s) => s.from < goal))
</script>

<Pane title="Goal" icon="flag" {onClose}>
  <GoalStepper {goal} {onChange} />
  <p>{planName(goal)}</p>
  {#if active}<p class="fields">Ends {dayClock(active.start + goal * HOUR)}</p>{/if}
  <p class="muted">
    Reaches
    {#each reached as stage, i (stage.id)}<span style:color="var(--{stage.id})">{stage.name}</span>{i < reached.length - 2
        ? ', '
        : i === reached.length - 2
          ? ' and '
          : '.'}{/each}
  </p>
</Pane>
