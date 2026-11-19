<script lang="ts">
  import { heightAtLimit, showHeight, stepHeight, type HeightUnit } from '../fasting/fasts'
  import Stepper from './Stepper.svelte'

  // The height in cm, shown in cm or in feet and inches; it is stored in cm either way.
  // Unset, the first step sets a height to go on from.
  let {
    height,
    unit,
    onChange,
  }: { height: number | null; unit: HeightUnit; onChange: (height: number) => void } = $props()
</script>

<Stepper
  label="Height"
  labelWidth={6}
  value={showHeight(height, unit)}
  onStep={(d) => onChange(stepHeight(height, d, unit))}
  atStart={heightAtLimit(height, -1, unit)}
  atEnd={heightAtLimit(height, 1, unit)}
/>
