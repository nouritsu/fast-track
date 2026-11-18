<script lang="ts">
  import { weekdayHeads, type WeekStart } from '../fasting/calendar'
  import {
    fastLength,
    KG_PER_LB,
    percentOf,
    stageHours,
    streak,
    summarize,
    weightNumber,
    type Active,
    type Fast,
  } from '../fasting/fasts'
  import type { ScaleWeight } from '../fasting/openscale'
  import { NAME_WIDTH, STAGES, stageEnd } from '../fasting/stages'
  import {
    bestStreak,
    clockOfDay,
    dayGrid,
    daysIn,
    dayStrip,
    eatingWindow,
    goalStats,
    lengthBands,
    median,
    priorWindow,
    records,
    spanName,
    SPANS,
    spanWindow,
    stageReach,
    startOfDay,
    typicalClock,
    weekdays,
    weeklyRate,
    weighings,
    weightTrend,
    within,
    type Span,
  } from '../fasting/stats'
  import { DAY, dayMonth, HOUR, MINUTE, noonOf, shortDate, stepDay } from '../fasting/time'
  import { hm, pad, two } from '../ui/fields'
  import { apportion } from '../ui/progress'
  import Block from '../ui/Block.svelte'
  import Measure from '../ui/Measure.svelte'

  // The history in panes, one block each, scrolling as a column. Summary's top edge
  // picks the span the panes cover (remembered in the settings) and sets it against the
  // same span before; Length, Goal, Stages and Rhythm chart the fasts that ended in it,
  // Weight the weighings in it, and Records the whole history. The charts are drawn on
  // the text's grid: their labels in the app font, their marks in the stage colours.
  let {
    fasts,
    active,
    scale,
    unit,
    weekStart,
    span,
    now,
    onSpan,
  }: {
    fasts: Fast[]
    active: Active | null // drawn in the rhythm strip up to now
    scale: ScaleWeight[]
    unit: 'kg' | 'lb'
    weekStart: WeekStart
    span: Span
    now: number
    onSpan: (span: Span) => void
  } = $props()

  // To the minute: the clock ticks several times a second, and nothing here needs it.
  const minute = $derived(Math.floor(now / MINUTE) * MINUTE)
  const range = $derived(spanWindow(fasts, span, minute))
  const shown = $derived(within(fasts, range))
  const sum = $derived(summarize(shown))
  const prior = $derived.by(() => {
    const window = priorWindow(range, span)
    return window ? summarize(within(fasts, window)) : null
  })
  const spanText = $derived(span === 365 ? 'the last year' : `the last ${span} days`)
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
  const percent = (share: number) => `${Math.round(share * 100)}%`

  // The panes' inner width and a character's (Measure): charts are drawn in pixels to
  // that width, and text bars in as many cells as fit.
  let width = $state(0)
  let measured = $state(0)
  const ch = $derived(measured || 8)
  const cells = $derived(Math.max(20, Math.floor(width / ch)))
  const gutter = $derived(5 * ch) // left of each chart, for its labels
  const plot = $derived(Math.max(0, width - gutter))

  // Length: each fast a bar in its stages' colours, newest at the right, as many as fit
  // four pixels apiece; a white mark at the goal of those that fell short.
  const LENGTH_H = 104
  const bars = $derived([...shown].sort((a, b) => a.end - b.end).slice(-Math.max(1, Math.floor(plot / 4))))
  const barPitch = $derived(bars.length ? Math.min(16, plot / bars.length) : 0)
  const top = $derived(
    Math.max(24, Math.ceil(Math.max(0, ...bars.map((f) => Math.max(fastLength(f) / HOUR, f.goal))) / 12) * 12),
  )
  const ticks = $derived.by(() => {
    const step = 12 * Math.ceil(top / 48) // 12h up to two days, then wider
    return Array.from({ length: Math.floor(top / step) }, (_, i) => (i + 1) * step)
  })
  const ly = (hours: number) => 4 + (1 - hours / top) * (LENGTH_H - 8)
  const segments = (fast: Fast) => {
    const hours = fastLength(fast) / HOUR
    return STAGES.flatMap((s, i) => (hours > s.from ? [{ id: s.id, from: s.from, to: Math.min(hours, stageEnd(i)) }] : []))
  }
  const lengths = $derived(shown.map(fastLength))
  const bands = $derived(lengthBands(shown))
  const bandMost = $derived(Math.max(1, ...bands.map((b) => b.count)))
  const bandCells = $derived(Math.max(4, Math.min(24, cells - 11)))
  const bandFill = (count: number) => (count ? Math.max(1, Math.round((count / bandMost) * bandCells)) : 0)

  // Goal: the span's days in weeks, each in the colour of the deepest stage it reached,
  // filled when a fast met its goal and outlined when none did.
  const weeks = $derived(dayGrid(fasts, range, weekStart, Infinity))
  const grid = $derived(weeks.slice(-Math.max(1, Math.floor(plot / 7))))
  const cellPitch = $derived(grid.length ? Math.min(18, plot / grid.length) : 18)
  const cellGap = $derived(cellPitch >= 9 ? 2 : 1)
  const heads = $derived(weekdayHeads(weekStart))
  const goals = $derived(goalStats(shown))
  const best = $derived(bestStreak(shown))
  const perWeek = $derived((sum.count / daysIn(range)) * 7)

  // Stages: the span's hours as one text bar, shared by stage, as on Info.
  const hours = $derived(stageHours(shown))
  const reach = $derived(stageReach(shown))
  const runs = $derived(apportion(hours, cells))

  // Rhythm: the last fortnight, a row a day in half hours, filled while fasting.
  const SLOTS = 48
  const ROW = 10
  const stripDays = $derived(Math.min(14, daysIn(range)))
  const strip = $derived.by(() => {
    const periods = active ? [...fasts, { start: active.start, end: minute }] : fasts
    return Array.from({ length: stripDays }, (_, i) => {
      const day = startOfDay(stepDay(minute, i - stripDays + 1))
      // Runs of one stage, so each is one rect.
      const slots = dayStrip(periods, day, SLOTS)
      const runs: { at: number; length: number; stage: number }[] = []
      slots.forEach((stage, at) => {
        if (stage === null) return
        const last = runs.at(-1)
        if (last && last.stage === stage && last.at + last.length === at) last.length++
        else runs.push({ at, length: 1, stage })
      })
      return { day, weekday: new Date(day).getDay(), runs }
    })
  })
  const starts = $derived(typicalClock(shown.map((f) => f.start)))
  const ends = $derived(typicalClock(shown.map((f) => f.end)))
  const eating = $derived(eatingWindow(shown))
  const days = $derived(weekdays(shown, weekStart))
  const dayMost = $derived(Math.max(1, ...days.map((d) => d.hours ?? 0)))
  const WEEKDAY_H = 72

  // Weight: every weighing in the span as a dot, and the trend through them.
  const WEIGHT_H = 92
  const points = $derived(weighings(fasts, scale, range))
  const trend = $derived(weightTrend(points))
  const rate = $derived(weeklyRate(points))
  const inUnit = (kg: number) => (unit === 'kg' ? kg : kg / KG_PER_LB)
  const scaleY = $derived.by(() => {
    const values = points.map((p) => inUnit(p.kg))
    const [lo, hi] = [Math.min(...values), Math.max(...values)]
    const step = [0.5, 1, 2, 5, 10, 20].find((s) => (hi - lo) / s <= 3) ?? 50
    const from = Math.floor(lo / step) * step
    const to = Math.max(from + step, Math.ceil(hi / step) * step)
    const lines = Array.from({ length: Math.round((to - from) / step) + 1 }, (_, i) => from + i * step)
    return { lo, hi, from, to, step, lines }
  })
  const yOf = (value: number) => 6 + ((scaleY.to - value) / (scaleY.to - scaleY.from)) * (WEIGHT_H - 12) // in the unit
  const wy = (kg: number) => yOf(inUnit(kg))
  const firstAt = $derived(points[0]?.at ?? range.from)
  const wx = (at: number) => gutter + (range.to > firstAt ? ((at - firstAt) / (range.to - firstAt)) * (plot - 3) : plot / 2)
  /** A change in kg in the unit, signed: "-1.6", "+0.4", "±0.0". */
  const signed = (kg: number) => {
    const value = weightNumber(Math.abs(kg), unit)
    return `${Number(value) === 0 ? '±' : kg < 0 ? '-' : '+'}${value}`
  }
  const change = $derived(rate === null ? 0 : (rate * (points[points.length - 1].at - points[0].at)) / (7 * DAY))
  const weighed = $derived(scale.length > 0 || fasts.some((f) => f.weight !== null))

  // Records: the whole history.
  const record = $derived(records(fasts, weekStart))
  const label = (text: string) => text.padEnd(12)
</script>

{#snippet swatch(filled: boolean)}<svg class="swatch" viewBox="0 0 10 10" aria-hidden="true"
    >{#if filled}<rect class="key-met" width="10" height="10" rx="2" />{:else}<rect
        class="key-missed"
        x="0.75"
        y="0.75"
        width="8.5"
        height="8.5"
        rx="2"
      />{/if}</svg
  >{/snippet}

{#snippet spans()}
  <span class="spans" role="group" aria-label="Span of the stats">
    {#each SPANS as s (s)}<button type="button" class="span" class:on={span === s} aria-pressed={span === s} onclick={() => onSpan(s)}
        >{spanName(s)}</button
      >{/each}
  </span>
{/snippet}

<div class="panes">
  {#if !fasts.length}
    <Block title="Statistics"><p class="muted">No fasts yet.</p></Block>
  {:else}
    <Block title="Summary" headingRight={spans}>
      <Measure bind:width bind:ch={measured} />
      {#if sum.count}
        <p class="fields">{plural(sum.count, 'fast')} · {Math.round(sum.total / HOUR)}h · goal met {percent(sum.goalRate)}</p>
        <p class="fields">avg {hm(sum.average)} · streak {streak(fasts, minute)}</p>
      {:else}
        <p class="fields muted">No fasts in {spanText}.</p>
      {/if}
      {#if prior}
        <p class="fields muted">
          prior {spanName(span)}: {prior.count ? `${plural(prior.count, 'fast')} · avg ${hm(prior.average)} · ${percent(prior.goalRate)}` : 'no fasts'}
        </p>
      {/if}
    </Block>

    {#if sum.count && width}
      <Block title="Length" titleRight="median {hm(median(lengths))}">
        <svg
          class="chart"
          width={width}
          height={LENGTH_H}
          viewBox="0 0 {width} {LENGTH_H}"
          role="img"
          aria-label="The last {plural(bars.length, 'fast')} by length, each in the colours of the stages it went through"
        >
          {#each ticks as h (h)}
            <line class="rule" x1={gutter} x2={width} y1={ly(h)} y2={ly(h)} />
            <text class="axis" x={gutter - ch} y={ly(h)} text-anchor="end" dominant-baseline="central">{h}h</text>
          {/each}
          {#each bars as fast, i (fast.id)}
            {@const x = gutter + i * barPitch}
            {@const w = Math.max(1, barPitch - (barPitch > 6 ? 2 : 1))}
            <g>
              <title>{shortDate(fast.end)} · {hm(fastLength(fast))} · {percentOf(fastLength(fast), fast.goal)}% of {fast.goal}h</title>
              {#each segments(fast) as s (s.id)}
                <rect {x} y={ly(s.to)} width={w} height={ly(s.from) - ly(s.to)} style:fill="var(--{s.id})" />
              {/each}
              {#if fastLength(fast) < fast.goal * HOUR}
                <rect class="goal" {x} y={ly(fast.goal) - 1} width={w} height="2" />
              {/if}
            </g>
          {/each}
          <line class="base" x1={gutter} x2={width} y1={ly(0)} y2={ly(0)} />
        </svg>
        <p class="fields muted">
          {bars.length < shown.length ? `last ${bars.length} of ${shown.length}` : plural(bars.length, 'fast')} · <span class="mark">━</span> goal missed
        </p>
        <p class="fields">avg {hm(sum.average)} · max {hm(sum.longest)} · min {hm(Math.min(...lengths))}</p>
        <div class="bands">
          {#each bands as band (band.name)}
            {@const n = bandFill(band.count)}
            <p class="fields">
              <span class="muted">{band.name.padEnd(6)}</span> <span class="accent">{'█'.repeat(n)}</span><span class="shade"
                >{'░'.repeat(bandCells - n)}</span
              >{pad(band.count, 4)}
            </p>
          {/each}
        </div>
      </Block>

      <Block title="Goal" titleRight="{percent(sum.goalRate)} met">
        <svg
          class="chart"
          width={width}
          height={7 * cellPitch}
          viewBox="0 0 {width} {7 * cellPitch}"
          role="img"
          aria-label="{plural(grid.length, 'week')} of days, each in the colour of the deepest stage reached, filled where the goal was met"
        >
          {#each [0, 2, 4, 6] as row (row)}
            <text class="axis" x={gutter - ch} y={(row + 0.5) * cellPitch} text-anchor="end" dominant-baseline="central">{heads[row]}</text>
          {/each}
          {#each grid as week, w (week.start)}
            {#each week.days as day, d (d)}
              {#if day}
                {@const size = cellPitch - cellGap}
                {@const x = gutter + w * cellPitch}
                {@const y = d * cellPitch}
                {#if day.stage === null}
                  <rect class="empty" {x} {y} width={size} height={size} rx="2" />
                {:else if day.met}
                  <rect {x} {y} width={size} height={size} rx="2" style:fill="var(--{STAGES[day.stage].id})" />
                {:else}
                  <rect
                    class="missed"
                    x={x + 0.75}
                    y={y + 0.75}
                    width={size - 1.5}
                    height={size - 1.5}
                    rx="2"
                    style:stroke="var(--{STAGES[day.stage].id})"
                  />
                {/if}
              {/if}
            {/each}
          {/each}
        </svg>
        <p class="fields muted">
          {grid.length < weeks.length ? `last ${grid.length} weeks · ` : ''}{@render swatch(true)} met · {@render swatch(false)} missed
        </p>
        <p class="fields">best streak {plural(best.days, 'day')} · {perWeek.toFixed(1)} a week</p>
        <p class="fields">near misses {goals.near} · avg {percent(goals.progress)} of goal</p>
      </Block>

      <Block title="Stages" titleRight="{Math.round(sum.total / HOUR)}h">
        <p class="fields stagebar" aria-hidden="true">
          {#each STAGES as stage, i (stage.id)}<span style:color="var(--{stage.id})">{'█'.repeat(runs[i])}</span>{/each}
        </p>
        {#each STAGES as stage, i (stage.id)}
          <p class="fields">
            <span style:color="var(--{stage.id})">■ {stage.name.padEnd(NAME_WIDTH)}</span>{pad(Math.round(hours[i]), 5)}h <span class="muted"
              >reached {pad(percent(reach[i]), 4)}</span
            >
          </p>
        {/each}
      </Block>

      <Block title="Rhythm">
        <svg
          class="chart"
          width={width}
          height={stripDays * ROW + 16}
          viewBox="0 0 {width} {stripDays * ROW + 16}"
          role="img"
          aria-label="The last {plural(stripDays, 'day')} over 24 hours, filled while fasting, in the colour of the stage"
        >
          {#each strip as row, r (row.day)}
            {#if row.weekday === weekStart}
              <text class="axis" x={gutter - ch} y={r * ROW + 3.5} text-anchor="end" dominant-baseline="central">{heads[0]}</text>
            {/if}
            <rect class="empty" x={gutter} y={r * ROW} width={plot} height={ROW - 3} />
            {#each row.runs as run (run.at)}
              <rect
                x={gutter + (run.at * plot) / SLOTS}
                y={r * ROW}
                width={(run.length * plot) / SLOTS}
                height={ROW - 3}
                style:fill="var(--{STAGES[run.stage].id})"
              />
            {/each}
          {/each}
          {#each [0, 6, 12, 18, 24] as h (h)}
            <text
              class="axis"
              x={gutter + (h / 24) * plot}
              y={stripDays * ROW + 8}
              text-anchor={h === 0 ? 'start' : h === 24 ? 'end' : 'middle'}
              dominant-baseline="central">{two(h)}</text
            >
          {/each}
        </svg>
        <p class="fields muted">last {plural(stripDays, 'day')}, today at the bottom</p>
        {#if starts && ends}
          <p class="fields">starts ~{clockOfDay(starts.minutes)} <span class="muted">±{hm(starts.spread * MINUTE)}</span></p>
          <p class="fields">{'ends'.padEnd(6)} ~{clockOfDay(ends.minutes)} <span class="muted">±{hm(ends.spread * MINUTE)}</span></p>
        {/if}
        {#if eating !== null}<p class="fields">eating window {hm(eating)} <span class="muted">on average</span></p>{/if}
        <svg
          class="chart weekdays"
          width={width}
          height={WEEKDAY_H}
          viewBox="0 0 {width} {WEEKDAY_H}"
          role="img"
          aria-label="Average hours by weekday: {days.map((d) => `${d.head} ${d.hours === null ? 'none' : Math.round(d.hours)}`).join(', ')}"
        >
          {#each days as day, i (day.head)}
            {@const pitch = plot / days.length}
            {@const w = Math.min(pitch - 6, 3 * ch)}
            {@const x = gutter + i * pitch + (pitch - w) / 2}
            {@const h = day.hours === null ? 0 : (day.hours / dayMost) * (WEEKDAY_H - 30)}
            <text class="axis" x={x + w / 2} y={WEEKDAY_H - 21 - h} text-anchor="middle" dominant-baseline="central"
              >{day.hours === null ? '--' : Math.round(day.hours)}</text
            >
            <rect class="column" {x} y={WEEKDAY_H - 14 - h} width={w} height={h} />
            <text class="head" x={x + w / 2} y={WEEKDAY_H - 7} text-anchor="middle" dominant-baseline="central">{day.head}</text>
          {/each}
        </svg>
        <p class="fields muted">average hours by weekday</p>
      </Block>
    {/if}

    <Block title="Weight" titleRight={trend.length ? `${weightNumber(trend[trend.length - 1].kg, unit)} ${unit}` : ''}>
      {#if points.length && width}
        <svg
          class="chart"
          width={width}
          height={WEIGHT_H}
          viewBox="0 0 {width} {WEIGHT_H}"
          role="img"
          aria-label="{plural(points.length, 'weighing')} as dots, and the trend through them"
        >
          {#each scaleY.lines as value (value)}
            <line class="rule" x1={gutter} x2={width} y1={yOf(value)} y2={yOf(value)} />
            <text
              class="axis"
              x={gutter - ch}
              y={yOf(value)}
              text-anchor="end"
              dominant-baseline="central">{scaleY.step < 1 ? value.toFixed(1) : value}</text
            >
          {/each}
          {#each points as p, i (i)}
            <circle class="dot" cx={wx(p.at)} cy={wy(p.kg)} r="2" />
          {/each}
          {#if trend.length > 1}
            <polyline class="trend" points={trend.map((t) => `${wx(t.at)},${wy(t.kg)}`).join(' ')} />
          {/if}
        </svg>
        {#if rate !== null}
          <p class="fields">{signed(change)} {unit} since {dayMonth(points[0].at, minute)} · {signed(rate)} {unit}/wk</p>
        {/if}
        <p class="fields muted">
          low {weightNumber(Math.min(...points.map((p) => p.kg)), unit)} · high {weightNumber(Math.max(...points.map((p) => p.kg)), unit)} · {plural(
            points.length,
            'weighing',
          )}
        </p>
      {:else if weighed}
        <p class="fields muted">No weighings in {span ? spanText : 'the history'}.</p>
      {:else}
        <p class="muted">Add a weight when you end a fast, or connect openScale in Options.</p>
      {/if}
    </Block>

    <Block title="Records" titleRight="all time">
      {#if record.longest}
        <p class="fields">{label('longest')}{hm(fastLength(record.longest))} <span class="muted">{dayMonth(record.longest.end, minute)}</span></p>
      {/if}
      {#if record.streak.from && record.streak.to}
        <p class="fields">
          {label('best streak')}{plural(record.streak.days, 'day')} <span class="muted"
            >{record.streak.days > 1
              ? `${dayMonth(noonOf(record.streak.from), minute)}–${dayMonth(noonOf(record.streak.to), minute)}`
              : dayMonth(noonOf(record.streak.from), minute)}</span
          >
        </p>
      {/if}
      {#if record.week}
        <p class="fields">{label('best week')}{Math.round(record.week.ms / HOUR)}h <span class="muted">from {dayMonth(record.week.start, minute)}</span></p>
      {/if}
      <p class="fields">{label('in all')}{(record.total / DAY).toFixed(record.total < 10 * DAY ? 1 : 0)} days of fasting</p>
      {#if record.first}
        <p class="fields muted">{plural(record.count, 'fast')} since {dayMonth(record.first.start, minute)}</p>
      {/if}
    </Block>
  {/if}
</div>

<style>
  /* The spans in Summary's top edge: the one shown in the accent, bold. The tap area
     reaches above and below the line without moving the words off it. */
  .spans {
    display: inline-flex;
    gap: 0.4ch;
  }

  .span {
    margin: -0.45em 0;
    padding: 0.45em 0.5ch;
    background: none;
    border: none;
    border-radius: 0;
    color: var(--muted);
    line-height: 1.2;
  }

  .span.on {
    color: var(--accent);
    font-weight: 700;
  }

  .chart {
    display: block;
    margin: 0.3em 0 0.2em;
    overflow: visible;
    font-variant-ligatures: none;
  }

  .axis {
    fill: var(--muted);
    font-size: 0.8em;
  }

  .rule {
    stroke: var(--button);
    stroke-width: 1;
  }

  .base {
    stroke: var(--border);
    stroke-width: 1;
  }

  .goal {
    fill: var(--fg);
  }

  .mark {
    color: var(--fg);
  }

  .empty {
    fill: var(--button);
  }

  .missed {
    fill: none;
    stroke-width: 1.5;
  }

  .dot {
    fill: var(--muted);
  }

  /* The goal grid's key: a filled and an outlined cell at the text's size. */
  .swatch {
    width: 0.7em;
    height: 0.7em;
    vertical-align: -0.05em;
  }

  .key-met {
    fill: var(--muted);
  }

  .key-missed {
    fill: none;
    stroke: var(--muted);
    stroke-width: 1.5;
  }

  .trend {
    fill: none;
    stroke: var(--accent);
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  .accent {
    color: var(--accent);
  }

  /* The unfilled part of a text bar, as on the Fast page. */
  .shade {
    color: var(--button-border);
  }

  .bands,
  .weekdays {
    margin-top: 0.5em;
  }

  .column {
    fill: var(--accent);
  }

  .head {
    fill: var(--fg);
    font-size: 0.8em;
  }

  .stagebar {
    margin: 0.3em 0 0.4em;
    line-height: 1.2;
  }
</style>
