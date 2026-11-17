<script lang="ts">
  import { untrack } from 'svelte'
  import { deepestByDay, deepestStage, fastLength, percentOf, showWeight, type Fast } from '../fasting/fasts'
  import { weightOf, type ScaleWeight } from '../fasting/openscale'
  import { STAGES } from '../fasting/stages'
  import { dayKey, longDate, monthGrid, monthTitle, nearClock } from '../fasting/time'
  import { carries, drag, type DragOptions } from '../ui/drag'
  import { clock, duration } from '../ui/fields'
  import Icon from '../ui/Icon.svelte'
  import Page from '../ui/Page.svelte'

  // A month of fasts: each day that ended one in the colour of the deepest stage it
  // reached, and below, the month's fasts (or a tapped day's), newest first. Delete
  // takes effect at once; the entry turns into an Undo line until the page is left.
  let {
    fasts,
    scale,
    unit,
    now,
    shown: visible,
    onEdit,
    onAdd,
    onDelete,
    onRestore,
  }: {
    fasts: Fast[]
    scale: ScaleWeight[] // openScale's weighings, for fasts without a weight typed in
    unit: 'kg' | 'lb'
    now: number
    shown: boolean // the page is in view; leaving it clears the Undo lines
    onEdit: (fast: Fast) => void
    onAdd: (day: string | null) => void
    onDelete: (fast: Fast) => void
    onRestore: (fast: Fast) => void
  } = $props()

  const today = untrack(() => new Date(now))
  let year = $state(today.getFullYear())
  let month = $state(today.getMonth())
  let selected = $state<string | null>(null)
  let removed = $state<Fast[]>([]) // deleted while the sheet is open, for Undo

  $effect(() => {
    if (!visible) removed = []
  })

  const days = $derived(deepestByDay(fasts))
  const weeks = $derived(monthGrid(year, month))
  const key = (day: number) => dayKey(new Date(year, month, day))
  const todayKey = $derived(dayKey(now))
  const monthKey = $derived(key(1).slice(0, 7))

  // Deleted fasts stay in their place in the list as Undo lines.
  const shown = $derived(
    [...fasts.map((fast) => ({ fast, gone: false })), ...removed.map((fast) => ({ fast, gone: true }))]
      .filter(({ fast }) => (selected ? dayKey(fast.end) === selected : dayKey(fast.end).startsWith(monthKey)))
      .sort((a, b) => b.fast.end - a.fast.end),
  )

  function move(by: -1 | 1) {
    const d = new Date(year, month + by, 1)
    year = d.getFullYear()
    month = d.getMonth()
    selected = null
  }

  function remove(fast: Fast) {
    removed = [...removed, fast]
    onDelete(fast)
  }

  function restore(fast: Fast) {
    removed = removed.filter((f) => f.id !== fast.id)
    onRestore(fast)
  }

  const count = $derived(shown.filter((s) => !s.gone).length)

  // Swipes: sideways on the month changes it; left on a fast deletes it (with Undo).
  // Both keep the press from the page swipe.
  let width = $state(1)
  let monthShift = $state(0)
  const monthDrag: DragOptions = {
    axis: 'x',
    claim: true,
    onMove: (dx) => (monthShift = dx / 3),
    onEnd: (dx, velocity) => {
      monthShift = 0
      if (carries(dx, width, velocity, 0.2)) move(dx < 0 ? 1 : -1)
    },
  }

  let swiping = $state<{ id: string; dx: number } | null>(null)
  const entryDrag = (fast: Fast): DragOptions => ({
    axis: 'x',
    claim: true,
    onMove: (dx) => (swiping = { id: fast.id, dx: Math.min(0, dx) }),
    onEnd: (dx, velocity) => {
      swiping = null
      if (dx < 0 && carries(dx, width, velocity, 0.35)) remove(fast)
    },
  })
</script>

<Page title="Calendar">
  <div class="swipe" bind:clientWidth={width} use:drag={monthDrag} style:transform="translateX({monthShift}px)">
  <div class="month">
    <button type="button" class="glyph" aria-label="Previous month" title="Previous month" onclick={() => move(-1)}>&lt;</button>
    <span>{monthTitle(year, month)}</span>
    <button type="button" class="glyph" aria-label="Next month" title="Next month" onclick={() => move(1)}>&gt;</button>
  </div>

  <table class="grid">
    <thead>
      <tr>{#each ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as d (d)}<th scope="col">{d}</th>{/each}</tr>
    </thead>
    <tbody>
      {#each weeks as week, w (w)}
        <tr>
          {#each week as day, d (d)}
            <td>
              {#if day !== null}
                {@const k = key(day)}
                {@const stage = days.get(k)}
                {#if stage !== undefined}
                  <button
                    type="button"
                    class="day"
                    class:selected={selected === k}
                    class:today={todayKey === k}
                    style:color="var(--{STAGES[stage].id})"
                    aria-label="{longDate(new Date(year, month, day).getTime())}: {STAGES[stage].name}"
                    aria-pressed={selected === k}
                    onclick={() => (selected = selected === k ? null : k)}>{String(day).padStart(2)}</button
                  >
                {:else}
                  <span class="day muted" class:today={todayKey === k}>{String(day).padStart(2)}</span>
                {/if}
              {/if}
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
  </div>

  <p class="legend">
    {#each STAGES as stage (stage.id)}<span><span style:color="var(--{stage.id})">■</span> {stage.name}</span>{/each}
  </p>

  <div class="head">
    <span class="muted">
      {selected ? longDate(new Date(`${selected}T12:00`).getTime()) : monthTitle(year, month).split(' ')[0]} ·
      {count === 1 ? '1 fast' : `${count} fasts`}
    </span>
    <button type="button" onclick={() => onAdd(selected)}><span class="icon" aria-hidden="true">✚</span>Add</button>
  </div>

  {#each shown as { fast, gone } (fast.id)}
    <hr class="split" />
    {#if gone}
      <div class="entry gone">
        <span class="muted">Deleted {longDate(fast.end)}</span>
        <button type="button" onclick={() => restore(fast)}><span class="icon" aria-hidden="true">↺</span>Undo</button>
      </div>
    {:else}
      {@const stage = STAGES[deepestStage(fast)]}
      {@const weight = weightOf(fast, scale)}
      <div class="swipe row" use:drag={entryDrag(fast)}>
      <span class="reveal" aria-hidden="true">✕ Delete</span>
      <div class="entry" style:transform="translateX({swiping?.id === fast.id ? swiping.dx : 0}px)" class:moving={swiping?.id === fast.id}>
        <div class="title">
          <h3>{longDate(fast.end)}</h3>
          <button type="button" class="glyph" aria-label="Edit" title="Edit" onclick={() => onEdit(fast)}><Icon name="edit" /></button>
          <button type="button" class="glyph" aria-label="Delete" title="Delete" onclick={() => remove(fast)}><Icon name="close" /></button>
        </div>
        <p class="fields">{nearClock(fast.start, fast.end)} → {clock(new Date(fast.end))} · {duration(fastLength(fast))}</p>
        <p class="fields">
          <span style:color="var(--{stage.id})">{stage.name}</span> · {percentOf(fastLength(fast), fast.goal)}% of {fast.goal}h{weight
            ? ` · ${showWeight(weight.kg, unit)}${weight.scale ? ' (scale)' : ''}`
            : ''}
        </p>
        {#if fast.note}<p class="note"><span class="icon" aria-hidden="true">¶</span>{fast.note}</p>{/if}
      </div>
      </div>
    {/if}
  {:else}
    <hr class="split" />
    <p class="muted">No fasts {selected ? 'that day' : 'this month'}.</p>
  {/each}
</Page>

<style>
  /* Swipeable areas: vertical drags still scroll the page. */
  .swipe {
    touch-action: pan-y;
  }

  .row {
    position: relative;
    overflow: hidden;
  }

  /* Behind a fast, shown as it is swiped left. */
  .reveal {
    position: absolute;
    right: 1ch;
    top: 50%;
    transform: translateY(-50%);
    color: var(--bad);
  }

  .entry {
    position: relative;
    background: var(--bg);
    transition: transform 0.2s ease;
  }

  .entry.moving {
    transition: none;
  }

  .month {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }


  .grid {
    margin: 0.5em auto 0;
    text-align: center;
  }

  .grid th,
  .grid td {
    padding: 0.05em 0.4ch;
    text-align: center;
  }

  .day {
    display: inline-block;
    min-width: 3ch;
    padding: 0.15em 0;
    white-space: pre;
  }

  button.day {
    font-weight: 700;
    background: none;
    border-color: transparent;
  }

  button.day.selected {
    border-color: var(--accent);
  }

  .today {
    text-decoration: underline;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0 2ch;
    justify-content: center;
  }

  .head,
  .entry.gone {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1ch;
    margin-top: 0.6em;
  }

  .entry {
    padding: 0.5em 0 0.2em;
  }

  .entry .title {
    display: flex;
    align-items: center;
    gap: 1ch;
  }

  .entry h3 {
    flex: 1;
    margin: 0;
  }

  .entry .fields {
    white-space: pre-wrap;
  }

  .note {
    overflow-wrap: anywhere;
  }

  /* Inside the page's scrolling content, a split stays within it. */
  hr.split {
    margin: 0.6em 0 0;
  }
</style>
