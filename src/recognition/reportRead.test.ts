import { describe, it, expect } from 'vitest';
import { solveSpread, digitsFromLine, type StatReads } from './reportRead';
import { computeStat } from '../champions/stats';
import type { NatureName, StatKey, StatSpread, StatTable } from '../champions/types';

const STAT_KEYS: StatKey[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

/** Build per-line reads as the game would show them for a known spread/nature. */
function makeReads(base: StatTable, sp: StatSpread, nature: NatureName, corrupt?: Partial<Record<StatKey, { final?: number; sp?: number }>>): StatReads {
  const reads = {} as StatReads;
  for (const key of STAT_KEYS) {
    reads[key] = {
      final: corrupt?.[key]?.final ?? computeStat(key, base[key], sp[key], nature),
      sp: corrupt?.[key]?.sp ?? sp[key],
    };
  }
  return reads;
}

describe('digitsFromLine', () => {
  it('takes the last two number groups as final + sp', () => {
    expect(digitsFromLine('Attack 200 32')).toEqual({ final: 200, sp: 32 });
    expect(digitsFromLine('HP 215 30')).toEqual({ final: 215, sp: 30 });
    expect(digitsFromLine('Speed 104')).toEqual({ final: 104, sp: null });
    expect(digitsFromLine('Defense')).toEqual({ final: null, sp: null });
  });
});

describe('solveSpread', () => {
  // Mamoswine: base atk 130, Adamant, full 66-point physical spread.
  const mamoswine: StatTable = { hp: 110, atk: 130, def: 80, spa: 70, spd: 60, spe: 80 };
  const mamoSp: StatSpread = { hp: 30, atk: 32, def: 0, spa: 0, spd: 0, spe: 4 };

  it('recovers the exact spread and nature from clean reads', () => {
    const solved = solveSpread(mamoswine, makeReads(mamoswine, mamoSp, 'Adamant'));
    expect(solved.statPoints).toEqual(mamoSp);
    expect(solved.nature).toBe('Adamant');
    expect(solved.fit).toBe(5);
  });

  it('repairs a misread final stat using the SP column', () => {
    // Volcarona-style: Defense final misread (117 → 17), SP column intact.
    const volc: StatTable = { hp: 85, atk: 60, def: 65, spa: 135, spd: 105, spe: 100 };
    const sp: StatSpread = { hp: 20, atk: 0, def: 32, spa: 0, spd: 0, spe: 14 };
    const solved = solveSpread(volc, makeReads(volc, sp, 'Timid', { def: { final: 17 } }));
    expect(solved.statPoints).toEqual(sp);
    expect(solved.nature).toBe('Timid');
  });

  it('derives nature purely from the stat numbers (no arrows needed)', () => {
    // A Bold spread (def+ / atk-) must come back as Bold from the math alone.
    const umbreon: StatTable = { hp: 95, atk: 65, def: 110, spa: 60, spd: 130, spe: 65 };
    const sp: StatSpread = { hp: 32, atk: 0, def: 32, spa: 0, spd: 2, spe: 0 };
    const solved = solveSpread(umbreon, makeReads(umbreon, sp, 'Bold'));
    expect(solved.nature).toBe('Bold');
    expect(solved.statPoints).toEqual(sp);
  });
});
