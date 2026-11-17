<script lang="ts">
  import { untrack } from 'svelte'
  import { GOALS, invalidTimes, overlapping, parseWeight, stepGoal, weightNumber, type Fast } from '../fasting/fasts'
  import { scaleWeightFor, type ScaleWeight } from '../fasting/openscale'
  import { dayClock, floorMinute, longDate, shortDate, stepDay, stepHour, stepMinute } from '../fasting/time'
  import { duration } from '../ui/fields'
  import Pane from '../ui/Pane.svelte'
  import Stepper from '../ui/Stepper.svelte'

  // A finished fast, or a new one logged afterwards: its note, the weight at its end,
  // when it began and ended, and its goal.
  let {
    fast,
    others,
    scale,
    isNew,
    unit,
    now,
    onSave,
    onClose,
  }: {
    fast: Fast
    others: Fast[] // the rest of the history, which it must not overlap
    scale: ScaleWeight[] // openScale's weighings: the one nearest the end fills an empty weight
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

  const latest = $derived(floorMinute(now))
  const weight = $derived(parseWeight(weightText, unit))
  const weightBad = $derived(weightText.trim() !== '' && weight === null)
  const fromScale = $derived(scaleWeightFor({ start, end }, scale))
  const clash = $derived(overlapping(others, start, end, initial.id))
  const problem = $derived(
    invalidTimes(start, end, now) ??
      (clash ? `It overlaps the fast that ended ${longDate(clash.end)}.` : null) ??
      (weightBad ? `That is not a weight in ${unit}.` : null),
  )

  const two = (n: number) => String(n).padStart(2, '0')
  type Move = (t: number, n: number) => number
  const stepStart = (move: Move) => (d: -1 | 1) => (start = Math.min(move(start, d), latest))
  const stepEnd = (move: Move) => (d: -1 | 1) => (end = Math.min(move(end, d), latest))

  function save() {
    if (problem) return
    // A weight synced from the scale stays marked so while it is left as it was.
    const fromScale = initial.fromScale === true && weight !== null && weightText === initialWeightText
    onSave({ ...initial, start, end, goal, note: note.trim(), weight, fromScale: fromScale || undefined })
  }
</script>

<Pane title={isNew ? 'Add fast' : 'Edit fast'} {onClose}>
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
  <Stepper label="Day" value={shortDate(start)} onStep={stepStart(stepDay)} atEnd={stepDay(start, 1) > latest} />
  <Stepper label="Hour" value={two(new Date(start).getHours())} onStep={stepStart(stepHour)} atEnd={stepHour(start, 1) > latest} />
  <Stepper label="Min" value={two(new Date(start).getMinutes())} onStep={stepStart(stepMinute)} atEnd={start >= latest} />

  <h3>End</h3>
  <Stepper label="Day" value={shortDate(end)} onStep={stepEnd(stepDay)} atEnd={stepDay(end, 1) > latest} />
  <Stepper label="Hour" value={two(new Date(end).getHours())} onStep={stepEnd(stepHour)} atEnd={stepHour(end, 1) > latest} />
  <Stepper label="Min" value={two(new Date(end).getMinutes())} onStep={stepEnd(stepMinute)} atEnd={end >= latest} />

  <h3>Goal</h3>
  <Stepper
    label="Goal"
    value="{String(goal).padStart(2)}h"
    onStep={(d) => (goal = stepGoal(goal, d))}
    atStart={goal <= GOALS[0]}
    atEnd={goal >= GOALS[GOALS.length - 1]}
  />

  {#if problem}
    <p class="problem" role="alert">{problem}</p>
  {:else}
    <p class="fields">Length {duration(end - start)}</p>
  {/if}

  {#snippet action()}
    <button type="button" class="edge primary" disabled={problem !== null} onclick={save}
      ><span class="icon" aria-hidden="true">✓</span>Save</button
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
