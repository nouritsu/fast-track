<script lang="ts">
  import { STAGES, stageSpan } from '../fasting/stages'
  import Page from '../ui/Page.svelte'

  // The four stages, in a line each, then the app: its version, source and licences.
  const SOURCE = 'https://github.com/nouritsu/fast-track'
</script>

<Page title="Info">
  <h3>Stages of a fast</h3>
  {#each STAGES as stage, i (stage.id)}
    <div class="stage">
      <p class="fields"><span style:color="var(--{stage.id})">■ {stage.name}</span> <span class="muted">{stageSpan(i)}</span></p>
      <p class="about">{stage.term === stage.name ? '' : `${stage.term}. `}{stage.about}</p>
    </div>
  {/each}
  <p class="muted">Times vary with the person, the last meal and activity. This is not medical advice.</p>

  <hr class="split" />
  <p>Fast Track {__APP_VERSION__}</p>
  <p>
    <a class="button" href={SOURCE} target="_blank" rel="noreferrer"
      ><span class="icon" aria-hidden="true">⚯</span>Source on GitHub</a
    >
  </p>
  <p class="muted">Iosevka and Noto Sans Symbols 2 (SIL OFL 1.1); Catppuccin palette (MIT).</p>
</Page>

<style>
  .stage {
    margin: 0.5em 0;
  }

  .stage p {
    margin: 0;
  }

  .about {
    padding-left: 2ch;
  }

  hr.split {
    margin: 0.8em 0 0.4em;
  }
</style>
