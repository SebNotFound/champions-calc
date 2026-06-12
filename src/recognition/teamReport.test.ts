import { describe, it, expect } from 'vitest';
import { toChampionsSet } from './teamReport';

describe('team-report set mapping', () => {
  it('maps a full raw entry (Mamoswine from the sample report)', () => {
    const set = toChampionsSet({
      species: 'Mamoswine',
      ability: 'Thick Fat',
      item: 'Focus Sash',
      nature: 'Adamant',
      moves: ['Ice Shard', 'Icicle Crash', 'Earthquake', 'Rock Tomb'],
      sp: { hp: 30, atk: 32, def: 0, spa: 0, spd: 0, spe: 4 },
    });
    expect(set).not.toBeNull();
    expect(set!.species).toBe('Mamoswine');
    expect(set!.item).toBe('Focus Sash');
    expect(set!.nature).toBe('Adamant');
    expect(set!.moves).toEqual(['Ice Shard', 'Icicle Crash', 'Earthquake', 'Rock Tomb']);
    expect(set!.statPoints).toEqual({ hp: 30, atk: 32, def: 0, spa: 0, spd: 0, spe: 4 });
  });

  it('pads moves to four and clamps Stat Points to 0–32', () => {
    const set = toChampionsSet({ species: 'Garchomp', moves: ['Earthquake'], sp: { atk: 40, spe: -5 } });
    expect(set!.moves).toHaveLength(4);
    expect(set!.moves.filter(Boolean)).toEqual(['Earthquake']);
    // 40 looks like an EV → folded to SP (÷8 = 5); negatives clamp to 0.
    expect(set!.statPoints.atk).toBe(5);
    expect(set!.statPoints.spe).toBe(0);
  });

  it('falls back to a neutral nature when unreadable, and fills a default ability', () => {
    const set = toChampionsSet({ species: 'Garchomp', nature: 'Glorious' });
    expect(set!.nature).toBe('Hardy');
    expect(set!.ability).toBeTruthy();
  });

  it('returns null for an unknown species', () => {
    expect(toChampionsSet({ species: 'Notamon' })).toBeNull();
  });
});
