<script lang="ts">
  import { Capacitor } from '@capacitor/core'
  import { untrack } from 'svelte'
  import { askAlerts } from '../fasting/alerts'
  import { lastResult, type ExportResult } from '../fasting/autoexport'
  import { askScale, scaleStatus, scaleUsers, WINDOW_HOURS, type ScaleStatus, type ScaleUser } from '../fasting/openscale'
  import { backupName, makeBackup, parseBackup, saveBackupFile } from '../fasting/backup'
  import { describeSchedule, listed, nextRun, parseSchedule, ScheduleError } from '../fasting/schedule'
  import { dayClock, shortDate } from '../fasting/time'
  import type { Tracker } from '../fasting/tracker.svelte'
  import Page from '../ui/Page.svelte'
  import type { Theme } from '../theme'

  // Options in btop's manner: categories along the top, then each option as its name
  // with its value under it, ← value →, the selected one lit, and a box at the foot
  // that explains it and says how the last action went. Values cycle with the arrows;
  // actions show as [ action ]; the export schedule is typed in place.
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
  let users = $state<ScaleUser[]>([]) // openScale's users, once it may be read

  $effect(() => {
    void scaleStatus().then(async (status) => {
      scale = status
      const id = untrack(() => settings.scaleUser)
      if (!status.granted) return
      users = await scaleUsers().catch(() => [])
      scaleUser = users.find((u) => u.id === id) ?? null
    })
  })

  function connect() {
    run(async () => {
      scale = await askScale()
      if (!scale.granted) return 'Not allowed. Android settings → Apps → Fast Track → Permissions can allow openScale later.'
      users = await scaleUsers()
      if (!users.length) return 'openScale has no users yet.'
      const picked = await pick(users[0])
      return users.length > 1 ? `${picked} Not you? Switch users with the arrows.` : picked
    })
  }

  async function pick(user: ScaleUser): Promise<string> {
    scaleUser = user
    await tracker.setSettings({ scaleUser: user.id })
    return `Connected to ${user.name || 'openScale'}: ${tracker.scale.length} weighings.`
  }

  // Writes the scale's weights into past fasts, and says what it found.
  function sync() {
    run(async () => {
      const r = await tracker.syncScale()
      const w = tracker.scale
      if (!w.length) return 'openScale gave no weighings for this user.'
      const span = `${w.length} weighings, ${shortDate(w[0].at)} to ${shortDate(w.at(-1)!.at)}`
      const did = [
        r.filled && `filled ${r.filled}`,
        r.updated && `updated ${r.updated}`,
        r.typed && `kept ${r.typed} typed in`,
        r.unmatched && `${r.unmatched} without a weighing during the fast or within ${WINDOW_HOURS} hours of its end`,
      ].filter(Boolean)
      return `${span}: ${did.length ? listed(did as string[]) : 'every fast was up to date'}.`
    })
  }

  /** The next or previous openScale user. */
  function switchUser(by: -1 | 1) {
    if (!users.length) return
    const at = users.findIndex((u) => u.id === scaleUser?.id)
    const user = users[(at + by + users.length) % users.length]
    run(() => pick(user))
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

  // The options, by category ------------------------------------------------------

  type Category = 'general' | 'weight' | 'backup'
  const CATEGORIES: Category[] = ['general', 'weight', 'backup']

  interface Option {
    id: string
    name: string
    kind: 'cycle' | 'action' | 'text' | 'note'
    value: string
    about: string
    step?: (by: -1 | 1, button: HTMLElement) => void // cycle
    act?: () => void // action
    off?: boolean // an action not available now
  }

  const onOff = (on: boolean) => (on ? 'on' : 'off')
  const connected = $derived(scale.granted && settings.scaleUser !== null)

  const options = $derived<Record<Category, Option[]>>({
    general: [
      {
        id: 'theme',
        name: 'Theme',
        kind: 'cycle',
        value: theme === 'mocha' ? 'Mocha' : 'Latte',
        about: 'Catppuccin Mocha, dark, or Latte, light. The new one grows from the arrow you pressed.',
        step: (_, button) => onTheme(button),
      },
      {
        id: 'alerts',
        name: 'Stage alerts',
        kind: 'cycle',
        value: onOff(settings.alerts),
        about: 'A notification when a stage begins and when the goal is reached.',
        step: toggleAlerts,
      },
      {
        id: 'status',
        name: 'Status notification',
        kind: 'cycle',
        value: onOff(settings.status),
        about: 'A notification that stays while you fast or eat: the stage, a running timer, and when the next stage and the goal come.',
        step: toggleStatus,
      },
    ],
    weight: [
      {
        id: 'unit',
        name: 'Unit',
        kind: 'cycle',
        value: settings.unit,
        about: 'Weights shown and typed in kilograms or pounds; they are kept in kilograms either way.',
        step: () => void tracker.setSettings({ unit: settings.unit === 'kg' ? 'lb' : 'kg' }),
      },
      !scale.installed
        ? { id: 'openscale', name: 'openScale', kind: 'note', value: 'not installed', about: 'Install openScale to take each fast\'s weight from your scale.' }
        : connected && users.length
          ? {
              id: 'openscale',
              name: 'openScale user',
              kind: 'cycle',
              value: scaleUser?.name || `user ${settings.scaleUser}`,
              about: `Weights come from this openScale user: ${tracker.scale.length} weighings. A fast takes the last one during it, else the closest to its end within ${WINDOW_HOURS} hours; a weight you type in wins.`,
              step: switchUser,
            }
          : {
              id: 'openscale',
              name: 'openScale',
              kind: 'action',
              value: 'connect',
              about: `Take each fast's weight from openScale: the last weighing during the fast, else the closest to its end within ${WINDOW_HOURS} hours. Android asks you once to allow it.`,
              act: connect,
            },
      {
        id: 'sync',
        name: 'Sync weights',
        kind: 'action',
        value: 'sync now',
        about: `Writes openScale's weights into past fasts that have none typed in, so backups and stats keep them. Run it again after weighing in.${connected ? '' : ' Connect openScale first.'}`,
        act: sync,
        off: !connected,
      },
      ...(connected
        ? [
            {
              id: 'disconnect',
              name: 'Disconnect',
              kind: 'action' as const,
              value: 'disconnect',
              about: 'Stop reading openScale. Weights already synced into fasts stay.',
              act: disconnect,
            },
          ]
        : []),
    ],
    backup: [
      {
        id: 'export',
        name: 'Export',
        kind: 'action',
        value: 'export now',
        about: `Saves every fast and the settings to Documents/FastTrack/. ${last ? `Last export ${last}.` : 'Never exported.'}`,
        act: exportNow,
      },
      {
        id: 'import',
        name: 'Import',
        kind: 'action',
        value: 'choose file',
        about: 'Adds the fasts from a backup file. Fasts already here are not changed.',
        act: () => picker?.click(),
      },
      {
        id: 'regular',
        name: 'Regular export',
        kind: 'cycle',
        value: onOff(settings.exportOn),
        about: `Exports on a schedule, with the app closed too: one file a day in Documents/FastTrack/.${autoLine ? ` ${autoLine}` : ''}`,
        step: () => void tracker.setSettings({ exportOn: !settings.exportOn }),
      },
      {
        id: 'every',
        name: 'Export every',
        kind: 'text',
        value: every,
        about: "In calendar event notation (systemd's OnCalendar format): daily, weekly, Mon..Fri 08:00, *-*-01 09:00, *:0/30.",
      },
    ],
  })

  let category = $state<Category>('general')
  let selected = $state('theme')
  const shown = $derived(options[category].find((o) => o.id === selected) ?? options[category][0])

  function choose(next: Category) {
    category = next
    selected = options[next][0].id
    message = ''
  }

  function select(id: string) {
    if (id !== selected) message = ''
    selected = id
  }
</script>

<Page title="Options">
  <div class="layout">
    <div class="categories" role="tablist" aria-label="Option categories">
      {#each CATEGORIES as c (c)}
        <button type="button" role="tab" aria-selected={category === c} class:current={category === c} onclick={() => choose(c)}
          >{c}</button
        >
      {/each}
    </div>
    <hr class="split" />

    <div class="list">
      {#each options[category] as o (o.id)}
        <div class="option" class:selected={shown.id === o.id}>
          <button type="button" class="name" aria-pressed={shown.id === o.id} onclick={() => select(o.id)}>{o.name}</button>
          <div class="value">
            {#if o.kind === 'cycle'}
              <button
                type="button"
                class="glyph"
                aria-label="Previous {o.name}"
                disabled={busy}
                onclick={(e) => (select(o.id), o.step?.(-1, e.currentTarget))}>←</button
              >
              <span class="shown">{o.value}</span>
              <button
                type="button"
                class="glyph"
                aria-label="Next {o.name}"
                disabled={busy}
                onclick={(e) => (select(o.id), o.step?.(1, e.currentTarget))}>→</button
              >
            {:else if o.kind === 'action'}
              <button type="button" class="run" disabled={busy || o.off} onclick={() => (select(o.id), o.act?.())}>[ {o.value} ]</button>
            {:else if o.kind === 'text'}
              <input
                type="text"
                bind:value={every}
                oninput={typed}
                onfocus={() => select(o.id)}
                onblur={() => (typing = false)}
                autocapitalize="off"
                autocomplete="off"
                spellcheck="false"
                placeholder="daily"
                aria-label={o.name}
              />
            {:else}
              <span class="muted">{o.value}</span>
            {/if}
          </div>
        </div>
      {/each}
    </div>

    <hr class="split" />
    <div class="about" role="status">
      <p>{shown.about}</p>
      {#if shown.id === 'every'}
        <p class:problem={!reading.ok}>
          {reading.text}{#if reading.ok}{' '}<span class="muted">{settings.exportOn ? reading.next : 'Regular export is off.'}</span>{/if}
        </p>
      {/if}
      {#if message}<p class="message">{message}</p>{/if}
    </div>
  </div>
  <input bind:this={picker} type="file" accept="application/json,.json" hidden onchange={importFile} />
</Page>

<style>
  .layout {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  /* Inside the page's content, a split stays within it. */
  hr.split {
    margin: 0.4em 0;
  }

  /* btop's category tabs: words, the current one lit. */
  .categories {
    display: flex;
    gap: 1ch;
  }

  .categories button {
    padding: 0.15em 1ch;
    background: none;
    border: none;
    color: var(--muted);
  }

  .categories button.current {
    background: var(--accent);
    color: var(--bg);
  }

  .list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  /* An option: its name, then its value centred under it. The selected name is lit
     across the width, as btop does. */
  .option {
    margin-bottom: 0.35em;
  }

  .name {
    display: block;
    width: 100%;
    padding: 0.1em 1ch;
    background: none;
    border: none;
    border-radius: 0.3em;
    text-align: left;
  }

  .selected .name {
    background: var(--accent);
    color: var(--bg);
  }

  .value {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1ch;
    min-height: 2em;
  }

  .shown {
    min-width: 12ch;
    text-align: center;
    font-weight: 700;
  }

  .run {
    padding: 0.2em 1ch;
    background: none;
    border: none;
    color: var(--accent);
  }

  .value input {
    width: 80%;
    text-align: center;
  }

  /* The foot: what the selected option does, and how the last action went. */
  .about {
    min-height: 6.5em;
  }

  .about p {
    margin: 0.2em 0;
  }

  .message {
    overflow-wrap: anywhere;
    color: var(--accent);
  }

  .problem {
    color: var(--bad);
  }
</style>
