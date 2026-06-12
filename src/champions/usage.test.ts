import { describe, it, expect } from 'vitest';
import { getUsage, hasUsage } from './usage';

describe('getUsage exact match', () => {
  it('returns a species\' own set when it has one', () => {
    // Basculegion has both a base entry and a `basculegionf` forme entry. The
    // exact match is checked first, so the base keeps its own set — the fallback
    // only fires on a miss and can never clobber real base usage. Its signature
    // move proves we served the base entry, not a forme's.
    const set = getUsage('Basculegion');
    expect(set).toBeDefined();
    expect(set?.moves).toContain('Last Respects');
  });
});

describe('base-species forme fallback', () => {
  it('fills Rotom from its most-used forme (Rotom-Wash) instead of blank', () => {
    const rotom = getUsage('Rotom');
    expect(rotom).toBeDefined();
    expect(rotom?.moves.length).toBeGreaterThan(0);
    expect(rotom?.item).toBeTruthy();
    expect(rotom?.statPoints).toBeDefined();
    // The snapshot lists Rotom-Wash first (most-used), so the base folds to it.
    expect(rotom).toEqual(getUsage('Rotom-Wash'));
    expect(hasUsage('Rotom')).toBe(true);
  });

  it('fills Lycanroc from Lycanroc-Dusk (the only used forme)', () => {
    const lycanroc = getUsage('Lycanroc');
    expect(lycanroc).toBeDefined();
    expect(lycanroc).toEqual(getUsage('Lycanroc-Dusk'));
  });

  it('does not fold a base species onto its Mega (Mega Stones stay off the base)', () => {
    // Charizard only appears as Mega-Y in the snapshot. Megas autofill via the
    // `megaForme` path, so the base must not inherit a Mega Stone item here.
    expect(getUsage('Charizard')).toBeUndefined();
    expect(hasUsage('Charizard')).toBe(false);
  });

  it('returns undefined for a species we have no data for at all', () => {
    expect(getUsage('Notapokemon')).toBeUndefined();
    expect(hasUsage('Notapokemon')).toBe(false);
  });
});
