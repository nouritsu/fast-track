<script lang="ts">
  import { dayTotals, hoursOf, monthRows, monthSummary, rowWeek, weekdayHeads, weekTotal } from '../fasting/calendar'
  import { deepestStage, fastLength, percentOf, showWeight, type Fast } from '../fasting/fasts'
  import { weightOf, type ScaleWeight } from '../fasting/openscale'
  import { STAGES } from '../fasting/stages'
  import type { Settings } from '../fasting/store'
  import { dayKey, longDate, MONTHS, nearClock, noonOf } from '../fasting/time'
  import { reducedMotion } from '../motion/shuffle'
  import { carries, drag, type DragOptions } from '../ui/drag'
  import { clock, duration, hm } from '../ui/fields'
  import Icon from '../ui/Icon.svelte'
  import Block from '../ui/Block.svelte'

  // Two panels. The Calendar: a month in which each day that ended a fast is in the
  // colour of the deepest stage it reached, and week numbers
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
    visible,
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
    visible: boolean // the page is in view; leaving it clears the Undo lines
    onPickMonth: () => void
    onPickYear: () => void
    onEdit: (fast: Fast) => void
    onAdd: (day: string | null) => void
    onDelete: (fast: Fast) => void
    onRestore: (fast: Fast) => void
  } = $props()

  let selected = $state<string | null>(null)
  let removed = $state<Fast[]>([]) // deleted while the page is in view, for Undo

  $effect(() => {
    if (!visible) removed = []
  })

  const days = $derived(dayTotals(fasts))
  const heads = $derived(weekdayHeads(settings.weekStart))
  const key = (y: number, m: number, day: number) => dayKey(new Date(y, m, day))
  const todayKey = $derived(dayKey(now))
  const monthKey = $derived(key(year, month, 1).slice(0, 7))
  const summary = $derived(monthSummary(fasts, year, month))

  // The month or the year changed elsewhere (its pane): no day stays picked.
  $effect(() => {
    void year
    void month
    selected = null
  })

  // Deleted fasts stay in their place in the list as Undo lines.
  const entries = $derived(
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

  const count = $derived(entries.filter((s) => !s.gone).length)

  // The grids of the month before, the month shown and the month after sit side by
  // side in a strip, the header staying where it is. A drag moves the strip one to one;
  // let go, it slides on to a neighbour (whose month is then the one shown, and the strip
  // is back in place) or springs back. Only its transform changes as it moves.
  const around = $derived(
    ([-1, 0, 1] as const).map((by) => {
      const d = new Date(year, month + by, 1)
      return { by, year: d.getFullYear(), month: d.getMonth() }
    }),
  )
  let shift = $state(0) // the drag's offset, in px
  let going = $state<-1 | 0 | 1>(0) // the neighbour it slides to: 1 the next month, -1 the one before
  let sliding = $state(false) // on its way to rest, with the slide's easing
  let slideTimer = 0

  /** Slides the strip from where it is to a neighbour's grid, or back to the shown one. */
  function glide(by: -1 | 0 | 1) {
    if (reducedMotion()) {
      shift = 0
      if (by) move(by)
      return
    }
    if (!by && !shift) return
    sliding = true
    going = by
    shift = 0
    slideTimer = window.setTimeout(settle, 400) // for a transitionend that never comes
  }

  /** The strip is at rest: a neighbour's month becomes the one shown, the strip goes back. */
  function settle() {
    clearTimeout(slideTimer)
    if (!sliding) return
    const by = going
    sliding = false
    going = 0
    shift = 0
    if (by) move(by)
  }

  function slid(event: TransitionEvent) {
    if (event.target === event.currentTarget && event.propertyName === 'transform') settle()
  }

  /** The buttons slide the grid too; one still sliding is left to finish. */
  function step(by: -1 | 1) {
    if (!sliding && !shift) glide(by)
  }

  // Swipes: sideways on the month slides it; left on a fast deletes it (with Undo).
  // Both keep the press from the page swipe.
  let width = $state(1)
  const monthDrag: DragOptions = {
    axis: 'x',
    claim: true,
    onStart: settle, // a drag takes over from a slide still going
    onMove: (dx) => (shift = Math.max(-width, Math.min(width, dx))),
    onEnd: (dx, velocity) => glide(carries(dx, width, velocity, 0.2) ? (dx < 0 ? 1 : -1) : 0),
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

{#snippet grid(y: number, m: number)}
  {@const rows = monthRows(y, m, settings.weekStart)}
  <table class="grid">
    <thead>
      <tr>
        <th scope="col" class="side" aria-label="Week" aria-hidden={!settings.weekNumbers}>{settings.weekNumbers ? 'wk' : ''}</th>
        {#each heads as d (d)}<th scope="col">{d}</th>{/each}
        <th scope="col" class="side" aria-label="Hours that week" aria-hidden={!settings.weekTotals}>{settings.weekTotals ? 'h' : ''}</th>
      </tr>
    </thead>
    <tbody>
      {#each rows as row, w (w)}
        {@const inMonth = row.days.some((d) => d !== null)}
        {@const ms = settings.weekTotals && inMonth ? weekTotal(fasts, row) : 0}
        <tr>
          <th scope="row" class="side muted" aria-hidden={!settings.weekNumbers}>{settings.weekNumbers && inMonth ? rowWeek(row) : ''}</th>
          {#each row.days as day, d (d)}
            <td>
              {#if day !== null}
                {@const k = key(y, m, day)}
                {@const total = days.get(k)}
                {#if total}
                  <button
                    type="button"
                    class="day"
                    class:selected={selected === k}
                    class:today={todayKey === k}
                    style:--stage="var(--{STAGES[total.stage].id})"
                    aria-label="{longDate(new Date(y, m, day).getTime())}: {hoursOf(total.ms)} hours, {STAGES[total.stage].name}"
                    aria-pressed={selected === k}
                    onclick={() => (selected = selected === k ? null : k)}
                  >
                    <span class="date">{day}</span>
                  </button>
                {:else}
                  <span class="day muted" class:today={todayKey === k}>
                    <span class="date">{day}</span>
                  </span>
                {/if}
              {:else}
                <!-- Holds the row's height, so short months keep the grid's size. -->
                <span class="day" aria-hidden="true"><span class="date"> </span></span>
              {/if}
            </td>
          {/each}
          <td class="side muted" aria-hidden={!settings.weekTotals}>{ms ? `${hoursOf(ms)}h` : ''}</td>
        </tr>
      {/each}
    </tbody>
  </table>
{/snippet}

<div class="layout">
<Block title="Calendar" class="calendar-block" actions={legend}>
  <div class="swipe" bind:clientWidth={width} use:drag={monthDrag}>
    <div class="month">
      <button type="button" class="glyph" aria-label="Previous month" title="Previous month" onclick={() => step(-1)}>&lt;</button>
      <span class="when">
        <button type="button" class="word" data-pane="month" aria-label="Pick a month: {MONTHS[month]}" onclick={onPickMonth}>{MONTHS[month]}</button>
        <button type="button" class="word" data-pane="year" aria-label="Pick a year: {year}" onclick={onPickYear}>{year}</button>
      </span>
      <button type="button" class="glyph" aria-label="Next month" title="Next month" onclick={() => step(1)}>&gt;</button>
    </div>

    <div class="viewport">
      <div
        class="strip"
        class:sliding
        style:transform="translateX(calc({-100 - 100 * going}% + {shift}px))"
        ontransitionend={slid}
      >
        {#each around as m (m.year * 12 + m.month)}
          <!-- The neighbours wait out of sight: nothing in them is reached by touch or keys. -->
          <div class="panel" inert={m.by !== 0}>{@render grid(m.year, m.month)}</div>
        {/each}
      </div>
    </div>
  </div>
</Block>

<Block title="Fasts" class="fasts-block" headingRight={addButton}>
  <div class="content scroller">
  <div class="head">
    {#if selected}
      <p class="fields">{longDate(noonOf(selected))} · {count === 1 ? '1 fast' : `${count} fasts`}</p>
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

  {#each entries as { fast, gone } (fast.id)}
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
    padding-top: 0.2em;
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
    padding: 0.5em 0 0.2em;
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

  /* The month grids side by side, one panel wide each; only the strip moves, and only by
     transform, so a drag costs the compositor and nothing else. The ends are clipped. */
  .viewport {
    overflow-x: clip;
  }

  .strip {
    display: flex;
    will-change: transform;
  }

  .strip.sliding {
    transition: transform var(--slide);
  }

  .panel {
    flex: 0 0 100%;
    min-width: 0;
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

  /* Week numbers before a week, its hours after it. Both columns are always there and as
     wide as each other, so the seven days stay in the middle whichever is on. */
  .side {
    font-size: 0.8em;
    width: 4ch;
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

  button.day {
    background: none;
    border-color: transparent;
  }

  button.day .date {
    font-weight: 700;
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
