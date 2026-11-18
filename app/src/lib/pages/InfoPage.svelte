<script lang="ts">
  import { untrack } from 'svelte'
  import { STAGES, stageSpan } from '../fasting/stages'
  import Icon from '../ui/Icon.svelte'
  import Measure from '../ui/Measure.svelte'
  import { spread } from '../ui/progress'
  import Page from '../ui/Page.svelte'

  // The stages of a fast as one text bar like the Fast page's, as wide as the page:
  // as many cells as fit, shared among the stages by the hours they span, each run in
  // its stage's colour, the picked one solid and the others shaded. Tapping a run
  // (or < >) shows what happens in it and papers to read; it opens on the stage the
  // fast in progress is in. Then the app: version, source, its origin and credits.
  let { current = null }: { current?: number | null } = $props()

  let pick = $state(untrack(() => current ?? 0))
  // A fast that moves on to the next stage moves the bar with it.
  $effect(() => {
    if (current !== null) pick = current
  })
  const stage = $derived(STAGES[pick])
  const step = (by: -1 | 1) => (pick = (pick + by + STAGES.length) % STAGES.length)

  // Each stage's hours, the open-ended last as long as the one before.
  const SPANS = STAGES.map((s, i) => (STAGES[i + 1]?.from ?? s.from + (s.from - STAGES[i - 1].from)) - s.from)

  // As many cells as the width holds: the bar's width over a character's (Measure).
  let width = $state(0)
  let ch = $state(0)
  const cells = $derived(ch ? Math.max(STAGES.length * 3, Math.floor(width / ch)) : 36)
  const counts = $derived(spread(SPANS, cells))
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

<Page title="Info">
  <h3>Stages of a fast</h3>
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
        ><span style:color="var(--{stage.id})">■ {stage.name}</span> <span class="muted"
          >{stageSpan(pick)}{current === pick ? ' · now' : ''}</span
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

  <hr class="split" />
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
      <span class="muted">fonts</span>
      <a class="link" href="https://github.com/be5invis/Iosevka" target="_blank" rel="noreferrer">Iosevka</a>,
      <a class="link" href="https://fonts.google.com/noto/specimen/Noto+Sans+Symbols+2" target="_blank" rel="noreferrer"
        >Noto Sans Symbols 2</a
      >
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
  </ul>
</Page>

<style>
  /* The stages as a text bar, as the Fast page draws progress: one cell an hour. */
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
    margin: 0;
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

  hr.split {
    margin: 0.8em 0 0.4em;
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
</style>
