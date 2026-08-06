<script lang="ts">
  import { spriteUrl, baseSpriteUrl } from '@core';

  let { species, class: className = '', alt = '' }: {
    species: string;
    class?: string;
    alt?: string;
  } = $props();

  const url = $derived(spriteUrl(species));
  // Champions-original Megas have no Showdown forme art, so fall back to the base
  // species sprite instead of a blank box. '' for non-megas.
  const fallback = $derived(baseSpriteUrl(species));

  let src = $state('');
  let failed = $state(false);
  // Plain locals (not state): they drive the retry chain, never the template.
  let target = '';
  let tries = 0;
  let triedFallback = false;

  // Showdown's sprite CDN occasionally drops a request, so retry a couple of
  // times with a cache-buster before giving up. Resets whenever the species
  // changes, so switching Pokemon always re-attempts.
  $effect(() => {
    target = url;
    tries = 0;
    triedFallback = false;
    src = url;
    failed = false;
  });

  function onError() {
    if (tries < 2) {
      tries += 1;
      src = `${target}${target.includes('?') ? '&' : '?'}r=${tries}`;
    } else if (fallback && fallback !== target && !triedFallback) {
      triedFallback = true;
      target = fallback;
      tries = 0;
      src = fallback;
    } else {
      failed = true;
    }
  }
</script>

{#if !url || failed}
  <!-- Keep the layout box, but show nothing (no broken-image icon). -->
  <span class={className} aria-hidden="true"></span>
{:else}
  <img class={className} {src} {alt} loading="lazy" draggable="false" onerror={onError} />
{/if}
