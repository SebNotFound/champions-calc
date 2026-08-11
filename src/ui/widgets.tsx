/**
 * Small, presentational building blocks shared across the editors.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { listSpeciesOptions, listMoves, listItems, listAbilities, spriteUrl, baseSpriteUrl, moveInfo } from '../champions';
import type { DamageSummary } from '../champions';
import { isTauri, isAndroidOverlay } from './tauri';

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
  // Champions-original Megas have no Showdown forme art, so fall back to the base
  // species sprite instead of a blank box (see baseSpriteUrl). '' for non-megas.
  const fallback = useMemo(() => baseSpriteUrl(species), [species]);
  const [src, setSrc] = useState(url);
  const [failed, setFailed] = useState(false);
  const target = useRef(url);          // the sprite we're currently retrying (forme, then base)
  const tries = useRef(0);
  const triedFallback = useRef(false);

  useEffect(() => {
    target.current = url;
    tries.current = 0;
    triedFallback.current = false;
    setSrc(url);
    setFailed(false);
  }, [url]);

  // No URL or out of options — keep the layout box, but show nothing (no broken-image icon).
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
          // Flaky CDN — retry the same sprite a couple of times with a cache-buster.
          tries.current += 1;
          setSrc(`${target.current}${target.current.includes('?') ? '&' : '?'}r=${tries.current}`);
        } else if (fallback && fallback !== target.current && !triedFallback.current) {
          // The forme sprite genuinely doesn't exist — swap to the base species art.
          triedFallback.current = true;
          target.current = fallback;
          tries.current = 0;
          setSrc(fallback);
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
 * A text input with type-ahead over a big list.
 *
 * On the website it uses the native `<datalist>` (fast, and we deliberately do NOT
 * set `autocomplete="off"`, which would suppress the dropdown). In the desktop
 * overlay the native datalist popup is a separate OS window that renders BEHIND
 * the always-on-top overlay (so no suggestions show), so there we draw our own
 * suggestion list in the DOM instead. The website behaviour is unchanged.
 */
export function Combobox(props: ComboboxProps) {
  // Both overlays render the suggestion list in the DOM: on the desktop (Tauri)
  // the native datalist popup hides behind the always-on-top window; in the
  // Android system-overlay WebView native popups don't open reliably at all.
  return isTauri() || isAndroidOverlay() ? <ComboboxMenu {...props} /> : <ComboboxNative {...props} />;
}

function ComboboxNative({ value, onChange, listId, placeholder, className, ...rest }: ComboboxProps) {
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

/** Up to this many suggestions are shown. */
const CBX_MAX = 8;

/** Overlay-only: a custom suggestion dropdown drawn in the DOM (and portalled to
 *  the body with fixed positioning, so it floats above the always-on-top window
 *  and is never clipped by a scrolling panel). Reads the same shared `<datalist>`
 *  as its option source, so call sites don't change. */
function ComboboxMenu({ value, onChange, listId, placeholder, className, ...rest }: ComboboxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState<{ left: number; top: number; width: number } | null>(null);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    const dl = document.getElementById(listId) as HTMLDataListElement | null;
    if (!dl) return [];
    const starts: string[] = [];
    const includes: string[] = [];
    const opts = dl.options;
    for (let i = 0; i < opts.length && starts.length < CBX_MAX; i++) {
      const v = opts[i].value;
      const lv = v.toLowerCase();
      if (lv.startsWith(q)) starts.push(v);
      else if (includes.length < CBX_MAX && lv.includes(q)) includes.push(v);
    }
    return [...starts, ...includes].slice(0, CBX_MAX);
  }, [value, listId, open]);

  const place = () => {
    const r = inputRef.current?.getBoundingClientRect();
    if (r) setRect({ left: r.left, top: r.bottom, width: r.width });
  };

  // Keep the menu glued to the input while scrolling/resizing.
  useEffect(() => {
    if (!open) return;
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  const choose = (v: string) => { onChange(v); setOpen(false); };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && open && matches[active]) { e.preventDefault(); choose(matches[active]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <>
      <input
        ref={inputRef}
        className={className}
        value={value}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
        {...rest}
      />
      {open && rect && matches.length > 0 && createPortal(
        <ul className="cbx-list" style={{ left: rect.left, top: rect.top, width: rect.width }}>
          {matches.map((m, i) => (
            <li
              key={m}
              className={`cbx-opt${i === active ? ' active' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); choose(m); }}
              onMouseEnter={() => setActive(i)}
            >
              {m}
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

/**
 * A dropdown over a fixed set of options.
 *
 * On the website it's a native `<select>`. In BOTH overlays it's a custom DOM
 * menu instead: a native `<select>` opens its list in a separate OS popup window,
 * which renders behind the always-on-top desktop overlay and does not open at all
 * from the Android system-overlay WebView. The custom menu is drawn in the page
 * (portalled to the body), so it works in both. The website is unchanged.
 */
export function Select(props: SelectProps) {
  return isTauri() || isAndroidOverlay() ? <SelectMenu {...props} /> : <SelectNative {...props} />;
}

function SelectNative({ value, onChange, options, className, disabled, ...rest }: SelectProps) {
  return (
    <select
      className={className}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      {...rest}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function SelectMenu({ value, onChange, options, className, disabled, ...rest }: SelectProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ left: number; top: number; width: number } | null>(null);

  const current = options.find((o) => o.value === value);

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setRect({ left: r.left, top: r.bottom, width: r.width });
  };

  useEffect(() => {
    if (!open) return;
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  const choose = (v: string) => { onChange(v); setOpen(false); };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`select-menu-btn${className ? ` ${className}` : ''}`}
        disabled={disabled}
        onClick={() => { if (!disabled) setOpen((o) => !o); }}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        {...rest}
      >
        <span className="select-menu-label">{current?.label ?? ''}</span>
        <span className="select-menu-caret" aria-hidden>▾</span>
      </button>
      {open && rect && createPortal(
        <ul className="cbx-list" style={{ left: rect.left, top: rect.top, width: rect.width }}>
          {options.map((o) => (
            <li
              key={o.value}
              className={`cbx-opt${o.value === value ? ' active' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); choose(o.value); }}
            >
              {o.label}
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </>
  );
}

/** A single move's damage result (a damage summary tagged with its move name). */
export type MoveResult = DamageSummary & { move: string };

/** Short KO tag + its colour, derived from the KO-chance text and the max %:
 *  OHKO -> danger, 2-3HKO -> warn, 4+HKO / low -> safe, no damage -> nothing. */
function koTag(koChance: string | undefined, maxPercent: number): { label: string; color: string } | null {
  if (maxPercent <= 0) return null;
  const s = koChance ?? '';
  let n = 0;
  if (/OHKO/.test(s)) n = 1;
  else { const m = s.match(/(\d+)HKO/); if (m) n = Number(m[1]); }
  if (n === 0) return { label: 'safe', color: 'var(--safe)' };
  return { label: n === 1 ? 'OHKO' : `${n}HKO`, color: n === 1 ? 'var(--danger)' : n <= 3 ? 'var(--warn)' : 'var(--safe)' };
}

/** One damage line: a type dot, the move, its % (KO-coloured), a KO badge and a
 *  green->red HP-style bar. Shared by the offensive and incoming readouts. */
export function ResultRow({ r }: { r: MoveResult }) {
  const info = moveInfo(r.move);
  const ko = koTag(r.koChance, r.maxPercent);
  return (
    <div className={`result-row${r.maxPercent <= 0 ? ' result-row--status' : ''}`}>
      {info ? <TypeIcon type={info.type} className="result-type" /> : <span className="result-type result-type--none" aria-hidden />}
      <span className="result-move" title={r.move}>{r.move}</span>
      {r.maxPercent > 0 ? (
        <span className="result-pct" style={ko ? { color: ko.color } : undefined}>{r.minPercent}–{r.maxPercent}%</span>
      ) : (
        <span className="result-pct result-status">status</span>
      )}
      {ko && <span className="result-ko" style={{ backgroundColor: ko.color }}>{ko.label}</span>}
      {r.maxPercent > 0 && <DamageBar minPercent={r.minPercent} maxPercent={r.maxPercent} />}
    </div>
  );
}

/** Pokédex-redesign type colours (badges, move end-caps, tinted headers). */
const TYPE_COLORS: Record<string, string> = {
  Normal: '#a0a29f', Fire: '#ee8130', Water: '#5aa9e6', Electric: '#f2c944',
  Grass: '#63bc5a', Ice: '#74cec0', Fighting: '#c0392b', Poison: '#a34fa0',
  Ground: '#dbaf5a', Flying: '#8fa9e8', Psychic: '#f56aa0', Bug: '#a3b83a',
  Rock: '#b6a24a', Ghost: '#6c5aa6', Dragon: '#7a5df0', Dark: '#5a5366',
  Steel: '#7c8b9c', Fairy: '#e68fb8',
};

/** The colour for one type (falls back to a neutral grey). */
export function typeHex(type: string): string {
  return TYPE_COLORS[type] ?? '#a0a29f';
}

/**
 * A type-tinted gradient for a Pokémon's card header, keyed by its types: the
 * first type flows into the second (or into a darker shade of itself when
 * mono-typed), the same diagonal wash used across the redesign's headers.
 */
export function typeGradientStyle(types: string[]): CSSProperties {
  const c1 = typeHex(types[0] ?? 'Normal');
  if (types.length < 2) {
    return { background: `linear-gradient(120deg, ${c1}, color-mix(in srgb, ${c1} 64%, #2a2431))` };
  }
  const c2 = typeHex(types[1]);
  return {
    background: `linear-gradient(120deg, ${c1}, color-mix(in srgb, ${c1} 45%, ${c2}) 55%, ${c2})`,
  };
}

/**
 * The type's icon: a coloured circular badge (disc + white glyph) from the
 * partywhale/pokemon-type-icons set (MIT), bundled in public/type-icons/.
 */
export function TypeIcon({ type, className }: { type: string; className?: string }) {
  if (!type) return null;
  return (
    <img
      className={`type-icon${className ? ` ${className}` : ''}`}
      src={`/type-icons/${type.toLowerCase()}.svg`}
      alt=""
      aria-hidden
      width={16}
      height={16}
      draggable={false}
    />
  );
}

export function TypeBadge({ type }: { type: string }) {
  return (
    <span className="type-badge" style={{ backgroundColor: TYPE_COLORS[type] ?? '#777' }}>
      <TypeIcon type={type} />
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
