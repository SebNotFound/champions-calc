import { describe, it, expect } from 'vitest';
import { megaFormeFromItem, applyMegaItem } from './data/megas';
import { emptySpread } from './stats';
import type { ChampionsSet } from './types';

const set = (p: Partial<ChampionsSet> & { species: string }): ChampionsSet => ({
  level: 50, nature: 'Hardy', statPoints: emptySpread(), moves: [], ...p,
});

describe('megaFormeFromItem', () => {
  it('maps a generic Champions mega item to the species single Mega', () => {
    expect(megaFormeFromItem('Eelektross', 'Mega Gem')).toBe('Eelektross-Mega');
    expect(megaFormeFromItem('Aerodactyl', 'Mega Orb')).toBe('Aerodactyl-Mega');
  });

  it('resolves a real per-species Mega Stone to its exact forme (including X/Y)', () => {
    expect(megaFormeFromItem('Charizard', 'Charizardite Y')).toBe('Charizard-Mega-Y');
    expect(megaFormeFromItem('Aerodactyl', 'Aerodactylite')).toBe('Aerodactyl-Mega');
  });

  it('returns undefined for a non-mega item, no item, or a species with no Mega', () => {
    expect(megaFormeFromItem('Garchomp', 'Life Orb')).toBeUndefined();
    expect(megaFormeFromItem('Eelektross', undefined)).toBeUndefined();
    expect(megaFormeFromItem('Amoonguss', 'Mega Gem')).toBeUndefined();
  });
});

describe('applyMegaItem', () => {
  it('sets the forme and clears the item when a mega item is held', () => {
    const out = applyMegaItem(set({ species: 'Eelektross', item: 'Mega Gem' }));
    expect(out.megaForme).toBe('Eelektross-Mega');
    expect(out.item).toBeUndefined();
  });

  it('leaves a set with a normal item untouched', () => {
    const s = set({ species: 'Garchomp', item: 'Life Orb' });
    expect(applyMegaItem(s)).toEqual(s);
  });
});
