/**
 * Editor for a Pokémon's Stat Points.
 *
 * Champions gives you 66 points, max 32 per stat. Each row has a slider and a
 * number box (whichever you prefer), shows the resulting stat with nature
 * colouring, and the header tracks how many points are left. Every change is
 * run through `clampStatPoints`, so you physically can't overspend the budget.
 */
import {
  STAT_KEYS,
  STAT_LABELS,
  MAX_SP_PER_STAT,
  MAX_TOTAL_SP,
  computeChampionsStats,
  natureMultiplier,
  remainingSp,
  clampStatPoints,
} from '../champions';
import type { NatureName, StatKey, StatSpread, StatTable } from '../champions';

interface Props {
  baseStats?: StatTable;
  spread: StatSpread;
  nature: NatureName;
  level: number;
  onChange: (next: StatSpread) => void;
}

export function StatSpreadEditor({ baseStats, spread, nature, level, onChange }: Props) {
  const finalStats = baseStats
    ? computeChampionsStats(baseStats, spread, nature, level)
    : undefined;
  const left = remainingSp(spread);

  const setStat = (stat: StatKey, desired: number) => {
    onChange({ ...spread, [stat]: clampStatPoints(spread, stat, desired) });
  };

  return (
    <div className="spread-editor">
      <div className="spread-header">
        <span>Stat Points</span>
        <span className={left === 0 ? 'sp-left sp-empty' : 'sp-left'}>
          {left} / {MAX_TOTAL_SP} left
        </span>
      </div>

      {STAT_KEYS.map((stat) => {
        const mult = natureMultiplier(nature, stat);
        const natureClass = mult > 1 ? 'stat-up' : mult < 1 ? 'stat-down' : '';
        return (
          <div className="spread-row" key={stat}>
            <label className="spread-label">{STAT_LABELS[stat]}</label>
            <input
              type="range"
              min={0}
              max={MAX_SP_PER_STAT}
              value={spread[stat]}
              onChange={(e) => setStat(stat, Number(e.target.value))}
              className="spread-slider"
              aria-label={`${STAT_LABELS[stat]} stat points`}
            />
            <input
              type="number"
              min={0}
              max={MAX_SP_PER_STAT}
              value={spread[stat]}
              onChange={(e) => setStat(stat, Number(e.target.value))}
              className="spread-number"
            />
            <span className={`spread-final ${natureClass}`}>
              {finalStats ? finalStats[stat] : '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
