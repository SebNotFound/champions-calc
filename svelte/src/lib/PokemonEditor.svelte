<script lang="ts">
  /**
   * Editor for a single Pokemon set, used for both the attacker and each target.
   * The ability and move pickers are filtered to what the species can actually
   * have / learn, and a Mega Evolution holds no item (the Omni Ring replaces it).
   */
  import {
    NATURES, describeNature, speciesAbilities, speciesMoves,
    getSpeciesBaseStats, getSpeciesTypes, getMega, autofillSet,
  } from '@core';
  import type { ChampionsSet, NatureName, StatTable } from '@core';
  import Combobox from './Combobox.svelte';
  import Sprite from './Sprite.svelte';
  import TypeBadge from './TypeBadge.svelte';
  import StatSpreadEditor from './StatSpreadEditor.svelte';
  import { DATALIST } from './datalists';

  let { set, onChange, role, onRemove = undefined, title = undefined }: {
    set: ChampionsSet;
    onChange: (next: ChampionsSet) => void;
    /** 'attacker' = your side (cyan), 'defender' = the enemy side (rose). */
    role: 'attacker' | 'defender';
    onRemove?: () => void;
    title?: string;
  } = $props();

  const NATURE_NAMES = (Object.keys(NATURES) as NatureName[]).sort();

  /** Major-status options (value = @smogon/calc status id, or '' for healthy). */
  const STATUSES: [string, string][] = [
    ['', 'Healthy'],
    ['brn', 'Burned'],
    ['par', 'Paralyzed'],
    ['psn', 'Poisoned'],
    ['tox', 'Badly Poisoned'],
    ['slp', 'Asleep'],
    ['frz', 'Frozen'],
  ];

  const mega = $derived(set.megaForme ? getMega(set.megaForme) : undefined);
  // When Mega Evolved, the displayed stats/types come from the mega overlay.
  const baseStats = $derived<StatTable | undefined>(mega?.baseStats ?? getSpeciesBaseStats(set.species));
  const types = $derived(mega?.types ?? getSpeciesTypes(set.species) ?? []);
  const abilityOptions = $derived.by(() => {
    const opts = mega ? [mega.ability] : speciesAbilities(set.species);
    return set.ability && !opts.includes(set.ability) ? [set.ability, ...opts] : opts;
  });

  // Learnable moves for the move pickers, loaded async (the dex fetches learnsets
  // on demand); until ready we fall back to the full move list.
  const movesListId = `dl-learn-${Math.random().toString(36).slice(2, 9)}`;
  let learnMoves = $state<string[]>([]);
  $effect(() => {
    const species = set.species;
    let active = true;
    speciesMoves(species).then((m) => { if (active) learnMoves = m; });
    return () => { active = false; };
  });
  const movesList = $derived(learnMoves.length ? movesListId : DATALIST.moves);

  const patch = (changes: Partial<ChampionsSet>) => onChange({ ...set, ...changes });

  function onSpecies(value: string) {
    // Re-selecting the same thing shouldn't clobber edits you've made.
    if (value === (set.megaForme ?? set.species)) return;

    // Megas live in the species list directly (e.g. "Charizard-Mega-Y"); a match
    // here means a Mega was picked, otherwise it's a plain species.
    const pickedMega = getMega(value);
    const species = pickedMega ? pickedMega.baseSpecies : value;
    const megaForme = pickedMega?.name;

    // While typing a partial/unknown name, just store the text.
    if (!pickedMega && !getSpeciesBaseStats(species)) {
      patch({ species: value, megaForme: undefined });
      return;
    }

    // A valid pick auto-fills the most-used Champions set. Edits then stick:
    // autofill only re-runs when you pick a *different* species/Mega.
    const filled = autofillSet(species, megaForme);
    patch({
      ...filled,
      ability: pickedMega ? pickedMega.ability : filled.ability,
      item: pickedMega ? undefined : filled.item,
    });
  }

  function setMove(index: number, name: string) {
    const moves = [...(set.moves ?? [])];
    while (moves.length < 4) moves.push('');
    moves[index] = name;
    patch({ moves });
  }
</script>

<div class="mon-editor mon-editor--{role}">
  <div class="mon-editor-head">
    <Sprite class="mon-sprite" species={set.megaForme ?? set.species} />
    <div class="mon-title-line">
      {#if title}<span class="mon-role">{title}</span>{/if}
      <div class="mon-types">
        {#each types as t (t)}<TypeBadge type={t} />{/each}
      </div>
    </div>
    {#if onRemove}
      <button class="icon-btn" onclick={onRemove} aria-label="Remove" title="Remove">×</button>
    {/if}
  </div>

  <div class="mon-identity">
    <Combobox
      class="species-input"
      value={set.megaForme ?? set.species}
      onChange={onSpecies}
      listId={DATALIST.species}
      placeholder="Species or Mega…"
      ariaLabel="Species"
    />

    <div class="field-grid">
      <label class="field">
        <span>Nature</span>
        <select value={set.nature} onchange={(e) => patch({ nature: e.currentTarget.value as NatureName })}>
          {#each NATURE_NAMES as n (n)}
            <option value={n}>{n} ({describeNature(n)})</option>
          {/each}
        </select>
      </label>

      <label class="field">
        <span>Item</span>
        {#if mega}
          <input value="" placeholder="No item (Mega)" disabled spellcheck="false" />
        {:else}
          <Combobox
            value={set.item ?? ''}
            onChange={(v) => patch({ item: v || undefined })}
            listId={DATALIST.items}
            placeholder="Item…"
            ariaLabel="Item"
          />
        {/if}
      </label>

      <label class="field">
        <span>Ability</span>
        <select
          value={set.ability ?? ''}
          disabled={!!mega}
          onchange={(e) => patch({ ability: e.currentTarget.value || undefined })}
        >
          {#if !set.ability}<option value="">—</option>{/if}
          {#each abilityOptions as a (a)}<option value={a}>{a}</option>{/each}
        </select>
      </label>

      <label class="field">
        <span>Status</span>
        <select value={set.status ?? ''} onchange={(e) => patch({ status: e.currentTarget.value || undefined })}>
          {#each STATUSES as [v, l] (v)}<option value={v}>{l}</option>{/each}
        </select>
      </label>
    </div>
  </div>

  <StatSpreadEditor
    {baseStats}
    spread={set.statPoints}
    nature={set.nature}
    level={set.level}
    onChange={(statPoints) => patch({ statPoints })}
    item={mega ? undefined : set.item}
    boosts={set.boosts}
  />

  <div class="moves-block">
    <span class="block-label">Moves</span>
    <div class="moves-grid">
      {#each [0, 1, 2, 3] as i (i)}
        <Combobox
          value={set.moves?.[i] ?? ''}
          onChange={(v) => setMove(i, v)}
          listId={movesList}
          placeholder="Move {i + 1}…"
        />
      {/each}
    </div>
    {#if learnMoves.length > 0}
      <datalist id={movesListId}>
        {#each learnMoves as m (m)}<option value={m}></option>{/each}
      </datalist>
    {/if}
  </div>
</div>
