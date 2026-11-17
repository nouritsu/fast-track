<script lang="ts">
  import { Capacitor } from '@capacitor/core'
  import { untrack } from 'svelte'
  import { askAlerts } from '../fasting/alerts'
  import { lastResult, type ExportResult } from '../fasting/autoexport'
  import { askScale, scaleStatus, scaleUsers, WINDOW_HOURS, type ScaleStatus, type ScaleUser } from '../fasting/openscale'
  import { backupName, makeBackup, parseBackup, saveBackupFile } from '../fasting/backup'
  import { describeSchedule, nextRun, parseSchedule, ScheduleError } from '../fasting/schedule'
  import { dayClock } from '../fasting/time'
  import type { Tracker } from '../fasting/tracker.svelte'
  import Page from '../ui/Page.svelte'
  import type { Theme } from '../theme'

  // The theme, alerts, the status notification, the weight unit, weights from openScale,
  // and the backup with its regular exports. Toggles show the current state.
  let {
    tracker,
    theme,
    onTheme,
  }: { tracker: Tracker; theme: Theme; onTheme: (button: HTMLElement) => void } = $props()

  let busy = $state(false)
  let message = $state('')
  let picker = $state<HTMLInputElement>()

  const settings = $derived(tracker.settings)

  // Regular exports: the expression is read as it is typed, and saved once it reads.
  const SAVE_MS = 600
  let every = $state(untrack(() => tracker.settings.exportEvery)) // the field; the setting follows once it reads
  let saveTimer = 0
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
    const expression = every.trim()
    if (!reading.ok || expression === settings.exportEvery) return
    saveTimer = window.setTimeout(() => void tracker.setSettings({ exportEvery: expression }), SAVE_MS)
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
    })
  }

  async function pick(user: ScaleUser): Promise<string> {
    choosing = []
    scaleUser = user
    await tracker.setSettings({ scaleUser: user.id })
    return `Connected to ${user.name || 'openScale'}: ${tracker.scale.length} weighings.`
  }

  function disconnect() {
    run(async () => {
      await tracker.setSettings({ scaleUser: null })
      scaleUser = null
      return 'openScale disconnected; weights you typed in stay.'
    })
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

  async function run(task: () => Promise<string>) {
    busy = true
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
    })
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
    })
  }

  function exportNow() {
    run(async () => {
      const now = new Date()
      const where = await saveBackupFile(backupName(now), JSON.stringify(makeBackup(tracker.fasts, settings, now), null, 1))
      await tracker.setSettings({ lastExport: now.toISOString() })
      return `Saved to ${where}.`
    })
  }

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

<Page title="Options">
  <div class="row first">
    <span>Theme</span>
    <button type="button" class="toggle" aria-label="Theme: {theme === 'mocha' ? 'Mocha' : 'Latte'}" onclick={(e) => onTheme(e.currentTarget)}>
      <span class="icon" aria-hidden="true">{theme === 'mocha' ? '⏾' : '☼'}</span>{theme === 'mocha' ? 'Mocha' : 'Latte'}
    </button>
  </div>

  <div class="row">
    <span>Alerts</span>
    <button type="button" class="toggle" disabled={busy} aria-pressed={settings.alerts} onclick={toggleAlerts}>
      {settings.alerts ? 'On' : 'Off'}
    </button>
  </div>
  <p class="muted">A notification when a stage begins and at the goal.</p>

  <div class="row">
    <span>Status</span>
    <button type="button" class="toggle" disabled={busy} aria-pressed={settings.status} onclick={toggleStatus}>
      {settings.status ? 'On' : 'Off'}
    </button>
  </div>
  <p class="muted">A notification that stays: fasting or eating, the stage, and a running timer.</p>

  <div class="row">
    <span>Weight</span>
    <button
      type="button"
      class="toggle"
      aria-label="Weight unit: {settings.unit}"
      onclick={() => tracker.setSettings({ unit: settings.unit === 'kg' ? 'lb' : 'kg' })}>{settings.unit}</button
    >
  </div>

  <h3 class="gap">openScale</h3>
  {#if !scale.installed}
    <p class="muted">openScale is not installed. With it, each fast takes its weight from your scale.</p>
  {:else if scale.granted && settings.scaleUser !== null}
    <div class="row">
      <span>Weights from {scaleUser?.name || 'openScale'}</span>
      <button type="button" disabled={busy} onclick={disconnect}>Disconnect</button>
    </div>
    <p class="muted">
      {tracker.scale.length} weighings. A fast takes the one closest to its end, within {WINDOW_HOURS} hours; a weight you
      type in wins.
    </p>
  {:else if choosing.length}
    <div class="choices">
      {#each choosing as user (user.id)}
        <button type="button" disabled={busy} onclick={() => run(() => pick(user))}>{user.name || `User ${user.id}`}</button>
      {/each}
    </div>
  {:else}
    <p class="muted">Take each fast's weight from openScale: the weighing closest to its end, within {WINDOW_HOURS} hours.</p>
    <button type="button" disabled={busy} onclick={connect}><span class="icon" aria-hidden="true">⚯</span>Connect openScale</button>
  {/if}

  <h3 class="gap">Backup</h3>
  <p class="muted">{last ? `Last export ${last}.` : 'Never exported.'}</p>
  <div class="pair">
    <button type="button" disabled={busy} onclick={exportNow}><span class="icon" aria-hidden="true">⤓</span>Export</button>
    <button type="button" disabled={busy} onclick={() => picker?.click()}>
      <span class="icon" aria-hidden="true">⤒</span>Import
    </button>
  </div>
  <input bind:this={picker} type="file" accept="application/json,.json" hidden onchange={importFile} />
  {#if message}<p class="message" role="status">{message}</p>{/if}
  <p class="muted">Import adds fasts the app does not have yet and changes none.</p>

  <div class="row">
    <span>Regular export</span>
    <button
      type="button"
      class="toggle"
      aria-pressed={settings.exportOn}
      onclick={() => tracker.setSettings({ exportOn: !settings.exportOn })}>{settings.exportOn ? 'On' : 'Off'}</button
    >
  </div>
  <label class="when">
    <span class="muted">Every</span>
    <input
      type="text"
      bind:value={every}
      oninput={typed}
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
</Page>

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

  .toggle {
    min-width: 9ch;
  }

  .gap {
    margin-top: 1em;
  }

  .pair {
    display: flex;
    gap: 1ch;
  }

  .pair button {
    flex: 1;
  }

  .message {
    overflow-wrap: anywhere;
  }

  .choices {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5em 1ch;
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
