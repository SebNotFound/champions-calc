<script lang="ts">
  let { type }: { type: string } = $props();

  /** Official-ish Pokemon type colours, for type pills. */
  const TYPE_COLORS: Record<string, string> = {
    Normal: '#9fa19f', Fire: '#e62829', Water: '#2980ef', Electric: '#fac000',
    Grass: '#3fa129', Ice: '#3dcef3', Fighting: '#ff8000', Poison: '#9141cb',
    Ground: '#915121', Flying: '#81b9ef', Psychic: '#ef4179', Bug: '#91a119',
    Rock: '#afa981', Ghost: '#704170', Dragon: '#5060e1', Dark: '#624d4e',
    Steel: '#60a1b8', Fairy: '#ef70ef',
  };
</script>

<span class="type-badge" style="background-color: {TYPE_COLORS[type] ?? '#777'}">{type}</span>
