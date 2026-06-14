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

/**
 * The classic stat-stage multiplier: +1 is x1.5, +2 is x2, up to +6 = x4, and
 * the mirror for negatives (-1 is x2/3, down to -6 = x1/4). HP has no stage, so
 * callers skip it. We floor the result, the same way the game does.
 */
function applyBoostStage(stat: number, stage: number): number {
  if (!stage) return stat;
  const factor = stage > 0 ? (2 + stage) / 2 : 2 / (2 - stage);
  return Math.floor(stat * factor);
}

interface Props {
  baseStats?: StatTable;
  spread: StatSpread;
  nature: NatureName;
  level: number;
  onChange: (next: StatSpread) => void;
  /** Held item — applies its stat multiplier to the shown stat (e.g. Choice Scarf → Spe). */
  item?: string;
  /** In-battle stat-stage boosts, so the shown stat reflects e.g. a +2 from Swords Dance. */
  boosts?: Partial<StatTable>;
}

export function StatSpreadEditor({ baseStats, spread, nature, level, onChange, item, boosts }: Props) {
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

        // Show the *effective* stat: start from the at-level number, apply the
        // in-battle stage boost (HP has none), then the held-item multiplier.
        // This matches what the damage calc actually uses, so the two agree.
        const stage = stat === 'hp' ? 0 : (boosts?.[stat] ?? 0);
        const itemHere = itemBoost && itemBoost.stat === stat;
        let shownStat: number | undefined;
        if (finalStats) {
          shownStat = applyBoostStage(finalStats[stat], stage);
          if (itemHere) shownStat = Math.floor(shownStat * itemBoost!.mult);
        }
        const modified = stage !== 0 || itemHere;
        const modTitle = [
          stage ? `${stage > 0 ? '+' : ''}${stage} stage` : '',
          itemHere ? `x${itemBoost!.mult} ${item}` : '',
        ].filter(Boolean).join(', ');
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
              className={`spread-final ${natureClass}${modified ? ' stat-mod' : ''}`}
              title={modified ? modTitle : undefined}
            >
              {shownStat ?? '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
