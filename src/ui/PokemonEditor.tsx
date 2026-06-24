/**
 * Editor for a single Pokémon set. Used for both the attacker and each
 * defender; the `role` prop just hides the moves block for defenders (a target
 * doesn't need moves to be hit).
 *
 * The ability and move pickers are filtered to what the species can actually
 * have / learn (via the @pkmn dex), the nature menu spells out each nature's
 * +/- stats, and a Mega Evolution holds no item (the Omni Ring replaces it).
 */
import { useEffect, useId, useState, type DragEvent } from 'react';
import { Combobox, Select, TypeBadge, DATALIST, Sprite } from './widgets';
import { StatSpreadEditor } from './StatSpreadEditor';
import { BattleState } from './BattleState';
import {
  NATURES,
  describeNature,
  speciesAbilities,
  speciesMoves,
  getSpeciesBaseStats,
  getSpeciesTypes,
  getMega,
  autofillSet,
} from '../champions';
import type { ChampionsSet, NatureName, StatTable } from '../champions';

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

interface Props {
  set: ChampionsSet;
  onChange: (next: ChampionsSet) => void;
  role: 'attacker' | 'defender';
  onRemove?: () => void;
  title?: string;
  /** When set, the header row acts as a drag handle (used to reorder targets). */
  draggable?: boolean;
  onHeaderDragStart?: (e: DragEvent) => void;
  onHeaderDragEnd?: (e: DragEvent) => void;
}

export function PokemonEditor({
  set, onChange, role, onRemove, title, draggable, onHeaderDragStart, onHeaderDragEnd,
}: Props) {
  const mega = set.megaForme ? getMega(set.megaForme) : undefined;

  // When Mega Evolved, the displayed stats/types come from the mega overlay.
  const baseStats: StatTable | undefined = mega?.baseStats ?? getSpeciesBaseStats(set.species);
  const types = mega?.types ?? getSpeciesTypes(set.species) ?? [];

  // Abilities the species can have (a Mega forces its own single ability).
  const abilityOptions = mega ? [mega.ability] : speciesAbilities(set.species);
  if (set.ability && !abilityOptions.includes(set.ability)) abilityOptions.unshift(set.ability);

  // Learnable moves for the move pickers. Loaded async (the dex fetches
  // learnsets on demand); until ready we fall back to the full move list.
  const movesListId = useId();
  const [learnMoves, setLearnMoves] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    speciesMoves(set.species).then((m) => { if (active) setLearnMoves(m); });
    return () => { active = false; };
  }, [set.species]);
  const movesList = learnMoves.length ? movesListId : DATALIST.moves;

  const patch = (changes: Partial<ChampionsSet>) => onChange({ ...set, ...changes });

  const onSpecies = (value: string) => {
    // Re-selecting the same thing shouldn't clobber edits you've made.
    if (value === (set.megaForme ?? set.species)) return;

    // Megas live in the species list directly (e.g. "Charizard-Mega-Y"); a match
    // here means a Mega was picked, otherwise it's a plain species.
    const pickedMega = getMega(value);
    const species = pickedMega ? pickedMega.baseSpecies : value;
    const megaForme = pickedMega?.name;

    // While typing a partial/unknown name, just store the text — don't reset
    // anything until a real species (or Mega) is chosen.
    if (!pickedMega && !getSpeciesBaseStats(species)) {
      patch({ species: value, megaForme: undefined });
      return;
    }

    // A valid pick auto-fills the most-used Champions set (moves, item, ability,
    // nature, Stat Points) — the same fill as Team Preview import. Edits then
    // stick: autofill only re-runs when you pick a *different* species/Mega.
    const filled = autofillSet(species, megaForme);
    patch({
      ...filled,
      // A Mega forces its own ability and holds no item.
      ability: pickedMega ? pickedMega.ability : filled.ability,
      item: pickedMega ? undefined : filled.item,
    });
  };

  const setMove = (index: number, name: string) => {
    const moves = [...(set.moves ?? [])];
    while (moves.length < 4) moves.push('');
    moves[index] = name;
    patch({ moves });
  };

  return (
    <div className={`mon-editor mon-editor--${role}`}>
      <div
        className={`mon-editor-head${draggable ? ' mon-editor-head--drag' : ''}`}
        draggable={draggable}
        onDragStart={onHeaderDragStart}
        onDragEnd={onHeaderDragEnd}
        title={draggable ? 'Drag to swap targets' : undefined}
      >
        <Sprite className="mon-sprite" species={set.megaForme ?? set.species} />
        <div className="mon-title-line">
          {title && <span className="mon-role">{title}</span>}
          <div className="mon-types">
            {types.map((t) => <TypeBadge key={t} type={t} />)}
          </div>
        </div>
        {onRemove && (
          <button
            className="icon-btn"
            draggable={false}
            onClick={onRemove}
            aria-label="Remove"
            title="Remove"
          >×</button>
        )}
      </div>

      {/* Species name + the nature/item/ability/status grid are grouped so arena
          mode can sit them as one column beside the stat spread (in the normal
          layout they just stack as before). */}
      <div className="mon-identity">
      <Combobox
        className="species-input"
        value={set.megaForme ?? set.species}
        onChange={onSpecies}
        listId={DATALIST.species}
        placeholder="Species or Mega…"
        aria-label="Species"
      />

      <div className="field-grid">
        <label className="field">
          <span>Nature</span>
          <Select
            value={set.nature}
            onChange={(v) => patch({ nature: v as NatureName })}
            options={NATURE_NAMES.map((n) => ({ value: n, label: `${n} (${describeNature(n)})` }))}
            aria-label="Nature"
          />
        </label>
        <label className="field">
          <span>Item</span>
          {mega ? (
            <input value="" placeholder="No item (Mega)" disabled spellCheck={false} />
          ) : (
            <Combobox
              value={set.item ?? ''}
              onChange={(v) => patch({ item: v || undefined })}
              listId={DATALIST.items}
              placeholder="Item…"
              aria-label="Item"
            />
          )}
        </label>
        <label className="field">
          <span>Ability</span>
          <Select
            value={set.ability ?? ''}
            onChange={(v) => patch({ ability: v || undefined })}
            options={[
              ...(set.ability ? [] : [{ value: '', label: '—' }]),
              ...abilityOptions.map((a) => ({ value: a, label: a })),
            ]}
            disabled={!!mega}
            aria-label="Ability"
          />
        </label>
        <label className="field">
          <span>Status</span>
          <Select
            value={set.status ?? ''}
            onChange={(v) => patch({ status: v || undefined })}
            options={STATUSES.map(([v, l]) => ({ value: v, label: l }))}
            aria-label="Status"
          />
        </label>
      </div>
      </div>

      <StatSpreadEditor
        baseStats={baseStats}
        spread={set.statPoints}
        nature={set.nature}
        level={set.level}
        onChange={(statPoints) => patch({ statPoints })}
        item={mega ? undefined : set.item}
        boosts={set.boosts}
      />

      {/* Moves are shown for both sides now: the attacker's drive the damage to
          each target, and a defender's drive the "incoming" damage back to your
          active Pokémon (see DefenderCard). */}
      <div className="moves-block">
        <span className="block-label">Moves</span>
        <div className="moves-grid">
          {[0, 1, 2, 3].map((i) => (
            <Combobox
              key={i}
              value={set.moves?.[i] ?? ''}
              onChange={(v) => setMove(i, v)}
              listId={movesList}
              placeholder={`Move ${i + 1}…`}
            />
          ))}
        </div>
        {learnMoves.length > 0 && (
          <datalist id={movesListId}>
            {learnMoves.map((m) => <option key={m} value={m} />)}
          </datalist>
        )}
      </div>

      <BattleState
        boosts={set.boosts ?? {}}
        onBoosts={(boosts) => patch({ boosts })}
      />
    </div>
  );
}
