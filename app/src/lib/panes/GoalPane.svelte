<script lang="ts">
  import { GOALS, planName, stepGoal, type Active } from '../fasting/fasts'
  import { STAGES } from '../fasting/stages'
  import { dayClock, HOUR } from '../fasting/time'
  import Pane from '../ui/Pane.svelte'
  import Stepper from '../ui/Stepper.svelte'

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

<Pane title="Goal" {onClose}>
  <Stepper
    label="Goal"
    value="{String(goal).padStart(2)}h"
    onStep={(d) => onChange(stepGoal(goal, d))}
    atStart={goal <= GOALS[0]}
    atEnd={goal >= GOALS[GOALS.length - 1]}
  />
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
