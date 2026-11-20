<script lang="ts">
  import { untrack } from 'svelte'
  import { invalidTimes, overlapping, parseWeight, weightNumber, type Active, type Fast } from '../fasting/fasts'
  import { scaleWeightFor, type ScaleWeight } from '../fasting/openscale'
  import { dayClock, longDate } from '../fasting/time'
  import { duration } from '../ui/fields'
  import GoalStepper from '../ui/GoalStepper.svelte'
  import Icon from '../ui/Icon.svelte'
  import Pane from '../ui/Pane.svelte'
  import TimeSteppers from '../ui/TimeSteppers.svelte'

  // A finished fast, a new one logged afterwards, or one planned ahead: its note, the
  // weight at its end, when it begins and ends, and its goal.
  let {
    fast,
    others,
    active,
    scale,
    isNew,
    unit,
    now,
    onSave,
    onClose,
  }: {
    fast: Fast
    others: Fast[] // the rest of the history, which it must not overlap
    active: Active | null // the fast in progress, which it must end before
    scale: ScaleWeight[] // openScale's weighings: the fast's own (scaleWeightFor) fills an empty weight
    isNew: boolean
    unit: 'kg' | 'lb'
    now: number
    onSave: (fast: Fast) => void
    onClose: () => void
  } = $props()

  const initial = untrack(() => fast)
  let start = $state(initial.start)
  let end = $state(initial.end)
  let goal = $state(initial.goal)
  let note = $state(initial.note)
  const initialWeightText = initial.weight === null ? '' : weightNumber(initial.weight, untrack(() => unit))
  let weightText = $state(initialWeightText)

  const weight = $derived(parseWeight(weightText, unit))
  const weightBad = $derived(weightText.trim() !== '' && weight === null)
  const fromScale = $derived(scaleWeightFor({ start, end }, scale))
  const clash = $derived(overlapping(others, start, end, initial.id))
  const problem = $derived(
    invalidTimes(start, end) ??
      (clash ? `It overlaps the fast ${clash.end > now ? 'planned for' : 'that ended'} ${longDate(clash.end)}.` : null) ??
      (active && end > active.start ? 'It overlaps the fast in progress.' : null) ??
      (weightBad ? `That is not a weight in ${unit}.` : null),
  )

  function save() {
    if (problem) return
    // A weight synced from the scale stays marked so while it is left as it was.
    const fromScale = initial.fromScale === true && weight !== null && weightText === initialWeightText
    onSave({ ...initial, start, end, goal, note: note.trim(), weight, fromScale: fromScale || undefined })
  }
</script>

<Pane title={isNew ? 'Add fast' : 'Edit fast'} icon={isNew ? 'add' : 'edit'} {onClose}>
  <label class="field">
    <span class="muted">Note</span>
    <input type="text" bind:value={note} maxlength="80" placeholder="How it went" />
  </label>
  <label class="field">
    <span class="muted">Weight</span>
    <input
      type="text"
      class="weight"
      inputmode="decimal"
      bind:value={weightText}
      placeholder={fromScale ? weightNumber(fromScale.kg, unit) : '--.-'}
    />
    <span>{unit}</span>
  </label>
  {#if fromScale && !weightText.trim()}
    <p class="muted">From openScale, weighed {dayClock(fromScale.at)}. Type a weight to use your own.</p>
  {:else if initial.fromScale && weightText === initialWeightText}
    <p class="muted">Synced from openScale. Type a weight to use your own.</p>
  {/if}

  <h3>Start</h3>
  <TimeSteppers at={start} latest={Infinity} onChange={(t) => (start = t)} />

  <h3>End</h3>
  <TimeSteppers at={end} latest={Infinity} onChange={(t) => (end = t)} />

  <h3>Goal</h3>
  <GoalStepper {goal} onChange={(g) => (goal = g)} />

  {#if problem}
    <p class="problem" role="alert">{problem}</p>
  {:else}
    <p class="fields">Length {duration(end - start)}</p>
  {/if}

  {#snippet action()}
    <button type="button" class="edge primary" disabled={problem !== null} onclick={save}
      ><span class="icon" aria-hidden="true"><Icon name="check" /></span>Save</button
    >
  {/snippet}
</Pane>

<style>
  .field {
    display: flex;
    align-items: center;
    gap: 1ch;
    margin: 0.3em 0;
  }

  .field > .muted {
    width: 7ch;
    flex: none;
  }

  .field input {
    flex: 1;
    min-width: 0;
  }

  .field input.weight {
    flex: none;
    width: 8ch;
  }

  h3 {
    margin-top: 0.8em;
  }

  .problem {
    color: var(--bad);
  }
</style>
