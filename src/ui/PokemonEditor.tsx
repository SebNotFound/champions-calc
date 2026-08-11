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
import { Combobox, Select, TypeBadge, TypeIcon, DATALIST, Sprite, typeGradientStyle, typeHex } from './widgets';
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
  moveInfo,
} from '../champions';
import type { ChampionsSet, NatureName, StatTable } from '../champions';

/**
 * One move as a "plate": the editable name on the left with its category / PP /
 * base power, and a type-coloured end-cap on the right (both derived live from
 * the move's dex data as you type).
 */
function MovePlate({ value, onChange, listId }: { value: string; onChange: (v: string) => void; listId: string }) {
  const info = moveInfo(value);
  return (
    <div className="move-plate">
      <div className="move-plate-main">
        <Combobox className="move-name" value={value} onChange={onChange} listId={listId} placeholder="Move…" />
        {info && (
          <span className="move-meta">
            <span className={`move-cat move-cat--${info.category.toLowerCase()}`}>{info.category}</span>
            {` · PP ${info.pp}`}{info.basePower ? ` · ${info.basePower} BP` : ''}
          </span>
        )}
      </div>
      {/* The end-cap is the type icon alone: the cards are narrow in the classic
          three-up row, and spelling the type out there ate the move's name. */}
      {info && (
        <span
          className="move-cap"
          style={{ background: `color-mix(in srgb, ${typeHex(info.type)} 15%, transparent)` }}
          title={info.type}
        >
          <TypeIcon type={info.type} className="move-cap-icon" />
        </span>
      )}
    </div>
  );
}

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
  title?: string;
  /** When set, the header row acts as a drag handle (used to reorder targets). */
  draggable?: boolean;
  onHeaderDragStart?: (e: DragEvent) => void;
  onHeaderDragEnd?: (e: DragEvent) => void;
  /** Collapse the body (nature/moves/stats/boosts) behind an "Edit set" toggle. */
  collapsibleBody?: boolean;
  /** Label for the collapse toggle. */
  summaryLabel?: string;
}

export function PokemonEditor({
  set, onChange, role, title, draggable, onHeaderDragStart, onHeaderDragEnd,
  collapsibleBody, summaryLabel,
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

  // The card body (identity + stats + moves + boosts). A fragment, so when it's
  // NOT collapsed the sections stay direct children of .mon-editor (arena mode's
  // grid relies on that); when collapsed they sit inside the <details> instead.
  const body = (
    <>
      {/* The nature/item/ability/status grid (species now lives in the header). */}
      <div className="mon-identity">
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

      {/* Moves: the attacker's drive damage to each target; a defender's drive the
          incoming damage back to your active Pokémon (see DefenderCard). */}
      <div className="moves-block">
        <span className="block-label">Moves</span>
        <div className="moves-grid">
          {[0, 1, 2, 3].map((i) => (
            <MovePlate
              key={i}
              value={set.moves?.[i] ?? ''}
              onChange={(v) => setMove(i, v)}
              listId={movesList}
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
    </>
  );

  return (
    <div className={`mon-editor mon-editor--${role}`}>
      {/* Type-tinted gradient header: the sprite in a radial Poké-ring, the
          species (editable) as the title, and the type badges. The header's
          background is keyed by the Pokémon's types. */}
      <div
        className={`mon-editor-head${draggable ? ' mon-editor-head--drag' : ''}`}
        style={typeGradientStyle(types)}
        draggable={draggable}
        onDragStart={onHeaderDragStart}
        onDragEnd={onHeaderDragEnd}
        title={draggable ? 'Drag to swap targets' : undefined}
      >
        {/* The sprite doubles as the drag handle. The header itself is draggable,
            but the species field fills most of it and an input swallows the
            mousedown, so grabbing the Pokémon is the reliable gesture. */}
        <div
          className="poke-ring"
          draggable={draggable}
          onDragStart={onHeaderDragStart}
          onDragEnd={onHeaderDragEnd}
          title={draggable ? 'Drag onto another card to swap' : undefined}
        >
          <Sprite className="mon-sprite" species={set.megaForme ?? set.species} />
        </div>
        <div className="mon-title-line">
          {title && <span className="mon-role">{title}</span>}
          <Combobox
            className="mon-name-input"
            value={set.megaForme ?? set.species}
            onChange={onSpecies}
            listId={DATALIST.species}
            placeholder="Species or Mega…"
            aria-label="Species"
          />
          <div className="mon-types">
            {types.map((t) => <TypeBadge key={t} type={t} />)}
          </div>
        </div>
      </div>

      {collapsibleBody ? (
        <details className="edit-set">
          <summary className="edit-set-summary">
            {summaryLabel ?? 'Edit set'}
            <svg className="chev" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
          </summary>
          {body}
        </details>
      ) : body}
    </div>
  );
}
