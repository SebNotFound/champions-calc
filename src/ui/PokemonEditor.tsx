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
import { Combobox, TypeBadge, DATALIST, Sprite } from './widgets';
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
          <select value={set.nature} onChange={(e) => patch({ nature: e.target.value as NatureName })}>
            {NATURE_NAMES.map((n) => (
              <option key={n} value={n}>{n} ({describeNature(n)})</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Item</span>
          <input
            value={mega ? '' : (set.item ?? '')}
            onChange={(e) => patch({ item: e.target.value || undefined })}
            list={DATALIST.items}
            placeholder={mega ? 'No item (Mega)' : 'Item…'}
            disabled={!!mega}
            spellCheck={false}
            autoComplete="off"
          />
        </label>
        <label className="field">
          <span>Ability</span>
          <select
            value={set.ability ?? ''}
            onChange={(e) => patch({ ability: e.target.value || undefined })}
            disabled={!!mega}
          >
            {!set.ability && <option value="">—</option>}
            {abilityOptions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Status</span>
          <select value={set.status ?? ''} onChange={(e) => patch({ status: e.target.value || undefined })}>
            {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>

      <StatSpreadEditor
        baseStats={baseStats}
        spread={set.statPoints}
        nature={set.nature}
        level={set.level}
        onChange={(statPoints) => patch({ statPoints })}
      />

      {/* Moves are shown for both sides now: the attacker's drive the damage to
          each target, and a defender's drive the "incoming" damage back to your
          active Pokémon (see DefenderCard). */}
      <div className="moves-block">
        <span className="block-label">{role === 'attacker' ? 'Moves' : 'Moves (used for incoming damage)'}</span>
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
