<script lang="ts">
  import { accentName, DEFAULT_COLORS, sameColors, stepAccent, type ColorKey, type Colors } from '../colors'
  import { STAGES } from '../fasting/stages'
  import Icon from '../ui/Icon.svelte'
  import Pane from '../ui/Pane.svelte'
  import ShuffleText from '../ui/ShuffleText.svelte'
  import Stepper from '../ui/Stepper.svelte'

  // The accent's colour and each stage's, from Catppuccin's accents: `<` `>` step a
  // row through them, round the ends. Each step applies at once.
  let { colors, onChange, onClose }: { colors: Colors; onChange: (colors: Colors) => void; onClose: () => void } = $props()

  const ROWS: { key: ColorKey; label: string }[] = [
    { key: 'accent', label: 'Accent' },
    ...STAGES.map((s) => ({ key: s.id, label: s.name })),
  ]

  // A name shuffles into place on a tap, and just changes while a hold or a drag steps
  // fast, which would only flicker.
  let fast = $state(false)

  function step(key: ColorKey, direction: -1 | 1, repeating: boolean) {
    fast = repeating
    onChange({ ...colors, [key]: stepAccent(colors[key], direction) })
  }

  function reset() {
    fast = false
    onChange({ ...DEFAULT_COLORS })
  }
</script>

<Pane title="Colours" icon="palette" {onClose}>
  {#each ROWS as { key, label } (key)}
    <Stepper {label} labelWidth={12} width={14} onStep={(direction, repeating) => step(key, direction, repeating)}>
      <span style:color="var(--ctp-{colors[key]})" aria-hidden="true">████</span> <ShuffleText text={accentName(colors[key])} plain={fast} />
    </Stepper>
  {/each}
  {#snippet action()}
    <button type="button" class="edge" disabled={sameColors(colors, DEFAULT_COLORS)} onclick={reset}
      ><span class="icon" aria-hidden="true"><Icon name="restart_alt" /></span>Defaults</button
    >
  {/snippet}
</Pane>
