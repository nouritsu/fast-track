<script lang="ts">
  import { Capacitor } from '@capacitor/core'
  import { untrack } from 'svelte'
  import { askAlerts } from '../fasting/alerts'
  import { lastResult, type ExportResult } from '../fasting/autoexport'
  import { askScale, emptyReason, scaleStatus, scaleUsers, WINDOW_HOURS, type ScaleStatus, type ScaleUser } from '../fasting/openscale'
  import { backupName, makeBackup, parseBackup, saveExportFile } from '../fasting/backup'
  import { toIcs, WEEK_STARTS, weekStartName } from '../fasting/calendar'
  import { bmiFormula } from '../fasting/fasts'
  import { describeSchedule, listed, nextRun, parseSchedule, SCHEDULE_EXAMPLES, ScheduleError } from '../fasting/schedule'
  import { latestWeighing } from '../fasting/stats'
  import { dayClock, dayKey, shortDate } from '../fasting/time'
  import type { Tracker } from '../fasting/tracker.svelte'
  import { COLOR_KEYS } from '../colors'
  import { SWITCHABLE, TEXT_SIZES } from '../display'
  import { FIXED_PAGES, moveIn, PAGE_NAMES, shownPages, startPageOf, type PageId } from '../layout'
  import type { IconName } from '../ui/Icon.svelte'
  import Block from '../ui/Block.svelte'
  import ShuffleText from '../ui/ShuffleText.svelte'
  import HeightStepper from '../ui/HeightStepper.svelte'
  import Icon from '../ui/Icon.svelte'
  import type { ThemeChoice } from '../theme'
  import { unfold } from '../motion/unfold'
  import ColoursBlock from './ColoursBlock.svelte'

  // A pane a category: the theme and colours, the weight unit and BMI, the notifications,
  // the calendar, weights from openScale, the backup with its regular exports, and privacy.
  // Toggles show the current state. Colours unfolds below Theme, pushing the rest down,
  // and folds away again when the page is left.
  let {
    tracker,
    choice,
    visible,
    onTheme,
  }: { tracker: Tracker; choice: ThemeChoice; visible: boolean; onTheme: (button: HTMLElement) => void } = $props()

  let colours = $state(false)
  $effect(() => {
    if (!visible) colours = false
  })

  const THEMES: Record<ThemeChoice, { name: string; icon: IconName }> = {
    mocha: { name: 'Mocha', icon: 'dark_mode' },
    latte: { name: 'Latte', icon: 'light_mode' },
    system: { name: 'System', icon: 'brightness_auto' },
  }

  let busy = $state(false)
  let message = $state('')
  let messageAt = $state<'scale' | 'backup' | 'notify'>('backup') // the section the message belongs to
  let picker = $state<HTMLInputElement>()

  const settings = $derived(tracker.settings)

  // Regular exports: the expression is read as it is typed, and saved once it reads.
  const SAVE_MS = 600
  let every = $state(untrack(() => tracker.settings.exportEvery)) // the field; the setting follows once it reads
  let saveTimer = 0
  let typing = false // between a keystroke and its save

  // The page exists before the settings load: the field follows the saved schedule,
  // except while it is being typed into.
  $effect(() => {
    const saved = settings.exportEvery
    if (!untrack(() => typing)) every = saved
  })
  let auto = $state<ExportResult | null>(null)

  const reading = $derived.by(() => {
    try {
      const cal = parseSchedule(every)
      const next = nextRun(cal, new Date())
      return { ok: true as const, text: `${describeSchedule(cal)}.`, next: next ? `Next ${dayClock(next.getTime())}.` : 'It never comes round.' }
    } catch (error) {
      return { ok: false as const, text: error instanceof ScheduleError ? `Not a time: ${error.message}.` : String(error) }
    }
  })

  $effect(() => {
    void lastResult().then((result) => (auto = result))
  })

  function typed() {
    clearTimeout(saveTimer)
    typing = true
    const expression = every.trim()
    if (!reading.ok || expression === settings.exportEvery) return
    saveTimer = window.setTimeout(() => {
      typing = false
      void tracker.setSettings({ exportEvery: expression })
    }, SAVE_MS)
  }

  // Examples to tap (SCHEDULE_EXAMPLES): they fill the field and save as typing does.

  function example(text: string) {
    every = text
    typed()
  }

  // openScale: connect asks Android for access, then which of its users is this one.
  let scale = $state<ScaleStatus>({ installed: false, granted: false })
  let scaleUser = $state<ScaleUser | null>(null)
  let choosing = $state<ScaleUser[]>([])

  $effect(() => {
    void scaleStatus().then(async (status) => {
      scale = status
      const id = untrack(() => settings.scaleUser)
      if (status.granted && id !== null) scaleUser = (await scaleUsers().catch(() => [])).find((u) => u.id === id) ?? null
    })
  })

  function connect() {
    run(async () => {
      scale = await askScale()
      if (!scale.granted) return 'Not allowed. Android settings → Apps → Fast Track → Permissions can allow openScale later.'
      const users = await scaleUsers()
      if (!users.length) return 'openScale has no users yet.'
      if (users.length > 1) {
        choosing = users
        return 'Which openScale user are you?'
      }
      return pick(users[0])
    }, 'scale')
  }

  async function pick(user: ScaleUser): Promise<string> {
    choosing = []
    scaleUser = user
    await tracker.setSettings({ scaleUser: user.id })
    return `Connected to ${user.name || 'openScale'}: ${tracker.scale.length} weighings.`
  }

  // Writes the scale's weights into past fasts, and says what it found.
  function sync() {
    run(async () => {
      const r = await tracker.syncScale()
      const w = tracker.scale
      if (!w.length) return reason ?? 'openScale gave no weighings for this user.'
      const span = `${w.length} weighings, ${shortDate(w[0].at)} to ${shortDate(w.at(-1)!.at)}`
      const did = [
        r.filled && `filled ${r.filled}`,
        r.updated && `updated ${r.updated}`,
        r.typed && `kept ${r.typed} typed in`,
        r.unmatched && `${r.unmatched} without a weighing during the fast or within ${WINDOW_HOURS} hours of its end`,
      ].filter(Boolean)
      return `${span}: ${did.length ? listed(did as string[]) : 'every fast was up to date'}.`
    }, 'scale')
  }

  // Why a connected openScale gave no weighings, if it did not.
  const reason = $derived(
    tracker.scaleRead && settings.scaleUser !== null ? emptyReason(tracker.scaleRead, settings.scaleUser) : null,
  )

  /** Offers openScale's users again, to pick another. */
  function changeUser() {
    run(async () => {
      const users = await scaleUsers()
      if (users.length < 2) return `openScale has ${users.length === 1 ? 'only this user' : 'no users'}.`
      choosing = users
      return 'Which openScale user are you?'
    }, 'scale')
  }

  function disconnect() {
    run(async () => {
      await tracker.setSettings({ scaleUser: null })
      scaleUser = null
      return 'openScale disconnected; weights you typed in stay.'
    }, 'scale')
  }

  const STAMP = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' })
  const autoLine = $derived(
    auto &&
      `Last regular export ${STAMP.format(new Date(auto.at))}${
        auto.error ? ` failed: ${auto.error}` : ` to ${auto.path}`
      }.`,
  )
  const last = $derived(settings.lastExport ? STAMP.format(new Date(settings.lastExport)) : null)

  // Where exports go and what they are called: a file a day, or one that each export replaces.
  const exportNote = $derived(
    `In Documents/FastTrack/, ${settings.keepOneFile ? 'one file, replaced each time' : 'a file a day'}: ${backupName(new Date(), settings.keepOneFile)}.`,
  )

  // BMI's formula, with numbers once there is a height and a weight: the latest one the
  // app knows, from a fast or openScale.
  const latest = $derived(latestWeighing(tracker.fasts, tracker.scale))
  const formula = $derived(bmiFormula(settings.unit, settings.heightUnit, latest?.kg ?? null, settings.height))

  async function run(task: () => Promise<string>, at: typeof messageAt = 'backup') {
    busy = true
    messageAt = at
    try {
      message = await task()
    } catch (error) {
      message = `Failed: ${error instanceof Error ? error.message : String(error)}.`
    } finally {
      busy = false
    }
  }

  // Settings that are on or off. Alerts and the status notification ask Android for
  // permission to notify before they turn on, and say what they did.
  type Switch = 'alerts' | 'status' | 'weekNumbers' | 'weekTotals' | 'exportOn' | 'keepOneFile' | 'bmi' | 'cloudBackup'
  const NOTICES: Partial<Record<Switch, string>> = { alerts: 'Alerts', status: 'Status notification' }

  function flip(key: Switch) {
    const notice = NOTICES[key]
    if (!notice) return void tracker.setSettings({ [key]: !settings[key] })
    run(async () => {
      if (settings[key]) {
        await tracker.setSettings({ [key]: false })
        return `${notice} off.`
      }
      if (Capacitor.isNativePlatform() && !(await askAlerts())) return 'Notifications are blocked in Android settings.'
      await tracker.setSettings({ [key]: true })
      return `${notice} on.`
    }, 'notify')
  }

  function exportNow() {
    run(async () => {
      const now = new Date()
      const where = await saveExportFile(
        backupName(now, settings.keepOneFile),
        JSON.stringify(makeBackup(tracker.fasts, settings, now), null, 1),
      )
      await tracker.setSettings({ lastExport: now.toISOString() })
      return `Saved to ${where}.`
    })
  }

  // The fasts as an .ics file, for any calendar app.
  function exportIcs() {
    run(async () => {
      const where = await saveExportFile(`fast-track-${dayKey(new Date())}.ics`, toIcs(tracker.fasts, settings.unit), 'text/calendar')
      return `Saved ${tracker.fasts.length} fasts to ${where}; open it with a calendar app to import them.`
    })
  }

  // Display: each word steps to the next choice.
  const capital = (word: string) => word[0].toUpperCase() + word.slice(1)
  function cycle(key: 'textSize' | 'motion' | 'haptics', choices: readonly string[]) {
    const next = choices[(choices.indexOf(settings[key]) + 1) % choices.length]
    void tracker.setSettings({ [key]: next })
  }

  // Pages: shown or not, their order along the tabs, and the one the app opens on, from
  // those that show.
  const startPage = $derived(startPageOf(settings.startPage, shownPages(settings.pages, settings.hiddenPages)))

  function showPage(id: PageId, hidden: boolean) {
    void tracker.setSettings({ hiddenPages: hidden ? settings.hiddenPages.filter((p) => p !== id) : [...settings.hiddenPages, id] })
  }

  const movePage = (id: PageId, by: -1 | 1) => void tracker.setSettings({ pages: moveIn(settings.pages, id, by) })

  function nextStartPage() {
    const shown = shownPages(settings.pages, settings.hiddenPages)
    void tracker.setSettings({ startPage: shown[(shown.indexOf(startPage) + 1) % shown.length] })
  }

  /** The calendar's next first weekday: Monday, Sunday, Saturday. */
  const nextWeekStart = () => WEEK_STARTS[(WEEK_STARTS.indexOf(settings.weekStart) + 1) % WEEK_STARTS.length]

  function importFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = '' // the same file can be picked again
    if (!file) return
    run(async () => {
      const backup = parseBackup(await file.text())
      const added = await tracker.merge(backup.fasts)
      return `Imported ${added} of ${backup.fasts.length} fasts; the rest were already here.`
    })
  }
</script>

<!-- A setting that is on or off: its name, and the word to press. -->
{#snippet toggle(key: Switch, name: string, first = false)}
  <div class="row" class:first>
    <span>{name}</span>
    <button type="button" class="word" disabled={key in NOTICES && busy} aria-pressed={settings[key]} onclick={() => flip(key)}
      ><ShuffleText text={settings[key] ? 'on' : 'off'} /></button
    >
  </div>
{/snippet}

<!-- A setting of a few choices: its name, and the word to press for the next one. -->
{#snippet choose(key: 'textSize' | 'motion' | 'haptics', name: string, choices: readonly string[], first = false)}
  <div class="row" class:first>
    <span>{name}</span>
    <button type="button" class="word" aria-label="{name}: {settings[key]}" onclick={() => cycle(key, choices)}
      ><ShuffleText text={capital(settings[key])} /></button
    >
  </div>
{/snippet}

<!-- A pane a category, in one scrolling column like Stats (app.css .panes). -->
<div class="panes">
  <Block title="Theme" icon="contrast">
    <div class="row first">
      <span>Flavour</span>
      <button type="button" class="word" aria-label="Flavour: {THEMES[choice].name}" onclick={(e) => onTheme(e.currentTarget)}>
        <span class="mark" aria-hidden="true"><Icon name={THEMES[choice].icon} /></span>{THEMES[choice].name}
      </button>
    </div>
    <!-- The whole row opens the pane; the button inside is what a keyboard or screen reader finds. -->
    <div class="row" role="presentation" onclick={() => (colours = !colours)}>
      <span>Colours</span>
      <button type="button" class="word" aria-label="Colours" aria-expanded={colours}>
        {#each COLOR_KEYS as key (key)}<span style:color="var(--{key})" aria-hidden="true">■</span>{/each}
      </button>
    </div>
  </Block>

  {#if colours}
    <div class="unfold" transition:unfold>
      <ColoursBlock colors={settings.colors} onChange={(colors) => tracker.setSettings({ colors })} onClose={() => (colours = false)} />
    </div>
  {/if}

  <Block title="Display" icon="text_fields">
    {@render choose('textSize', 'Text size', TEXT_SIZES, true)}
    {@render choose('motion', 'Motion', SWITCHABLE)}
    {@render choose('haptics', 'Haptics', SWITCHABLE)}
    <p class="muted">System follows the phone: its font size, Remove animations, and touch feedback.</p>
  </Block>

  <Block title="Pages" icon="tab">
    {#each settings.pages as id, i (id)}
      {@const fixed = FIXED_PAGES.includes(id)}
      {@const hidden = !fixed && settings.hiddenPages.includes(id)}
      <div class="row" class:first={i === 0}>
        <span class="page-name" class:muted={hidden}>{PAGE_NAMES[id]}</span>
        {#if fixed}
          <span class="muted always">always</span>
        {:else}
          <button type="button" class="word" aria-label="Show {PAGE_NAMES[id]}" aria-pressed={!hidden} onclick={() => showPage(id, hidden)}
            ><ShuffleText text={hidden ? 'off' : 'on'} /></button
          >
        {/if}
        <span class="moves">
          <button type="button" class="glyph" aria-label="Move {PAGE_NAMES[id]} up" disabled={i === 0} onclick={() => movePage(id, -1)}
            ><Icon name="keyboard_arrow_up" /></button
          >
          <button
            type="button"
            class="glyph"
            aria-label="Move {PAGE_NAMES[id]} down"
            disabled={i === settings.pages.length - 1}
            onclick={() => movePage(id, 1)}><Icon name="keyboard_arrow_down" /></button
          >
        </span>
      </div>
    {/each}
    <div class="row">
      <span>Opens on</span>
      <button type="button" class="word" onclick={nextStartPage}><ShuffleText text={PAGE_NAMES[startPage]} /></button>
    </div>
    <p class="muted">The tabs follow this order; Fast and Options always show.</p>
  </Block>

  <Block title="Body" icon="accessibility_new">
    <div class="row first">
      <span>Weight unit</span>
      <button
        type="button"
        class="word"
        aria-label="Weight unit: {settings.unit}"
        onclick={() => tracker.setSettings({ unit: settings.unit === 'kg' ? 'lb' : 'kg' })}><ShuffleText text={settings.unit} /></button
      >
    </div>
    {@render toggle('bmi', 'BMI')}
    {#if settings.bmi}
      <!-- The height's unit is its own: kg with feet, or pounds with cm, works too. -->
      <div class="row">
        <span>Height unit</span>
        <button
          type="button"
          class="word"
          aria-label="Height unit: {settings.heightUnit === 'cm' ? 'centimetres' : 'feet and inches'}"
          onclick={() => tracker.setSettings({ heightUnit: settings.heightUnit === 'cm' ? 'in' : 'cm' })}
          ><ShuffleText text={settings.heightUnit === 'cm' ? 'cm' : 'ft'} /></button
        >
      </div>
      <HeightStepper height={settings.height} unit={settings.heightUnit} onChange={(height) => tracker.setSettings({ height })} />
      <p class:muted={settings.height === null || !latest}>{formula}</p>
    {/if}
  </Block>

  <Block title="Notifications" icon="notifications">
    {@render toggle('alerts', 'Alerts', true)}
    <p class="muted">A notification when a stage begins and at the goal.</p>
    {@render toggle('status', 'Status')}
    <p class="muted">A notification that stays: fasting or eating, the stage, and a running timer.</p>
    {#if message && messageAt === 'notify'}<p class="message" role="status">{message}</p>{/if}
  </Block>

  <Block title="Calendar" icon="calendar_month">
    <div class="row first">
      <span>Week starts on</span>
      <button type="button" class="word" onclick={() => tracker.setSettings({ weekStart: nextWeekStart() })}
        ><ShuffleText text={weekStartName(settings.weekStart)} /></button
      >
    </div>
    {@render toggle('weekNumbers', 'Week numbers')}
    {@render toggle('weekTotals', 'Weekly totals')}
    <p class="muted">Week numbers are ISO weeks; a week's hours count the fasts that ended in it.</p>
  </Block>

  <Block title="openScale" icon="scale">
    {#if !scale.installed}
      <p class="muted">openScale is not installed. With it, each fast takes its weight from your scale.</p>
    {:else if scale.granted && settings.scaleUser !== null}
      <div class="row first">
        <span>Weights from {scaleUser?.name || `user ${settings.scaleUser}`}</span>
        <button type="button" class="word" disabled={busy} onclick={disconnect}>disconnect</button>
      </div>
      <p class="muted">
        {tracker.scale.length} weighings. A fast takes the last one during it, else the closest to its end within
        {WINDOW_HOURS} hours; a weight you type in wins. Sync writes them into past fasts.
      </p>
      {#if reason}<p class="problem">{reason}</p>{/if}
      <div class="pair">
        <button type="button" class="word lead" disabled={busy} onclick={sync}><span class="icon" aria-hidden="true"><Icon name="sync" /></span>sync weights</button>
        <button type="button" class="word" disabled={busy} onclick={changeUser}>change user</button>
      </div>
    {:else if choosing.length}
      <div class="choices">
        {#each choosing as user (user.id)}
          <button type="button" class="word" disabled={busy} onclick={() => run(() => pick(user), 'scale')}>{user.name || `user ${user.id}`}</button>
        {/each}
      </div>
    {:else}
      <p class="muted">Take each fast's weight from openScale: the last weighing during it, else the closest to its end within {WINDOW_HOURS} hours.</p>
      <button type="button" class="word lead" disabled={busy} onclick={connect}
        ><span class="icon" aria-hidden="true"><Icon name="link" /></span>connect openScale</button
      >
    {/if}
    {#if message && messageAt === 'scale'}<p class="message" role="status">{message}</p>{/if}
  </Block>

  <Block title="Backup" icon="backup">
    <p class="muted">{last ? `Last export ${last}.` : 'Never exported.'}</p>
    <div class="pair">
      <button type="button" class="word lead" disabled={busy} onclick={exportNow}><span class="icon" aria-hidden="true"><Icon name="download" /></span>export</button>
      <button type="button" class="word" disabled={busy} onclick={() => picker?.click()}>
        <span class="icon" aria-hidden="true"><Icon name="upload" /></span>import
      </button>
    </div>
    <input bind:this={picker} type="file" accept="application/json,.json" hidden onchange={importFile} />
    <button type="button" class="word lead" disabled={busy} onclick={exportIcs}
      ><span class="icon" aria-hidden="true"><Icon name="download" /></span>export to calendar (.ics)</button
    >
    {#if message && messageAt === 'backup'}<p class="message" role="status">{message}</p>{/if}
    <p class="muted">Import adds the fasts the app lacks and changes none.</p>

    <hr class="split" />
    {@render toggle('keepOneFile', 'Keep one file')}
    <p class="muted">{exportNote}</p>
    {@render toggle('exportOn', 'Export on a schedule')}
    <label class="when">
      <span class="muted">Every</span>
      <input
        type="text"
        bind:value={every}
        oninput={typed}
        onblur={() => (typing = false)}
        autocapitalize="off"
        autocomplete="off"
        spellcheck="false"
        placeholder="daily"
        aria-describedby="when-reads"
      />
    </label>
    <p id="when-reads" class:problem={!reading.ok} role="status">
      {reading.text}{#if reading.ok && settings.exportOn}{' '}<span class="muted">{reading.next}</span>{/if}
    </p>
    <div class="examples">
      {#each SCHEDULE_EXAMPLES as text (text)}<button type="button" class="link" onclick={() => example(text)}>{text}</button>{/each}
    </div>
    {#if autoLine}<p class="muted message">{autoLine}</p>{/if}
  </Block>

  <Block title="Privacy" icon="lock">
    {@render toggle('cloudBackup', 'Cloud backup', true)}
    <p class="muted">
      Off keeps your fasts out of your Google account's backup; moving to a new phone by direct transfer works either
      way, on Android 9 and newer.
    </p>
  </Block>
</div>

<style>
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 0.4em;
  }

  /* Pages: the name, whether it shows, then the moves at the right edge. */
  .page-name {
    flex: 1;
  }

  .always {
    padding: 0 0.3ch;
  }

  .moves {
    display: flex;
    margin-right: -0.6ch;
  }

  .row.first {
    margin-top: 0;
  }

  p {
    margin: 0.3em 0;
  }

  hr.split {
    margin-top: 0.8em;
  }

  /* A Material icon at the start of a word button. */
  .mark {
    margin-right: 0.6ch;
  }

  .pair {
    display: flex;
    gap: 3ch;
  }

  /* A button on its own line keeps to its words, not the pane's width. */
  button.lead {
    align-self: flex-start;
  }

  .message {
    overflow-wrap: anywhere;
  }

  .choices {
    display: flex;
    flex-wrap: wrap;
    gap: 0 2ch;
    margin-left: -0.3ch;
  }

  .when {
    display: flex;
    align-items: center;
    gap: 1ch;
    margin-top: 0.4em;
  }

  .when input {
    flex: 1;
    min-width: 0;
  }

  /* Example schedules to tap, spaced out, with room round each for a finger. */
  .examples {
    display: flex;
    flex-wrap: wrap;
    gap: 0 2ch;
  }

  .examples button {
    padding: 0.35em 0;
  }

  .problem {
    color: var(--bad);
  }
</style>
