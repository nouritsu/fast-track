<script lang="ts">
  import { GOALS, stepGoal } from '../fasting/fasts'
  import Stepper from './Stepper.svelte'

  // A fast's goal in hours, stepped through GOALS.
  let { goal, onChange }: { goal: number; onChange: (goal: number) => void } = $props()
</script>

<Stepper
  label="Goal"
  value="{String(goal).padStart(2)}h"
  onStep={(d) => onChange(stepGoal(goal, d))}
  atStart={goal <= GOALS[0]}
  atEnd={goal >= GOALS[GOALS.length - 1]}
/>
