# Japanese Localization Implementation Plan

> **For implementation:** Follow this plan task by task. Every step uses a checkbox so progress can be reviewed before moving on.

**Goal:** Add an optional Japanese interface and official Japanese game names to the current Exo Calc website while preserving canonical English calculator data.

**Architecture:** A web-only language provider owns the active locale and loads the Japanese resources as one local Vite chunk. UI components request localized text and display names at render time, while every selection is converted back to the existing canonical English value before it reaches application state, storage, imports, or the damage engine.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 4, PokeAPI development data, existing Exo Calc UI components.

**Spec:** `docs/superpowers/specs/2026-09-10-japanese-localization-design.md`

## Global Constraints

- Apply this feature only to the current website design.
- Keep English as the default. Do not infer a language from the browser or device.
- Keep `/classic.html`, the Windows overlay, and the Android overlay in English.
- Never copy the new website build into either overlay as part of this work.
- Keep canonical English values in calculator state, saved teams, imports, and damage calculations.
- Do not add a runtime dependency on PokeAPI or any other localization service.
- Use official Japanese names from PokeAPI or official Japanese Pokemon sources. Never invent a Japanese game name.
- Fall back to the canonical English name when no official Japanese name is available.
- Do not add Japanese OCR or change recognition behavior.
- Preserve the existing Google tag in `index.html` exactly.
- Preserve user-created team names exactly as entered.
- Show Seb the proposed files and changes before each implementation task. Wait for approval before editing.
- Show the complete relevant diff before each commit. Wait for approval before committing.
- Do not push without a separate explicit approval.
- Use Seb's configured Git identity and do not add co-author trailers.
- Write natural code and concise comments. Do not add long dash characters.

## File Map

### New localization files

- `src/i18n/types.ts`: shared locale, game-name catalog, and localized-option types.
- `src/i18n/ui.en.ts`: the complete English interface catalog.
- `src/i18n/ui.ja.ts`: the complete Japanese interface catalog.
- `src/i18n/messages.ts`: message lookup and parameter interpolation.
- `src/i18n/names.ts`: localized game-name display, reverse lookup, sorting, and option filtering.
- `src/i18n/ja-resources.ts`: Japanese messages and name maps exported as one lazy Vite chunk.
- `src/i18n/locale.ts`: local-storage and document-language helpers.
- `src/i18n/LanguageProvider.tsx`: React context, lazy resource loading, fallback, and overlay gate.
- `src/i18n/LanguageSwitcher.tsx`: compact `EN | 日本語` header control.
- `src/i18n/recognitionNotes.ts`: maps known photo-recognition notes to localized interface messages without changing recognition output.
- `src/i18n/index.ts`: the public localization exports used by UI components.
- `src/i18n/messages.test.ts`: catalog parity, interpolation, and fallback tests.
- `src/i18n/names.test.ts`: game-name display, lookup, alias, sorting, and coverage tests.
- `src/i18n/locale.test.ts`: persistence, document language, and overlay-selection tests.
- `src/i18n/recognitionNotes.test.ts`: known-note mapping and unknown-note fallback tests.
- `src/i18n/data/ja.generated.ts`: deterministic Japanese names imported from PokeAPI development data.
- `src/i18n/data/ja.overrides.ts`: reviewed Champions names and source-specific corrections.
- `src/i18n/data/ja.english-fallbacks.ts`: explicit names that have no published Japanese equivalent.
- `scripts/build-japanese-names.mjs`: repeatable local data refresh and coverage report.

### Existing files to modify

- `package.json`: add Japanese-data refresh and check scripts, with no new package dependency.
- `src/main.tsx:1-10`: mount the language provider.
- `src/App.tsx:265-697`: add the selector and localize the current website shell, modes, teams, battlefield, notices, and footer.
- `src/index.css:14-160`: add the Japanese system-font override.
- `src/App.css:19-60`: style the compact language selector and its loading or error state.
- `src/ui/widgets.tsx:68-220`: add structured localized options while preserving native English website behavior and existing overlay behavior.
- `src/ui/widgets.tsx:323-432`: localize move names, move categories, result states, and type labels.
- `src/ui/FieldControls.tsx:73-152`: localize weather, terrain, screens, and side controls.
- `src/ui/PokemonEditor.tsx:28-297`: localize searchable values, fixed selectors, card labels, and move metadata.
- `src/ui/StatSpreadEditor.tsx:56-126`: localize stat labels, points remaining, and modifier text.
- `src/ui/BattleState.tsx:12-54`: localize stat-stage controls.
- `src/ui/ArenaCard.tsx:46-126`: localize active names, damage headings, and empty states.
- `src/ui/ArenaRoster.tsx:20-111`: localize names, actions, and accessible text without changing drag behavior.
- `src/ui/DefenderCard.tsx:34-95`: localize target headings, editor summary, and damage hints.
- `src/ui/IncomingPanel.tsx:29-85`: localize names, heading, and incoming-damage hints.
- `src/ui/MatchupPreview.tsx:38-100`: localize names, accessible controls, and the empty state.
- `src/ui/TeamColumn.tsx:48-110`: localize displayed Pokemon names and team actions while preserving typed team names.
- `src/ui/TeamSlots.tsx:27-67`: localize team controls and import labels.
- `src/ui/ImportDialog.tsx:36-304`: localize the photo-import workflow and display localized Pokemon names.
- `src/ui/CropBox.tsx:30-124`: localize crop instructions and actions.
- `src/ui/PokepasteDialog.tsx:20-88`: localize import instructions, progress, and known errors.
- `src/ui/TeamReportDialog.tsx:28-172`: localize report-import controls and reviewed set names.

---

### Task 1: Typed Interface Catalogs

**Files:**

- Create: `src/i18n/types.ts`
- Create: `src/i18n/ui.en.ts`
- Create: `src/i18n/ui.ja.ts`
- Create: `src/i18n/messages.ts`
- Create: `src/i18n/messages.test.ts`

**Interfaces:**

- Produces: `Locale`, `GameNameCategory`, `JapaneseNameCatalog`, `JapaneseFallbackEntry`, `JapaneseFallbackCatalog`, `LocalizedOption`, `MessageParams`, `MessageKey`, `EN_MESSAGES`, `JA_MESSAGES`, and `getMessage(catalog, key, params)`.
- Consumers: every later localization task.

- [ ] **Step 1: Show the five proposed files and the Appendix A message matrix to Seb, then wait for approval.**

- [ ] **Step 2: Write the failing catalog tests.**

```ts
import { describe, expect, it } from 'vitest';
import { EN_MESSAGES } from './ui.en';
import { JA_MESSAGES } from './ui.ja';
import { getMessage } from './messages';

describe('interface messages', () => {
  it('keeps the English and Japanese catalogs in sync', () => {
    expect(Object.keys(JA_MESSAGES).sort()).toEqual(Object.keys(EN_MESSAGES).sort());
  });

  it('returns Japanese text when Japanese is active', () => {
    expect(getMessage(JA_MESSAGES, 'header.reset')).toBe('リセット');
  });

  it('fills named parameters without changing the source catalog', () => {
    expect(getMessage(JA_MESSAGES, 'stats.pointsLeft', { left: 12, total: 66 }))
      .toBe('残り 12 / 66');
    expect(EN_MESSAGES['stats.pointsLeft']).toBe('{left} / {total} left');
  });

  it('falls back to English when a loaded catalog has no entry', () => {
    expect(getMessage({}, 'header.reset')).toBe('Reset');
  });
});
```

- [ ] **Step 3: Run the focused test and confirm it fails because the modules do not exist.**

Run: `npx vitest run src/i18n/messages.test.ts`

Expected: FAIL with an unresolved `./ui.en` or `./messages` import.

- [ ] **Step 4: Add the shared types.**

```ts
export type Locale = 'en' | 'ja';
export type MessageParams = Readonly<Record<string, string | number>>;

export type GameNameCategory =
  | 'species'
  | 'move'
  | 'ability'
  | 'item'
  | 'nature'
  | 'type';

export type JapaneseNameCatalog = Readonly<
  Partial<Record<GameNameCategory, Readonly<Record<string, string>>>>
>;

export interface JapaneseFallbackEntry {
  source: string;
  reason: string;
}

export type JapaneseFallbackCatalog = Readonly<
  Partial<Record<GameNameCategory, Readonly<Record<string, JapaneseFallbackEntry>>>>
>;

export interface LocalizedOption {
  value: string;
  label: string;
  aliases: readonly string[];
}
```

- [ ] **Step 5: Add the complete English catalog using the keys and copy in Appendix A.**

The English catalog is the source of the key type:

```ts
export const EN_MESSAGES = {
  'header.reset': 'Reset',
  'stats.pointsLeft': '{left} / {total} left',
} as const;

export type MessageKey = keyof typeof EN_MESSAGES;
```

The actual file must contain every Appendix A key, not only the two shown above.

- [ ] **Step 6: Add the complete Japanese catalog using the same keys.**

```ts
import type { MessageKey } from './ui.en';

export const JA_MESSAGES = {
  'header.reset': 'リセット',
  'stats.pointsLeft': '残り {left} / {total}',
} as const satisfies Record<MessageKey, string>;
```

The actual file must contain every Appendix A key.

- [ ] **Step 7: Implement message lookup and interpolation.**

```ts
export type MessageCatalog = Readonly<Partial<Record<MessageKey, string>>>;

export function getMessage(
  catalog: MessageCatalog | undefined,
  key: MessageKey,
  params: MessageParams = {},
): string {
  const template = catalog?.[key] ?? EN_MESSAGES[key];
  return template.replace(/\{(\w+)\}/g, (token, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : token,
  );
}
```

`messages.ts` must import only `EN_MESSAGES`. Tests may import `JA_MESSAGES` directly, but application code must reach it only through the dynamic `ja-resources` import added in Task 4.

- [ ] **Step 8: Run the focused test.**

Run: `npx vitest run src/i18n/messages.test.ts`

Expected: PASS.

- [ ] **Step 9: Run the TypeScript and lint checks.**

Run: `npx tsc -b`

Run: `npm run lint`

Expected: both commands exit successfully.

- [ ] **Step 10: Show the complete task diff to Seb. After approval, commit only these five files.**

```powershell
git add -- src/i18n/types.ts src/i18n/ui.en.ts src/i18n/ui.ja.ts src/i18n/messages.ts src/i18n/messages.test.ts
git diff --cached --check
git commit -m "Add typed English and Japanese interface catalogs"
```

### Task 2: Japanese Game-Name Data

**Files:**

- Create: `scripts/build-japanese-names.mjs`
- Create: `src/i18n/data/ja.generated.ts`
- Create: `src/i18n/data/ja.overrides.ts`
- Create: `src/i18n/data/ja.english-fallbacks.ts`
- Create: `src/i18n/names.test.ts`
- Modify: `package.json:6-15`

**Interfaces:**

- Consumes: `GameNameCategory`, `JapaneseNameCatalog`, and `JapaneseFallbackCatalog` from Task 1, plus canonical names from `src/champions`.
- Produces: `JAPANESE_NAMES`, `JAPANESE_OVERRIDES`, and `JAPANESE_ENGLISH_FALLBACKS`.
- Consumers: Task 3 name lookup and all localized game controls.

- [ ] **Step 1: Show the source list, output format, and reviewed override strategy to Seb, then wait for approval.**

Use these fixed PokeAPI source files from the official repository:

```text
https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species_names.csv
https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_form_names.csv
https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/move_names.csv
https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/ability_names.csv
https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/item_names.csv
https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/nature_names.csv
https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/type_names.csv
```

Pair English language ID `9` with Japanese language ID `1`, which is PokeAPI's official `ja-hrkt` entry.

- [ ] **Step 2: Write failing representative and coverage tests.**

```ts
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
import { JAPANESE_NAMES } from './data/ja.generated';
import { JAPANESE_OVERRIDES } from './data/ja.overrides';
import { JAPANESE_ENGLISH_FALLBACKS } from './data/ja.english-fallbacks';
import type { GameNameCategory, JapaneseNameCatalog } from './types';

const catalogs: readonly JapaneseNameCatalog[] = [JAPANESE_OVERRIDES, JAPANESE_NAMES];
const resolved = (category: GameNameCategory, name: string) =>
  catalogs.find((catalog) => catalog[category]?.[name])?.[category]?.[name];

const GAME_TYPES = [
  'Normal', 'Fighting', 'Flying', 'Poison', 'Ground', 'Rock',
  'Bug', 'Ghost', 'Steel', 'Fire', 'Water', 'Grass',
  'Electric', 'Psychic', 'Ice', 'Dragon', 'Dark', 'Fairy',
] as const satisfies readonly TypeName[];

describe('Japanese game-name data', () => {
  it('contains known official names', () => {
    expect(resolved('species', 'Bulbasaur')).toBe('フシギダネ');
    expect(resolved('move', 'Earthquake')).toBe('じしん');
    expect(resolved('ability', 'Rough Skin')).toBe('さめはだ');
    expect(resolved('item', 'Life Orb')).toBe('いのちのたま');
    expect(resolved('nature', 'Jolly')).toBe('ようき');
    expect(resolved('type', 'Fire')).toBe('ほのお');
  });

  it('contains reviewed Champions names', () => {
    expect(resolved('species', 'Eelektross-Mega')).toBe('メガシビルドン');
    expect(resolved('ability', 'Eelevate')).toBe('うなぎのぼり');
    expect(resolved('species', 'Pyroar-Mega')).toBe('メガカエンジシ');
    expect(resolved('ability', 'Fire Mane')).toBe('ほのおのたてがみ');
    expect(resolved('species', 'Lucario-Mega-Z')).toBe('メガルカリオＺ');
    expect(resolved('ability', 'Aura Guard')).toBe('はどうのぼうご');
  });

  it('accounts for every selectable canonical name', () => {
    const expected: Record<GameNameCategory, readonly string[]> = {
      species: listSpeciesOptions(),
      move: listMoves(),
      ability: [...new Set([...listAbilities(), ...MEGAS.map((mega) => mega.ability)])],
      item: [...listItems(), ...MEGA_ITEMS],
      nature: Object.keys(NATURES),
      type: GAME_TYPES,
    };

    for (const category of Object.keys(expected) as GameNameCategory[]) {
      for (const name of expected[category]) {
        const localized = resolved(category, name);
        const allowed = Boolean(JAPANESE_ENGLISH_FALLBACKS[category]?.[name]);
        expect(Boolean(localized) || Boolean(allowed), `${category}: ${name}`).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 3: Run the test and confirm it fails because the catalogs do not exist.**

Run: `npx vitest run src/i18n/names.test.ts`

Expected: FAIL with an unresolved data-module import.

- [ ] **Step 4: Implement a dependency-free CSV reader in the refresh script.**

The parser must support commas inside quoted fields, doubled quote escaping, CRLF, LF, and UTF-8. Keep it inside the script because it is development-only code and no other module needs it.

- [ ] **Step 5: Pair names by resource ID and select only language IDs 9 and 1.**

For each category, build `resourceId -> { en, ja }`, then key the output by the exact English display name. Normalize English punctuation only for matching against `@pkmn` names. Preserve the Japanese string exactly as published.

- [ ] **Step 6: Resolve Pokemon forms without inventing names.**

Use this order:

1. Exact Japanese full form name from `pokemon_form_names.csv` when present.
2. Official Japanese base species plus the published Japanese form name in full-width parentheses.
3. For Mega Evolutions, official `メガ` prefix plus the base name and an official full-width `Ｘ`, `Ｙ`, or `Ｚ` suffix where applicable.
4. A reviewed entry in `ja.overrides.ts` sourced from the official Japanese Pokemon Pokédex.
5. Canonical English fallback only when the value is listed with a reason in `ja.english-fallbacks.ts`.

- [ ] **Step 7: Add the reviewed Champions overrides.**

The initial required entries include:

```ts
export const JAPANESE_OVERRIDES = {
  species: {
    'Absol-Mega-Z': 'メガアブソルＺ',
    'Eelektross-Mega': 'メガシビルドン',
    'Garchomp-Mega-Z': 'メガガブリアスＺ',
    'Lucario-Mega-Z': 'メガルカリオＺ',
    'Pyroar-Mega': 'メガカエンジシ',
  },
  ability: {
    'Aura Guard': 'はどうのぼうご',
    Eelevate: 'うなぎのぼり',
    'Fire Mane': 'ほのおのたてがみ',
  },
} as const;
```

For every other unmatched Champions Mega or exclusive ability, consult its entry on `https://zukan.pokemon.co.jp/`. Add the observed Japanese name to the override file. If the official entry does not publish a name, add the canonical English value to the fallback allowlist with the source URL and a short reason. Do not derive a new Japanese word from the English name.

Store fallbacks by category and canonical name so each exception carries its evidence:

```ts
import type { JapaneseFallbackCatalog } from '../types';

export const JAPANESE_ENGLISH_FALLBACKS: JapaneseFallbackCatalog = {};
```

Add an entry only after confirming that the canonical name has no published Japanese equivalent. Each real entry must include its source URL and the reason English remains visible.

- [ ] **Step 8: Make output deterministic and add check mode.**

Sort categories and canonical keys with a fixed English comparator. Write valid TypeScript using `JSON.stringify(value, null, 2)`. `--check` must generate in memory, compare with `ja.generated.ts`, print a concise mismatch, and exit with code 1 without writing.

- [ ] **Step 9: Add package scripts.**

```json
"i18n:ja": "node scripts/build-japanese-names.mjs",
"i18n:ja:check": "node scripts/build-japanese-names.mjs --check"
```

- [ ] **Step 10: Run the refresh script, review every fallback, and run check mode.**

Run: `npm run i18n:ja`

Run: `npm run i18n:ja:check`

Expected: both commands exit successfully, and check mode reports that the committed catalog is current.

- [ ] **Step 11: Run focused tests, TypeScript, and lint.**

Run: `npx vitest run src/i18n/names.test.ts`

Run: `npx tsc -b`

Run: `npm run lint`

Expected: all commands exit successfully.

- [ ] **Step 12: Show the generated diff, override sources, and fallback allowlist to Seb. After approval, commit only Task 2 files.**

```powershell
git add -- package.json scripts/build-japanese-names.mjs src/i18n/data/ja.generated.ts src/i18n/data/ja.overrides.ts src/i18n/data/ja.english-fallbacks.ts src/i18n/names.test.ts
git diff --cached --check
git commit -m "Add official Japanese game names"
```

### Task 3: Canonical Name Lookup and Localized Options

**Files:**

- Create: `src/i18n/names.ts`
- Create: `src/i18n/ja-resources.ts`
- Create: `src/i18n/index.ts`
- Modify: `src/i18n/names.test.ts`

**Interfaces:**

- Consumes: Task 1 messages and Task 2 name maps.
- Produces:

```ts
export function displayGameName(category: GameNameCategory, canonical: string, locale: Locale, catalog?: JapaneseNameCatalog): string;
export function resolveGameName(category: GameNameCategory, input: string, locale: Locale, catalog?: JapaneseNameCatalog): string | undefined;
export function buildLocalizedOptions(category: GameNameCategory, values: readonly string[], locale: Locale, catalog?: JapaneseNameCatalog): LocalizedOption[];
export function filterLocalizedOptions(options: readonly LocalizedOption[], query: string, limit?: number): LocalizedOption[];
export function mergeJapaneseNames(...catalogs: readonly JapaneseNameCatalog[]): JapaneseNameCatalog;
```

- [ ] **Step 1: Show the proposed lookup behavior and exact public interfaces to Seb, then wait for approval.**

- [ ] **Step 2: Extend the failing tests for canonical separation.**

```ts
import {
  buildLocalizedOptions,
  displayGameName,
  filterLocalizedOptions,
  mergeJapaneseNames,
  resolveGameName,
} from './names';

const japaneseCatalog = mergeJapaneseNames(JAPANESE_NAMES, JAPANESE_OVERRIDES);

describe('localized name lookup', () => {
  it('displays Japanese without changing the canonical value', () => {
    expect(displayGameName('move', 'Earthquake', 'ja', japaneseCatalog)).toBe('じしん');
    expect(resolveGameName('move', 'じしん', 'ja', japaneseCatalog)).toBe('Earthquake');
  });

  it('accepts English while Japanese is active', () => {
    expect(resolveGameName('species', 'garchomp', 'ja', japaneseCatalog)).toBe('Garchomp');
  });

  it('normalizes full-width Unicode', () => {
    expect(resolveGameName('species', 'メガリザードンX', 'ja', japaneseCatalog))
      .toBe('Charizard-Mega-X');
  });

  it('falls back to canonical English when Japanese is unavailable', () => {
    expect(displayGameName('species', 'Unpublished Form', 'ja')).toBe('Unpublished Form');
  });

  it('finds Japanese and English aliases in the same menu', () => {
    const options = buildLocalizedOptions(
      'move',
      ['Earthquake', 'Earth Power'],
      'ja',
      japaneseCatalog,
    );
    expect(filterLocalizedOptions(options, 'じし')[0]?.value).toBe('Earthquake');
    expect(filterLocalizedOptions(options, 'earth').map((entry) => entry.value))
      .toEqual(expect.arrayContaining(['Earth Power', 'Earthquake']));
  });
});
```

- [ ] **Step 3: Run the focused test and confirm the new assertions fail.**

Run: `npx vitest run src/i18n/names.test.ts`

Expected: FAIL because the lookup functions do not exist.

- [ ] **Step 4: Implement normalized, category-scoped lookup.**

Use `String.prototype.normalize('NFKC')`, trim surrounding whitespace, collapse repeated spaces, and lowercase Latin text. Build reverse maps once per category and catalog object. Do not scan all names on every keystroke.

- [ ] **Step 5: Build stable localized options.**

Each option keeps its canonical `value`, localized `label`, and both Japanese and English searchable aliases. Sort Japanese labels with `new Intl.Collator('ja')`, then use the canonical value as a deterministic tie-breaker.

- [ ] **Step 6: Export Japanese resources as one lazy-loadable module.**

```ts
export const JA_RESOURCES = {
  messages: JA_MESSAGES,
  names: mergeJapaneseNames(JAPANESE_NAMES, JAPANESE_OVERRIDES),
} as const;
```

Do not import `ja-resources.ts` statically from `main.tsx`, `App.tsx`, or the provider. It must remain behind a dynamic import in Task 4.

`messages.ts`, `names.ts`, and `index.ts` must also avoid static imports of `ui.ja.ts`, `ja.generated.ts`, `ja.overrides.ts`, or `ja-resources.ts`. This keeps every Japanese catalog inside the lazy chunk.

- [ ] **Step 7: Run the focused tests and static checks.**

Run: `npx vitest run src/i18n/names.test.ts src/i18n/messages.test.ts`

Run: `npx tsc -b`

Run: `npm run lint`

Expected: all commands exit successfully.

- [ ] **Step 8: Show the complete task diff to Seb. After approval, commit only Task 3 files.**

```powershell
git add -- src/i18n/names.ts src/i18n/ja-resources.ts src/i18n/index.ts src/i18n/names.test.ts
git diff --cached --check
git commit -m "Add canonical Japanese name lookup"
```

### Task 4: Web Language Provider and Header Selector

**Files:**

- Create: `src/i18n/locale.ts`
- Create: `src/i18n/locale.test.ts`
- Create: `src/i18n/LanguageProvider.tsx`
- Create: `src/i18n/LanguageSwitcher.tsx`
- Modify: `src/i18n/index.ts`
- Modify: `src/main.tsx:1-10`
- Modify: `src/App.tsx:396-452`
- Modify: `src/index.css:14-20`
- Modify: `src/App.css:19-60`

**Interfaces:**

- Consumes: Task 1 message functions, Task 3 name helpers, and `isOverlay()` from `src/ui/tauri.tsx`.
- Produces:

```ts
export interface LanguageContextValue {
  locale: Locale;
  loading: boolean;
  error: string | null;
  setLocale: (locale: Locale) => Promise<void>;
  text: (key: MessageKey, params?: MessageParams) => string;
  name: (category: GameNameCategory, canonical: string) => string;
  options: (category: GameNameCategory, values: readonly string[]) => LocalizedOption[];
  resolveName: (category: GameNameCategory, input: string) => string | undefined;
}

export function useLanguage(): LanguageContextValue;
```

- [ ] **Step 1: Show the provider state flow and selector placement to Seb, then wait for approval.**

Place the selector in `.header-right`, between Reset and the theme button. Do not move the centered Classic and Battle Arena control.

- [ ] **Step 2: Write failing tests for stored preference and overlay rules.**

```ts
import { describe, expect, it } from 'vitest';
import { applyDocumentLocale, readInitialLocale, writeStoredLocale } from './locale';

describe('locale preference', () => {
  it('defaults to English and restores Japanese only on the website', () => {
    const storage = { getItem: () => 'ja' };
    expect(readInitialLocale(storage, false)).toBe('ja');
    expect(readInitialLocale(storage, true)).toBe('en');
    expect(readInitialLocale({ getItem: () => null }, false)).toBe('en');
  });

  it('persists the exact supported locale', () => {
    const writes: Array<[string, string]> = [];
    writeStoredLocale({ setItem: (key, value) => writes.push([key, value]) }, 'ja');
    expect(writes).toEqual([['champions-calc/language', 'ja']]);
  });

  it('updates the document language', () => {
    const root = { lang: 'en' };
    applyDocumentLocale(root, 'ja');
    expect(root.lang).toBe('ja');
  });
});
```

- [ ] **Step 3: Run the test and confirm it fails because `locale.ts` does not exist.**

Run: `npx vitest run src/i18n/locale.test.ts`

Expected: FAIL with an unresolved import.

- [ ] **Step 4: Implement safe preference helpers.**

Read only `en` or `ja`. Catch storage access errors. `readInitialLocale(storage, overlay)` must always return `en` when `overlay` is true. `applyDocumentLocale` only assigns the root element's `lang` property.

- [ ] **Step 5: Implement the provider with atomic lazy loading.**

When Japanese is requested, call `import('./ja-resources')`. Keep English active while loading. On success, install the Japanese messages and name map together, set `document.documentElement.lang` to `ja`, save `ja`, and clear any error. On failure, keep English active, set `lang` to `en`, and expose `language.loadFailed` once.

The `text` callback passes the currently installed message catalog to `getMessage(catalog, key, params)`. English uses `undefined`, which selects `EN_MESSAGES`. The provider must never import `JA_MESSAGES` directly.

On an initial visit with a saved Japanese preference, start the same load in an effect. Do not save Japanese until the chunk loads successfully.

- [ ] **Step 6: Force overlay sessions to English.**

Call `isOverlay()` once for environment gating. Overlay sessions must not load the Japanese chunk, must not read or overwrite the website preference, and must keep `lang="en"`.

- [ ] **Step 7: Mount the provider in `src/main.tsx`.**

```tsx
<StrictMode>
  <LanguageProvider>
    <App />
  </LanguageProvider>
</StrictMode>
```

- [ ] **Step 8: Add the compact selector to the website header.**

Render two buttons labelled `EN` and `日本語`. Use `aria-pressed`, an accessible group label, a loading-disabled state, and the existing header visual language. Return `null` from `LanguageSwitcher` in an overlay environment.

- [ ] **Step 9: Localize only the header shell in this task.**

Replace Classic, Battle Arena, Reset, the layout label, reset tooltip, theme tooltip, and language accessibility text with `text(...)`. Leave all other body copy for Tasks 6 to 8.

- [ ] **Step 10: Add exact selector and Japanese font styles.**

```css
html[lang='ja'] {
  --font-display: 'Noto Sans JP', 'Yu Gothic', 'Hiragino Kaku Gothic ProN', system-ui, sans-serif;
  --font-body: 'Noto Sans JP', 'Yu Gothic', 'Hiragino Kaku Gothic ProN', system-ui, sans-serif;
}

.language-switch {
  display: flex;
  padding: 3px;
  border-radius: 10px;
  background: var(--panel-3);
}

.language-switch button {
  min-width: 34px;
  min-height: 30px;
  padding: 4px 7px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-dim);
  font-size: 11px;
  font-weight: 900;
}

.language-switch button.active {
  background: var(--ally);
  color: var(--active-ink);
}

@media (max-width: 560px) {
  .language-switch button { min-width: 31px; padding-inline: 5px; }
}
```

- [ ] **Step 11: Run the focused tests, full tests, and build.**

Run: `npx vitest run src/i18n/locale.test.ts src/i18n/messages.test.ts src/i18n/names.test.ts`

Run: `npm test`

Run: `npm run build`

Expected: all commands pass. The Vite output must contain a separate `ja-resources` JavaScript chunk.

- [ ] **Step 12: Confirm `index.html` and its Google tag have no diff.**

Run: `git diff -- index.html`

Expected: no output.

- [ ] **Step 13: Show the complete task diff and a desktop plus mobile header preview to Seb. After approval, commit only Task 4 files.**

```powershell
git add -- src/i18n/locale.ts src/i18n/locale.test.ts src/i18n/LanguageProvider.tsx src/i18n/LanguageSwitcher.tsx src/i18n/index.ts src/main.tsx src/App.tsx src/index.css src/App.css
git diff --cached --check
git commit -m "Add the website language selector"
```

### Task 5: Japanese Search With Canonical Values

**Files:**

- Modify: `src/ui/widgets.tsx:68-220`
- Modify: `src/ui/PokemonEditor.tsx:28-55, 103-117, 216-240, 272-281`
- Modify: `src/ui/ImportDialog.tsx:146-152, 213-224`
- Modify: `src/i18n/names.test.ts`

**Interfaces:**

- Consumes: `LocalizedOption`, `useLanguage()`, and Task 3 filtering and resolution helpers.
- Extends `ComboboxProps` with `category: 'species' | 'move' | 'item'` for localized searchable fields.
- Adds: `resolveLocalizedDraft(options: readonly LocalizedOption[], input: string): string | undefined`.
- Preserves: existing English native datalists and existing English custom overlay menus.

- [ ] **Step 1: Show the three Combobox execution paths and all affected call sites to Seb, then wait for approval.**

The paths are:

1. English website: current native datalist.
2. English overlay: current custom menu.
3. Japanese website: localized custom menu that displays Japanese and emits canonical English.

- [ ] **Step 2: Add failing tests for draft resolution.**

```ts
it('commits an exact Japanese draft as the canonical value', () => {
  const options = buildLocalizedOptions('item', ['Life Orb'], 'ja', japaneseCatalog);
  expect(resolveLocalizedDraft(options, 'いのちのたま')).toBe('Life Orb');
});

it('rejects an unknown draft instead of replacing a valid value', () => {
  const options = buildLocalizedOptions('move', ['Earthquake'], 'ja', japaneseCatalog);
  expect(resolveLocalizedDraft(options, 'unknown')).toBeUndefined();
});
```

- [ ] **Step 3: Run the focused test and confirm the new assertions fail.**

Run: `npx vitest run src/i18n/names.test.ts`

Expected: FAIL because `resolveLocalizedDraft` does not exist.

- [ ] **Step 4: Add `resolveLocalizedDraft` to `src/i18n/names.ts`.**

It must accept exact Japanese labels and canonical English aliases after NFKC normalization. Partial text returns `undefined`.

- [ ] **Step 5: Add a Japanese custom Combobox path.**

Maintain a local `draft` string separate from the canonical `value`. Synchronize it from `name(category, value)` when the canonical value or locale changes. Filtering uses structured options. Selecting an option calls `onChange(option.value)`. Enter and blur commit only an exact match; otherwise they restore the localized label for the last valid canonical value.

- [ ] **Step 6: Preserve current English and overlay behavior byte for byte where practical.**

Do not change `ComboboxNative` behavior. Do not route an English overlay through the Japanese draft logic. Keep the fixed-position portal, scroll tracking, touch selection, keyboard arrows, Enter, and Escape.

- [ ] **Step 7: Mark every searchable field with its category.**

Use `species` for the Pokemon header and manual photo-import field, `move` for all four move inputs, and `item` for the held-item input. The per-species move datalist still supplies its canonical values.

- [ ] **Step 8: Confirm canonical state with a focused manual check.**

In Japanese mode, select `じしん`, `いのちのたま`, and `メガガブリアス`. Inspect the current set in React state or temporarily through the existing editor callbacks. The values reaching callbacks must be `Earthquake`, `Life Orb`, and `Garchomp-Mega` respectively. Remove any temporary inspection before review.

- [ ] **Step 9: Run tests and build.**

Run: `npx vitest run src/i18n/names.test.ts`

Run: `npm test`

Run: `npm run build`

Expected: all commands pass.

- [ ] **Step 10: Show the diff and a short Japanese search demonstration to Seb. After approval, commit only Task 5 files.**

```powershell
git add -- src/i18n/names.ts src/i18n/names.test.ts src/ui/widgets.tsx src/ui/PokemonEditor.tsx src/ui/ImportDialog.tsx
git diff --cached --check
git commit -m "Add Japanese search with canonical values"
```

### Task 6: Pokemon Editors and Battlefield Controls

**Files:**

- Modify: `src/ui/widgets.tsx:323-432`
- Modify: `src/ui/FieldControls.tsx:73-152`
- Modify: `src/ui/PokemonEditor.tsx:60-297`
- Modify: `src/ui/StatSpreadEditor.tsx:56-126`
- Modify: `src/ui/BattleState.tsx:12-54`
- Modify: `src/App.tsx:265-331, 454-461, 523-528`
- Modify: `src/i18n/messages.test.ts`

**Interfaces:**

- Consumes: `useLanguage().text`, `name`, and `options`.
- Preserves: all canonical values passed to `Select`, `PokemonEditor.patch`, field state, stat calculations, and `calcOne`.

- [ ] **Step 1: Show the proposed editor, field, stat, and result labels to Seb using Appendix A, then wait for approval.**

- [ ] **Step 2: Add failing catalog assertions for every group used in this task.**

```ts
it('contains the battle-editor copy', () => {
  expect(getMessage(JA_MESSAGES, 'pokemon.nature')).toBe('性格');
  expect(getMessage(JA_MESSAGES, 'field.weather.sun')).toBe('晴れ');
  expect(getMessage(JA_MESSAGES, 'move.category.physical')).toBe('物理');
  expect(getMessage(JA_MESSAGES, 'stats.battleBoosts')).toBe('能力変化');
});
```

- [ ] **Step 3: Localize fixed selectors without changing their values.**

Nature option values remain `NatureName`. Ability option values remain canonical English ability names. Status values remain `brn`, `par`, `psn`, `tox`, `slp`, and `frz`. Weather and terrain values remain their current English unions.

- [ ] **Step 4: Display localized nature effects at the UI boundary.**

Use `NATURES[nature].plus` and `.minus` with localized stat labels. Neutral natures show `補正なし`. Do not change `describeNature()` in `src/champions/stats.ts`.

- [ ] **Step 5: Localize displayed game names.**

Use `name('ability', ability)`, `name('type', type)`, and the localized move option path. `TypeBadge` must continue receiving the canonical type for color and icon selection while rendering the localized type text.

- [ ] **Step 6: Localize result rows without changing damage parsing.**

Keep `koChance` detection based on the current English engine output. Display `確1` for OHKO, `確{count}` for other fixed hit counts, `耐久` for the current safe state, and `変化` for a zero-damage status move. Keep percent numbers unchanged.

- [ ] **Step 7: Localize field controls and side conditions.**

Map Weather, Terrain, None, Sun, Rain, Sand, Snow, Electric, Grassy, Psychic, Misty, Helping Hand, Reflect, Light Screen, and Aurora Veil through Appendix A. Keep every `FieldState` value unchanged.

- [ ] **Step 8: Localize stats and battle boosts.**

Keep canonical stat keys. Display HP, 攻撃, 防御, 特攻, 特防, and 素早さ. Localize points remaining, stage tooltips, modifier titles, raise and lower accessibility labels, and the Battle Boosts heading.

- [ ] **Step 9: Run focused and complete checks.**

Run: `npx vitest run src/i18n/messages.test.ts src/i18n/names.test.ts`

Run: `npm test`

Run: `npm run build`

Expected: all commands pass and English damage outputs are numerically identical before and after switching locale.

- [ ] **Step 10: Show the task diff plus one English and one Japanese Pokemon card to Seb. After approval, commit only Task 6 files.**

```powershell
git add -- src/App.tsx src/ui/widgets.tsx src/ui/FieldControls.tsx src/ui/PokemonEditor.tsx src/ui/StatSpreadEditor.tsx src/ui/BattleState.tsx src/i18n/messages.test.ts
git diff --cached --check
git commit -m "Localize Pokemon editors and battlefield controls"
```

### Task 7: Teams, Arena, and Damage Panels

**Files:**

- Modify: `src/App.tsx:265-383, 468-606, 654-675`
- Modify: `src/ui/ArenaCard.tsx:46-126`
- Modify: `src/ui/ArenaRoster.tsx:20-111`
- Modify: `src/ui/DefenderCard.tsx:34-95`
- Modify: `src/ui/IncomingPanel.tsx:29-85`
- Modify: `src/ui/MatchupPreview.tsx:38-100`
- Modify: `src/ui/TeamColumn.tsx:48-110`
- Modify: `src/ui/TeamSlots.tsx:27-67`
- Modify: `src/i18n/messages.test.ts`

**Interfaces:**

- Consumes: localization context only.
- Preserves: team names, member ordering, drag payloads, active indices, hover behavior, imports, and damage inputs.

- [ ] **Step 1: Show all proposed team, Arena, and result copy to Seb using Appendix A, then wait for approval.**

- [ ] **Step 2: Add failing assertions for team and Arena message groups.**

```ts
it('contains team and Arena copy', () => {
  expect(getMessage(JA_MESSAGES, 'team.myTeam')).toBe('自分のチーム');
  expect(getMessage(JA_MESSAGES, 'team.enemyTeam')).toBe('相手のチーム');
  expect(getMessage(JA_MESSAGES, 'result.incomingFrom')).toBe('受けるダメージ');
  expect(getMessage(JA_MESSAGES, 'arena.turnSideways')).toBe('端末を横向きにしてください');
});
```

- [ ] **Step 3: Localize team controls while preserving typed names.**

Do not pass `team.name` through localization. Only localize empty fallback labels, action labels, tooltips, import controls, add buttons, and remove buttons.

- [ ] **Step 4: Localize every displayed Pokemon name.**

Use `name('species', set.megaForme ?? set.species)` in team chips, Arena tiles, target headings, incoming tabs, matchup previews, and accessible labels. Keep sprite and calculation props canonical.

Replace `shortName` with a display-safe function that truncates by Unicode code points, not UTF-16 code units. Japanese names up to eight visible characters remain intact.

- [ ] **Step 5: Localize Arena and damage headings.**

Cover My Team, Enemy Team, Your side, Enemy side, Attacker, Target, Your slot, Battlefield, Incoming, Incoming from, Damage from, More targets, and every empty or add-move hint.

- [ ] **Step 6: Preserve interaction behavior.**

Do not change `draggable`, `onDragStart`, `dataTransfer`, `onDrop`, `onActivate`, `onSwap`, tab indexes, or card collapse rules. Language switching must cause display rerenders only.

- [ ] **Step 7: Localize the portrait rotation gate.**

Use the Appendix A title, explanation, and Classic-mode action. Keep its existing media query and website-only behavior.

- [ ] **Step 8: Run focused tests, full tests, and build.**

Run: `npx vitest run src/i18n/messages.test.ts src/i18n/names.test.ts`

Run: `npm test`

Run: `npm run build`

Expected: all commands pass.

- [ ] **Step 9: Manually verify drag and drop in both languages.**

In Battle Arena, drag a member from My Team to each active card, then repeat for Enemy Team. Confirm active slots and damage panels update exactly as in English. Repeat one bench-to-front swap in Classic mode.

- [ ] **Step 10: Show the task diff and both desktop modes in Japanese to Seb. After approval, commit only Task 7 files.**

```powershell
git add -- src/App.tsx src/ui/ArenaCard.tsx src/ui/ArenaRoster.tsx src/ui/DefenderCard.tsx src/ui/IncomingPanel.tsx src/ui/MatchupPreview.tsx src/ui/TeamColumn.tsx src/ui/TeamSlots.tsx src/i18n/messages.test.ts
git diff --cached --check
git commit -m "Localize teams and battle views"
```

### Task 8: Imports, Notices, and Footer

**Files:**

- Create: `src/i18n/recognitionNotes.ts`
- Create: `src/i18n/recognitionNotes.test.ts`
- Modify: `src/App.tsx:608-651, 677-697`
- Modify: `src/ui/ImportDialog.tsx:36-304`
- Modify: `src/ui/CropBox.tsx:30-124`
- Modify: `src/ui/PokepasteDialog.tsx:20-88`
- Modify: `src/ui/TeamReportDialog.tsx:28-172`
- Modify: `src/i18n/messages.test.ts`

**Interfaces:**

- Consumes: `useLanguage()`, localized game-name display, and existing canonical recognition results.
- Produces:

```ts
export type TextLookup = (key: MessageKey, params?: MessageParams) => string;
export function localizeRecognitionNote(note: string, text: TextLookup): string;
```

- Preserves: import payloads, parsed team data, uploaded files, OCR language, external links, and local-storage keys unrelated to language.

- [ ] **Step 1: Show the proposed dialog, notice, and footer copy to Seb using Appendix A, then wait for approval.**

- [ ] **Step 2: Write failing tests for known recognition notes.**

```ts
import { describe, expect, it } from 'vitest';
import { getMessage } from './messages';
import { localizeRecognitionNote } from './recognitionNotes';
import type { MessageParams } from './types';
import type { MessageKey } from './ui.en';
import { JA_MESSAGES } from './ui.ja';

describe('recognition notes', () => {
  it('localizes known on-device guidance', () => {
    const text = (key: MessageKey, params?: MessageParams) =>
      getMessage(JA_MESSAGES, key, params);
    expect(localizeRecognitionNote('Could not find the red enemy panels', text))
      .toBe('相手側の赤いパネルを見つけられませんでした。範囲を手動で選択するか、高精度モードを試してください。');
  });

  it('keeps unknown diagnostic text intact', () => {
    const text = (key: MessageKey, params?: MessageParams) =>
      getMessage(JA_MESSAGES, key, params);
    expect(localizeRecognitionNote('Unexpected camera note', text))
      .toBe('Unexpected camera note');
  });
});
```

- [ ] **Step 3: Run the focused test and confirm it fails because the note mapper does not exist.**

Run: `npx vitest run src/i18n/recognitionNotes.test.ts`

Expected: FAIL with an unresolved import.

- [ ] **Step 4: Implement known-note localization at the UI boundary.**

Match stable subject phrases for the blue-side limitation, missing red panels, low confidence, no match, and crop-too-small cases. Return the original string for an unknown note. Do not modify recognition classes or result types.

- [ ] **Step 5: Localize photo import.**

Localize titles, side labels, engine labels, review text, detected names, best guesses, manual add controls, dropzone instructions, crop actions, progress, buttons, and known errors. Recognition results and the final `species: string[]` callback stay canonical.

- [ ] **Step 6: Localize text and report imports.**

Localize headings, instructions, known errors, progress, buttons, reviewed species, nature, item, and move names. Keep Showdown and pokepast.es input in its current English syntax. When Japanese is active, show `report.japaneseOcrUnavailable` before the screenshot areas.

- [ ] **Step 7: Use neutral visible names for optional precision modes.**

Use `Precise · API` in English and `高精度 · API` in Japanese. Use `API key (kept in your browser)` and `APIキー（ブラウザ内に保存）` for the field. Do not rename internal recognizer classes, stored mode values, or storage keys in this task.

- [ ] **Step 8: Localize the classic-design notice and footer.**

Keep all URLs and proper names unchanged. Localize surrounding sentences and button labels. Closing the notice and choosing not to show it again must retain their existing storage behavior.

- [ ] **Step 9: Run focused and complete checks.**

Run: `npx vitest run src/i18n/recognitionNotes.test.ts src/i18n/messages.test.ts src/i18n/names.test.ts`

Run: `npm test`

Run: `npm run build`

Expected: all commands pass.

- [ ] **Step 10: Show the complete task diff and each localized dialog to Seb. After approval, commit only Task 8 files.**

```powershell
git add -- src/App.tsx src/ui/ImportDialog.tsx src/ui/CropBox.tsx src/ui/PokepasteDialog.tsx src/ui/TeamReportDialog.tsx src/i18n/recognitionNotes.ts src/i18n/recognitionNotes.test.ts src/i18n/messages.test.ts
git diff --cached --check
git commit -m "Localize imports and supporting website copy"
```

### Task 9: Final Website Verification

**Files:**

- Verify: all files changed in Tasks 1 to 8.
- Do not modify: `index.html`, `public/classic/**`, `overlay/**`, or `android/**`.

**Interfaces:**

- Verifies the complete feature against the design specification.
- Produces no additional code unless Seb first approves a separately shown correction.

- [ ] **Step 1: Run the Japanese data check.**

Run: `npm run i18n:ja:check`

Expected: the static catalog matches the source and reviewed overrides.

- [ ] **Step 2: Run all automated checks.**

Run: `npx tsc -b`

Run: `npm run lint`

Run: `npm test`

Run: `npm run build`

Expected: every command exits successfully with no test failures.

- [ ] **Step 3: Verify lazy loading and the English default.**

Open a fresh browser profile at the local production preview. Confirm the first render is English and no Japanese resource request occurs until `日本語` is selected. After selection, confirm one local `ja-resources` chunk loads and no PokeAPI request occurs.

- [ ] **Step 4: Verify persistence and canonical state.**

Select Japanese, configure a Pokemon, reload, and confirm Japanese remains active. Export or inspect the saved state and confirm species, moves, abilities, items, natures, weather, and terrain remain canonical English values. Switch back to English and confirm the same set and damage numbers remain.

- [ ] **Step 5: Verify both themes and both current modes at desktop size.**

Use a 1920 by 1080 viewport at browser zoom 100 percent. Check Classic and Battle Arena in light and dark themes. Verify headers, selectors, Pokemon cards, damage rows, team bars, dialogs, and the footer do not clip Japanese text.

- [ ] **Step 6: Verify the current website at phone widths.**

Use 390 by 844 portrait and 844 by 390 landscape viewports at browser zoom 100 percent. Check the header selector, Classic team grid, Pokemon editor, import dialogs, rotation gate, and landscape Battle Arena. Confirm no desktop layout changed.

- [ ] **Step 7: Verify overlay isolation through environment tests.**

Run the locale tests with overlay flags set to true. Confirm the resolved locale is English, the Japanese chunk loader is not called, and the selector returns no markup. Do not rebuild or replace either installed overlay.

- [ ] **Step 8: Verify protected files and unrelated folders.**

Run: `git diff 86f54bc -- index.html public/classic`

Run: `git status --short --untracked-files=all -- Redesign android overlay`

Expected: the first command has no output. The second command matches the status recorded before Task 1, confirming that the pre-existing untracked `Redesign`, `android`, and `overlay` directories were not touched.

- [ ] **Step 9: Scan new and modified localization work for unfinished text and long dash characters.**

Run: `git diff --unified=0 86f54bc -- src/i18n scripts/build-japanese-names.mjs src/App.tsx src/ui src/App.css src/index.css | rg --pcre2 '^\+(?!\+\+).*(TBD|TODO|FIXME|\x{2013}|\x{2014})'`

Expected: no output. This scans only added lines, so unrelated text that existed before the localization work cannot create a false result.

- [ ] **Step 10: Show Seb the final diff, test results, and desktop plus mobile previews. Wait for explicit approval before any final commit or push.**

## Appendix A: Interface Copy Matrix

Use these exact keys and values in Task 1. Proper names such as EXO, Showdown, pokepast.es, partywhale, Ko-fi, and `@smogon/calc` remain unchanged.

| Key | English | Japanese |
| --- | --- | --- |
| `common.add` | Add | 追加 |
| `common.back` | Back | 戻る |
| `common.cancel` | Cancel | キャンセル |
| `common.close` | Close | 閉じる |
| `common.delete` | Delete | 削除 |
| `common.detect` | Detect | 検出 |
| `common.detecting` | Detecting... | 検出中... |
| `common.fetching` | Fetching... | 取得中... |
| `common.import` | Import | 読み込む |
| `common.none` | None | なし |
| `common.reading` | Reading... | 読み取り中... |
| `common.remove` | Remove | 削除 |
| `header.title` | Champions Damage Calculator | ポケモンチャンピオンズ ダメージ計算 |
| `header.layout` | Layout | 表示モード |
| `header.classic` | Classic | クラシック |
| `header.battleArena` | Battle Arena | バトルアリーナ |
| `header.reset` | Reset | リセット |
| `header.resetTitle` | Clear weather, terrain, screens, statuses and boosts | 天気、フィールド、壁、状態異常、能力変化をリセット |
| `header.theme` | Toggle light / dark | ライト / ダーク切替 |
| `header.language` | Language | 言語 |
| `language.loadFailed` | Japanese could not be loaded. English remains active. | 日本語データを読み込めませんでした。英語表示を継続します。 |
| `field.battlefield` | Battlefield | バトルフィールド |
| `field.weather` | Weather | 天気 |
| `field.terrain` | Terrain | フィールド |
| `field.weather.sun` | Sun | 晴れ |
| `field.weather.rain` | Rain | 雨 |
| `field.weather.sand` | Sand | 砂あらし |
| `field.weather.snow` | Snow | 雪 |
| `field.terrain.electric` | Electric | エレキフィールド |
| `field.terrain.grassy` | Grassy | グラスフィールド |
| `field.terrain.psychic` | Psychic | サイコフィールド |
| `field.terrain.misty` | Misty | ミストフィールド |
| `field.helpingHand` | Helping Hand | てだすけ |
| `field.reflect` | Reflect | リフレクター |
| `field.lightScreen` | Light Screen | ひかりのかべ |
| `field.auroraVeil` | Aurora Veil | オーロラベール |
| `team.myTeam` | My Team | 自分のチーム |
| `team.enemyTeam` | Enemy Team | 相手のチーム |
| `team.yourSide` | Your side | 自分側 |
| `team.enemySide` | Enemy side | 相手側 |
| `team.defaultName` | Team {number} | チーム {number} |
| `team.enemyDefaultName` | Enemy {number} | 相手 {number} |
| `team.name` | Team name | チーム名 |
| `team.new` | New team | 新しいチーム |
| `team.deleteThis` | Delete this team | このチームを削除 |
| `team.capture` | Capture | キャプチャ |
| `team.importText` | Text | テキスト |
| `team.importPhoto` | Photo | 画像 |
| `team.importReport` | Report | レポート |
| `team.importTextTitle` | Import a pokepaste or Showdown team | pokepaste または Showdown のチームを読み込む |
| `team.importPhotoTitle` | Import a Team Preview screenshot or photo | チームプレビューの画像を読み込む |
| `team.importReportTitle` | Import in-game Stats and Moves screenshots | ゲーム内の能力とわざの画像を読み込む |
| `team.addPokemon` | + Add Pokemon | + ポケモンを追加 |
| `team.addTarget` | + Add target | + 対象を追加 |
| `team.addShort` | Add | 追加 |
| `team.removePokemon` | Remove Pokemon | ポケモンを削除 |
| `team.dragToFront` | Drag onto an active target to bring it to the front | アクティブ枠へドラッグして前に出す |
| `team.activateHint` | {name}: click to send to the front line, or drag it onto a card | {name}: クリックで前に出すか、カードへドラッグして入れ替え |
| `pokemon.attacker` | Attacker | 攻撃側 |
| `pokemon.target` | Target {number} | 対象 {number} |
| `pokemon.yourSlot` | Your {number} | 自分 {number} |
| `pokemon.species` | Species | ポケモン |
| `pokemon.speciesPlaceholder` | Species or Mega... | ポケモンまたはメガシンカ... |
| `pokemon.nature` | Nature | 性格 |
| `pokemon.item` | Item | 持ち物 |
| `pokemon.ability` | Ability | 特性 |
| `pokemon.status` | Status | 状態 |
| `pokemon.moves` | Moves | わざ |
| `pokemon.movePlaceholder` | Move... | わざ... |
| `pokemon.itemPlaceholder` | Item... | 持ち物... |
| `pokemon.noItemMega` | No item (Mega) | 持ち物なし（メガシンカ） |
| `pokemon.editSet` | Edit set | 詳細編集 |
| `pokemon.editNamedSet` | Edit {name}'s set | {name}の詳細編集 |
| `pokemon.dragSwap` | Drag to swap targets | ドラッグして対象を入れ替え |
| `pokemon.dragOntoCard` | Drag onto another card to swap | 別のカードへドラッグして入れ替え |
| `status.healthy` | Healthy | なし |
| `status.burned` | Burned | やけど |
| `status.paralyzed` | Paralyzed | まひ |
| `status.poisoned` | Poisoned | どく |
| `status.badlyPoisoned` | Badly Poisoned | もうどく |
| `status.asleep` | Asleep | ねむり |
| `status.frozen` | Frozen | こおり |
| `nature.neutral` | neutral | 補正なし |
| `move.category.physical` | Physical | 物理 |
| `move.category.special` | Special | 特殊 |
| `move.category.status` | Status | 変化 |
| `move.pp` | PP | PP |
| `move.basePower` | BP | 威力 |
| `stats.points` | Stat Points | 能力ポイント |
| `stats.pointsLeft` | {left} / {total} left | 残り {left} / {total} |
| `stats.battleBoosts` | Battle Boosts | 能力変化 |
| `stats.hp` | HP | HP |
| `stats.atk` | Atk | 攻撃 |
| `stats.def` | Def | 防御 |
| `stats.spa` | SpA | 特攻 |
| `stats.spd` | SpD | 特防 |
| `stats.spe` | Spe | 素早さ |
| `stats.raise` | Raise {stat} | {stat}を上げる |
| `stats.lower` | Lower {stat} | {stat}を下げる |
| `stats.stage` | {stage} stage | {stage}段階 |
| `result.safe` | safe | 耐久 |
| `result.fixedKo` | {count}HKO | 確{count} |
| `result.status` | status | 変化 |
| `result.incoming` | Incoming | 受けるダメージ |
| `result.incomingTo` | Incoming to {name} | {name}が受けるダメージ |
| `result.incomingFrom` | Incoming from | 受けるダメージ |
| `result.damageFrom` | Damage from | 与えるダメージ |
| `result.moreTargets` | More targets | その他の対象 |
| `result.noTargets` | No targets. Add one in the Enemy Team box. | 対象がいません。相手のチームに追加してください。 |
| `result.noOpposingPokemon` | No opposing Pokemon. | 相手のポケモンがいません。 |
| `result.noEnemy` | Add an enemy to see what it does to you. | 相手を追加すると受けるダメージを確認できます。 |
| `result.setAttacker` | Set an attacker species to see damage. | 攻撃側のポケモンを選ぶとダメージを確認できます。 |
| `result.setAttackerIncoming` | Set your attacker's species to see incoming damage. | 自分のポケモンを選ぶと受けるダメージを確認できます。 |
| `result.addAttackerMove` | Add a move to the attacker. | 攻撃側にわざを追加してください。 |
| `result.addMoveTo` | Add a move to {name}. | {name}にわざを追加してください。 |
| `result.addMovesToCard` | Add moves to {name} in its card to see incoming damage. | {name}のカードにわざを追加すると受けるダメージを確認できます。 |
| `result.noMoveDamage` | No move damage to show. | 表示できるわざのダメージがありません。 |
| `arena.turnSideways` | Turn your device sideways | 端末を横向きにしてください |
| `arena.rotateExplanation` | Battle Arena is a wide 2v2 board. Rotate your phone or switch to Classic mode. | バトルアリーナは横長の2対2表示です。端末を回転するか、クラシックに切り替えてください。 |
| `arena.useClassic` | Use Classic mode instead | クラシックを使用する |
| `arena.addYourPokemon` | Add a Pokemon to your team above. | 上の自分のチームにポケモンを追加してください。 |
| `arena.addEnemyPokemon` | Add a target to the enemy team above. | 上の相手のチームに対象を追加してください。 |
| `arena.activePokemon` | Active Pokemon for this slot | この枠のアクティブポケモン |
| `photo.title` | Import {side} from a photo | {side}を画像から読み込む |
| `photo.yourTeam` | your team | 自分のチーム |
| `photo.enemyTeam` | the enemy team | 相手のチーム |
| `photo.detected` | Detected with {engine}. Review, then apply. | {engine}で検出しました。確認してから適用してください。 |
| `photo.engineLocal` | on-device mode | 端末内モード |
| `photo.enginePrecise` | precise mode | 高精度モード |
| `photo.nothingAdded` | Nothing added yet. Choose a best guess or search for a Pokemon. | まだ追加されていません。候補を選ぶか、ポケモンを検索してください。 |
| `photo.bestGuesses` | Best guesses. Tap to add. | 候補です。タップして追加してください。 |
| `photo.addPokemon` | Add a Pokemon | ポケモンを追加 |
| `photo.searchPlaceholder` | Search by name... | 名前で検索... |
| `photo.searchLabel` | Add a Pokemon by name | 名前でポケモンを追加 |
| `photo.cropPanels` | Crop the panels myself | パネル範囲を手動で選択 |
| `photo.differentImage` | Use a different image | 別の画像を使用 |
| `photo.dropPlayer` | Drop or paste a blue Team Preview screenshot, or click to browse. | 青い自分側のチームプレビュー画像をドロップまたは貼り付けるか、クリックして選択してください。 |
| `photo.dropEnemy` | Drop or paste a red Team Preview screenshot, or click to browse. | 赤い相手側のチームプレビュー画像をドロップまたは貼り付けるか、クリックして選択してください。 |
| `photo.preciseMode` | More precise API mode. Uses a key and may have a small cost. | 高精度APIモードです。キーが必要で、少額の費用が発生する場合があります。 |
| `photo.apiKey` | API key (kept in your browser) | APIキー（ブラウザ内に保存） |
| `photo.apply` | Apply to calculator | 計算機に適用 |
| `photo.cropManually` | Crop manually | 手動で範囲を選択 |
| `photo.readingScreen` | Reading the screen... | 画面を読み取り中... |
| `photo.captureScreen` | Capture the screen | 画面をキャプチャ |
| `photo.captureDevice` | Capture from device | 端末からキャプチャ |
| `crop.help` | Drag the box around the six enemy panels. The lines show the six rows that will be read. | 相手側の6つのパネルを囲むように枠を動かしてください。線は読み取る6行を示します。 |
| `crop.imageAlt` | Screenshot to crop | 範囲を選択する画像 |
| `crop.read` | Read this crop | この範囲を読み取る |
| `paste.titleYour` | Import your team | 自分のチームを読み込む |
| `paste.titleEnemy` | Import enemy team | 相手のチームを読み込む |
| `paste.hint` | Paste a Showdown export or pokepast.es URL. This replaces the current slot. EVs are converted to Stat Points automatically. | Showdownの書き出しまたはpokepast.esのURLを貼り付けてください。現在の枠が置き換わり、EVは能力ポイントに自動変換されます。 |
| `paste.empty` | Paste a team first. | 先にチームを貼り付けてください。 |
| `paste.fetchFailed` | That URL could not be fetched. Copy the team text and paste it here instead. | URLを取得できませんでした。チームのテキストをコピーして、ここに貼り付けてください。 |
| `paste.noPokemon` | No Pokemon were found in that team. | チーム内にポケモンが見つかりませんでした。 |
| `report.title` | Import your team from its report | チームレポートから自分のチームを読み込む |
| `report.readCount` | Read {count} Pokemon. Review, then apply. | {count}匹のポケモンを読み取りました。確認してから適用してください。 |
| `report.noMoves` | no moves read | わざを読み取れませんでした |
| `report.reviewNote` | Double-check anything that looks incorrect. | 誤って見える項目がないか確認してください。 |
| `report.differentScreenshots` | Use different screenshots | 別の画像を使用 |
| `report.freeMode` | Free, on-device | 無料、端末内 |
| `report.preciseMode` | Precise, API | 高精度、API |
| `report.instructions` | Open the in-game team view, then add the Stats and Moves & More screenshots. One screenshot also works. | ゲーム内のチーム画面を開き、「能力」と「わざ・その他」の画像を追加してください。1枚だけでも使用できます。 |
| `report.statsTab` | Stats tab | 能力タブ |
| `report.movesTab` | Moves & More tab | わざ・その他タブ |
| `report.localHint` | Reads entirely in your browser. The first run downloads and caches the OCR model. | ブラウザ内だけで読み取ります。初回のみOCRモデルをダウンロードして保存します。 |
| `report.preciseHint` | Uses the precise API mode and may have a small cost. | 高精度APIモードを使用し、少額の費用が発生する場合があります。 |
| `report.japaneseOcrUnavailable` | Japanese text recognition is not available yet. Use screenshots from the English game interface. | 日本語の文字認識にはまだ対応していません。ゲームを英語表示にした画像を使用してください。 |
| `report.addScreenshot` | Add at least one screenshot. | 画像を1枚以上追加してください。 |
| `report.dropPasteClick` | Drop, paste, or click | ドロップ、貼り付け、またはクリック |
| `report.apply` | Apply to My Team | 自分のチームに適用 |
| `notice.title` | The calculator has a new look. | 計算機のデザインが新しくなりました。 |
| `notice.body` | Prefer the old one? You can still use it here. | 以前のデザインは、こちらから引き続き使用できます。 |
| `notice.here` | here | こちら |
| `notice.never` | Don't show this again | 今後表示しない |
| `footer.stats` | Stats use the Champions Stat Points model (66 SP, 32 per stat, perfect IVs). | 能力値はChampionsの能力ポイント方式（合計66、各能力32まで、個体値最大）を使用しています。 |
| `footer.damage` | Damage by @smogon/calc. Mega and roster data is a work in progress. | ダメージ計算には@smogon/calcを使用しています。メガシンカと登場ポケモンのデータは更新中です。 |
| `footer.typeIcons` | Type icons by partywhale (MIT). | タイプアイコンはpartywhaleによるものです（MIT）。 |
| `footer.oldLook` | Preferred the old look? Use the classic design. | 以前のデザインを使う場合は、クラシックデザインを開いてください。 |
| `footer.madeBy` | Made by SebNotFound. | 制作: SebNotFound |
| `footer.support` | If you want to help me, buy me a Ko-fi. | 応援していただける場合は、Ko-fiでサポートできます。 |
| `recognition.blueSide` | The local reader cannot reliably read the blue side yet. Use text import, manual entry, or precise mode. | 端末内の読み取りでは青い自分側を安定して認識できません。テキスト読み込み、手動入力、または高精度モードを使用してください。 |
| `recognition.redPanels` | The red enemy panels could not be found. Select the range manually or try precise mode. | 相手側の赤いパネルを見つけられませんでした。範囲を手動で選択するか、高精度モードを試してください。 |
| `recognition.lowConfidence` | The enemy team could not be read confidently. Review the suggestions or select the range manually. | 相手のチームを十分な精度で読み取れませんでした。候補を確認するか、範囲を手動で選択してください。 |
| `recognition.noMatch` | No enemy Pokemon could be matched. Add them manually or select the range yourself. | 相手のポケモンを判定できませんでした。手動で追加するか、範囲を選択してください。 |
| `recognition.cropTooSmall` | That crop is too small. Draw a box around all six enemy panels. | 選択範囲が小さすぎます。相手側の6つのパネル全体を囲んでください。 |
