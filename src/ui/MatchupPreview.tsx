/**
 * A floating "matchup preview" that pops up when you hover a Pokémon in either
 * team list, showing only that one matchup's damage:
 *   - Hover an enemy  → your current attacker's moves against that enemy.
 *   - Hover your mon  → that Pokémon's moves against the active enemies, with a
 *     tab per front-line enemy to switch targets.
 *
 * It's anchored next to the hovered row (positioned by the caller) and stays open
 * while the cursor is over it, so the tabs are clickable.
 */
import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Pokemon, Field } from '@smogon/calc';
import { buildPokemon, calcOne } from '../champions';
import type { ChampionsSet } from '../champions';
import { ResultRow, Sprite, type MoveResult } from './widgets';

interface Props {
  /** The attacking Pokémon for this preview (your selected attacker, or the hovered team mon). */
  attacker: Pokemon | null;
  attackerName: string;
  /** The attacker's move names. */
  moves: string[];
  /** Candidate targets — one tab each (front-line enemies, or the single hovered enemy). */
  targets: ChampionsSet[];
  field: Field;
  /** Fixed-position placement computed from the hovered row. */
  style: CSSProperties;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export function MatchupPreview({ attacker, attackerName, moves, targets, field, style, onMouseEnter, onMouseLeave }: Props) {
  const [tab, setTab] = useState(0);
  const t = Math.min(tab, Math.max(0, targets.length - 1));

  const targetMon = useMemo<Pokemon | null>(() => {
    try { return targets[t] ? buildPokemon(targets[t]) : null; } catch { return null; }
  }, [targets, t]);

  const cleanMoves = useMemo(
    () => Array.from(new Set(moves.map((m) => m.trim()).filter(Boolean))),
    [moves],
  );

  const rows = useMemo<MoveResult[]>(() => {
    if (!attacker || !targetMon) return [];
    return cleanMoves
      .map((m) => { try { return { move: m, ...calcOne(attacker, targetMon, m, field) }; } catch { return null; } })
      .filter((r): r is MoveResult => !!r);
  }, [attacker, targetMon, cleanMoves, field]);

  return (
    <div className="matchup-preview" style={style} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} role="dialog">
      <div className="mp-title">
        <strong>{attackerName}</strong><span className="mp-arrow">→</span>
        {targets.length === 1 && <span className="mp-target">{targets[0].species}</span>}
      </div>

      {targets.length > 1 && (
        <div className="mp-tabs">
          {targets.map((tg, i) => (
            <button key={i} className={`mp-tab${i === t ? ' active' : ''}`} onClick={() => setTab(i)} title={tg.species}>
              <Sprite species={tg.megaForme ?? tg.species} />
              <span>{tg.species}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mp-rows">
        {rows.length
          ? rows.map((r, i) => <ResultRow key={i} r={r} />)
          : <p className="mp-empty">No move damage to show.</p>}
      </div>
    </div>
  );
}
