<script lang="ts" module>
  // Material Icons (Google, Apache 2.0), 24-unit paths.
  const PATHS = {
    edit: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
    close: 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  }
  export type IconName = keyof typeof PATHS
</script>

<script lang="ts">
  // A Material icon drawn in the text colour at the font's size, so a glyph button
  // colours and sizes it like a character.
  let { name }: { name: IconName } = $props()
</script>

<svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path d={PATHS[name]} /></svg>

<style>
  .icon-svg {
    width: 1em;
    height: 1em;
    fill: currentColor;
    vertical-align: -0.125em;
  }
</style>
