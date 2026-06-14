/**
 * Small, presentational building blocks shared across the editors.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { listSpeciesOptions, listMoves, listItems, listAbilities, spriteUrl } from '../champions';
import type { DamageSummary } from '../champions';

/**
 * A Pokémon sprite that survives the flaky remote CDN.
 *
 * Sprites come from Pokémon Showdown's server, which occasionally drops a
 * request — and the old `onError → visibility:hidden` hid the <img> *inline and
 * permanently*, so once a load hiccuped the same reused element stayed blank
 * until a full page refresh. This instead retries a couple of times with a
 * cache-buster, and resets cleanly whenever the species changes, so switching
 * Pokémon always re-attempts rather than inheriting a stuck-hidden state.
 */
export function Sprite({ species, className, alt = '' }: { species: string; className?: string; alt?: string }) {
  const url = useMemo(() => spriteUrl(species), [species]);
  const [src, setSrc] = useState(url);
  const [failed, setFailed] = useState(false);
  const tries = useRef(0);

  useEffect(() => { setSrc(url); setFailed(false); tries.current = 0; }, [url]);

  // No URL or out of retries — keep the layout box, but show nothing (no broken-image icon).
  if (!url || failed) return <span className={className} aria-hidden />;

  return (
    <img
      className={className}
      src={src}
      alt={alt}
      loading="lazy"
      draggable={false}
      onError={() => {
        if (tries.current < 2) {
          tries.current += 1;
          setSrc(`${url}${url.includes('?') ? '&' : '?'}r=${tries.current}`);
        } else {
          setFailed(true);
        }
      }}
    />
  );
}

// Stable <datalist> ids. We render the actual lists ONCE at the app root (see
// <SharedDatalists/>) and every Combobox just points at them via `list=`. This
// keeps the ~1000-entry species/move lists from being duplicated per field.
export const DATALIST = {
  species: 'dl-species',
  moves: 'dl-moves',
  items: 'dl-items',
  abilities: 'dl-abilities',
} as const;

/** Renders the four big shared datalists. Mount once near the app root. */
export function SharedDatalists() {
  const species = useMemo(listSpeciesOptions, []);
  const moves = useMemo(listMoves, []);
  const items = useMemo(listItems, []);
  const abilities = useMemo(listAbilities, []);
  return (
    <>
      <datalist id={DATALIST.species}>{species.map((o) => <option key={o} value={o} />)}</datalist>
      <datalist id={DATALIST.moves}>{moves.map((o) => <option key={o} value={o} />)}</datalist>
      <datalist id={DATALIST.items}>{items.map((o) => <option key={o} value={o} />)}</datalist>
      <datalist id={DATALIST.abilities}>{abilities.map((o) => <option key={o} value={o} />)}</datalist>
    </>
  );
}

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  /** One of the DATALIST ids. */
  listId: string;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
}

/**
 * A text input backed by a shared datalist (type-ahead over big lists).
 *
 * NB: we deliberately do NOT set `autocomplete="off"`. Chrome suppresses the
 * <datalist> suggestion dropdown entirely when autocomplete is off, which made
 * these pickers type-only (you had to type the whole name). Leaving it unset
 * lets the datalist show.
 */
export function Combobox({ value, onChange, listId, placeholder, className, ...rest }: ComboboxProps) {
  return (
    <input
      className={className}
      list={listId}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
      {...rest}
    />
  );
}

/** A single move's damage result (a damage summary tagged with its move name). */
export type MoveResult = DamageSummary & { move: string };

/** One damage line: move name, bar, % range and KO chance. Shared by the
 *  offensive (DefenderCard) and incoming (IncomingPanel) readouts. */
export function ResultRow({ r }: { r: MoveResult }) {
  return (
    <div className="result-row">
      <span className="result-move" title={r.move}>{r.move}</span>
      <DamageBar minPercent={r.minPercent} maxPercent={r.maxPercent} />
      <span className="result-pct">{r.minPercent}–{r.maxPercent}%</span>
      {r.koChance && <span className="result-ko">{r.koChance}</span>}
    </div>
  );
}

/** Official-ish Pokémon type colours, for type pills. */
const TYPE_COLORS: Record<string, string> = {
  Normal: '#9fa19f', Fire: '#e62829', Water: '#2980ef', Electric: '#fac000',
  Grass: '#3fa129', Ice: '#3dcef3', Fighting: '#ff8000', Poison: '#9141cb',
  Ground: '#915121', Flying: '#81b9ef', Psychic: '#ef4179', Bug: '#91a119',
  Rock: '#afa981', Ghost: '#704170', Dragon: '#5060e1', Dark: '#624d4e',
  Steel: '#60a1b8', Fairy: '#ef70ef',
};

export function TypeBadge({ type }: { type: string }) {
  return (
    <span className="type-badge" style={{ backgroundColor: TYPE_COLORS[type] ?? '#777' }}>
      {type}
    </span>
  );
}

/**
 * A horizontal damage bar. Width tracks the max-damage %, and the colour goes
 * green → orange → red as the hit gets scarier, flipping to a "KO" colour at
 * 100%+.
 */
export function DamageBar({ minPercent, maxPercent }: { minPercent: number; maxPercent: number }) {
  const width = Math.min(100, maxPercent);
  const color =
    maxPercent >= 100 ? '#b3253a' :
    maxPercent >= 75 ? '#e8590c' :
    maxPercent >= 50 ? '#f08c00' :
    maxPercent >= 25 ? '#74b816' : '#37b24d';
  return (
    <div className="dmg-bar" title={`${minPercent}% – ${maxPercent}%`}>
      <div className="dmg-bar-fill" style={{ width: `${width}%`, backgroundColor: color }} />
    </div>
  );
}
