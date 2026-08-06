<script lang="ts">
  /**
   * A text input with type-ahead over one of the shared <datalist>s.
   *
   * We deliberately do NOT set autocomplete="off", which would suppress the
   * native dropdown.
   */
  let {
    value,
    onChange,
    listId,
    placeholder = '',
    class: className = '',
    ariaLabel = undefined,
  }: {
    value: string;
    onChange: (value: string) => void;
    listId: string;
    placeholder?: string;
    class?: string;
    ariaLabel?: string;
  } = $props();
</script>

<input
  class={className}
  list={listId}
  {value}
  {placeholder}
  spellcheck="false"
  aria-label={ariaLabel}
  oninput={(e) => onChange(e.currentTarget.value)}
/>
