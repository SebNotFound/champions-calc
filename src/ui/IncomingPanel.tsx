/**
 * Incoming-damage panel, shown under your attacker.
 *
 * One tab per front-line enemy (the two active targets on the top row). The
 * active tab lists that enemy's moves resolved against your attacker — the
 * "what do they do to me?" half of the matchup. Because the tabs are driven by
 * whichever enemies are on the front line, dragging a different enemy up there
 * refreshes the tab with the new Pokémon automatically.
 *
 * `field` is the incoming field built by the app (your-side screens + shared
 * weather/terrain), so "Your screens" protect you here.
 */
import { useMemo, useState } from 'react';
import type { Field, Pokemon } from '@smogon/calc';
import { buildPokemon, calcOne } from '../champions';
import type { ChampionsSet } from '../champions';
import { ResultRow, Sprite, type MoveResult } from './widgets';

interface Props {
  /** Your built attacker, or null while its species is mid-edit / invalid. */
  attacker: Pokemon | null;
  /** Your attacker's display name (for the heading). */
  attackerName: string;
  /** The front-line enemy sets (up to two) — these become the tabs. */
  enemies: ChampionsSet[];
  field: Field;
}

export function IncomingPanel({ attacker, attackerName, enemies, field }: Props) {
  const [tab, setTab] = useState(0);
  // Clamp so removing/!reordering enemies can't leave the tab out of range.
  const active = Math.min(tab, Math.max(0, enemies.length - 1));
  const enemy = enemies[active];

  const rows = useMemo<MoveResult[]>(() => {
    if (!attacker || !enemy) return [];
    let mon: Pokemon;
    try { mon = buildPokemon(enemy); } catch { return []; }
    const moves = Array.from(new Set((enemy.moves ?? []).map((m) => m.trim()).filter(Boolean)));
    return moves.map((move) => {
      try {
        return { move, ...calcOne(mon, attacker, move, field) };
      } catch {
        return { move, minPercent: 0, maxPercent: 0, minDamage: 0, maxDamage: 0, defenderMaxHP: 0, koChance: '', rolls: [] };
      }
    });
  }, [attacker, enemy, field]);

  return (
    <div className="incoming-panel">
      <div className="incoming-topline">
        <span className="incoming-head">Incoming{attacker ? ` → ${attackerName}` : ''}</span>
        {enemies.length > 0 && (
          <div className="incoming-tabs" role="tablist">
            {enemies.map((e, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === active}
                className={`incoming-tab${i === active ? ' active' : ''}`}
                onClick={() => setTab(i)}
                title={e.species}
              >
                <Sprite species={e.megaForme ?? e.species} />
                <span>{e.species}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {enemies.length === 0 ? (
        <p className="results-hint">Add an enemy (right) to see what it does to you.</p>
      ) : (
        <div className="incoming-body">
          {!attacker && <p className="results-hint">Set your attacker’s species to see incoming damage.</p>}
          {attacker && rows.length === 0 && (
            <p className="results-hint">Add moves to {enemy?.species} (in its card) to see incoming damage.</p>
          )}
          {attacker && rows.map((r) => <ResultRow key={r.move} r={r} />)}
        </div>
      )}
    </div>
  );
}
