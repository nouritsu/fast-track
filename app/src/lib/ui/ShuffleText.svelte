<script lang="ts">
  import { untrack } from 'svelte'
  import { frame, plan, reducedMotion, runShuffle } from '../motion/shuffle'

  // Text that runs the letter shuffle whenever it changes (a live value, a status
  // field); the first text just appears, unless `intro` shuffles it in too. While
  // `plain`, a change just appears: for a value that changes too fast to shuffle.
  let {
    text,
    staggerMs = 50,
    intro = false,
    plain = false,
  }: { text: string; staggerMs?: number; intro?: boolean; plain?: boolean } = $props()
  let shown = $state('')
  let first = true

  $effect(() => {
    const target = text
    const shuffle = plan(target, staggerMs)
    if ((first && !intro) || untrack(() => plain) || !shuffle.duration || reducedMotion()) {
      first = false
      shown = target
      return
    }
    if (first) shown = frame(target, shuffle, 0) // an intro starts scrambled, not blank
    first = false
    return runShuffle(target, shuffle, (frame) => (shown = frame))
  })
</script>

<span>{shown}</span>
