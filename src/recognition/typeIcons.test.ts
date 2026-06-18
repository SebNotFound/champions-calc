import { describe, it, expect } from 'vitest';
import { speciesTypeBuckets, typeMatchBonus, TYPE_MATCH_BONUS, type ColorBucket } from './typeIcons';
import { acceptsAutoFill, worthMentioning } from './localRecognizer';

const set = (...b: ColorBucket[]) => new Set(b);

describe('acceptsAutoFill', () => {
  it('uses the full bar for a plain match', () => {
    expect(acceptsAutoFill(0.71, false)).toBe(true);
    expect(acceptsAutoFill(0.69, false)).toBe(false);
  });

  it('relaxes the bar only for a type-consistent match', () => {
    // 0.67: below the plain bar, above the type-consistent bar.
    expect(acceptsAutoFill(0.67, false)).toBe(false);
    expect(acceptsAutoFill(0.67, true)).toBe(true);
    // A type-backed read that is still too weak stays a best guess.
    expect(acceptsAutoFill(0.6, true)).toBe(false);
  });
});

describe('worthMentioning', () => {
  it('uses the normal bar for a plain match', () => {
    expect(worthMentioning(0.46, false)).toBe(true);
    expect(worthMentioning(0.44, false)).toBe(false);
  });

  it('surfaces a type-consistent match at a lower bar (the phone Whimsicott case)', () => {
    // 0.38: below the normal mention bar, but its types are corroborated.
    expect(worthMentioning(0.38, false)).toBe(false);
    expect(worthMentioning(0.38, true)).toBe(true);
    // Still drops genuinely hopeless reads, even type-consistent ones.
    expect(worthMentioning(0.3, true)).toBe(false);
  });
});

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
