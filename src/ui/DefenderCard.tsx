/**
 * One defender column in the multi-calc: the defender's editor plus a live
 * readout of every attacker move resolved against this particular target.
 *
 * This card shows the OUTGOING direction (your attacker → this target). The
 * incoming direction (this target → your attacker) lives under the attacker as
 * tabs — see IncomingPanel — so you compare threats in one place.
 *
 * Cards are draggable (grab the handle at the top) so you can reorder the enemy
 * team — drop one onto another to swap positions. The first two cards are the
 * "front line" shown on the top row, so dragging a benched target onto a
 * front-line slot brings it forward (and updates the incoming tabs).
 */
import { useMemo } from 'react';
import type { Field, Pokemon } from '@smogon/calc';
import { PokemonEditor } from './PokemonEditor';
import { ResultRow, type MoveResult } from './widgets';
import { buildPokemon, calcOne } from '../champions';
import type { ChampionsSet } from '../champions';

interface Props {
  set: ChampionsSet;
  onChange: (next: ChampionsSet) => void;
  onRemove: () => void;
  /** The already-built attacker, or null while its species is invalid. */
  attacker: Pokemon | null;
  /** Non-empty attacker move names. */
  attackerMoves: string[];
  field: Field;
  index: number;
  /** Swap the target dragged from `from` with this card's position. */
  onSwap: (from: number, to: number) => void;
}

export function DefenderCard({ set, onChange, onRemove, attacker, attackerMoves, field, index, onSwap }: Props) {
  // Build this defender; null if the species box is mid-edit / unknown.
  const defender = useMemo<Pokemon | null>(() => {
    try {
      return buildPokemon(set);
    } catch {
      return null;
    }
  }, [set]);

  // Outgoing: your attacker's moves resolved against this target.
  const results = useMemo<MoveResult[]>(() => {
    if (!attacker || !defender) return [];
    return attackerMoves.map((move) => {
      try {
        return { move, ...calcOne(attacker, defender, move, field) };
      } catch {
        return { move, minPercent: 0, maxPercent: 0, minDamage: 0, maxDamage: 0, defenderMaxHP: 0, koChance: '', rolls: [] };
      }
    });
  }, [attacker, defender, attackerMoves, field]);

  return (
    <div
      className="defender-card"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const from = Number(e.dataTransfer.getData('text/plain'));
        if (!Number.isNaN(from)) onSwap(from, index);
      }}
    >
      <PokemonEditor
        set={set}
        onChange={onChange}
        role="defender"
        onRemove={onRemove}
        title={`Target ${index + 1}`}
        draggable
        onHeaderDragStart={(e) => {
          e.dataTransfer.setData('text/plain', String(index));
          e.dataTransfer.effectAllowed = 'move';
        }}
      />

      <div className="results">
        {!attacker && <p className="results-hint">Set an attacker species to see damage.</p>}
        {attacker && attackerMoves.length === 0 && (
          <p className="results-hint">Add a move to the attacker.</p>
        )}
        {attacker && defender && results.map((r) => <ResultRow key={r.move} r={r} />)}
      </div>
    </div>
  );
}
