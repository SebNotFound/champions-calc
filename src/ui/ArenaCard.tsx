/**
 * One battler on the arena battleground: the full Pokémon editor plus a damage
 * readout for THIS Pokémon, with a tab to pick who is hitting it.
 *
 * The card always shows the damage it *receives*. On your side that is the
 * incoming hit from one of the enemy's two active mons; on the enemy side it is
 * the hit from one of your two. So both sides read the same way, and the tab
 * just chooses which of the opposing two is attacking.
 *
 * Same drag handle as the defender cards: grab the header and drop onto the
 * other card to swap the two active slots.
 */
import { useMemo, useState } from 'react';
import type { Field, Pokemon } from '@smogon/calc';
import { PokemonEditor } from './PokemonEditor';
import { ResultRow, Sprite, type MoveResult } from './widgets';
import { buildPokemon, calcOne } from '../champions';
import type { ChampionsSet } from '../champions';

/** One of the opposing side's active mons, pre-built so we don't rebuild per card. */
export interface Battler {
  name: string;
  species: string;
  mon: Pokemon | null;
  moves: string[];
}

interface Props {
  set: ChampionsSet;
  onChange: (next: ChampionsSet) => void;
  onRemove: () => void;
  index: number;
  onSwap: (from: number, to: number) => void;
  /** 'attacker' = your side (cyan), 'defender' = the enemy side (rose). */
  role: 'attacker' | 'defender';
  side: 'ally' | 'foe';
  title: string;
  /** The opposing two actives, any of which can hit this card. */
  attackers: Battler[];
  /** Field for attacker -> this card (incoming for your side, outgoing for theirs). */
  field: Field;
}

export function ArenaCard({ set, onChange, onRemove, index, onSwap, role, side, title, attackers, field }: Props) {
  const [tab, setTab] = useState(0);

  const defender = useMemo<Pokemon | null>(() => {
    try { return buildPokemon(set); } catch { return null; }
  }, [set]);

  const t = Math.min(tab, Math.max(0, attackers.length - 1));
  const atk = attackers[t];

  const rows = useMemo<MoveResult[]>(() => {
    if (!defender || !atk?.mon) return [];
    return atk.moves
      .map((m) => { try { return { move: m, ...calcOne(atk.mon!, defender, m, field) }; } catch { return null; } })
      .filter((r): r is MoveResult => !!r);
  }, [defender, atk, field]);

  return (
    <div
      className={`arena-card arena-card--${side}`}
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
        role={role}
        onRemove={onRemove}
        title={title}
        draggable
        onHeaderDragStart={(e) => {
          e.dataTransfer.setData('text/plain', String(index));
          e.dataTransfer.effectAllowed = 'move';
        }}
      />

      <div className="results arena-damage">
        <div className="incoming-topline">
          <span className="incoming-head">{side === 'ally' ? 'Incoming from' : 'Damage from'}</span>
          {attackers.length > 1 && (
            <div className="incoming-tabs">
              {attackers.map((a, i) => (
                <button key={i} className={`incoming-tab${i === t ? ' active' : ''}`} onClick={() => setTab(i)} title={a.name}>
                  <Sprite species={a.species} />
                  <span>{a.name}</span>
                </button>
              ))}
            </div>
          )}
          {attackers.length === 1 && <span className="incoming-one">{atk?.name}</span>}
        </div>
        <div className="incoming-body">
          {!atk?.mon && <p className="results-hint">No opposing Pokémon.</p>}
          {atk?.mon && rows.length === 0 && <p className="results-hint">Add a move to {atk.name}.</p>}
          {atk?.mon && rows.map((r) => <ResultRow key={r.move} r={r} />)}
        </div>
      </div>
    </div>
  );
}
