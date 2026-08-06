<script lang="ts">
  /** One enemy target: the editor plus the damage each attacker move deals to it. */
  import { buildPokemon, calcOne } from '@core';
  import type { ChampionsSet } from '@core';
  import type { Field, Pokemon } from '@smogon/calc';
  import PokemonEditor from './PokemonEditor.svelte';
  import ResultRow from './ResultRow.svelte';
  import type { MoveResult } from './results';

  let { set, onChange, onRemove, index, attacker, attackerMoves, field }: {
    set: ChampionsSet;
    onChange: (next: ChampionsSet) => void;
    onRemove: () => void;
    index: number;
    attacker: Pokemon | null;
    attackerMoves: string[];
    field: Field;
  } = $props();

  const defender = $derived.by<Pokemon | null>(() => {
    try { return buildPokemon(set); } catch { return null; }
  });

  const rows = $derived.by<MoveResult[]>(() => {
    if (!attacker || !defender) return [];
    return attackerMoves
      .map((m) => {
        try { return { move: m, ...calcOne(attacker, defender, m, field) }; } catch { return null; }
      })
      .filter((r): r is MoveResult => !!r);
  });
</script>

<div class="defender-card">
  <PokemonEditor {set} {onChange} role="defender" {onRemove} title="Target {index + 1}" />
  <div class="results">
    {#if rows.length === 0}
      <p class="results-hint">Give your attacker a move to see damage.</p>
    {:else}
      {#each rows as r (r.move)}<ResultRow {r} />{/each}
    {/if}
  </div>
</div>
