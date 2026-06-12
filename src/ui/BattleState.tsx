/**
 * Optional in-battle stat-stage boosts (e.g. +2 Atk from Swords Dance). Tucked
 * inside a <details> so it stays out of the way until needed. Major status lives
 * up in the editor's field grid (next to Ability) for quick access.
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

interface Props {
  boosts: Boosts;
  onBoosts: (next: Boosts) => void;
}

export function BattleState({ boosts, onBoosts }: Props) {
  const activeCount = BOOST_STATS.filter(({ key }) => (boosts[key] ?? 0) !== 0).length;

  return (
    <details className="battle-state">
      <summary>
        Stat boosts{activeCount > 0 ? ` (${activeCount})` : ''}
      </summary>
      <div className="boost-row">
        {BOOST_STATS.map(({ key, label }) => (
          <label key={key} className="boost-cell">
            <span>{label}</span>
            <input
              type="number"
              min={-6}
              max={6}
              value={boosts[key] ?? 0}
              onChange={(e) => {
                const v = Math.max(-6, Math.min(6, Number(e.target.value)));
                onBoosts({ ...boosts, [key]: v });
              }}
            />
          </label>
        ))}
      </div>
    </details>
  );
}
