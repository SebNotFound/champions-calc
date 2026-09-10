import { describe, expect, it } from 'vitest';
import {
  listAbilities,
  listItems,
  listMoves,
  listSpeciesOptions,
  MEGAS,
  MEGA_ITEMS,
  NATURES,
} from '../champions';
import type { TypeName } from '../champions';
import { JAPANESE_ENGLISH_FALLBACKS } from './data/ja.english-fallbacks';
import { JAPANESE_NAMES } from './data/ja.generated';
import { JAPANESE_OVERRIDES } from './data/ja.overrides';
import type { GameNameCategory, JapaneseNameCatalog } from './types';

const catalogs: readonly JapaneseNameCatalog[] = [JAPANESE_OVERRIDES, JAPANESE_NAMES];

const gameTypes = [
  'Normal', 'Fighting', 'Flying', 'Poison', 'Ground', 'Rock',
  'Bug', 'Ghost', 'Steel', 'Fire', 'Water', 'Grass',
  'Electric', 'Psychic', 'Ice', 'Dragon', 'Dark', 'Fairy',
] as const satisfies readonly TypeName[];

function resolveJapanese(category: GameNameCategory, name: string): string | undefined {
  for (const catalog of catalogs) {
    const localized = catalog[category]?.[name];
    if (localized) return localized;
  }
  return undefined;
}

describe('Japanese game-name data', () => {
  it('contains known official names', () => {
    expect(resolveJapanese('species', 'Bulbasaur')).toBe('フシギダネ');
    expect(resolveJapanese('move', 'Earthquake')).toBe('じしん');
    expect(resolveJapanese('ability', 'Rough Skin')).toBe('さめはだ');
    expect(resolveJapanese('item', 'Life Orb')).toBe('いのちのたま');
    expect(resolveJapanese('item', 'Metal Alloy')).toBe('ふくごうきんぞく');
    expect(resolveJapanese('nature', 'Jolly')).toBe('ようき');
    expect(resolveJapanese('type', 'Fire')).toBe('ほのお');
    expect(resolveJapanese('move', 'G-Max Wildfire')).toBe('キョダイゴクエン');
    expect(resolveJapanese('move', 'Nihil Light')).toBe('無に帰す光');
  });

  it('contains reviewed Champions names', () => {
    expect(resolveJapanese('species', 'Eelektross-Mega')).toBe('メガシビルドン');
    expect(resolveJapanese('ability', 'Eelevate')).toBe('うなぎのぼり');
    expect(resolveJapanese('species', 'Pyroar-Mega')).toBe('メガカエンジシ');
    expect(resolveJapanese('ability', 'Fire Mane')).toBe('ほのおのたてがみ');
    expect(resolveJapanese('species', 'Lucario-Mega-Z')).toBe('メガルカリオＺ');
    expect(resolveJapanese('ability', 'Aura Guard')).toBe('はどうのぼうご');
    expect(resolveJapanese('ability', 'Dragonize')).toBe('ドラゴンスキン');
    expect(resolveJapanese('ability', 'Mega Sol')).toBe('メガソーラー');
    expect(resolveJapanese('ability', 'Piercing Drill')).toBe('かんつうドリル');
    expect(resolveJapanese('ability', 'Spicy Spray')).toBe('とびだすハバネロ');
  });

  it('accounts for every selectable canonical name', () => {
    const expected: Record<GameNameCategory, readonly string[]> = {
      species: listSpeciesOptions(),
      move: listMoves(),
      ability: [...new Set([...listAbilities(), ...MEGAS.map((mega) => mega.ability)])],
      item: [...listItems(), ...MEGA_ITEMS],
      nature: Object.keys(NATURES),
      type: gameTypes,
    };

    for (const category of Object.keys(expected) as GameNameCategory[]) {
      for (const name of expected[category]) {
        const localized = resolveJapanese(category, name);
        const allowed = Boolean(JAPANESE_ENGLISH_FALLBACKS[category]?.[name]);
        expect(Boolean(localized) || allowed, `${category}: ${name}`).toBe(true);
      }
    }
  });

  it('documents every English fallback', () => {
    for (const category of Object.values(JAPANESE_ENGLISH_FALLBACKS)) {
      for (const fallback of Object.values(category ?? {})) {
        expect(fallback.source).toMatch(/^https:\/\//);
        expect(fallback.reason.length).toBeGreaterThan(20);
      }
    }
  });
});
