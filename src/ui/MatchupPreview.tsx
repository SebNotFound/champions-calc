/**
 * A floating "matchup preview" that pops up when you hover a Pokémon in either
 * team list, showing only that one matchup's damage:
 *   - Hover an enemy  → your current attacker's moves against that enemy.
 *   - Hover your mon  → that Pokémon's moves against the active enemies, with a
 *     tab per front-line enemy to switch targets.
 *
 * The "→" in the title is a button: click it to reverse the calc — swap attacker
 * and defender (damage done ⇄ damage taken), which also swaps to the incoming
 * field (the right screens / Helping Hand for that direction).
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
  /** The attacker's move names (used in the normal, damage-done direction). */
  moves: string[];
  /** Candidate targets — one tab each (front-line enemies, or the single hovered enemy). */
  targets: ChampionsSet[];
  field: Field;         // attacker → target  (damage done / outgoing)
  reverseField: Field;  // target → attacker  (damage taken / incoming)
  /** Fixed-position placement computed from the hovered row. */
  style: CSSProperties;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export function MatchupPreview({ attacker, attackerName, moves, targets, field, reverseField, style, onMouseEnter, onMouseLeave }: Props) {
  const [tab, setTab] = useState(0);
  const [reversed, setReversed] = useState(false);
  const t = Math.min(tab, Math.max(0, targets.length - 1));
  const targetSet = targets[t];

  const targetMon = useMemo<Pokemon | null>(() => {
    try { return targetSet ? buildPokemon(targetSet) : null; } catch { return null; }
  }, [targetSet]);

  // Direction: normal = attacker → target (damage done); reversed swaps both the
  // attacker/defender AND the field (so the right screens/Helping Hand apply).
  const atkMon = reversed ? targetMon : attacker;
  const defMon = reversed ? attacker : targetMon;
  const dirField = reversed ? reverseField : field;
  const dirMoves = reversed ? (targetSet?.moves ?? []) : moves;
  // Names stay put — only the arrow rotates to show the direction.
  const leftName = attackerName;
  const rightName = targetSet?.species ?? '';

  const cleanMoves = useMemo(
    () => Array.from(new Set(dirMoves.map((m) => m.trim()).filter(Boolean))),
    [dirMoves],
  );

  const rows = useMemo<MoveResult[]>(() => {
    if (!atkMon || !defMon) return [];
    return cleanMoves
      .map((m) => { try { return { move: m, ...calcOne(atkMon, defMon, m, dirField) }; } catch { return null; } })
      .filter((r): r is MoveResult => !!r);
  }, [atkMon, defMon, cleanMoves, dirField]);

  return (
    <div className="matchup-preview" style={style} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} role="dialog">
      <div className="mp-title">
        <span className="mp-name">{leftName}</span>
        <button
          className={`mp-rev${reversed ? ' reversed' : ''}`}
          onClick={() => setReversed((r) => !r)}
          aria-label="Reverse the matchup (damage done / taken)"
        >→</button>
        <span className="mp-name">{rightName}</span>
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
