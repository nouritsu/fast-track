<script lang="ts">
  import { untrack } from 'svelte'
  import { STAGES, stageSpan } from '../fasting/stages'
  import Page from '../ui/Page.svelte'

  // The stages of a fast as one bar, a segment for each, wide as the hours it spans:
  // tapping one (or < >) shows what happens in it and papers to read. It opens on the
  // stage the fast in progress is in. Then the app: version, source and credits.
  let { current = null }: { current?: number | null } = $props()

  let pick = $state(untrack(() => current ?? 0))
  // A fast that moves on to the next stage moves the bar with it.
  $effect(() => {
    if (current !== null) pick = current
  })
  const stage = $derived(STAGES[pick])
  const step = (by: -1 | 1) => (pick = (pick + by + STAGES.length) % STAGES.length)

  // Each segment's width: the hours it spans, the open-ended last as wide as the one before.
  const SPANS = STAGES.map((s, i) => (STAGES[i + 1]?.from ?? s.from + (s.from - STAGES[i - 1].from)) - s.from)

  const SOURCE = 'https://github.com/nouritsu/fast-track'
</script>

<Page title="Info">
  <h3>Stages of a fast</h3>
  <div class="bar" role="tablist" aria-label="Stages of a fast">
    {#each STAGES as s, i (s.id)}
      <button
        type="button"
        role="tab"
        class="segment"
        class:on={pick === i}
        aria-selected={pick === i}
        aria-label="{s.name}, {stageSpan(i)}{current === i ? ', now' : ''}"
        style:--c="var(--{s.id})"
        style:flex-grow={SPANS[i]}
        onclick={() => (pick = i)}>{s.name.slice(0, 3).toLowerCase()}{current === i ? '•' : ''}</button
      >
    {/each}
  </div>
  <div class="ticks" aria-hidden="true">
    {#each STAGES as s, i (s.id)}<span style:flex-grow={SPANS[i]}>{s.from}h</span>{/each}
  </div>

  <div class="detail" role="tabpanel" aria-label={stage.name}>
    <div class="name">
      <button type="button" class="glyph" aria-label="Previous stage" onclick={() => step(-1)}>&lt;</button>
      <span><span style:color="var(--{stage.id})">■ {stage.name}</span> <span class="muted">{stageSpan(pick)}</span></span>
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
  <p>Fast Track {__APP_VERSION__} · <a class="link" href={SOURCE} target="_blank" rel="noreferrer">source on GitHub</a></p>
  <p class="muted">Based on the original Fast Track app.</p>
  <p class="muted">
    Fonts <a class="link" href="https://github.com/be5invis/Iosevka" target="_blank" rel="noreferrer">Iosevka</a> and
    <a class="link" href="https://fonts.google.com/noto/specimen/Noto+Sans+Symbols+2" target="_blank" rel="noreferrer"
      >Noto Sans Symbols 2</a
    >
    (SIL OFL 1.1), colours <a class="link" href="https://catppuccin.com" target="_blank" rel="noreferrer">Catppuccin</a> (MIT),
    icons <a class="link" href="https://fonts.google.com/icons" target="_blank" rel="noreferrer">Material Icons</a> (Apache 2.0).
  </p>
</Page>

<style>
  /* The stages side by side, each as wide as its hours: the picked one filled with its
     colour, the others a line of it under their name. */
  .bar {
    display: flex;
    gap: 2px;
    margin-top: 0.4em;
  }

  .segment {
    flex-basis: 0;
    min-width: 0;
    padding: 0.35em 0 0.25em;
    background: none;
    border: none;
    border-bottom: 3px solid var(--c);
    border-radius: 0.3em 0.3em 0 0;
    color: var(--c);
    white-space: nowrap;
    overflow: hidden;
    transition:
      background-color 0.2s ease,
      color 0.2s ease;
  }

  .segment.on {
    background: var(--c);
    color: var(--bg);
    font-weight: 700;
  }

  .ticks {
    display: flex;
    font-size: 0.8em;
    color: var(--muted);
  }

  .ticks span {
    flex-basis: 0;
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
</style>
