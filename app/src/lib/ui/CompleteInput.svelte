<script lang="ts">
  import Icon from './Icon.svelte'

  // A text field that offers to finish what is typed: the rest of `suggest`'s answer
  // shows greyed out behind the text, and Tab, → at the end, or the button at the
  // field's right takes it.
  let {
    value = $bindable(),
    suggest,
    placeholder = '',
    maxlength = 80,
  }: {
    value: string
    suggest: (typed: string) => string | null
    placeholder?: string
    maxlength?: number
  } = $props()

  let input = $state<HTMLInputElement>()
  let scroll = $state(0) // how far the text has scrolled in the field, which the grey text follows
  const suggestion = $derived(suggest(value))
  const rest = $derived(suggestion ? suggestion.slice(value.length) : '')
  const follow = () => (scroll = input?.scrollLeft ?? 0)

  function take() {
    if (!suggestion || !input) return
    value = suggestion
    const field = input
    field.focus()
    requestAnimationFrame(() => {
      field.setSelectionRange(field.value.length, field.value.length)
      follow()
    })
  }

  function keydown(event: KeyboardEvent) {
    if (!rest || !input) return
    const atEnd = input.selectionStart === value.length && input.selectionEnd === value.length
    if ((event.key === 'Tab' && !event.shiftKey) || (event.key === 'ArrowRight' && atEnd)) {
      event.preventDefault()
      take()
    }
  }
</script>

<span class="complete">
  <span class="behind" aria-hidden="true"
    ><span class="ghost" style:transform="translateX({-scroll}px)"><span class="typed">{value}</span>{rest}</span></span
  >
  <input type="text" bind:this={input} bind:value {placeholder} {maxlength} onkeydown={keydown} oninput={follow} onscroll={follow} />
  {#if rest}
    <!-- Keeps the keyboard up: the press does not take the focus from the field. -->
    <button
      type="button"
      class="glyph take"
      aria-label="Complete to {suggestion}"
      title="Complete"
      onpointerdown={(event) => event.preventDefault()}
      onclick={take}><Icon name="keyboard_tab" /></button
    >
  {/if}
</span>

<style>
  /* The field over its grey text, with room at the right for the button. */
  .complete {
    position: relative;
    flex: 1;
    min-width: 0;
    display: flex;
  }

  .complete input {
    position: relative;
    flex: 1;
    min-width: 0;
    padding-right: 3.5ch;
    background: transparent;
  }

  /* Inside the field's border and padding, where its text sits; the text scrolled out
     of the field is cut off here too. */
  .behind {
    position: absolute;
    inset: 1px 3.5ch 1px 1px;
    padding: 0 1ch;
    display: flex;
    align-items: center;
    overflow: hidden;
    color: var(--muted);
    pointer-events: none;
  }

  .ghost {
    white-space: pre;
  }

  /* What is typed holds its place, unseen: the field draws it. */
  .typed {
    visibility: hidden;
  }

  .take {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    color: var(--accent);
  }
</style>
