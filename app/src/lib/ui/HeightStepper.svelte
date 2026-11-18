<script lang="ts">
  import { heightAtLimit, showHeight, stepHeight } from '../fasting/fasts'
  import Stepper from './Stepper.svelte'

  // The height in cm, as cm with kg and feet and inches with lb; it is stored in cm
  // either way. Unset, the first step sets a height to go on from.
  let {
    height,
    unit,
    onChange,
  }: { height: number | null; unit: 'kg' | 'lb'; onChange: (height: number) => void } = $props()
</script>

<Stepper
  label="Height"
  value={showHeight(height, unit)}
  onStep={(d) => onChange(stepHeight(height, d, unit))}
  atStart={heightAtLimit(height, -1, unit)}
  atEnd={heightAtLimit(height, 1, unit)}
/>
