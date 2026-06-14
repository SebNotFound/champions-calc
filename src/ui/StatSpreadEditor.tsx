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

/**
 * Held items that multiply one stat (the unconditional ones). The damage calc
 * already applies these internally; this mirrors them in the displayed stat so
 * the effect is visible — e.g. Choice Scarf actually shows the +50% Speed.
 */
const ITEM_STAT_MULT: Record<string, { stat: StatKey; mult: number }> = {
  'choice band': { stat: 'atk', mult: 1.5 },
  'choice specs': { stat: 'spa', mult: 1.5 },
  'choice scarf': { stat: 'spe', mult: 1.5 },
  'assault vest': { stat: 'spd', mult: 1.5 },
};

interface Props {
  baseStats?: StatTable;
  spread: StatSpread;
  nature: NatureName;
  level: number;
  onChange: (next: StatSpread) => void;
  /** Held item — applies its stat multiplier to the shown stat (e.g. Choice Scarf → Spe). */
  item?: string;
}

export function StatSpreadEditor({ baseStats, spread, nature, level, onChange, item }: Props) {
  const finalStats = baseStats
    ? computeChampionsStats(baseStats, spread, nature, level)
    : undefined;
  const left = remainingSp(spread);
  const itemBoost = item ? ITEM_STAT_MULT[item.trim().toLowerCase()] : undefined;

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
        const boosted = itemBoost && itemBoost.stat === stat;
        const shownStat = finalStats
          ? (boosted ? Math.floor(finalStats[stat] * itemBoost!.mult) : finalStats[stat])
          : undefined;
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
            <span
              className={`spread-final ${natureClass}${boosted ? ' stat-itemed' : ''}`}
              title={boosted ? `×${itemBoost!.mult} from ${item}` : undefined}
            >
              {shownStat ?? '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
