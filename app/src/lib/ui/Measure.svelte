<script lang="ts">
  // The width it is given and a character's, measured off ten of them, so charts and
  // text bars can be drawn to fit. It takes no room.
  let { width = $bindable(0), ch = $bindable(0) }: { width?: number; ch?: number } = $props()
</script>

<div class="measure" aria-hidden="true" bind:clientWidth={width}>
  <span bind:clientWidth={null, (ten) => (ch = (ten ?? 0) / 10)}>0000000000</span>
</div>

<style>
  .measure {
    position: relative;
    height: 0;
  }

  span {
    position: absolute;
    visibility: hidden;
    pointer-events: none;
    white-space: pre;
    font-variant-ligatures: none;
  }
</style>
