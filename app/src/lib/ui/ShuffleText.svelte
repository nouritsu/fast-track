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
  // The text as a value: a prop passed as an expression (settings.unit) is read again
  // whenever anything it reads changes, and only a change of the text itself shuffles.
  const current = $derived(text)

  $effect(() => {
    const target = current
    const shuffle = plan(target, untrack(() => staggerMs))
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
