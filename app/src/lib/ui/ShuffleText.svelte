<script lang="ts">
  import { plan, reducedMotion, runShuffle } from '../motion/shuffle'

  // Text that runs the letter shuffle whenever it changes (a live value, a title,
  // a button's flash); the first text just appears.
  let { text, staggerMs = 50 }: { text: string; staggerMs?: number } = $props()
  let shown = $state('')
  let first = true

  $effect(() => {
    const target = text
    const shuffle = plan(target, staggerMs)
    if (first || !shuffle.duration || reducedMotion()) {
      first = false
      shown = target
      return
    }
    return runShuffle(target, shuffle, (frame) => (shown = frame))
  })
</script>

<span>{shown}</span>
