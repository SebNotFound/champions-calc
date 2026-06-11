import { describe, it, expect } from 'vitest';
import {
  computeStat,
  computeChampionsStats,
  natureMultiplier,
  totalSp,
  remainingSp,
  isLegalSpread,
  clampStatPoints,
  emptySpread,
} from './stats';
import type { StatTable } from './types';

describe('Champions stat formula', () => {
  // At Lv50 with perfect IVs and no investment, HP == base + 75 and the
  // 32-SP cap takes it to base + 107 (the classic "252 EV" maximum).
  it('HP baseline is base + 75 and caps at base + 107', () => {
    expect(computeStat('hp', 100, 0, 'Hardy')).toBe(175);
    expect(computeStat('hp', 100, 32, 'Hardy')).toBe(207);
  });

  // A non-HP stat with a neutral nature and no SP is base + 20 at Lv50.
  it('neutral non-HP baseline is base + 20', () => {
    expect(computeStat('atk', 100, 0, 'Hardy')).toBe(120);
    expect(computeStat('atk', 100, 32, 'Hardy')).toBe(152);
  });

  // A boosting nature with 0 SP matches the classic Lv50 number exactly
  // (because with 0 investment the two systems agree).
  it('boosting nature with 0 SP matches mainline (base 130 Atk = 165)', () => {
    expect(computeStat('atk', 130, 0, 'Adamant')).toBe(165);
  });

  it('hindering nature lowers the stat by 10% (floored)', () => {
    // base 100 SpA-neutral core+5 = 120; Modest lowers Atk: 120 * 0.9 = 108.
    expect(computeStat('atk', 100, 0, 'Modest')).toBe(108);
  });

  // The documented divergence from classic EV math: SP is added AFTER the
  // nature multiplier, so 32 SP into a boosted stat is NOT the same as 252 EV.
  it('SP is added after nature (base 100 Adamant +32 SP = 164, not 167)', () => {
    expect(computeStat('atk', 100, 32, 'Adamant')).toBe(164);
  });

  it('natureMultiplier never affects HP', () => {
    expect(natureMultiplier('Adamant', 'hp')).toBe(1);
    expect(natureMultiplier('Adamant', 'atk')).toBe(1.1);
    expect(natureMultiplier('Adamant', 'spa')).toBe(0.9);
    expect(natureMultiplier('Hardy', 'atk')).toBe(1);
  });

  it('computes a full stat table', () => {
    const base: StatTable = { hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102 };
    const stats = computeChampionsStats(
      base,
      { hp: 4, atk: 32, def: 0, spa: 0, spd: 0, spe: 30 },
      'Adamant',
    );
    // HP: floor((216+31)/2)+60 = 123+60 = 183, +4 SP = 187
    expect(stats.hp).toBe(187);
    // Atk: floor((floor((260+31)/2)+5)*1.1)+32 = floor((145+5)*1.1)+32 = 165+32 = 197
    expect(stats.atk).toBe(197);
    // SpA hindered by Adamant: floor((floor((160+31)/2)+5)*0.9) = floor((95+5)*0.9) = 90
    expect(stats.spa).toBe(90);
    // Spe neutral: floor((204+31)/2)+5 = 117+5 = 122, +30 SP = 152
    expect(stats.spe).toBe(152);
  });
});

describe('Stat Point budget helpers', () => {
  it('totals and remaining points respect the 66 cap', () => {
    const spread = { ...emptySpread(), hp: 20, atk: 32, spe: 10 };
    expect(totalSp(spread)).toBe(62);
    expect(remainingSp(spread)).toBe(4);
  });

  it('flags illegal spreads (over 66 total or over 32 in one stat)', () => {
    expect(isLegalSpread({ ...emptySpread(), atk: 32, spa: 32 })).toBe(true); // 64 total, ok
    expect(isLegalSpread({ ...emptySpread(), atk: 32, spa: 32, spe: 4 })).toBe(false); // 68 -> over budget
    expect(isLegalSpread({ ...emptySpread(), atk: 33 })).toBe(false); // over per-stat cap
  });

  it('clamps a stat to the remaining budget and the per-stat cap', () => {
    // 60 already spent elsewhere, so this stat can only take 6 more.
    const spread = { ...emptySpread(), hp: 32, def: 28 };
    expect(clampStatPoints(spread, 'atk', 32)).toBe(6);
    // Never exceeds the 32 per-stat cap even with budget to spare.
    expect(clampStatPoints(emptySpread(), 'atk', 50)).toBe(32);
  });
});
