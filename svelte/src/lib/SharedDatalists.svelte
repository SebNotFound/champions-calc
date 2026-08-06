<script lang="ts">
  import { listSpeciesOptions, listMoves, listItems, listAbilities } from '@core';
  import { DATALIST } from './datalists';

  // Built once at module/component init; these lists are static.
  const species = listSpeciesOptions();
  const moves = listMoves();
  const items = listItems();
  const abilities = listAbilities();
</script>

<datalist id={DATALIST.species}>{#each species as o (o)}<option value={o}></option>{/each}</datalist>
<datalist id={DATALIST.moves}>{#each moves as o (o)}<option value={o}></option>{/each}</datalist>
<datalist id={DATALIST.items}>{#each items as o (o)}<option value={o}></option>{/each}</datalist>
<datalist id={DATALIST.abilities}>{#each abilities as o (o)}<option value={o}></option>{/each}</datalist>
