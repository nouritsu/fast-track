<script lang="ts">
  import { Capacitor } from '@capacitor/core'
  import { onMount } from 'svelte'
  import { applyColors, saveColors } from './lib/colors'
  import { applyDisplay, buzzFor, reduceQuery, stillFor, systemPrefs, textScale, twelveFor, type SystemPrefs } from './lib/display'
  import { askAlerts } from './lib/fasting/alerts'
  import {
    deepestStage,
    earliestStart,
    endedBy,
    fastLength,
    eatingLeft,
    milestones,
    pastMeals,
    percentOf,
    progressOf,
    type Fast,
  } from './lib/fasting/fasts'
  import { NAME_WIDTH, STAGES, stageIndex } from './lib/fasting/stages'
  import { Tracker } from './lib/fasting/tracker.svelte'
  import { PAGE_NAMES, shownPages, startPageOf, type PageId } from './lib/layout'
  import { dayClock, dayKey, floorMinute, HOUR, nearClock, noonOf } from './lib/fasting/time'
  import { reducedMotion } from './lib/motion/shuffle'
  import CalendarPage from './lib/pages/CalendarPage.svelte'
  import InfoPage from './lib/pages/InfoPage.svelte'
  import OptionsPage from './lib/pages/OptionsPage.svelte'
  import StatsPage from './lib/pages/StatsPage.svelte'
  import EditPane from './lib/panes/EditPane.svelte'
  import GoalPane from './lib/panes/GoalPane.svelte'
  import LicencesPane from './lib/panes/LicencesPane.svelte'
  import MonthPane from './lib/panes/MonthPane.svelte'
  import StartPane from './lib/panes/StartPane.svelte'
  import YearPane from './lib/panes/YearPane.svelte'
  import { currentTheme, revealTheme, savedChoice, saveTheme, setTheme, shownTheme, systemDark, THEME_CHOICES, watchSystem } from './lib/theme'
  import Block, { type Tone } from './lib/ui/Block.svelte'
  import Hero from './lib/ui/Hero.svelte'
  import Icon from './lib/ui/Icon.svelte'
  import ShuffleText from './lib/ui/ShuffleText.svelte'
  import TabBar from './lib/ui/TabBar.svelte'
  import TypeText from './lib/ui/TypeText.svelte'
  import { carries, drag, resist, type DragOptions } from './lib/ui/drag'
  import { clock, dashes, duration, hm } from './lib/ui/fields'
  import { buzz, setHaptics } from './lib/ui/haptics'
  import { hours } from './lib/ui/hours.svelte'
  import { stageCells } from './lib/ui/progress'

  // Fast Track: five pages side by side, switched by the tabs along the bottom or a
  // swipe. The Fast page is one panel: the fast's status at its top, the goal's share
  // in its top edge, a coloured progress line under the timer, and its buttons in its
  // bottom edge. A fast starts at the gate (now) or from Start at (earlier or later),
  // runs until End fast, and ends on "Done!", where it can be resumed or discarded.
  // Start time, Goal, Edit fast and Info's licences open as panes hung below the page,
  // which slides up and off the top, pushed by the pane; the calendar's month and year
  // panes hang above it and push it down.
  type Phase = 'loading' | 'ready' | 'running' | 'done'
  type PaneId = 'start' | 'goal' | 'edit' | 'month' | 'year' | 'licences'
  type HeroMode = 'left' | 'elapsed'

  const COLORS = STAGES.map((s) => s.id)
  const DISARM_MS = 3000 // Cancel stays armed this long for the second press
  const DRAW_MS = 700 // the progress line draws in while the hero shuffles in, within its 700 ms
  const PANE_OUT_MS = 240 // the page's slide back down when a pane closes (.page's transition)
  const DATE_FRAME = '[]%·: ' // "Tue 06:30" dashes to "--- --:--"

  const tracker = new Tracker()
  // The page in view, by id: reordering the tabs or hiding one keeps it in view.
  let current = $state<PageId>('fast')
  let phase = $state<Phase>('loading')
  let revealed = $state(false) // the hero has locked; the detail settles in
  let ended = $state<Fast | null>(null) // the fast the ending shows
  let now = $state(Date.now())
  let choice = $state(savedChoice()) // what the theme button shows
  let theme = $state(currentTheme()) // the theme shown; the page follows the button a beat late
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
  let paneHost = $state<PageId | null>(null) // the page it hangs below
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
  // The fasts that have ended, to the minute; planned ones wait in the Fasts list.
  const minuteNow = $derived(floorMinute(now))
  const history = $derived(endedBy(tracker.fasts, minuteNow))
  // The pages along the tabs, in the user's order (Options' Pages); `page` is where the
  // current one sits among them.
  const order = $derived(shownPages(settings.pages, settings.hiddenPages))
  const page = $derived(Math.max(0, order.indexOf(current)))
  const tabs = $derived(order.map((id) => ({ id, label: PAGE_NAMES[id] })))
  const goal = $derived(phase === 'running' ? (active?.goal ?? settings.goal) : phase === 'done' && ended ? ended.goal : settings.goal)
  // Until the hero locks on a fast started now, nothing has elapsed.
  const elapsed = $derived(
    phase === 'running' ? (active ? Math.max(0, now - active.start) : 0) : phase === 'done' && ended ? fastLength(ended) : 0,
  )
  // A fast set to start later: until then the timer counts down to its start, in the
  // text's colour, and the stage and goal wait as dashes.
  const pending = $derived(phase === 'running' && active !== null && active.start > now)
  const progress = $derived(progressOf(elapsed, goal))
  const percent = $derived(percentOf(elapsed, goal))
  const tone = $derived<Tone>(phase === 'running' || phase === 'done' ? (progress >= 1 ? 'ok' : progress >= 0.5 ? 'warn' : '') : '')
  const stage = $derived(stageIndex(elapsed / HOUR))
  const left = $derived(goal * HOUR - elapsed)
  const eating = $derived(phase === 'ready' ? eatingLeft(history, now) : 0)

  // Counting down to a start, the second it shows is the one still to come.
  const heroText = $derived(
    pending && active
      ? `-${duration(active.start - now + 999)}`
      : heroMode === 'elapsed'
        ? duration(elapsed)
        : left > 0
          ? duration(left)
          : `+${duration(-left)}`,
  )
  // The goal's progress as coloured text under the timer, each cell in its stage's colour.
  const cellsFor = (goalHours: number, reached: number) =>
    stageCells(
      STAGES.map((s) => s.from / goalHours),
      COLORS,
      reached,
    )
  const toneColor = (t: Tone) => (t ? `var(--${t})` : undefined)

  const heroDetail = $derived(
    pending ? 'eating window' : heroMode === 'elapsed' ? `of ${goal}h` : left > 0 ? `left of ${goal}h` : `past ${goal}h`,
  )

  // What comes next: the start, the next stage or the goal, else the stage the fast is in.
  // Its clock time is marked, apart from the day before it.
  const next = $derived.by(() => {
    if (!active) return null
    const say = (words: string, at: number) => {
      const [time, near] = [clock(new Date(at)), nearClock(at, now)]
      return { lead: `${words} ${near.slice(0, near.length - time.length)}`, time }
    }
    if (pending) return say('Starts at', active.start)
    const coming = milestones(active).find((m) => m.at > now)
    if (!coming) return say(`${STAGES[stage].name} since`, active.start + STAGES[stage].from * HOUR)
    return say(`${coming.stage === null ? 'Goal' : STAGES[coming.stage].name} at`, coming.at)
  })
  const nextLine = $derived(next ? `${next.lead}${next.time}.` : '')
  const nextMark = $derived<[number, number]>(next ? [next.lead.length, next.lead.length + next.time.length] : [0, 0])

  // Waiting at the gate, every status field shows dashes at its normal width.
  const dashed = $derived(phase === 'ready' || phase === 'loading')
  const show = (text: string, keep?: string) => (dashed ? dashes(text, keep) : text)
  // Before a later start, the times are known but the stage and the goal's share are not.
  const unstaged = $derived(dashed || pending)
  const showStage = (text: string, keep?: string) => (unstaged ? dashes(text, keep) : text)
  const shownStart = $derived(phase === 'done' && ended ? ended.start : (active?.start ?? now))
  const shownEnd = $derived(phase === 'done' && ended ? ended.end : shownStart + goal * HOUR)

  // The picked colours reach the page once the settings have loaded, and are kept for
  // the next start's first paint (index.html). Until then it wears the last ones.
  $effect(() => {
    if (!tracker.loaded) return
    applyColors(settings.colors)
    saveColors(settings.colors)
  })

  // Text size, motion, haptics and the clock, from the settings and, where they follow the
  // system, what the phone says (read again whenever the app comes back to the front).
  let system = $state<SystemPrefs | null>(null)
  let reduce = $state(reduceQuery().matches)
  const readSystem = () => void systemPrefs().then((prefs) => (system = prefs))
  $effect(() => {
    if (!tracker.loaded || !system) return
    applyDisplay(textScale(settings.textSize, system), stillFor(settings.motion, system, reduce))
    setHaptics(buzzFor(settings.haptics, system))
    hours.twelve = twelveFor(settings.clock, system)
  })

  onMount(() => {
    const timer = setInterval(() => (now = Date.now()), 200)
    const unwatch = watchSystem(follow)
    follow()
    readSystem()
    const query = reduceQuery()
    const motion = () => (reduce = query.matches)
    query.addEventListener('change', motion)
    attempt(async () => {
      await tracker.load()
      current = startPageOf(tracker.settings.startPage, order)
      if (tracker.active) begin()
    }).finally(() => {
      // Storage that fails to load still leaves a working gate; the alert says why.
      if (phase === 'loading') phase = 'ready'
    })
    // Back in front, read openScale and the phone's settings again: a weighing may have
    // come in meanwhile, or the font size changed.
    const back = () => {
      if (document.visibilityState !== 'visible') return
      void tracker.loadScale()
      readSystem()
    }
    document.addEventListener('visibilitychange', back)
    return () => {
      clearInterval(timer)
      unwatch()
      query.removeEventListener('change', motion)
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

  // The track slides only while a page is turned (a tab, a swipe, or one springing
  // back); opening on the start page, or hiding or moving the one in view, puts it in
  // place at once, without sweeping across the others.
  const TURN_MS = 400 // past the slide (--slide), which ends it
  let turning = $state(false)
  let turnTimer = 0
  function turn() {
    turning = true
    clearTimeout(turnTimer)
    turnTimer = window.setTimeout(() => (turning = false), TURN_MS)
  }

  // A pane belongs to the page it was opened on; turning the page closes it.
  function go(index: number) {
    turn()
    current = order[Math.min(order.length - 1, Math.max(0, index))]
    clearTimeout(paneTimer)
    pane = shownPane = paneHost = editing = null
  }

  /** Hangs the pane below the current page and pushes the page up to show it. */
  function openPane(id: PaneId) {
    clearTimeout(paneTimer)
    pane = shownPane = id
    paneHost = current
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

  // While a pane is open, its page above is one button that closes it (.dismiss). A tap
  // there on a button that opens another pane in the same place (marked data-pane:
  // Start and Goal under the Fast page, month and year over the calendar) swaps the
  // panes instead: the new one slides in from the side its button is on as the old one
  // slides out the other way, and the page moves to the new one's height.
  let slide = $state<1 | -1>(1) // the side the next pane comes in from: 1 the right
  const SIDE_BY_SIDE: PaneId[][] = [
    ['start', 'goal'],
    ['month', 'year'],
  ]

  function tapAbove(event: MouseEvent) {
    const host = (event.currentTarget as HTMLElement).parentElement
    const inside = (el: Element) => {
      const r = el.getBoundingClientRect()
      return event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom
    }
    const hit = [...(host?.querySelectorAll<HTMLButtonElement>('[data-pane]') ?? [])].find((el) => !el.disabled && inside(el))
    const id = hit?.dataset.pane as PaneId | undefined
    const from = pane && host?.querySelector(`[data-pane="${pane}"]`)
    if (!hit || !id || !from || id === pane || !SIDE_BY_SIDE.some((group) => group.includes(id) && group.includes(pane!)))
      return closePane()
    slide = hit.getBoundingClientRect().left < from.getBoundingClientRect().left ? -1 : 1
    clearTimeout(paneTimer)
    pane = shownPane = id
  }

  const PANE_SWAP_MS = 220
  const easeOut = (t: number) => 1 - (1 - t) ** 3

  /** A swapped-in pane, sliding in from the side its button is on. */
  function paneIn(_node: HTMLElement, { side }: { side: number }) {
    return { duration: reducedMotion() ? 0 : PANE_SWAP_MS, easing: easeOut, css: (_t: number, u: number) => `transform: translateX(${side * u * 100}%)` }
  }

  /** The pane it replaces, out of the flow (the new one sets the height) and sliding
   *  out the other way. */
  function paneOut(node: HTMLElement, { side, top }: { side: number; top: boolean }) {
    Object.assign(node.style, { position: 'absolute', left: '0', right: '0', [top ? 'bottom' : 'top']: '0' })
    return { duration: reducedMotion() ? 0 : PANE_SWAP_MS, easing: easeOut, css: (_t: number, u: number) => `transform: translateX(${-side * u * 100}%)` }
  }

  // Pages follow a sideways drag and settle on release: on the next page when it went
  // far or fast enough, else back. Past the first or last page the drag resists. The
  // click a swipe ends in is swallowed (drag.ts), so a swipe across the gate does not
  // start a fast.
  let dragX = $state(0)
  let paging = $state(false)
  let pagesEl = $state<HTMLElement>()
  const pastEnd = (dx: number) => (page === 0 && dx > 0) || (page === order.length - 1 && dx < 0)

  const pageDrag: DragOptions = {
    axis: 'x',
    enabled: () => pane === null,
    onStart: () => (paging = true),
    onMove: (dx) => (dragX = resist(dx, pastEnd(dx))),
    onEnd: (dx, velocity) => {
      paging = false
      turn()
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
    if (settings.alerts !== 'off' && Capacitor.isNativePlatform() && !(await askAlerts())) await tracker.setSettings({ alerts: 'off' })
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

  /** The first press arms the button (Cancel, Discard); a second within DISARM_MS acts. */
  function twice(act: () => void) {
    clearTimeout(disarm)
    if (!armed) {
      armed = true
      disarm = window.setTimeout(() => (armed = false), DISARM_MS)
      return
    }
    armed = false
    act()
  }

  /** Drops the fast in progress. */
  const cancel = () =>
    twice(() =>
      attempt(async () => {
        await tracker.cancel()
        phase = 'ready'
        buzz('bad')
      }),
    )

  /** Deletes the fast just ended: one started and ended by mistake. */
  const discard = (fast: Fast) =>
    twice(() =>
      attempt(async () => {
        await tracker.remove(fast.id)
        again()
        buzz('bad')
      }),
    )

  /** Takes the fast just ended back into progress: an End pressed by mistake. */
  function resume(fast: Fast) {
    attempt(async () => {
      await tracker.resume(fast)
      ended = null
      begin()
    })
  }

  /** Back to the gate for the next fast. */
  function again() {
    clearTimeout(disarm)
    armed = false
    ended = null
    phase = 'ready'
  }

  function openEdit(fast: Fast, isNew: boolean) {
    editing = { fast, isNew }
    openPane('edit')
  }

  /** A blank fast to log, as long as the goal: ending now, or at noon on `day` (by now, on
   *  today), or to plan, on a day still to come. */
  function newFast(day: string | null): Fast {
    const noon = day ? noonOf(day) : Infinity
    const end = day && day > dayKey(now) ? noon : Math.min(floorMinute(now), noon)
    const goalHours = settings.goal
    return { id: crypto.randomUUID(), start: end - goalHours * HOUR, end, goal: goalHours, note: '', weight: null }
  }

  /** A fast added in the list to track on the Fast page: it becomes the fast in
   *  progress, counting down to its start until then. */
  function track(at: number, goalHours: number) {
    closePane()
    attempt(async () => {
      await allowAlerts()
      await tracker.start(at, goalHours)
      begin()
    })
  }

  function saveEdit(fast: Fast) {
    attempt(async () => {
      await tracker.save(fast)
      if (ended?.id === fast.id) ended = fast
      closePane()
    })
  }

  // The button cycles Mocha, Latte and System. When that changes the theme shown, the
  // button takes the new one first and the page follows in a circle from it.
  function switchTheme(button: HTMLElement) {
    if (switching) return
    choice = THEME_CHOICES[(THEME_CHOICES.indexOf(choice) + 1) % THEME_CHOICES.length]
    saveTheme(choice)
    const shown = shownTheme(choice, systemDark())
    if (shown === theme) return
    switching = true
    theme = shown
    revealTheme(shown, button).finally(() => {
      switching = false
      follow()
    })
  }

  /** Shows what the choice calls for. System follows the device as it changes, at once,
   *  with no reveal; after a reveal it catches up with a change made meanwhile. */
  function follow() {
    const shown = shownTheme(choice, systemDark())
    if (switching || shown === theme) return
    theme = shown
    setTheme(shown)
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
{#snippet hangingPane(host: PageId)}
  {#if paneHost === host}
    {#if pane}<button
        type="button"
        class="dismiss"
        aria-label="Close {pane === 'edit' ? 'editor' : pane}"
        tabindex="-1"
        use:drag={paneDrag}
        onclick={tapAbove}
      ></button>{/if}
    <div class="hang" class:top={fromTop} bind:offsetHeight={paneHeight} use:drag={paneDrag}>
    {#key shownPane}
    <div class="slot" in:paneIn={{ side: slide }} out:paneOut={{ side: slide, top: fromTop }}>
    {#if shownPane === 'start'}
      <StartPane
        initial={active?.start ?? now}
        earliest={earliestStart(history)}
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
        {active}
        meals={pastMeals(tracker.fasts)}
        scale={tracker.scale}
        isNew={editing.isNew}
        unit={settings.unit}
        {now}
        onSave={saveEdit}
        onTrack={track}
        onClose={closePane}
      />
    {:else if shownPane === 'licences'}
      <LicencesPane onClose={closePane} />
    {/if}
    </div>
    {/key}
    </div>
  {/if}
{/snippet}

<main class="app">
  <div class="pages" bind:this={pagesEl} use:drag={pageDrag}>
    <div class="track" class:turning class:dragging={paging} style:transform="translateX(calc({-page * 100}% + {dragX}px))">
      <div
        class="page"
        class:pushed={pane !== null && paneHost === 'fast'}
        class:pulling={pulling && paneHost === 'fast'}
        style:--push="{fromTop ? -paneHeight : paneHeight}px"
        style:--pull="{paneHost === 'fast' ? pull : 0}px"
        style:order={order.indexOf('fast')}
        class:gone={!order.includes('fast')}
        id="page-fast"
        role="tabpanel"
        aria-labelledby="tab-fast"
        inert={current !== 'fast'}
      >
        <div class="page-main" inert={pane !== null && paneHost === 'fast'}>
        <Block title="Fast" icon="timer" class="page-block">
          {#snippet headingRight()}Goal <span class="value" style:--block-border={tone ? `var(--${tone})` : undefined}
              ><ShuffleText text={unstaged ? '--' : `${percent}%`} staggerMs={120} /></span
            >{/snippet}

          <div class="summary">
            <p class="fields">Stage <ShuffleText text={showStage(`${stage + 1}/${STAGES.length}`, '/')} /> <span
                style:color={unstaged ? undefined : `var(--${STAGES[stage].id})`}
                ><ShuffleText text={showStage(STAGES[stage].name.padEnd(NAME_WIDTH))} /></span
              ></p>
            <p class="fields">Start <ShuffleText text={show(dayClock(shownStart), DATE_FRAME)} /> · {phase === 'done' ? 'Ended' : 'Ends'} <ShuffleText
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
                  style:color={pending ? 'var(--fg)' : `var(--${STAGES[stage].id})`}
                >
                  <!-- The timer in the colour of the stage the fast is in; its detail stays muted. -->
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
                  <ShuffleText text={hm(length)} intro /> · <span style:color="var(--{deepest.id})"
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
              <button type="button" class="edge quit" class:flash={armed} onclick={() => discard(fast)}>
                <span class="icon" aria-hidden="true"><Icon name="delete" /></span><ShuffleText text={armed ? 'Discard?' : 'Discard'} />
              </button>
              <button type="button" class="edge" onclick={() => resume(fast)}>
                <span class="icon" aria-hidden="true"><Icon name="play_arrow" /></span>Resume
              </button>
              <button type="button" class="edge" onclick={() => openEdit(fast, false)}>
                <span class="icon" aria-hidden="true"><Icon name="edit_note" /></span>Note
              </button>
              <button type="button" class="edge primary" onclick={again}>
                <span class="icon" aria-hidden="true"><Icon name="replay" /></span>Again
              </button>
            {:else if phase === 'running'}
              <button type="button" class="edge quit" class:flash={armed} disabled={!active} onclick={cancel}>
                <span class="icon" aria-hidden="true"><Icon name="close" /></span><ShuffleText text={armed ? 'Discard?' : 'Cancel'} />
              </button>
              <button type="button" class="edge" data-pane="start" aria-label="Start time" disabled={!active} onclick={() => openPane('start')}>
                <span class="icon" aria-hidden="true"><Icon name="schedule" /></span>Start
              </button>
              <button type="button" class="edge" data-pane="goal" aria-label="Goal: {goal} hours" onclick={() => openPane('goal')}>
                <span class="icon" aria-hidden="true"><Icon name="hourglass_bottom" /></span>{goal}h
              </button>
              <button type="button" class="edge primary" disabled={!active || pending} onclick={end}>
                <span class="icon" aria-hidden="true"><Icon name="stop" /></span>End fast
              </button>
            {:else if phase === 'ready'}
              <button type="button" class="edge" data-pane="start" onclick={() => openPane('start')}>
                <span class="icon" aria-hidden="true"><Icon name="schedule" /></span>Start at
              </button>
              <button type="button" class="edge" data-pane="goal" aria-label="Goal: {goal} hours" onclick={() => openPane('goal')}>
                <span class="icon" aria-hidden="true"><Icon name="hourglass_bottom" /></span>{goal}h
              </button>
            {/if}
          {/snippet}
        </Block>
        </div>
        {@render hangingPane('fast')}
      </div>

      <div
        class="page"
        class:pushed={pane !== null && paneHost === 'calendar'}
        class:pulling={pulling && paneHost === 'calendar'}
        style:--push="{fromTop ? -paneHeight : paneHeight}px"
        style:--pull="{paneHost === 'calendar' ? pull : 0}px"
        style:order={order.indexOf('calendar')}
        class:gone={!order.includes('calendar')}
        id="page-calendar"
        role="tabpanel"
        aria-labelledby="tab-calendar"
        inert={current !== 'calendar'}
      >
        <div class="page-main" inert={pane !== null && paneHost === 'calendar'}>
        <CalendarPage
          fasts={tracker.fasts}
          scale={tracker.scale}
          unit={settings.unit}
          {now}
          {settings}
          bind:year={calYear}
          bind:month={calMonth}
          visible={current === 'calendar'}
          onPickMonth={() => openPane('month')}
          onPickYear={() => openPane('year')}
          onEdit={(fast) => openEdit(fast, false)}
          onAdd={(day) => openEdit(newFast(day), true)}
          onDelete={(fast) => attempt(() => tracker.remove(fast.id))}
          onRestore={(fast) => attempt(() => tracker.save(fast))}
        />
        </div>
        {@render hangingPane('calendar')}
      </div>

      <div
        class="page"
        style:order={order.indexOf('stats')}
        class:gone={!order.includes('stats')}
        id="page-stats"
        role="tabpanel"
        aria-labelledby="tab-stats"
        inert={current !== 'stats'}
      >
        <StatsPage
          fasts={history}
          active={tracker.active}
          scale={tracker.scale}
          unit={settings.unit}
          height={settings.bmi ? settings.height : null}
          weekStart={settings.weekStart}
          nearMiss={settings.nearMiss}
          span={settings.statsSpan}
          picked={settings.statsRange}
          {now}
          visible={current === 'stats'}
          panes={settings.statsPanes}
          hiddenPanes={settings.hiddenStats}
          onArrange={(statsPanes, hiddenStats) => attempt(() => tracker.setSettings({ statsPanes, hiddenStats }))}
          onSpan={(statsSpan, statsRange) => attempt(() => tracker.setSettings(statsRange ? { statsSpan, statsRange } : { statsSpan }))}
          onPick={(statsRange) => attempt(() => tracker.setSettings({ statsRange }))}
        />
      </div>

      <div
        class="page"
        class:pushed={pane !== null && paneHost === 'options'}
        class:pulling={pulling && paneHost === 'options'}
        style:--push="{fromTop ? -paneHeight : paneHeight}px"
        style:--pull="{paneHost === 'options' ? pull : 0}px"
        style:order={order.indexOf('options')}
        class:gone={!order.includes('options')}
        id="page-options"
        role="tabpanel"
        aria-labelledby="tab-options"
        inert={current !== 'options'}
      >
        <div class="page-main" inert={pane !== null && paneHost === 'options'}>
        <OptionsPage {tracker} {choice} visible={current === 'options'} onTheme={switchTheme} />
        </div>
        {@render hangingPane('options')}
      </div>

      <div
        class="page"
        class:pushed={pane !== null && paneHost === 'info'}
        class:pulling={pulling && paneHost === 'info'}
        style:--push="{fromTop ? -paneHeight : paneHeight}px"
        style:--pull="{paneHost === 'info' ? pull : 0}px"
        style:order={order.indexOf('info')}
        class:gone={!order.includes('info')}
        id="page-info"
        role="tabpanel"
        aria-labelledby="tab-info"
        inert={current !== 'info'}
      >
        <div class="page-main" inert={pane !== null && paneHost === 'info'}>
        <InfoPage current={phase === 'running' && active && !pending ? stage : null} onLicences={() => openPane('licences')} />
        </div>
        {@render hangingPane('info')}
      </div>
    </div>
  </div>

  <TabBar {tabs} current={page} onSelect={go} />
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
     scrolling stays with the page, horizontal drags come here as swipes. Clipped, not
     hidden: focus moving into a pane must not scroll the track out of line. */
  .pages {
    min-width: 0;
    min-height: 0;
    overflow: clip;
    touch-action: pan-y;
  }

  .track {
    display: flex;
    height: 100%;
  }

  .track.turning {
    transition: transform var(--slide);
  }

  /* Under the finger, the track and a pulled page follow it without easing. */
  .track.dragging,
  .page.pulling {
    transition: none;
  }

  :global(:root[data-still]) .track {
    transition: none;
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

  /* A page left off the tabs (Options' Pages) takes no room in the track. */
  .page.gone {
    display: none;
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

  /* The pane in it, passing the height on so a tall pane still scrolls inside. A
     swapped-out pane leaves the flow (App's paneOut) and slides off over the next. */
  .slot {
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--bg);
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

  :global(:root[data-still]) .page,
  :global(:root[data-still]) .page.pushed {
    transition: none;
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
