<script lang="ts">
  import { untrack } from 'svelte'
  import { STAGES, stageSpan } from '../fasting/stages'
  import Icon from '../ui/Icon.svelte'
  import Measure from '../ui/Measure.svelte'
  import { spread } from '../ui/progress'
  import Block from '../ui/Block.svelte'
  import ShuffleText from '../ui/ShuffleText.svelte'

  // The stages of a fast as one text bar like the Fast page's, as wide as the page:
  // as many cells as fit, shared among the stages by the hours they span, each run in
  // its stage's colour, the picked one solid and the others shaded. Tapping a run
  // (or < >) shows what happens in it and papers to read; it opens on the stage the
  // fast in progress is in. It fills what the page leaves, scrolling inside its border,
  // so stepping through the stages moves nothing else. Below it, as tall as it needs,
  // the app: version, source, its origin, credits and licences, which open in a pane (App).
  let { current = null, onLicences }: { current?: number | null; onLicences: () => void } = $props()

  let pick = $state(untrack(() => current ?? 0))
  // A fast that moves on to the next stage moves the bar with it.
  $effect(() => {
    if (current !== null) pick = current
  })
  const stage = $derived(STAGES[pick])
  const step = (by: -1 | 1) => (pick = (pick + by + STAGES.length) % STAGES.length)

  // Each stage's length in hours, the open-ended last as long as the one before.
  const LENGTHS = STAGES.map((s, i) => (STAGES[i + 1]?.from ?? s.from + (s.from - STAGES[i - 1].from)) - s.from)

  // As many cells as the width holds: the bar's width over a character's (Measure).
  let width = $state(0)
  let ch = $state(0)
  const cells = $derived(ch ? Math.max(STAGES.length * 3, Math.floor(width / ch)) : 36)
  const counts = $derived(spread(LENGTHS, cells))
  // The hours under the bar, each at the cell its stage starts on.
  const ticks = $derived(
    STAGES.reduce((line, s, i) => {
      const at = counts.slice(0, i).reduce((a, b) => a + b, 0)
      return line.padEnd(at) + (i === STAGES.length - 1 ? `${s.from}h+` : `${s.from}h`) + ' '
    }, '').trimEnd(),
  )

  const SOURCE = 'https://github.com/nouritsu/fast-track'
  const ORIGINAL = 'https://github.com/Darkrock-Studios/FastTrack'
</script>

<div class="layout">
<Block title="Stages of a fast" icon="layers" class="stages-block">
  <div class="scroller">
  <Measure bind:width bind:ch />
  <div class="bar" role="tablist" aria-label="Stages of a fast">
    {#each STAGES as s, i (s.id)}<button
        type="button"
        role="tab"
        class="run"
        aria-selected={pick === i}
        aria-label="{s.name}, {stageSpan(i)}{current === i ? ', now' : ''}"
        style:color="var(--{s.id})"
        onclick={() => (pick = i)}>{(pick === i ? '█' : '░').repeat(counts[i])}</button
      >{/each}
  </div>
  <p class="ticks" aria-hidden="true">{ticks}</p>

  <div class="detail" role="tabpanel" aria-label={stage.name}>
    <div class="name">
      <button type="button" class="glyph" aria-label="Previous stage" onclick={() => step(-1)}>&lt;</button>
      <span
        ><span style:color="var(--{stage.id})">■ <ShuffleText text={stage.name} /></span> <span class="muted"
          ><ShuffleText text="{stageSpan(pick)}{current === pick ? ' · now' : ''}" /></span
        ></span
      >
      <button type="button" class="glyph" aria-label="Next stage" onclick={() => step(1)}>&gt;</button>
    </div>
    <p>{stage.term === stage.name ? '' : `${stage.term}. `}{stage.about}</p>
    <p class="muted">Read more</p>
    <ul class="sources">
      {#each stage.sources as source (source.url)}
        <li>
          <a class="link" href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
          <span class="muted">{source.who} · {source.where}{source.note ? ` · ${source.note}` : ''}</span>
        </li>
      {/each}
    </ul>
  </div>
  <p class="muted">Times vary with the person, the last meal and activity. This is not medical advice.</p>
  </div>
</Block>

<Block title="About" icon="info" class="about-block">
  <ul class="credits">
    <li>
      Fast Track {__APP_VERSION__} ·
      <a class="link" href={SOURCE} target="_blank" rel="noreferrer"><Icon name="github" /> source on GitHub</a>
    </li>
    <li>
      <span class="muted">based on</span>
      <a class="link" href={ORIGINAL} target="_blank" rel="noreferrer"><Icon name="github" /> Fast Track</a>
      <span class="muted">by Dark Rock Studios (MIT)</span>
    </li>
    <li>
      <span class="muted">font</span>
      <a class="link" href="https://github.com/be5invis/Iosevka" target="_blank" rel="noreferrer">Iosevka</a>
      <span class="muted">(SIL OFL 1.1)</span>
    </li>
    <li>
      <span class="muted">colours</span>
      <a class="link" href="https://catppuccin.com" target="_blank" rel="noreferrer">Catppuccin</a>
      <span class="muted">(MIT)</span>
    </li>
    <li>
      <span class="muted">icons</span>
      <a class="link" href="https://fonts.google.com/icons" target="_blank" rel="noreferrer">Material Icons</a>
      <span class="muted">(Apache 2.0),</span>
      <a class="link" href="https://primer.style/octicons" target="_blank" rel="noreferrer">Octicons</a>
      <span class="muted">(MIT)</span>
    </li>
    <li>
      <span class="muted">licences</span>
      <button type="button" class="link" onclick={onLicences}>third-party notices</button>
    </li>
  </ul>
</Block>
</div>

<style>
  /* The stages take what the page leaves and scroll inside; About keeps to its lines at
     the bottom. The gap leaves room for About's title in its top edge. */
  .layout {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 1.7em;
  }

  .layout > :global(.stages-block) {
    flex: 1;
    min-height: 0;
  }

  .layout > :global(.about-block) {
    flex: none;
  }

  /* The stages as a text bar, as the Fast page draws progress. */
  .bar {
    display: flex;
    margin-top: 0.5em;
    font-variant-ligatures: none;
    white-space: pre;
    line-height: 1.2;
  }

  .run {
    padding: 0.3em 0;
    background: none;
    border: none;
    border-radius: 0;
    color: inherit;
  }

  /* The same size as the bar, so each hour sits under the cell it names. */
  .ticks {
    white-space: pre;
    font-variant-ligatures: none;
    color: var(--muted);
  }

  .detail {
    margin-top: 0.6em;
  }

  .name {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .sources {
    margin: 0.2em 0 0.4em;
    padding: 0;
    list-style: none;
  }

  .sources li {
    margin: 0.45em 0;
  }

  .sources .muted {
    display: block;
    font-size: 0.9em;
  }

  /* The app's own credits, a line each with room to tap. */
  .credits {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .credits li {
    margin: 0.7em 0;
  }

  .credits li:first-child {
    margin-top: 0.1em;
  }

  .credits li:last-child {
    margin-bottom: 0.1em;
  }
</style>
