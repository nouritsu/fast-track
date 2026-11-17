<script lang="ts">
  import { Capacitor } from '@capacitor/core'
  import { askAlerts } from '../fasting/alerts'
  import { backupName, makeBackup, parseBackup, saveBackupFile } from '../fasting/backup'
  import type { Tracker } from '../fasting/tracker.svelte'
  import Page from '../ui/Page.svelte'
  import type { Theme } from '../theme'

  // The theme, alerts, the status notification, the weight unit, and the backup.
  // Toggles show the current state.
  let {
    tracker,
    theme,
    onTheme,
  }: { tracker: Tracker; theme: Theme; onTheme: (button: HTMLElement) => void } = $props()

  let busy = $state(false)
  let message = $state('')
  let picker = $state<HTMLInputElement>()

  const settings = $derived(tracker.settings)
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
</style>
