import { describe, it, expect } from 'vitest';
import { normalizeText, editDistance, fuzzyBest } from './fuzzy';

describe('normalizeText', () => {
  it('lowercases and strips non-alphanumerics', () => {
    expect(normalizeText('Sp. Atk')).toBe('spatk');
    expect(normalizeText('Urshifu-Rapid-Strike')).toBe('urshifurapidstrike');
  });
});

describe('editDistance', () => {
  it('counts single-character edits', () => {
    expect(editDistance('focus', 'focus')).toBe(0);
    expect(editDistance('tocus', 'focus')).toBe(1);
    expect(editDistance('', 'abc')).toBe(3);
  });
});

describe('fuzzyBest', () => {
  const moves = ['Icicle Crash', 'Earthquake', 'Rock Tomb', 'Aqua Jet', 'Chilling Water'];

  it('snaps an OCR slip to the right move', () => {
    expect(fuzzyBest('Ciele=Crash', moves)?.value).toBe('Icicle Crash');
    expect(fuzzyBest('Aqua Jef', moves)?.value).toBe('Aqua Jet');
  });

  it('returns an exact match with score 0', () => {
    expect(fuzzyBest('Earthquake', moves)).toEqual({ value: 'Earthquake', score: 0 });
  });

  it('rejects readings that are too far from anything', () => {
    expect(fuzzyBest('Hydro Pump', moves)).toBeNull();
    expect(fuzzyBest('', moves)).toBeNull();
  });
});
