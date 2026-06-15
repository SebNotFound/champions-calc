import { describe, it, expect } from 'vitest';
import { speciesTypeBuckets, typeMatchBonus, TYPE_MATCH_BONUS, type ColorBucket } from './typeIcons';

const set = (...b: ColorBucket[]) => new Set(b);

describe('speciesTypeBuckets', () => {
  it('maps each type to its colour options and drops unreadable types', () => {
    expect(speciesTypeBuckets(['Fire', 'Flying'])).toEqual([['red', 'orange'], ['blue']]);
    // Normal/Dark/Steel have no reliable icon colour, so they fall away.
    expect(speciesTypeBuckets(['Normal'])).toEqual([]);
    expect(speciesTypeBuckets(['Steel', 'Dragon'])).toEqual([['purple']]);
  });
});

describe('typeMatchBonus', () => {
  it('rewards a candidate only when every readable type is corroborated', () => {
    const venusaur = speciesTypeBuckets(['Grass', 'Poison']); // [[green],[purple]]
    // Both colours present -> full bonus.
    expect(typeMatchBonus(venusaur, set('green', 'purple'))).toBe(TYPE_MATCH_BONUS);
    // Only one of the two types backed -> nothing (this is what separates a
    // Grass/Poison from a Water/Flying when only green shows).
    expect(typeMatchBonus(venusaur, set('green'))).toBe(0);
  });

  it('treats a type\'s colours as alternatives (Fire = red OR orange)', () => {
    const charizard = speciesTypeBuckets(['Fire', 'Flying']); // [[red,orange],[blue]]
    expect(typeMatchBonus(charizard, set('red', 'blue'))).toBe(TYPE_MATCH_BONUS);
    expect(typeMatchBonus(charizard, set('orange', 'blue'))).toBe(TYPE_MATCH_BONUS);
    expect(typeMatchBonus(charizard, set('blue'))).toBe(0); // Fire unbacked
  });

  it('never rewards when nothing was detected or the species is unreadable', () => {
    expect(typeMatchBonus(speciesTypeBuckets(['Grass']), set())).toBe(0);
    expect(typeMatchBonus(speciesTypeBuckets(['Normal']), set('green'))).toBe(0);
  });
});
