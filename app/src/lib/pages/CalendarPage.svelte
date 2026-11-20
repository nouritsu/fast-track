<script lang="ts">
  import { dayTotals, hoursOf, monthRows, monthSummary, rowWeek, weekdayHeads, weekTotal } from '../fasting/calendar'
  import {
    bmi,
    deepestStage,
    endedBy,
    fastLength,
    goalTone,
    nearMiss,
    pastGoal,
    percentOf,
    progressOf,
    showBmi,
    showWeight,
    soFar,
    timeInDeepest,
    type Fast,
  } from '../fasting/fasts'
  import { weightOf, type ScaleWeight } from '../fasting/openscale'
  import { STAGES } from '../fasting/stages'
  import type { Settings } from '../fasting/store'
  import { dayKey, floorMinute, longDate, MONTHS, nearClock, noonOf } from '../fasting/time'
  import { reducedMotion } from '../motion/shuffle'
  import { carries, drag, type DragOptions } from '../ui/drag'
  import { tick } from '../ui/haptics'
  import { clock, hm, overGoal, pad } from '../ui/fields'
  import { stageCells } from '../ui/progress'
  import Icon from '../ui/Icon.svelte'
  import Block from '../ui/Block.svelte'
  import Measure from '../ui/Measure.svelte'
  import ShuffleText from '../ui/ShuffleText.svelte'

  // Two panels. The Calendar: a month in which each day that ended a fast is in the
  // colour of the deepest stage it reached, and week numbers
  // and weekly totals as the settings say; tapping the month or the year opens a pane
  // to pick another (App), and the stage legend sits in its bottom edge. The Fasts:
  // the month's summary and its fasts (or a tapped day's), newest first, planned ones
  // tracked as they go. Delete takes effect at once; the entry turns into an Undo line
  // until the page is left.
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

  // The grid and the month's numbers count the fasts that have ended; the list also
  // tracks the planned ones, ending later.
  const minute = $derived(floorMinute(now))
  const history = $derived(endedBy(fasts, minute))
  const days = $derived(dayTotals(history, settings.nearMiss))
  const heads = $derived(weekdayHeads(settings.weekStart))
  const key = (y: number, m: number, day: number) => dayKey(new Date(y, m, day))
  const todayKey = $derived(dayKey(minute))
  const monthKey = $derived(key(year, month, 1).slice(0, 7))
  const summary = $derived(monthSummary(history, year, month))

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

  // Each fast's progress line: as many cells as fit beside its "103% of 16h", each in
  // the colour of the stage it falls in, as under the Fast page's timer.
  let listWidth = $state(0)
  let measured = $state(0)
  const SUFFIX = 15 // " 103% of 16h", the entry's inset each side, and a spare cell
  const lineCells = $derived(Math.max(8, Math.floor(listWidth / (measured || 8)) - SUFFIX))
  const STAGE_IDS = STAGES.map((s) => s.id)
  // A near miss's line shows what it fell short by, hatched.
  const lineOf = (fast: Fast, length: number, near: boolean) =>
    stageCells(
      STAGES.map((s) => s.from / fast.goal),
      STAGE_IDS,
      progressOf(length, fast.goal),
      lineCells,
      near,
    )
  const height = $derived(settings.bmi ? settings.height : null)

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

  // Swipes: sideways on the month slides it; on a fast, left edits it and right deletes
  // it (with Undo). Both keep the press from the page swipe.
  let width = $state(1)
  const monthDrag: DragOptions = {
    axis: 'x',
    claim: true,
    onStart: settle, // a drag takes over from a slide still going
    onMove: (dx) => (shift = Math.max(-width, Math.min(width, dx))),
    onEnd: (dx, velocity) => glide(carries(dx, width, velocity, 0.2) ? (dx < 0 ? 1 : -1) : 0),
  }

  // A fast follows the finger at RESIST of its pace. Pulled past ARM of the width, or
  // flung once past half of that, it acts: the word behind it lights up and the phone
  // ticks as it crosses. Short of that, it springs back.
  const RESIST = 0.75
  const ARM = 0.3
  const FLING = 0.8 // px per ms
  const LEAVE_MS = 200 // a deleted fast sliding out (.entry.leaving)
  let swiping = $state<{ id: string; dx: number } | null>(null)
  let leaving = $state<string | null>(null)
  const armed = (dx: number) => Math.abs(dx) >= width * ARM
  const acts = (dx: number, velocity: number) =>
    armed(dx) || (Math.abs(dx) >= (width * ARM) / 2 && Math.abs(velocity) > FLING && Math.sign(velocity) === Math.sign(dx))

  const entryDrag = (fast: Fast): DragOptions => ({
    axis: 'x',
    claim: true,
    enabled: () => leaving === null,
    onMove: (dx) => {
      const shown = dx * RESIST
      if (armed(shown) !== armed(swiping?.dx ?? 0)) tick()
      swiping = { id: fast.id, dx: shown }
    },
    onEnd: (dx, velocity) => {
      swiping = null
      const shown = dx * RESIST
      if (!acts(shown, velocity * RESIST)) return
      if (shown < 0) return onEdit(fast)
      if (reducedMotion()) return remove(fast)
      leaving = fast.id
      setTimeout(() => {
        leaving = null
        remove(fast)
      }, LEAVE_MS)
    },
  })
  const offset = (id: string) => (leaving === id ? width : swiping?.id === id ? swiping.dx : 0)
</script>

{#snippet legend()}
  <!-- The stage colours, set into the edge between the calendar and the fasts, and the
       hatching of a near miss. -->
  <span class="legend" aria-label="Stage colours and near misses"
    >{#each STAGES as stage (stage.id)}<span><span style:color="var(--{stage.id})">■</span> {stage.name.slice(0, 3).toLowerCase()}</span
      >{/each}<span><span class="near-key" aria-hidden="true"></span> near</span></span
  >
{/snippet}

{#snippet addButton()}
  <button type="button" class="word" onclick={() => onAdd(selected)}><span class="icon" aria-hidden="true"><Icon name="add" /></span>add</button>
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
        {@const ms = settings.weekTotals && inMonth ? weekTotal(history, row) : 0}
        <tr>
          <th scope="row" class="side muted" aria-hidden={!settings.weekNumbers}>{settings.weekNumbers && inMonth ? rowWeek(row) : ''}</th>
          {#each row.days as day, d (d)}
            <td>
              {#if day !== null}
                {@const k = key(y, m, day)}
                {@const total = days.get(k)}
                <!-- Every day can be picked: one with fasts shows them, any shows Add for it. -->
                <button
                  type="button"
                  class="day"
                  class:fasted={total}
                  class:selected={selected === k}
                  class:today={todayKey === k}
                  class:near={total?.near}
                  style:--stage={total ? `var(--${STAGES[total.stage].id})` : undefined}
                  aria-label="{longDate(new Date(y, m, day).getTime())}: {total
                    ? `${hoursOf(total.ms)} hours, ${STAGES[total.stage].name}${total.near ? ', a near miss' : ''}`
                    : 'no fasts'}"
                  aria-pressed={selected === k}
                  onclick={() => (selected = selected === k ? null : k)}
                >
                  <span class="date">{day}</span>
                </button>
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
<Block title="Calendar" icon="calendar_month" class="calendar-block" actions={legend}>
  <div class="swipe" bind:clientWidth={width} use:drag={monthDrag}>
    <div class="month">
      <button type="button" class="glyph" aria-label="Previous month" title="Previous month" onclick={() => step(-1)}>&lt;</button>
      <span class="when">
        <button type="button" class="word" data-pane="month" aria-label="Pick a month: {MONTHS[month]}" onclick={onPickMonth}
          ><ShuffleText text={MONTHS[month]} /></button
        >
        <button type="button" class="word" data-pane="year" aria-label="Pick a year: {year}" onclick={onPickYear}
          ><ShuffleText text={String(year)} /></button
        >
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

<Block title="Fasts" icon="history" class="fasts-block" headingRight={addButton}>
  <div class="content scroller">
  <Measure bind:width={listWidth} bind:ch={measured} />
  <div class="head">
    {#if selected}
      <p class="fields">{longDate(noonOf(selected))} · <span class="value">{count}</span> {count === 1 ? 'fast' : 'fasts'}</p>
    {:else if summary.count}
      <p class="fields">
        {MONTHS[month]} · <span class="value">{summary.count}</span>
        {summary.count === 1 ? 'fast' : 'fasts'} · <span class="value">{hoursOf(summary.total)}</span>h
      </p>
    {:else}
      <p class="fields muted">{MONTHS[month]} · no fasts</p>
    {/if}
  </div>
  {#if !selected && summary.count}
    <p class="fields muted summary">
      avg <span class="value">{hm(summary.average)}</span> · goal met <span style:color="var(--{goalTone(summary.goalRate)})"
        >{Math.round(summary.goalRate * 100)}%</span
      > · longest <span class="value">{hm(summary.longest)}</span>
    </p>
  {/if}

  {#each entries as { fast, gone } (fast.id)}
    <hr class="split" />
    {#if gone}
      <div class="entry gone">
        <span class="muted">Deleted {longDate(fast.end)}</span>
        <button type="button" class="word" onclick={() => restore(fast)}><span class="icon" aria-hidden="true"><Icon name="undo" /></span>undo</button>
      </div>
    {:else}
      <!-- A planned fast, ending later, is tracked as far as it has got. -->
      {@const planned = fast.end > minute}
      {@const reached = soFar(fast, minute)}
      {@const stage = STAGES[deepestStage(reached)]}
      {@const weight = planned && fast.weight === null ? null : weightOf(fast, scale)}
      {@const percent = percentOf(fastLength(reached), fast.goal)}
      {@const dx = offset(fast.id)}
      <div class="swipe row" use:drag={entryDrag(fast)}>
      <!-- Behind the fast: Delete uncovered at the left by a swipe right, Edit at the right by a swipe left. -->
      <span class="reveal delete" class:armed={dx > 0 && armed(dx)} aria-hidden="true"><Icon name="delete" /> Delete</span>
      <span class="reveal edit" class:armed={dx < 0 && armed(dx)} aria-hidden="true">Edit <Icon name="edit" /></span>
      <div
        class="entry"
        style:transform="translateX({dx}px)"
        class:moving={swiping?.id === fast.id}
        class:lifted={dx !== 0}
        class:leaving={leaving === fast.id}
      >
        <div class="title">
          <h3>{longDate(fast.end)}</h3>
          <button type="button" class="glyph" aria-label="Edit" title="Edit" onclick={() => onEdit(fast)}><Icon name="edit" /></button>
          <button type="button" class="glyph" aria-label="Delete" title="Delete" onclick={() => remove(fast)}><Icon name="close" /></button>
        </div>
        <p class="fields">
          <span class="muted">from</span>
          {nearClock(fast.start, fast.end)} <span class="muted">to</span>
          {clock(new Date(fast.end))} · {hm(fastLength(fast))}
        </p>
        <p class="fields" aria-label="{percent}% of {fast.goal}h{!planned && nearMiss(fast, settings.nearMiss) ? ', a near miss' : ''}">
          <span aria-hidden="true"
            >{#each lineOf(fast, fastLength(reached), !planned && nearMiss(fast, settings.nearMiss)) as run, i (i)}<span
                style:color={run.color ? `var(--${run.color})` : undefined}
                class:shade={!run.color}
                class:shortfall={run.hatched}>{run.text}</span
              >{/each}</span
          >
          <!-- Under way, the share takes a colour only once the goal is met. -->
          <span style:color={planned && percent < 100 ? undefined : `var(--${goalTone(percent / 100)})`}>{pad(percent, 3)}%</span> of {fast.goal}h
        </p>
        <p class="fields detail">
          {#if planned && minute < fast.start}<span class="muted">planned</span> · starts in <span class="value">{hm(fast.start - minute)}</span
            >{:else if planned}{hm(timeInDeepest(reached))} in <span style:color="var(--{stage.id})">{stage.name}</span> · <span class="muted"
              >under way</span
            > · <span class="value">{hm(fast.end - minute)}</span> left{:else}{hm(timeInDeepest(fast))} in <span style:color="var(--{stage.id})"
              >{stage.name}</span
            > · {overGoal(pastGoal(fast))}{/if}
        </p>
        {#if weight}<p class="note">
            <span class="icon" aria-hidden="true"><Icon name="monitor_weight" /></span>{showWeight(weight.kg, unit)}{#if height !== null}{' · '}BMI
              {showBmi(bmi(weight.kg, height))}{/if}{#if weight.scale}{' '}<span class="muted">(openScale)</span>{/if}
          </p>{/if}
        {#if fast.brokeWith}<p class="note" title="Broke with">
            <span class="icon" aria-hidden="true"><Icon name="restaurant" /></span><span class="hidden-label">{'Broke with: '}</span>{fast.brokeWith}
          </p>{/if}
        {#if fast.note}<p class="note"><span class="icon" aria-hidden="true"><Icon name="notes" /></span>{fast.note}</p>{/if}
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

  /* Behind a fast, uncovered as it is swiped: muted until the swipe would act, then in
     its colour. */
  .reveal {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    color: var(--muted);
    transition: color 0.15s ease;
  }

  .reveal.delete {
    left: 1ch;
  }

  .reveal.edit {
    right: 1ch;
  }

  .reveal.delete.armed {
    color: var(--bad);
  }

  .reveal.edit.armed {
    color: var(--accent);
  }

  /* A fast, inset a character each side; the Undo line keeps the same room. */
  .entry {
    position: relative;
    padding: 0.5em 1ch 0.2em;
    background: var(--bg);
    border-radius: var(--radius);
    /* Let go short of acting, it springs back, a little past its place, its outline
       fading as it settles. */
    transition:
      transform 0.35s cubic-bezier(0.3, 1.4, 0.6, 1),
      box-shadow 0.35s ease;
  }

  /* Off its place, the fast shows its edges, over the track it slides along. */
  .entry.lifted {
    box-shadow: inset 0 0 0 1px var(--accent);
  }

  .row:has(.entry.lifted) {
    background: var(--button);
    border-radius: var(--radius);
  }

  /* Deleted, it slides on out to the right. */
  .entry.leaving {
    transition: transform 0.2s cubic-bezier(0.32, 0, 0.67, 0);
  }

  /* Under the finger it follows at once; only its outline eases in. */
  .entry.moving {
    transition: box-shadow 0.15s ease;
  }

  :global(:root[data-still]) .entry {
    transition: none;
  }

  /* The month's numbers stand out from their words. */
  .value {
    color: var(--accent);
  }

  /* The unfilled part of a progress line, as in Stats. */
  .shade {
    color: var(--button-border);
  }

  /* A near miss's shortfall: fine diagonals across its cells, as tall as the filled
     blocks, in the colours it fell short of. The cells' own glyphs are hidden; they only
     keep the width. */
  .shortfall {
    -webkit-text-fill-color: transparent;
    background: repeating-linear-gradient(-45deg, currentColor 0 1px, transparent 1px 3px);
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

  /* A day without a fast is muted; one that ended a fast is bold in its stage's colour. */
  button.day {
    background: none;
    border-color: transparent;
    color: var(--muted);
  }

  button.day.fasted .date {
    font-weight: 700;
    color: var(--stage);
  }

  button.day.selected {
    border-color: var(--accent);
  }

  /* A near miss: faint diagonal lines behind the date in its stage's colour, as the
     hatched cells in Stats' goal grid; the legend's key in the muted colour. */
  button.day.near {
    background: repeating-linear-gradient(-45deg, color-mix(in srgb, var(--stage) 45%, transparent) 0 1px, transparent 1px 3px);
  }

  .near-key {
    display: inline-block;
    box-sizing: border-box;
    width: 0.75em;
    height: 0.75em;
    vertical-align: -0.05em;
    border: 1px solid var(--muted);
    border-radius: 2px;
    background: repeating-linear-gradient(-45deg, var(--muted) 0 1px, transparent 1px 3px);
  }

  /* Today is underlined in the accent; without a fast it is in the accent too, and a day
     that ended one keeps its stage's colour. */
  .today .date {
    text-decoration: underline 2px var(--accent);
    text-underline-offset: 0.15em;
  }

  button.day.today:not(.fasted) .date {
    color: var(--accent);
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

  /* Said to a screen reader, which skips the icon; not drawn. */
  .hidden-label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  /* Inside the page's scrolling content, a split stays within it. */
  hr.split {
    margin: 0.6em 0 0;
  }
</style>
