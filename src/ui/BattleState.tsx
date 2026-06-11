/**
 * Optional in-battle modifiers: stat-stage boosts (e.g. +2 from Swords Dance)
 * and major status (Burn halves physical damage; others matter for Facade/Hex).
 * Tucked inside a <details> so it stays out of the way until needed.
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
  boosts: Boosts;
  status?: string;
  onBoosts: (next: Boosts) => void;
  onStatus: (next: string | undefined) => void;
}

export function BattleState({ boosts, status, onBoosts, onStatus }: Props) {
  const activeCount =
    BOOST_STATS.filter(({ key }) => (boosts[key] ?? 0) !== 0).length + (status ? 1 : 0);

  return (
    <details className="battle-state">
      <summary>
        Battle state{activeCount > 0 ? ` (${activeCount})` : ''}
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
      <label className="status-row">
        <span>Status</span>
        <select value={status ?? ''} onChange={(e) => onStatus(e.target.value || undefined)}>
          {STATUSES.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>
    </details>
  );
}
