<script lang="ts">
  import { Capacitor } from '@capacitor/core'
  import { onMount } from 'svelte'
  import { askAlerts } from './lib/fasting/alerts'
  import {
    deepestStage,
    earliestStart,
    fastLength,
    eatingLeft,
    milestones,
    percentOf,
    progressOf,
    type Fast,
  } from './lib/fasting/fasts'
  import { NAME_WIDTH, STAGES, stageIndex } from './lib/fasting/stages'
  import { Tracker } from './lib/fasting/tracker.svelte'
  import { dayClock, floorMinute, HOUR, nearClock } from './lib/fasting/time'
  import { reducedMotion } from './lib/motion/shuffle'
  import CalendarPage from './lib/pages/CalendarPage.svelte'
  import InfoPage from './lib/pages/InfoPage.svelte'
  import OptionsPage from './lib/pages/OptionsPage.svelte'
  import StatsPage from './lib/pages/StatsPage.svelte'
  import EditPane from './lib/panes/EditPane.svelte'
  import GoalPane from './lib/panes/GoalPane.svelte'
  import MonthPane from './lib/panes/MonthPane.svelte'
  import StartPane from './lib/panes/StartPane.svelte'
  import YearPane from './lib/panes/YearPane.svelte'
  import { currentTheme, revealTheme, saveTheme, THEMES } from './lib/theme'
  import Block, { type Tone } from './lib/ui/Block.svelte'
  import Hero from './lib/ui/Hero.svelte'
  import ShuffleText from './lib/ui/ShuffleText.svelte'
  import TabBar, { type Tab } from './lib/ui/TabBar.svelte'
  import TypeText from './lib/ui/TypeText.svelte'
  import { carries, drag, resist, type DragOptions } from './lib/ui/drag'
  import { dashes, duration } from './lib/ui/fields'
  import { buzz } from './lib/ui/haptics'
  import { stageCells } from './lib/ui/progress'

  // Fast Track: five pages side by side, switched by the tabs along the bottom or a
  // swipe. The Fast page is one panel: the goal's share sits in its top edge, a
  // coloured progress line under the timer, the fast's status at its top, and its buttons in its bottom
  // edge. A fast starts at the gate (now) or from Start at (earlier), runs until End
  // fast, and ends on "Done!". Start time, Goal and Edit fast open as panes hung below
  // the current page: the page slides up and off the top, pushed by the pane.
  type Phase = 'loading' | 'ready' | 'running' | 'done'
  type PageId = 'fast' | 'calendar' | 'stats' | 'options' | 'info'
  type PaneId = 'start' | 'goal' | 'edit' | 'month' | 'year'
  type HeroMode = 'left' | 'elapsed'

  const TABS: Tab<PageId>[] = [
    { id: 'fast', label: 'Fast' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'stats', label: 'Stats' },
    { id: 'options', label: 'Options' },
    { id: 'info', label: 'Info' },
  ]
  const COLORS = STAGES.map((s) => s.id)
  const DISARM_MS = 3000 // Cancel stays armed this long for the second press
  const DRAW_MS = 700 // the progress line draws in while the hero shuffles in, within its 700 ms
  const PANE_OUT_MS = 240 // the page's slide back down when a pane closes (.page's transition)
  const DATE_FRAME = '[]%·: ' // "Tue 06:30" dashes to "--- --:--"

  const tracker = new Tracker()
  let page = $state(0)
  let phase = $state<Phase>('loading')
  let revealed = $state(false) // the hero has locked; the detail settles in
  let ended = $state<Fast | null>(null) // the fast the ending shows
  let now = $state(Date.now())
  let theme = $state(currentTheme()) // what the theme button shows; the page follows
  let switching = false
  // The month the calendar shows: here, so its month and year panes can change it.
  let calYear = $state(new Date().getFullYear())
  let calMonth = $state(new Date().getMonth())
  const calToday = () => {
    const d = new Date()
    calYear = d.getFullYear()
    calMonth = d.getMonth()
    closePane()
  }

  let pane = $state<PaneId | null>(null) // the open pane
  let shownPane = $state<PaneId | null>(null) // the pane drawn; it stays while the page slides back
  let paneHost = $state<number | null>(null) // the page it hangs below
  let paneTimer = 0
  let paneHeight = $state(0) // the open pane's height: how far it pushes its page
  // Panes opened from the top of a page hang above it and push it down: the calendar's
  // month and year, whose buttons sit at its top.
  const FROM_TOP: PaneId[] = ['month', 'year']
  const fromTop = $derived(shownPane !== null && FROM_TOP.includes(shownPane))
  let editing = $state<{ fast: Fast; isNew: boolean } | null>(null)
  let heroMode = $state<HeroMode>(savedHeroMode())
  let drawn = $state(1) // how much of the progress line has drawn in, 0 to 1
  let armed = $state(false)
  let disarm = 0
  let failure = $state('')

  const active = $derived(tracker.active)
  const settings = $derived(tracker.settings)
  const goal = $derived(phase === 'running' ? (active?.goal ?? settings.goal) : phase === 'done' && ended ? ended.goal : settings.goal)
  // Until the hero locks on a fast started now, nothing has elapsed.
  const elapsed = $derived(
    phase === 'running' ? (active ? Math.max(0, now - active.start) : 0) : phase === 'done' && ended ? fastLength(ended) : 0,
  )
  const progress = $derived(progressOf(elapsed, goal))
  const percent = $derived(percentOf(elapsed, goal))
  const tone = $derived<Tone>(phase === 'running' || phase === 'done' ? (progress >= 1 ? 'ok' : progress >= 0.5 ? 'warn' : '') : '')
  const stage = $derived(stageIndex(elapsed / HOUR))
  const left = $derived(goal * HOUR - elapsed)
  const eating = $derived(phase === 'ready' ? eatingLeft(tracker.fasts, now) : 0)

  const heroText = $derived(heroMode === 'elapsed' ? duration(elapsed) : left > 0 ? duration(left) : `+${duration(-left)}`)
  // The goal's progress as coloured text under the timer, each cell in its stage's colour.
  const cellsFor = (goalHours: number, reached: number) =>
    stageCells(
      STAGES.map((s) => s.from / goalHours),
      COLORS,
      reached,
    )
  const toneColor = (t: Tone) => (t ? `var(--${t})` : undefined)

  const heroDetail = $derived(heroMode === 'elapsed' ? `of ${goal}h` : left > 0 ? `left of ${goal}h` : `past ${goal}h`)

  // What comes next: the next stage or the goal, else the stage the fast is in.
  const nextLine = $derived.by(() => {
    if (!active) return ''
    const next = milestones(active).find((m) => m.at > now)
    if (!next) return `${STAGES[stage].name} since ${nearClock(active.start + STAGES[stage].from * HOUR, now)}.`
    return `${next.stage === null ? 'Goal' : STAGES[next.stage].name} at ${nearClock(next.at, now)}.`
  })
  const nextMark = $derived<[number, number]>([nextLine.lastIndexOf(' ') + 1, nextLine.length - 1])

  // Waiting at the gate, every status field shows dashes at its normal width.
  const dashed = $derived(phase === 'ready' || phase === 'loading')
  const show = (text: string, keep?: string) => (dashed ? dashes(text, keep) : text)
  const shownStart = $derived(phase === 'done' && ended ? ended.start : (active?.start ?? now))
  const shownEnd = $derived(phase === 'done' && ended ? ended.end : shownStart + goal * HOUR)

  onMount(() => {
    const timer = setInterval(() => (now = Date.now()), 200)
    attempt(async () => {
      await tracker.load()
      if (tracker.active) begin()
    }).finally(() => {
      // Storage that fails to load still leaves a working gate; the alert says why.
      if (phase === 'loading') phase = 'ready'
    })
    // Back in front, read openScale again: a weighing may have come in meanwhile.
    const back = () => document.visibilityState === 'visible' && void tracker.loadScale()
    document.addEventListener('visibilitychange', back)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', back)
    }
  })

  /** Runs something that reads or writes storage; a failure shows as an alert. */
  async function attempt(task: () => Promise<void>) {
    try {
      await task()
    } catch (error) {
      failure = `Storage failed: ${error instanceof Error ? error.message : String(error)}`
      setTimeout(() => (failure = ''), 6000)
    }
  }

  function savedHeroMode(): HeroMode {
    try {
      return localStorage.getItem('hero') === 'elapsed' ? 'elapsed' : 'left'
    } catch {
      return 'left'
    }
  }

  function toggleHero() {
    heroMode = heroMode === 'left' ? 'elapsed' : 'left'
    try {
      localStorage.setItem('hero', heroMode)
    } catch {
      // no storage: the choice lasts until the app closes
    }
  }

  // Pages ---------------------------------------------------------------------

  // A pane belongs to the page it was opened on; turning the page closes it.
  function go(index: number) {
    page = Math.min(TABS.length - 1, Math.max(0, index))
    clearTimeout(paneTimer)
    pane = shownPane = paneHost = editing = null
  }

  /** Hangs the pane below the current page and pushes the page up to show it. */
  function openPane(id: PaneId) {
    clearTimeout(paneTimer)
    pane = shownPane = id
    paneHost = page
  }

  /** Slides the page back down; the pane goes once it is out of sight. */
  function closePane() {
    if (!pane) return
    pane = null
    clearTimeout(paneTimer)
    paneTimer = window.setTimeout(
      () => {
        if (pane) return // another pane opened meanwhile
        shownPane = paneHost = editing = null
      },
      reducedMotion() ? 0 : PANE_OUT_MS,
    )
  }

  // Pages follow a sideways drag and settle on release: on the next page when it went
  // far or fast enough, else back. Past the first or last page the drag resists. The
  // click a swipe ends in is swallowed (drag.ts), so a swipe across the gate does not
  // start a fast.
  let dragX = $state(0)
  let paging = $state(false)
  let pagesEl = $state<HTMLElement>()
  const pastEnd = (dx: number) => (page === 0 && dx > 0) || (page === TABS.length - 1 && dx < 0)

  const pageDrag: DragOptions = {
    axis: 'x',
    enabled: () => pane === null,
    onStart: () => (paging = true),
    onMove: (dx) => (dragX = resist(dx, pastEnd(dx))),
    onEnd: (dx, velocity) => {
      paging = false
      dragX = 0
      if (!pastEnd(dx) && carries(dx, pagesEl?.clientWidth ?? 1, velocity)) go(page + (dx < 0 ? 1 : -1))
    },
  }

  // An open pane follows a drag down, from the pane or from the page above it, and
  // closes when pulled a third of its height or flicked; upwards it barely gives.
  let pull = $state(0)
  let pulling = $state(false)

  const paneDrag: DragOptions = {
    axis: 'y',
    enabled: () => pane !== null,
    onStart: () => (pulling = true),
    // Away from the page closes it: down for a pane below, up for one above.
    onMove: (dy) => (pull = (fromTop ? dy < 0 : dy > 0) ? dy : dy / 4),
    onEnd: (dy, velocity) => {
      pulling = false
      pull = 0
      if ((fromTop ? dy < 0 : dy > 0) && carries(dy, paneHeight, velocity, 0.3)) closePane()
    },
  }

  // The fast ----------------------------------------------------------------------

  /** Shows the running face: the hero shuffles in and the progress line draws in with it. */
  function begin() {
    phase = 'running'
    revealed = false
    armed = false
    if (reducedMotion()) return void (drawn = 1)
    drawn = 0
    const from = performance.now()
    const tick = (t: number) => {
      drawn = Math.min(1, (t - from) / DRAW_MS)
      if (drawn < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  async function allowAlerts() {
    if (settings.alerts && Capacitor.isNativePlatform() && !(await askAlerts())) await tracker.setSettings({ alerts: false })
  }

  /** The hero has locked: a fast started at the gate starts now. */
  function onRevealed() {
    revealed = true
    if (tracker.active) return
    attempt(async () => {
      await allowAlerts()
      await tracker.start(Date.now())
    })
  }

  function startAt(at: number) {
    closePane()
    attempt(async () => {
      if (tracker.active) return tracker.moveStart(at)
      await allowAlerts()
      await tracker.start(at)
      begin()
    })
  }

  function end() {
    attempt(async () => {
      const fast = await tracker.end(Date.now())
      if (!fast) return
      ended = fast
      phase = 'done'
      armed = false
      buzz('ok')
    })
  }

  // The first press arms Cancel; a second within DISARM_MS discards the fast.
  function cancel() {
    clearTimeout(disarm)
    if (!armed) {
      armed = true
      disarm = window.setTimeout(() => (armed = false), DISARM_MS)
      return
    }
    armed = false
    attempt(async () => {
      await tracker.cancel()
      phase = 'ready'
      buzz('bad')
    })
  }

  function openEdit(fast: Fast, isNew: boolean) {
    editing = { fast, isNew }
    openPane('edit')
  }

  /** A blank fast to log afterwards: ending at noon on `day` (or now), as long as the goal. */
  function newFast(day: string | null): Fast {
    const end = Math.min(floorMinute(now), day ? new Date(`${day}T12:00`).getTime() : Infinity)
    const goalHours = settings.goal
    return { id: crypto.randomUUID(), start: end - goalHours * HOUR, end, goal: goalHours, note: '', weight: null }
  }

  const closeEdit = closePane

  function saveEdit(fast: Fast) {
    attempt(async () => {
      await tracker.save(fast)
      if (ended?.id === fast.id) ended = fast
      closeEdit()
    })
  }

  // The button takes the new theme first, then the page follows in a circle from it.
  function switchTheme(button: HTMLElement) {
    if (switching) return
    switching = true
    theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]
    saveTheme(theme)
    revealTheme(theme, button).finally(() => (switching = false))
  }
</script>

<!-- The goal's progress as coloured text: under the timer, and in the ending. -->
{#snippet progressLine(reached: number, shownPercent: number, lineTone: Tone, goalHours: number)}
  <p class="progress" aria-label="{shownPercent}% of the goal">
    <span aria-hidden="true"
      >{#each cellsFor(goalHours, reached) as run, i (i)}<span style:color={run.color ? `var(--${run.color})` : undefined}
          class:muted={!run.color}>{run.text}</span
        >{/each}</span
    >
    <strong style:color={toneColor(lineTone)}>{String(shownPercent).padStart(3)}%</strong>
  </p>
{/snippet}

<!-- A pane hangs below the page that opened it; the page slides up by the pane's
     height to show it. Tapping what is left of the page closes it. -->
{#snippet hangingPane(host: number)}
  {#if paneHost === host}
    {#if pane}<button
        type="button"
        class="dismiss"
        aria-label="Close {pane === 'edit' ? 'editor' : pane}"
        tabindex="-1"
        use:drag={paneDrag}
        onclick={closePane}
      ></button>{/if}
    <div class="hang" class:top={fromTop} bind:offsetHeight={paneHeight} use:drag={paneDrag}>
    {#if shownPane === 'start'}
      <StartPane
        initial={active?.start ?? now}
        earliest={earliestStart(tracker.fasts)}
        goal={active?.goal ?? settings.goal}
        {now}
        moving={active !== null}
        onConfirm={startAt}
        onClose={closePane}
      />
    {:else if shownPane === 'goal'}
      <GoalPane
        goal={active?.goal ?? settings.goal}
        {active}
        onChange={(g) => attempt(() => tracker.setGoal(g))}
        onClose={closePane}
      />
    {:else if shownPane === 'month'}
      <MonthPane month={calMonth} onPick={(m) => ((calMonth = m), closePane())} onToday={calToday} onClose={closePane} />
    {:else if shownPane === 'year'}
      <YearPane year={calYear} onPick={(y) => (calYear = y)} onToday={calToday} onClose={closePane} />
    {:else if shownPane === 'edit' && editing}
      <EditPane
        fast={editing.fast}
        others={tracker.fasts}
        scale={tracker.scale}
        isNew={editing.isNew}
        unit={settings.unit}
        {now}
        onSave={saveEdit}
        onClose={closeEdit}
      />
    {/if}
    </div>
  {/if}
{/snippet}

<main class="app">
  <div class="pages" bind:this={pagesEl} use:drag={pageDrag}>
    <div class="track" class:dragging={paging} style:transform="translateX(calc({-page * 100}% + {dragX}px))">
      <div
        class="page"
        class:pushed={pane !== null && paneHost === 0}
        class:pulling={pulling && paneHost === 0}
        style:--push="{fromTop ? -paneHeight : paneHeight}px"
        style:--pull="{paneHost === 0 ? pull : 0}px"
        id="page-fast"
        role="tabpanel"
        aria-labelledby="tab-fast"
        inert={page !== 0}
      >
        <div class="page-main" inert={pane !== null && paneHost === 0}>
        <Block title="Fast" class="page-block">
          {#snippet headingRight()}Goal <span class="value" style:--block-border={tone ? `var(--${tone})` : undefined}
              ><ShuffleText text={dashed ? '--' : `${percent}%`} staggerMs={120} /></span
            >{/snippet}

          <div class="summary">
            <p class="fields">Stage <ShuffleText text={show(`${stage + 1}/${STAGES.length}`, '/')} /> <span
                style:color={dashed ? undefined : `var(--${STAGES[stage].id})`}
                ><ShuffleText text={show(STAGES[stage].name.padEnd(NAME_WIDTH))} /></span
              ></p>
            <p class="fields">Start <ShuffleText text={show(dayClock(shownStart), DATE_FRAME)} /> · {phase === 'done' ? 'Ended' : 'Ends '} <ShuffleText
                text={show(dayClock(shownEnd), DATE_FRAME)}
              /></p>
          </div>
          <hr class="split" />

          <div class="stage">
            {#if phase === 'loading'}
              <p class="fill muted">Loading…</p>
            {:else if phase === 'ready'}
              <button type="button" class="gate fill" onclick={begin}>
                <ShuffleText text="Start!" intro />
                <span class="sub muted">goal {goal}h</span>
                <span class="sub muted" class:hidden={!eating}>eating window {duration(eating)}</span>
              </button>
            {:else if phase === 'running'}
              <div class="center">
                <button
                  type="button"
                  class="bare"
                  aria-label={heroMode === 'left' ? 'Show time elapsed' : 'Show time left'}
                  onclick={toggleHero}
                >
                  <Hero text={heroText} animate onDone={onRevealed} />
                  <span class="muted settle" class:visible={revealed}>{heroDetail}</span>
                </button>
                {@render progressLine(progress * drawn, percent, tone, goal)}
              </div>
              <div class="below">
                {#if revealed && nextLine}<p><TypeText text={nextLine} hl={nextMark} /></p>{/if}
              </div>
            {:else if ended}
              {@const length = fastLength(ended)}
              {@const deepest = STAGES[deepestStage(ended)]}
              <div class="fill">
                <p class="headline"><ShuffleText text="Done!" intro /></p>
                <p>
                  <ShuffleText text={duration(length)} intro /> · <span style:color="var(--{deepest.id})"
                    ><ShuffleText text={deepest.name} intro /></span
                  >
                </p>
                {@render progressLine(progressOf(length, ended.goal), percentOf(length, ended.goal), tone, ended.goal)}
              </div>
            {/if}
          </div>

          {#snippet actions()}
            {#if phase === 'done' && ended}
              {@const fast = ended}
              <button type="button" class="edge" onclick={() => openEdit(fast, false)}>
                <span class="icon" aria-hidden="true">¶</span>Note
              </button>
              <button type="button" class="edge primary" onclick={() => (phase = 'ready')}>
                <span class="icon" aria-hidden="true">↺</span>Again
              </button>
            {:else if phase === 'running'}
              <button type="button" class="edge" class:flash={armed} disabled={!active} onclick={cancel}>
                <span class="icon" aria-hidden="true">✕</span><ShuffleText text={armed ? 'Discard?' : 'Cancel'} />
              </button>
              <button type="button" class="edge" aria-label="Start time" disabled={!active} onclick={() => openPane('start')}>
                <span class="icon" aria-hidden="true">◷</span>Start
              </button>
              <button type="button" class="edge" aria-label="Goal: {goal} hours" onclick={() => openPane('goal')}>
                <span class="icon" aria-hidden="true">⧗</span>{goal}h
              </button>
              <button type="button" class="edge primary" disabled={!active} onclick={end}>
                <span class="icon" aria-hidden="true">■</span>End fast
              </button>
            {:else if phase === 'ready'}
              <button type="button" class="edge" onclick={() => openPane('start')}>
                <span class="icon" aria-hidden="true">◷</span>Start at
              </button>
              <button type="button" class="edge" aria-label="Goal: {goal} hours" onclick={() => openPane('goal')}>
                <span class="icon" aria-hidden="true">⧗</span>{goal}h
              </button>
            {/if}
          {/snippet}
        </Block>
        </div>
        {@render hangingPane(0)}
      </div>

      <div
        class="page"
        class:pushed={pane !== null && paneHost === 1}
        class:pulling={pulling && paneHost === 1}
        style:--push="{fromTop ? -paneHeight : paneHeight}px"
        style:--pull="{paneHost === 1 ? pull : 0}px"
        id="page-calendar"
        role="tabpanel"
        aria-labelledby="tab-calendar"
        inert={page !== 1}
      >
        <div class="page-main" inert={pane !== null && paneHost === 1}>
        <CalendarPage
          fasts={tracker.fasts}
          scale={tracker.scale}
          unit={settings.unit}
          {now}
          {settings}
          bind:year={calYear}
          bind:month={calMonth}
          shown={page === 1}
          onPickMonth={() => openPane('month')}
          onPickYear={() => openPane('year')}
          onEdit={(fast) => openEdit(fast, false)}
          onAdd={(day) => openEdit(newFast(day), true)}
          onDelete={(fast) => attempt(() => tracker.remove(fast.id))}
          onRestore={(fast) => attempt(() => tracker.save(fast))}
        />
        </div>
        {@render hangingPane(1)}
      </div>

      <div class="page" id="page-stats" role="tabpanel" aria-labelledby="tab-stats" inert={page !== 2}>
        <StatsPage fasts={tracker.fasts} scale={tracker.scale} unit={settings.unit} {now} />
      </div>

      <div class="page" id="page-options" role="tabpanel" aria-labelledby="tab-options" inert={page !== 3}>
        <OptionsPage {tracker} {theme} onTheme={switchTheme} />
      </div>

      <div class="page" id="page-info" role="tabpanel" aria-labelledby="tab-info" inert={page !== 4}>
        <InfoPage current={phase === 'running' && active ? stage : null} />
      </div>
    </div>
  </div>

  <TabBar tabs={TABS} current={page} onSelect={go} />
</main>

{#if failure}<p class="alert" role="alert">{failure}</p>{/if}

<style>
  /* One column of pages over the tabs; on wide screens a phone-width column. */
  .app {
    height: 100%;
    max-width: var(--column);
    margin-inline: auto;
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    padding: var(--inset-top) 0 var(--inset-bottom);
    box-sizing: border-box;
  }

  /* The pages sit side by side; the track slides to the current one. Vertical
     scrolling stays with the page, horizontal drags come here as swipes. */
  .pages {
    min-height: 0;
    overflow: hidden;
    touch-action: pan-y;
  }

  .track {
    display: flex;
    height: 100%;
    transition: transform 0.32s cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Under the finger, the track and a pulled page follow it without easing. */
  .track.dragging,
  .page.pulling {
    transition: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .track {
      transition: none;
    }
  }

  /* Room above each block for the titles in its top edge, and below it for the
     buttons in its bottom edge, inside the page so the slide does not clip them. */
  .page {
    flex: 0 0 100%;
    min-width: 0;
    height: 100%;
    box-sizing: border-box;
    padding: 1em 0.6em 1.3em;
    position: relative;
    /* Back down when a pane closes: easing in, like falling back. */
    transition: transform 0.24s cubic-bezier(0.32, 0, 0.67, 0);
  }

  /* A pane hangs below the page (Pane.svelte); opening it pushes the page up by the
     pane's height, the top of the page flowing off the screen. Easing out, like the
     pages' slide. */
  .page.pushed {
    transform: translateY(calc(-1 * var(--push) + var(--pull, 0px)));
    transition: transform 0.32s cubic-bezier(0.33, 1, 0.68, 1);
  }

  .page-main {
    height: 100%;
  }

  /* A pane opened from the top hangs above the page instead, and pushes it down. */
  .hang.top {
    top: auto;
    bottom: 100%;
  }

  /* Just below the page, as tall as its pane, at most the page's height. Vertical
     drags here pull the pane, not scroll (a pane whose content scrolls lets it). */
  .hang {
    touch-action: none;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    max-height: 100%;
    display: flex;
    flex-direction: column;
  }

  /* What is left of the page above an open pane: a tap there closes the pane, and a
     drag down pulls it. */
  .dismiss {
    touch-action: none;
    position: absolute;
    inset: 0;
    padding: 0;
    background: none;
    border: none;
    border-radius: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .page,
    .page.pushed {
      transition: none;
    }
  }

  .summary {
    padding-top: 0.2em;
  }

  /* The coloured progress line under the timer; no ligatures, so cells stay apart. */
  .progress {
    margin-top: 0.7em;
    white-space: pre;
    font-variant-ligatures: none;
    text-align: center;
  }

  /* The gate's second and third lines, at the base size under its large text. */
  .gate .sub {
    display: block;
    font-size: 0.4em;
  }

  .hidden {
    visibility: hidden;
  }

  /* The hero is a button that switches between time left and time elapsed. */
  .bare {
    width: 100%;
    padding: 0;
    background: none;
    border: none;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
</style>
