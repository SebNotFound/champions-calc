<script lang="ts">
  /**
   * Editor for a Pokemon's Stat Points. Champions gives you 66 points, max 32 per
   * stat; every change goes through clampStatPoints so you can't overspend.
   */
  import {
    STAT_KEYS, STAT_LABELS, MAX_SP_PER_STAT, MAX_TOTAL_SP,
    computeChampionsStats, natureMultiplier, remainingSp, clampStatPoints,
  } from '@core';
  import type { NatureName, StatKey, StatSpread, StatTable } from '@core';

  let { baseStats, spread, nature, level, onChange, item, boosts }: {
    baseStats?: StatTable;
    spread: StatSpread;
    nature: NatureName;
    level: number;
    onChange: (next: StatSpread) => void;
    /** Held item that multiplies the shown stat (e.g. Choice Scarf -> Spe). */
    item?: string;
    /** In-battle stat-stage boosts, so the shown stat reflects e.g. a +2 from Swords Dance. */
    boosts?: Partial<StatTable>;
  } = $props();

  /** Held items that multiply one stat, mirrored here so the displayed stat matches
   *  what the damage calc actually uses. */
  const ITEM_STAT_MULT: Record<string, { stat: StatKey; mult: number }> = {
    'choice band': { stat: 'atk', mult: 1.5 },
    'choice specs': { stat: 'spa', mult: 1.5 },
    'choice scarf': { stat: 'spe', mult: 1.5 },
    'assault vest': { stat: 'spd', mult: 1.5 },
  };

  /** The classic stat-stage multiplier: +1 is x1.5 up to +6 = x4, mirrored for negatives. */
  function applyBoostStage(stat: number, stage: number): number {
    if (!stage) return stat;
    const factor = stage > 0 ? (2 + stage) / 2 : 2 / (2 - stage);
    return Math.floor(stat * factor);
  }

  const finalStats = $derived(
    baseStats ? computeChampionsStats(baseStats, spread, nature, level) : undefined,
  );
  const left = $derived(remainingSp(spread));
  const itemBoost = $derived(item ? ITEM_STAT_MULT[item.trim().toLowerCase()] : undefined);

  const setStat = (stat: StatKey, desired: number) =>
    onChange({ ...spread, [stat]: clampStatPoints(spread, stat, desired) });

  /** The *effective* stat: at-level number, then the in-battle stage, then the item. */
  function shownStat(stat: StatKey) {
    const stage = stat === 'hp' ? 0 : (boosts?.[stat] ?? 0);
    const itemHere = !!itemBoost && itemBoost.stat === stat;
    let value: number | undefined;
    if (finalStats) {
      value = applyBoostStage(finalStats[stat], stage);
      if (itemHere) value = Math.floor(value * itemBoost!.mult);
    }
    const title = [
      stage ? `${stage > 0 ? '+' : ''}${stage} stage` : '',
      itemHere ? `x${itemBoost!.mult} ${item}` : '',
    ].filter(Boolean).join(', ');
    return { value, modified: stage !== 0 || itemHere, title };
  }
</script>

<div class="spread-editor">
  <div class="spread-header">
    <span>Stat Points</span>
    <span class={left === 0 ? 'sp-left sp-empty' : 'sp-left'}>{left} / {MAX_TOTAL_SP} left</span>
  </div>

  {#each STAT_KEYS as stat (stat)}
    {@const mult = natureMultiplier(nature, stat)}
    {@const natureClass = mult > 1 ? 'stat-up' : mult < 1 ? 'stat-down' : ''}
    {@const s = shownStat(stat)}
    <div class="spread-row">
      <span class="spread-label">{STAT_LABELS[stat]}</span>
      <input
        type="range"
        min="0"
        max={MAX_SP_PER_STAT}
        value={spread[stat]}
        class="spread-slider"
        aria-label="{STAT_LABELS[stat]} stat points"
        oninput={(e) => setStat(stat, Number(e.currentTarget.value))}
      />
      <input
        type="number"
        min="0"
        max={MAX_SP_PER_STAT}
        value={spread[stat]}
        class="spread-number"
        aria-label="{STAT_LABELS[stat]} stat points (number)"
        oninput={(e) => setStat(stat, Number(e.currentTarget.value))}
      />
      <span class="spread-final {natureClass}{s.modified ? ' stat-mod' : ''}" title={s.modified ? s.title : undefined}>
        {s.value ?? '—'}
      </span>
    </div>
  {/each}
</div>
