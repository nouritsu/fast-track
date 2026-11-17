<script lang="ts">
  import { fastLength, newestFirst, showWeight, stageHours, streak, summarize, type Fast } from '../fasting/fasts'
  import { weightOf, type ScaleWeight } from '../fasting/openscale'
  import { NAME_WIDTH, STAGES } from '../fasting/stages'
  import { bar, duration, pad, sparkline } from '../ui/fields'
  import Page from '../ui/Page.svelte'

  // The history at a glance: counts, lengths, how often the goal was met, the last
  // fortnight of fasts, the hours spent in each stage, and the weight's trend.
  let { fasts, scale, unit, now }: { fasts: Fast[]; scale: ScaleWeight[]; unit: 'kg' | 'lb'; now: number } = $props()

  const RECENT = 14
  const sum = $derived(summarize(fasts))
  const recent = $derived(newestFirst(fasts).slice(0, RECENT).reverse())
  const hours = $derived(stageHours(fasts))
  const most = $derived(Math.max(1, ...hours))
  // Each fast's weight, typed in or from openScale.
  const weighed = $derived(
    newestFirst(fasts)
      .map((f) => weightOf(f, scale)?.kg ?? null)
      .filter((kg) => kg !== null)
      .slice(0, RECENT)
      .reverse(),
  )
  const lowest = $derived(Math.min(...weighed))
  const firstWeight = $derived(weighed[0] ?? 0)
  const lastWeight = $derived(weighed.at(-1) ?? 0)
  const change = $derived.by(() => {
    const kg = lastWeight - firstWeight
    const shown = showWeight(Math.abs(kg), unit)
    return kg === 0 ? '±0' : `${kg > 0 ? '+' : '-'}${shown.split(' ')[0]}`
  })
</script>

<Page title="Statistics">
  {#if fasts.length}
    <h3>Fasts</h3>
    <p class="fields">Fasts {pad(sum.count, 3)} · Streak {pad(streak(fasts, now), 2)}</p>
    <p class="fields">Goal met {pad(Math.round(sum.goalRate * 100), 3)}%</p>
    <p class="fields">Average {duration(sum.average)}</p>
    <p class="fields">Longest {duration(sum.longest)}</p>
    <p class="fields">Total   {Math.round(sum.total / 3_600_000)}h</p>

    <h3 class="gap">Last {recent.length === 1 ? 'fast' : `${recent.length} fasts`}</h3>
    <p class="fields spark">{sparkline(recent.map(fastLength))}</p>

    <h3 class="gap">Hours in each stage</h3>
    {#each STAGES as stage, i (stage.id)}
      <!-- One line: inside a pre-formatted line, a line break between expressions would show. -->
      <p class="fields"><span style:color="var(--{stage.id})">{stage.name.padEnd(NAME_WIDTH)}</span> {`${bar(hours[i] / most, 8)} ${pad(Math.round(hours[i]), 4)}h`}</p>
    {/each}

    <h3 class="gap">Weight</h3>
    {#if weighed.length}
      <!-- Above the lowest weight, so the line shows the change rather than the weight. -->
      <p class="fields spark">{sparkline(weighed.map((kg) => kg - lowest + 0.1))}</p>
      <p class="fields">Now {showWeight(lastWeight, unit)} · {change} over {weighed.length === 1 ? '1 fast' : `${weighed.length} fasts`}</p>
    {:else}
      <p class="muted">Add a weight when you end a fast, or connect openScale in Options.</p>
    {/if}
  {:else}
    <p class="muted">No fasts yet.</p>
  {/if}
</Page>

<style>
  .gap {
    margin-top: 0.8em;
  }

  .spark {
    letter-spacing: 0.1ch;
  }
</style>
