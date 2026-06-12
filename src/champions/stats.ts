/**
 * The Pokémon Champions stat model.
 *
 * Champions threw out the classic EV/IV grind in favour of a much simpler
 * "Stat Points" (SP) system:
 *
 *   • Every Pokémon behaves as if it has perfect (31) IVs in every stat.
 *   • There are no EVs. Instead you spend Stat Points: 66 total, at most 32
 *     in any one stat, and **1 SP adds exactly +1 to that stat at Lv50**.
 *   • Natures still raise one stat by 10% and lower another by 10%.
 *
 * Where SP is applied — before or after the nature multiplier — was VERIFIED
 * against real in-game team-report screenshots (samples/derived-stats.png):
 * the game folds SP **inside** the nature multiplier, exactly like classic EV
 * math. Three independent stat lines prove it:
 *   - Mamoswine Atk 200 @ 32 SP, Adamant: floor((150+32)·1.1) = 200; the
 *     "after" ordering would give 197.
 *   - Volcarona Spe 147 @ 14 SP, Timid: floor((120+14)·1.1) = 147 (after: 146).
 *   - Floette-Eternal Spe 158 @ 32 SP, Timid: floor((112+32)·1.1) = 158
 *     (after: 155).
 * So on a boosted stat 1 SP is effectively +1.1 (and +0.9 on a hindered one),
 * the marketing "1 SP = +1" wording notwithstanding.
 *
 * Sanity check that the baseline is right: at Lv50 with perfect IVs and 0 SP,
 * HP comes out to (Base + 75); the 32-SP cap pushes it to (Base + 107) —
 * exactly the old "252 EV" maximum. The numbers line up, which is a good sign
 * the model matches the game.
 */

import type { NatureName, StatKey, StatSpread, StatTable } from './types';

/** Champions battles are always level 50 (VGC doubles). */
export const CHAMPIONS_LEVEL = 50;

/** Champions treats every Pokémon as having perfect IVs. */
export const PERFECT_IV = 31;

/** Total Stat Points a Pokémon may distribute across its six stats. */
export const MAX_TOTAL_SP = 66;

/** Most Stat Points allowed in a single stat. */
export const MAX_SP_PER_STAT = 32;

/**
 * `true`  → a Stat Point is added *after* the nature multiplier (1 SP = +1).
 * `false` → SP is folded into the value the nature multiplies (classic EV math).
 * Set from real team-report screenshots (see the module comment): the game
 * uses the classic ordering, so this stays `false`.
 */
export const SP_APPLIED_AFTER_NATURE = false;

/** The six stat keys, in canonical order. */
export const STAT_KEYS: StatKey[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

/** Short, human-friendly labels for the UI. */
export const STAT_LABELS: StatTable<string> = {
  hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe',
};

interface NatureEffect {
  /** Stat raised by 10% (undefined for neutral natures). */
  plus?: Exclude<StatKey, 'hp'>;
  /** Stat lowered by 10% (undefined for neutral natures). */
  minus?: Exclude<StatKey, 'hp'>;
}

/**
 * Which stat each nature raises and lowers. This is canonical, unchanging
 * data, kept inline so this module stays a pure function with no dependency
 * on a loaded `@smogon/calc` generation. Neutral natures have no entries.
 */
export const NATURES: Record<NatureName, NatureEffect> = {
  Hardy: {}, Docile: {}, Serious: {}, Bashful: {}, Quirky: {},
  Lonely: { plus: 'atk', minus: 'def' },
  Brave: { plus: 'atk', minus: 'spe' },
  Adamant: { plus: 'atk', minus: 'spa' },
  Naughty: { plus: 'atk', minus: 'spd' },
  Bold: { plus: 'def', minus: 'atk' },
  Relaxed: { plus: 'def', minus: 'spe' },
  Impish: { plus: 'def', minus: 'spa' },
  Lax: { plus: 'def', minus: 'spd' },
  Timid: { plus: 'spe', minus: 'atk' },
  Hasty: { plus: 'spe', minus: 'def' },
  Jolly: { plus: 'spe', minus: 'spa' },
  Naive: { plus: 'spe', minus: 'spd' },
  Modest: { plus: 'spa', minus: 'atk' },
  Mild: { plus: 'spa', minus: 'def' },
  Quiet: { plus: 'spa', minus: 'spe' },
  Rash: { plus: 'spa', minus: 'spd' },
  Calm: { plus: 'spd', minus: 'atk' },
  Gentle: { plus: 'spd', minus: 'def' },
  Sassy: { plus: 'spd', minus: 'spe' },
  Careful: { plus: 'spd', minus: 'spa' },
};

/** A short "+Atk, -Def" style description of a nature (or "neutral"). */
export function describeNature(nature: NatureName): string {
  const effect = NATURES[nature];
  if (!effect.plus || !effect.minus) return 'neutral';
  return `+${STAT_LABELS[effect.plus]}, -${STAT_LABELS[effect.minus]}`;
}

/** The nature multiplier (1.1 / 0.9 / 1) for a given stat. HP is never affected. */
export function natureMultiplier(nature: NatureName, stat: StatKey): number {
  if (stat === 'hp') return 1;
  const effect = NATURES[nature];
  if (effect.plus === stat) return 1.1;
  if (effect.minus === stat) return 0.9;
  return 1;
}

/**
 * Compute one final stat at a given level using the Champions rules.
 *
 * @param stat   Which stat is being computed (HP is special-cased).
 * @param base   The species' base stat.
 * @param sp     Stat Points invested in this stat (0–32).
 * @param nature The Pokémon's nature.
 * @param level  Defaults to 50 (Champions standard).
 */
export function computeStat(
  stat: StatKey,
  base: number,
  sp: number,
  nature: NatureName,
  level: number = CHAMPIONS_LEVEL,
): number {
  // The shared "(2·Base + IV) · level / 100" core, identical to mainline games.
  const core = Math.floor(((2 * base + PERFECT_IV) * level) / 100);

  if (stat === 'hp') {
    // HP adds (level + 10) and is never touched by nature; SP is then +1 each.
    return core + level + 10 + sp;
  }

  if (SP_APPLIED_AFTER_NATURE) {
    // Nature multiplies the *un-invested* stat, then SP is added at face value.
    return Math.floor((core + 5) * natureMultiplier(nature, stat)) + sp;
  }
  // Alternative ordering: SP sits inside the nature multiplier.
  return Math.floor((core + 5 + sp) * natureMultiplier(nature, stat));
}

/** Compute all six final stats for a Pokémon. */
export function computeChampionsStats(
  baseStats: StatTable,
  statPoints: Partial<StatSpread>,
  nature: NatureName,
  level: number = CHAMPIONS_LEVEL,
): StatTable {
  const result = {} as StatTable;
  for (const key of STAT_KEYS) {
    result[key] = computeStat(key, baseStats[key], statPoints[key] ?? 0, nature, level);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Stat Point bookkeeping helpers (used by the UI to validate / display spreads)
// ---------------------------------------------------------------------------

/** A spread with zero points in every stat. */
export function emptySpread(): StatSpread {
  return { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
}

/** Sum of all invested Stat Points. */
export function totalSp(spread: Partial<StatSpread>): number {
  return STAT_KEYS.reduce((sum, key) => sum + (spread[key] ?? 0), 0);
}

/** How many Stat Points are still available to spend (never negative). */
export function remainingSp(spread: Partial<StatSpread>): number {
  return Math.max(0, MAX_TOTAL_SP - totalSp(spread));
}

/** Whether a spread is legal: each stat 0–32 and the total is ≤66. */
export function isLegalSpread(spread: Partial<StatSpread>): boolean {
  if (totalSp(spread) > MAX_TOTAL_SP) return false;
  return STAT_KEYS.every((key) => {
    const value = spread[key] ?? 0;
    return value >= 0 && value <= MAX_SP_PER_STAT;
  });
}

/**
 * Clamp a single stat's SP to what is actually spendable: never above 32, and
 * never more than (remaining points + whatever was already in this stat). This
 * lets the UI freely raise a stat without ever exceeding the 66-point budget.
 */
export function clampStatPoints(
  spread: StatSpread,
  stat: StatKey,
  desired: number,
): number {
  const others = totalSp(spread) - spread[stat];
  const budgetLeft = MAX_TOTAL_SP - others;
  return Math.max(0, Math.min(desired, MAX_SP_PER_STAT, budgetLeft));
}
