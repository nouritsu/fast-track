<script lang="ts">
  import { untrack } from 'svelte'
  import { completeMeal, invalidTimes, overlapping, parseWeight, weightNumber, type Active, type Fast } from '../fasting/fasts'
  import { scaleWeightFor, type ScaleWeight } from '../fasting/openscale'
  import { dayClock, HOUR, longDate } from '../fasting/time'
  import CompleteInput from '../ui/CompleteInput.svelte'
  import { hm } from '../ui/fields'
  import GoalStepper from '../ui/GoalStepper.svelte'
  import Icon from '../ui/Icon.svelte'
  import Pane from '../ui/Pane.svelte'
  import ShuffleText from '../ui/ShuffleText.svelte'
  import TimeSteppers from '../ui/TimeSteppers.svelte'

  // A finished fast, a new one logged afterwards, or one planned ahead: the meal that
  // broke it, its note, the weight at its end, when it begins and ends, and its goal.
  let {
    fast,
    others,
    active,
    meals,
    scale,
    isNew,
    unit,
    now,
    onSave,
    onTrack,
    onClose,
  }: {
    fast: Fast
    others: Fast[] // the rest of the history, which it must not overlap
    active: Active | null // the fast in progress, which it must end before
    meals: string[] // the meals fasts were broken with, for completing the one typed (pastMeals)
    scale: ScaleWeight[] // openScale's weighings: the fast's own (scaleWeightFor) fills an empty weight
    isNew: boolean
    unit: 'kg' | 'lb'
    now: number
    onSave: (fast: Fast) => void
    onTrack: (start: number, goal: number) => void // runs it on the Fast page instead
    onClose: () => void
  } = $props()

  const initial = untrack(() => fast)
  let start = $state(initial.start)
  let end = $state(initial.end)
  let goal = $state(initial.goal)
  let note = $state(initial.note)
  let brokeWith = $state(initial.brokeWith ?? '')
  const initialWeightText = initial.weight === null ? '' : weightNumber(initial.weight, untrack(() => unit))
  let weightText = $state(initialWeightText)

  // A new fast that ends later may run on the Fast page instead of in the list, while
  // none is in progress there: it then has no end until it is ended, like any other.
  let tracked = $state(false)
  const canTrack = $derived(isNew && !active && (tracked || end > now))
  const onFastPage = $derived(tracked && canTrack)

  const weight = $derived(parseWeight(weightText, unit))
  const weightBad = $derived(weightText.trim() !== '' && weight === null)
  const fromScale = $derived(scaleWeightFor({ start, end }, scale))
  const clash = $derived(overlapping(others, start, onFastPage ? Infinity : end, initial.id))
  const problem = $derived(
    (onFastPage ? null : invalidTimes(start, end)) ??
      (clash ? `Overlaps the fast ${clash.end > now ? 'planned for' : 'that ended'} ${longDate(clash.end)}.` : null) ??
      (active && end > active.start ? 'Overlaps the fast in progress.' : null) ??
      (weightBad ? `Not a weight in ${unit}.` : null),
  )

  function save() {
    if (problem) return
    if (onFastPage) return onTrack(start, goal)
    // A weight synced from the scale stays marked so while it is left as it was.
    const fromScale = initial.fromScale === true && weight !== null && weightText === initialWeightText
    const meal = brokeWith.trim()
    onSave({ ...initial, start, end, goal, note: note.trim(), weight, fromScale: fromScale || undefined, brokeWith: meal || undefined })
  }
</script>

<Pane title={isNew ? 'Add fast' : 'Edit fast'} icon={isNew ? 'add' : 'edit'} {onClose}>
  <label class="field">
    <span class="label">Broke with</span>
    <CompleteInput bind:value={brokeWith} suggest={(typed) => completeMeal(typed, meals)} placeholder="First meal" />
  </label>
  <label class="field">
    <span class="label">Note</span>
    <input type="text" bind:value={note} maxlength="80" placeholder="How it went" />
  </label>
  <label class="field">
    <span class="label">Weight</span>
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
    <p class="muted">From openScale, weighed {dayClock(fromScale.at)}. Type one to replace it.</p>
  {:else if initial.fromScale && weightText === initialWeightText}
    <p class="muted">Synced from openScale. Type one to replace it.</p>
  {/if}

  {#if canTrack}
    <div class="row">
      <span>Track on the Fast page</span>
      <button type="button" class="word" aria-pressed={tracked} onclick={() => (tracked = !tracked)}
        ><ShuffleText text={tracked ? 'on' : 'off'} /></button
      >
    </div>
  {/if}

  <h3>Start</h3>
  <TimeSteppers at={start} latest={Infinity} onChange={(t) => (start = t)} />

  {#if !onFastPage}
    <h3>End</h3>
    <TimeSteppers at={end} latest={Infinity} onChange={(t) => (end = t)} />
  {/if}

  <h3>Goal</h3>
  <GoalStepper {goal} onChange={(g) => (goal = g)} />

  {#if problem}
    <p class="problem" role="alert">{problem}</p>
  {:else if onFastPage}
    <p class="fields">
      {start > now ? `starts in ${hm(start - now)}` : `began ${hm(now - start)} ago`} · goal {dayClock(start + goal * HOUR)}
    </p>
  {:else}
    <p class="fields">Length {hm(end - start)}</p>
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

  .field > .label {
    width: 10ch;
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

  /* A switch as in Options: its name, and the word to press. */
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 0.4em;
  }

  .problem {
    color: var(--bad);
  }
</style>
