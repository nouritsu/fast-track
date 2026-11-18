<script lang="ts">
  import { dayTotals, hoursOf, monthRows, monthSummary, rowWeek, weekdayHeads, weekTotal } from '../fasting/calendar'
  import { deepestStage, fastLength, percentOf, showWeight, type Fast } from '../fasting/fasts'
  import { weightOf, type ScaleWeight } from '../fasting/openscale'
  import { STAGES } from '../fasting/stages'
  import type { Settings } from '../fasting/store'
  import { dayKey, longDate, nearClock } from '../fasting/time'
  import { carries, drag, type DragOptions } from '../ui/drag'
  import { clock, duration } from '../ui/fields'
  import Icon from '../ui/Icon.svelte'
  import Block from '../ui/Block.svelte'

  // Two panels. The Calendar: a month in which each day that ended a fast is in the
  // colour of the deepest stage it reached, with its hours under it, and week numbers
  // and weekly totals as the settings say; tapping the month or the year opens a pane
  // to pick another (App), and the stage legend sits in its bottom edge. The Fasts:
  // the month's summary and its fasts (or a tapped day's), newest first. Delete takes
  // effect at once; the entry turns into an Undo line until the page is left.
  let {
    fasts,
    scale,
    unit,
    now,
    settings,
    year = $bindable(),
    month = $bindable(),
    shown: visible,
    onPickMonth,
    onPickYear,
    onEdit,
    onAdd,
    onDelete,
    onRestore,
  }: {
    fasts: Fast[]
    scale: ScaleWeight[] // openScale's weighings, for fasts without a weight typed in
    unit: 'kg' | 'lb'
    now: number
    settings: Settings
    year: number
    month: number // 0–11
    shown: boolean // the page is in view; leaving it clears the Undo lines
    onPickMonth: () => void
    onPickYear: () => void
    onEdit: (fast: Fast) => void
    onAdd: (day: string | null) => void
    onDelete: (fast: Fast) => void
    onRestore: (fast: Fast) => void
  } = $props()

  let selected = $state<string | null>(null)
  let removed = $state<Fast[]>([]) // deleted while the sheet is open, for Undo

  $effect(() => {
    if (!visible) removed = []
  })

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const days = $derived(dayTotals(fasts))
  const rows = $derived(monthRows(year, month, settings.weekStart))
  const heads = $derived(weekdayHeads(settings.weekStart))
  const key = (day: number) => dayKey(new Date(year, month, day))
  const todayKey = $derived(dayKey(now))
  const monthKey = $derived(key(1).slice(0, 7))
  const sub = $derived(settings.dayHours) // a second line under the days, for their hours
  const summary = $derived(monthSummary(fasts, year, month))
  const hm = (ms: number) => {
    const minutes = Math.round(ms / 60_000)
    return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`
  }

  // The month or the year changed elsewhere (its pane): no day stays picked.
  $effect(() => {
    void year
    void month
    selected = null
  })

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

{#snippet legend()}
  <!-- The stage colours, set into the edge between the calendar and the fasts. -->
  <span class="legend" aria-label="Stage colours"
    >{#each STAGES as stage (stage.id)}<span><span style:color="var(--{stage.id})">■</span> {stage.name.slice(0, 3).toLowerCase()}</span
      >{/each}</span
  >
{/snippet}

{#snippet addButton()}
  <button type="button" class="word" onclick={() => onAdd(selected)}><span class="icon" aria-hidden="true">✚</span>add</button>
{/snippet}

<div class="layout">
<Block title="Calendar" class="calendar-block" actions={legend}>
  <div class="swipe" bind:clientWidth={width} use:drag={monthDrag} style:transform="translateX({monthShift}px)">
    <div class="month">
      <button type="button" class="glyph" aria-label="Previous month" title="Previous month" onclick={() => move(-1)}>&lt;</button>
      <span class="when">
        <button type="button" class="word" aria-label="Pick a month: {MONTHS[month]}" onclick={onPickMonth}>{MONTHS[month]}</button>
        <button type="button" class="word" aria-label="Pick a year: {year}" onclick={onPickYear}>{year}</button>
      </span>
      <button type="button" class="glyph" aria-label="Next month" title="Next month" onclick={() => move(1)}>&gt;</button>
    </div>

    <table class="grid" class:sub>
      <thead>
        <tr>
          {#if settings.weekNumbers}<th scope="col" class="side" aria-label="Week">wk</th>{/if}
          {#each heads as d (d)}<th scope="col">{d}</th>{/each}
          {#if settings.weekTotals}<th scope="col" class="side" aria-label="Hours that week">h</th>{/if}
        </tr>
      </thead>
      <tbody>
        {#each rows as row, w (w)}
          {@const inMonth = row.days.some((d) => d !== null)}
          <tr>
            {#if settings.weekNumbers}<th scope="row" class="side muted">{inMonth ? rowWeek(row) : ''}</th>{/if}
            {#each row.days as day, d (d)}
              <td>
                {#if day !== null}
                  {@const k = key(day)}
                  {@const total = days.get(k)}
                  {#if total}
                    <button
                      type="button"
                      class="day"
                      class:selected={selected === k}
                      class:today={todayKey === k}
                      style:--stage="var(--{STAGES[total.stage].id})"
                      aria-label="{longDate(new Date(year, month, day).getTime())}: {hoursOf(total.ms)} hours, {STAGES[total.stage].name}"
                      aria-pressed={selected === k}
                      onclick={() => (selected = selected === k ? null : k)}
                    >
                      <span class="date">{day}</span>
                      {#if sub}<span class="under hours">{hoursOf(total.ms)}</span>{/if}
                    </button>
                  {:else}
                    <span class="day muted" class:today={todayKey === k}>
                      <span class="date">{day}</span>
                      {#if sub}<span class="under"> </span>{/if}
                    </span>
                  {/if}
                {:else}
                  <!-- Holds the row's height, so short months keep the grid's size. -->
                  <span class="day" aria-hidden="true"><span class="date"> </span>{#if sub}<span class="under"> </span>{/if}</span>
                {/if}
              </td>
            {/each}
            {#if settings.weekTotals}
              {@const ms = inMonth ? weekTotal(fasts, row) : 0}
              <td class="side muted">{ms ? `${hoursOf(ms)}h` : ''}</td>
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</Block>

<Block title="Fasts" class="fasts-block" headingRight={addButton}>
  <div class="content">
  <div class="head">
    {#if selected}
      <p class="fields">{longDate(new Date(`${selected}T12:00`).getTime())} · {count === 1 ? '1 fast' : `${count} fasts`}</p>
    {:else if summary.count}
      <p class="fields">{MONTHS[month]} · {summary.count === 1 ? '1 fast' : `${summary.count} fasts`} · {hoursOf(summary.total)}h</p>
    {:else}
      <p class="fields muted">{MONTHS[month]} · no fasts</p>
    {/if}
  </div>
  {#if !selected && summary.count}
    <p class="fields muted summary">
      avg {hm(summary.average)} · goal met {Math.round(summary.goalRate * 100)}% · longest {hm(summary.longest)}
    </p>
  {/if}

  {#each shown as { fast, gone } (fast.id)}
    <hr class="split" />
    {#if gone}
      <div class="entry gone">
        <span class="muted">Deleted {longDate(fast.end)}</span>
        <button type="button" class="word" onclick={() => restore(fast)}><span class="icon" aria-hidden="true">↺</span>undo</button>
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
  </div>
</Block>
</div>

<style>
  /* The two panels fill the page: the calendar as tall as it needs, the fasts the
     rest, scrolling inside their border. The gap leaves room for the legend in the
     calendar's bottom edge and the fasts' title in their top one. */
  .layout {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 1.7em;
  }

  .layout > :global(.calendar-block) {
    flex: none;
  }

  .layout > :global(.fasts-block) {
    flex: 1;
    min-height: 0;
  }

  .content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-top: 0.2em;
  }

  .content :global(p) {
    margin: 0.3em 0;
  }

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

  .when {
    display: flex;
    gap: 1ch;
  }

  .grid {
    margin: 0.4em auto 0;
    text-align: center;
    font-size: 1.1em;
  }

  .grid th,
  .grid td {
    padding: 0.1em 0.3ch;
    text-align: center;
    vertical-align: middle;
  }

  .grid thead th {
    font-size: 0.85em;
  }

  /* Week numbers before a week, its hours after it. */
  .side {
    font-size: 0.8em;
    min-width: 3.5ch;
  }

  /* Every day the same box, button or not, blank or not: the grid never changes height. */
  .day {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    min-width: 3.4ch;
    height: 1.9em;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 0.4em;
    line-height: 1.1;
    vertical-align: middle;
    white-space: pre;
  }

  .sub .day {
    height: 2.7em;
  }

  .under {
    font-size: 0.7em;
    min-height: 1.1em;
  }

  button.day {
    background: none;
    border-color: transparent;
  }

  button.day .date {
    font-weight: 700;
    color: var(--stage);
  }

  .hours {
    color: var(--stage);
  }

  button.day.selected {
    border-color: var(--accent);
  }

  .today .date {
    text-decoration: underline;
  }

  /* The legend in the bottom edge, cutting the line like the edge buttons. */
  .legend {
    display: flex;
    gap: 1.2ch;
    padding: 0 0.8ch;
    background: var(--bg);
    font-size: 0.85em;
    margin: 0 auto;
  }

  .entry.gone {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1ch;
    margin-top: 0.6em;
  }

  .head p,
  p.summary {
    margin: 0;
  }

  p.summary {
    white-space: normal;
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
