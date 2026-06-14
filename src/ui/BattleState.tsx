/**
 * In-battle stat-stage boosts (e.g. +2 Atk from Swords Dance), always visible —
 * one custom stepper per stat (no default browser number spinners). Click the
 * chevrons or scroll over a cell to adjust; range is clamped to ±6. Major status
 * lives up in the editor's field grid (next to Ability).
 */
import type { StatTable } from '../champions';

type Boosts = Partial<StatTable>;

const BOOST_STATS: { key: keyof StatTable; label: string }[] = [
  { key: 'atk', label: 'Atk' },
  { key: 'def', label: 'Def' },
  { key: 'spa', label: 'SpA' },
  { key: 'spd', label: 'SpD' },
  { key: 'spe', label: 'Spe' },
];

const clamp = (n: number) => Math.max(-6, Math.min(6, n));

interface Props {
  boosts: Boosts;
  onBoosts: (next: Boosts) => void;
}

export function BattleState({ boosts, onBoosts }: Props) {
  const set = (key: keyof StatTable, v: number) => onBoosts({ ...boosts, [key]: clamp(v) });

  return (
    <div className="battle-state">
      <div className="boost-row">
        {BOOST_STATS.map(({ key, label }) => {
          const v = boosts[key] ?? 0;
          return (
            <div
              key={key}
              className="boost-cell"
              onWheel={(e) => { e.preventDefault(); set(key, v + (e.deltaY < 0 ? 1 : -1)); }}
            >
              <span className="boost-label">{label}</span>
              <div className="boost-stepper">
                <span className={`boost-val${v > 0 ? ' pos' : v < 0 ? ' neg' : ''}`}>
                  {v > 0 ? `+${v}` : v}
                </span>
                <span className="boost-arrows">
                  <button type="button" className="boost-arrow" aria-label={`Raise ${label}`} disabled={v >= 6} onClick={() => set(key, v + 1)}>▴</button>
                  <button type="button" className="boost-arrow" aria-label={`Lower ${label}`} disabled={v <= -6} onClick={() => set(key, v - 1)}>▾</button>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
