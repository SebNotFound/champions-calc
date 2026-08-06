<script lang="ts">
  let { minPercent, maxPercent }: { minPercent: number; maxPercent: number } = $props();

  const width = $derived(Math.min(100, maxPercent));
  // Green -> orange -> red as the hit gets scarier, flipping to a "KO" colour at 100%+.
  const color = $derived(
    maxPercent >= 100 ? '#b3253a' :
    maxPercent >= 75 ? '#e8590c' :
    maxPercent >= 50 ? '#f08c00' :
    maxPercent >= 25 ? '#74b816' : '#37b24d',
  );
</script>

<div class="dmg-bar" title="{minPercent}% – {maxPercent}%">
  <div class="dmg-bar-fill" style="width: {width}%; background-color: {color}"></div>
</div>
