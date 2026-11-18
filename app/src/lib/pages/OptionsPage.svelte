<script lang="ts">
  import { Capacitor } from '@capacitor/core'
  import { untrack } from 'svelte'
  import { askAlerts } from '../fasting/alerts'
  import { lastResult, type ExportResult } from '../fasting/autoexport'
  import { askScale, emptyReason, scaleStatus, scaleUsers, WINDOW_HOURS, type ScaleStatus, type ScaleUser } from '../fasting/openscale'
  import { backupName, makeBackup, parseBackup, saveBackupFile } from '../fasting/backup'
  import { toIcs, WEEK_STARTS, weekStartName } from '../fasting/calendar'
  import { dayKey } from '../fasting/time'
  import { describeSchedule, listed, nextRun, parseSchedule, ScheduleError } from '../fasting/schedule'
  import { dayClock, shortDate } from '../fasting/time'
  import type { Tracker } from '../fasting/tracker.svelte'
  import Block from '../ui/Block.svelte'
  import type { Theme } from '../theme'

  // A pane a category: the theme and weight unit, the notifications, the calendar,
  // weights from openScale, the backup, and its regular exports. Toggles show the
  // current state.
  let {
    tracker,
    theme,
    onTheme,
  }: { tracker: Tracker; theme: Theme; onTheme: (button: HTMLElement) => void } = $props()

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

  const autoLine = $derived(
    auto &&
      `Last regular export ${new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(auto.at))}${
        auto.error ? ` failed: ${auto.error}` : ` to ${auto.path}`
      }.`,
  )
  const last = $derived(
    settings.lastExport
      ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(settings.lastExport))
      : null,
  )

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

  function toggleAlerts() {
    run(async () => {
      if (settings.alerts) {
        await tracker.setSettings({ alerts: false })
        return 'Alerts off.'
      }
      if (Capacitor.isNativePlatform() && !(await askAlerts())) return 'Notifications are blocked in Android settings.'
      await tracker.setSettings({ alerts: true })
      return 'Alerts on.'
    }, 'notify')
  }

  function toggleStatus() {
    run(async () => {
      if (settings.status) {
        await tracker.setSettings({ status: false })
        return 'Status notification off.'
      }
      if (Capacitor.isNativePlatform() && !(await askAlerts())) return 'Notifications are blocked in Android settings.'
      await tracker.setSettings({ status: true })
      return 'Status notification on.'
    }, 'notify')
  }

  function exportNow() {
    run(async () => {
      const now = new Date()
      const where = await saveBackupFile(backupName(now), JSON.stringify(makeBackup(tracker.fasts, settings, now), null, 1))
      await tracker.setSettings({ lastExport: now.toISOString() })
      return `Saved to ${where}.`
    })
  }

  // The fasts as an .ics file, for any calendar app.
  function exportIcs() {
    run(async () => {
      const where = await saveBackupFile(`fast-track-${dayKey(new Date())}.ics`, toIcs(tracker.fasts, settings.unit), 'text/calendar')
      return `Saved ${tracker.fasts.length} fasts to ${where}; open it with a calendar app to import them.`
    })
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

<!-- A pane a category, in one scrolling column like Stats (app.css .panes). -->
<div class="panes">
  <Block title="General">
    <div class="row first">
      <span>Theme</span>
      <button type="button" class="word" aria-label="Theme: {theme === 'mocha' ? 'Mocha' : 'Latte'}" onclick={(e) => onTheme(e.currentTarget)}>
        <span class="icon" aria-hidden="true">{theme === 'mocha' ? '⏾' : '☼'}</span>{theme === 'mocha' ? 'Mocha' : 'Latte'}
      </button>
    </div>
    <div class="row">
      <span>Weight</span>
      <button
        type="button"
        class="word"
        aria-label="Weight unit: {settings.unit}"
        onclick={() => tracker.setSettings({ unit: settings.unit === 'kg' ? 'lb' : 'kg' })}>{settings.unit}</button
      >
    </div>
  </Block>

  <Block title="Notifications">
    <div class="row first">
      <span>Alerts</span>
      <button type="button" class="word" disabled={busy} aria-pressed={settings.alerts} onclick={toggleAlerts}>
        {settings.alerts ? 'on' : 'off'}
      </button>
    </div>
    <p class="muted">A notification when a stage begins and at the goal.</p>
    <div class="row">
      <span>Status</span>
      <button type="button" class="word" disabled={busy} aria-pressed={settings.status} onclick={toggleStatus}>
        {settings.status ? 'on' : 'off'}
      </button>
    </div>
    <p class="muted">A notification that stays: fasting or eating, the stage, and a running timer.</p>
    {#if message && messageAt === 'notify'}<p class="message" role="status">{message}</p>{/if}
  </Block>

  <Block title="Calendar">
    <div class="row first">
      <span>Week starts on</span>
      <button type="button" class="word" onclick={() => tracker.setSettings({ weekStart: nextWeekStart() })}
        >{weekStartName(settings.weekStart)}</button
      >
    </div>
    {#each [['weekNumbers', 'Week numbers'], ['weekTotals', 'Weekly totals']] as const as [key, name] (key)}
      <div class="row">
        <span>{name}</span>
        <button type="button" class="word" aria-pressed={settings[key]} onclick={() => tracker.setSettings({ [key]: !settings[key] })}
          >{settings[key] ? 'on' : 'off'}</button
        >
      </div>
    {/each}
    <p class="muted">Week numbers are ISO weeks; a week's hours count the fasts that ended in it.</p>
  </Block>

  <Block title="openScale">
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
        <button type="button" class="word lead" disabled={busy} onclick={sync}><span class="icon" aria-hidden="true">↺</span>sync weights</button>
        <button type="button" class="word" disabled={busy} onclick={changeUser}>change user</button>
      </div>
    {:else if choosing.length}
      <div class="choices">
        {#each choosing as user (user.id)}
          <button type="button" class="word" disabled={busy} onclick={() => run(() => pick(user), 'scale')}>{user.name || `user ${user.id}`}</button>
        {/each}
      </div>
    {:else}
      <p class="muted">Take each fast's weight from openScale: the weighing closest to its end, within {WINDOW_HOURS} hours.</p>
      <button type="button" class="word lead" disabled={busy} onclick={connect}
        ><span class="icon" aria-hidden="true">⚯</span>connect openScale</button
      >
    {/if}
    {#if message && messageAt === 'scale'}<p class="message" role="status">{message}</p>{/if}
  </Block>

  <Block title="Backup">
    <p class="muted">{last ? `Last export ${last}.` : 'Never exported.'}</p>
    <div class="pair">
      <button type="button" class="word lead" disabled={busy} onclick={exportNow}><span class="icon" aria-hidden="true">⤓</span>export</button>
      <button type="button" class="word" disabled={busy} onclick={() => picker?.click()}>
        <span class="icon" aria-hidden="true">⤒</span>import
      </button>
    </div>
    <input bind:this={picker} type="file" accept="application/json,.json" hidden onchange={importFile} />
    <button type="button" class="word lead" disabled={busy} onclick={exportIcs}
      ><span class="icon" aria-hidden="true">⤓</span>export to calendar (.ics)</button
    >
    {#if message && messageAt === 'backup'}<p class="message" role="status">{message}</p>{/if}
    <p class="muted">Import adds fasts the app does not have yet and changes none. The .ics file has one event per fast for any calendar app.</p>
  </Block>

  <Block title="Regular export">
    <div class="row first">
      <span>Export on a schedule</span>
      <button
        type="button"
        class="word"
        aria-pressed={settings.exportOn}
        onclick={() => tracker.setSettings({ exportOn: !settings.exportOn })}>{settings.exportOn ? 'on' : 'off'}</button
      >
    </div>
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
    <p class="muted">
      In calendar event notation (systemd's OnCalendar format): daily, weekly, Mon..Fri 08:00, *-*-01 09:00, *:0/30.
      Files go to Documents/FastTrack/, one a day.
    </p>
    {#if autoLine}<p class="muted message">{autoLine}</p>{/if}
  </Block>
</div>

<style>
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 0.4em;
  }

  .row.first {
    margin-top: 0;
  }

  p {
    margin: 0.3em 0;
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

  .problem {
    color: var(--bad);
  }
</style>
