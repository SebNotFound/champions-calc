<script lang="ts">
  import DamageBar from './DamageBar.svelte';
  import type { MoveResult } from './results';

  let { r }: { r: MoveResult } = $props();
</script>

<div class="result-row">
  <span class="result-move" title={r.move}>{r.move}</span>
  <DamageBar minPercent={r.minPercent} maxPercent={r.maxPercent} />
  <span class="result-pct">{r.minPercent}–{r.maxPercent}%</span>
  {#if r.koChance}<span class="result-ko">{r.koChance}</span>{/if}
</div>
