# Japanese Localization Design

Date: 2026-09-10

## Goal

Add an optional Japanese experience to the current Exo Calc website while keeping English as the default language. Japanese names should be the correct original names used for Pokemon, moves, abilities, items, natures, types, statuses, weather, terrain, and other game terms.

The calculation engine, saved teams, imports, and internal state must continue to use their current canonical English values. Changing the displayed language must never change a set or a damage result.

## Scope

The first release includes:

- A compact `EN | 日本語` selector in the current website header.
- English as the default language, with no automatic browser-language detection.
- The selected language saved in local storage for later visits.
- Japanese interface text throughout the current design.
- Japanese names for Pokemon and forms, moves, abilities, items, natures, types, statuses, weather, terrain, stats, and move categories.
- Japanese names for Champions-specific Mega Evolutions and abilities that are missing from public datasets.
- Search by either Japanese or English names while Japanese is selected.
- Automatic English fallback for any missing Japanese entry.
- Desktop and mobile support for both Classic and Battle Arena modes in the current design.

The first release does not include:

- Japanese image recognition or OCR.
- Localization of the old design served from `/classic.html`.
- Japanese controls in the Windows or Android overlays.
- The Amazon recommendation banner.
- Automatic language selection based on browser or device settings.
- Romaji search.

## Core Principle

Localization belongs at the user interface boundary. Existing canonical English values remain the source of truth everywhere else.

For example, a Japanese user can see and select `じしん`, but the Pokemon set still stores `Earthquake`. The damage engine receives `Earthquake`, saved teams remain compatible, and an imported English team continues to work without conversion.

This boundary applies to every localized game value:

1. The application state provides a canonical English value.
2. The interface looks up the Japanese display name when needed.
3. A Japanese or English selection is resolved back to the canonical value.
4. Only the canonical value is passed to state, storage, imports, and calculations.

User-created team names are never localized or altered.

## Language State

A language provider will expose the active locale and the helpers used by components. Supported locales are `en` and `ja`.

The provider will:

- Default to English on a visitor's first session.
- Read and write the dedicated local-storage key `champions-calc/language`.
- Change the root document language between `en` and `ja`.
- Expose a text helper for interface labels.
- Expose name helpers for game data.
- Force English and hide the selector when the application is running inside either overlay.

The Japanese data can be loaded as a separate local application chunk when the user selects Japanese. This keeps the initial English download small and does not make any request to an external service while the calculator is being used. The language is saved only after that local data loads successfully.

If the Japanese chunk cannot be loaded, the site stays in English and shows a short, readable error instead of leaving partially localized controls on screen.

## Text Catalog

Interface text will use stable keys instead of embedding English sentences directly in components. The English and Japanese catalogs will contain the same keys.

The catalog covers:

- Header controls and display modes.
- Battlefield, team, and side labels.
- Pokemon editor labels and placeholders.
- Damage panels and result explanations.
- Import dialogs, team reports, photos, and paste controls.
- Buttons, empty states, validation messages, and errors.
- Theme controls, help text, notices, and footer text.
- Mobile-only labels in the current website.

Short labels can be selected where a literal Japanese rendering would make the mobile interface unnecessarily crowded. The meaning must remain accurate.

## Japanese Game Names

Game names will be kept in static maps grouped by category. A small generation script will collect localized names from PokeAPI during development. The generated result will be committed with the application, so visitors do not depend on PokeAPI.

The generated data will cover:

- Pokemon species and supported forms.
- Moves.
- Abilities.
- Items.
- Natures.
- Types.

Statuses, weather, terrain, stat labels, move categories, and Champions-specific content will use a reviewed local catalog because these values are few or may not exist in the external source.

Champions-specific overrides remain separate from generated data. Regenerating the general dictionary therefore cannot remove names such as new Mega Evolutions or their exclusive abilities.

Each entry is keyed by its existing canonical English value. Generated files must be deterministic so that future regulation updates produce a readable Git diff.

## Name Lookup

The localization layer will expose two operations:

- `displayName(category, canonicalValue, locale)` returns the name shown to the user.
- `resolveName(category, input, locale)` returns the canonical English value for a recognized Japanese or English name.

Lookup will normalize Unicode and surrounding whitespace. English matching remains case-insensitive. Japanese matching uses the official displayed spelling. Romaji conversion is outside the first release.

If a Japanese name is missing, `displayName` returns the canonical English value. Missing data must never produce an empty option or prevent the calculator from loading.

Names are resolved within their category. An identical word used by an item and an ability cannot cause a collision. Forms that would otherwise have the same visible name include a clear Japanese form label in the menu.

## Search and Comboboxes

The current browser datalists cannot reliably display a Japanese label while storing a different English value. English mode will keep its current website behavior to minimize risk. Japanese mode will use the existing custom in-page menu already used by the overlays, extended to accept structured options:

```ts
type LocalizedOption = {
  value: string
  label: string
  aliases: string[]
}
```

`value` is the canonical English name, `label` is the visible Japanese name, and `aliases` include searchable alternatives such as the English name.

While Japanese is active:

- The input displays the Japanese label for the selected canonical value.
- Typing filters both Japanese labels and English aliases.
- Selecting a result sends only its canonical value to the existing editor.
- Enter or blur accepts an exact Japanese or English match.
- Unrecognized text is not written into the calculator state and the field returns to its last valid value on blur.
- Keyboard and touch selection continue to work.

This behavior applies to Pokemon, moves, abilities, items, and any other searchable game-name field.

## Expected File Structure

The localization code will be split into focused modules:

- `src/i18n/LanguageProvider.tsx` for locale state and persistence.
- `src/i18n/ui.en.ts` for English interface text.
- `src/i18n/ui.ja.ts` for Japanese interface text.
- `src/i18n/names.ts` for display and reverse lookup.
- `src/i18n/data/ja.generated.ts` for generated game names.
- `src/i18n/data/ja.champions.ts` for reviewed Champions-specific overrides.
- `scripts/build-japanese-names.mjs` for reproducible data generation.
- Focused localization tests alongside the new modules.

`src/main.tsx` will mount the provider. Existing interface components will consume the provider for visible text and game names. `src/ui/widgets.tsx` will gain the structured localized option path while retaining the current English behavior.

The calculation engine and its list functions will not be localized. This keeps the new subsystem isolated from battle logic.

The existing Google tag in `index.html` must remain unchanged. The initial HTML language can stay English, then the provider updates it after the saved preference is read.

## Styling and Layout

The selector should fit into the existing header without moving the current controls onto a new row at standard desktop widths. On mobile it should remain easy to tap without taking space away from the calculator.

Japanese text will use a local system font stack such as `Noto Sans JP`, `Yu Gothic`, and `Hiragino Kaku Gothic ProN`, followed by the existing sans-serif fallback. No external font request is required.

Both themes and both current display modes must be checked because Japanese labels can change control widths. Existing desktop layouts must not be changed solely to accommodate Japanese text. Mobile labels can use accurate shorter wording when necessary.

## Error Handling

The interface should remain usable when localization data is incomplete or cannot be loaded:

- Missing interface keys fall back to the English catalog.
- Missing game names fall back to their canonical English names.
- A failed Japanese data load keeps English active and reports the problem once.
- Invalid user input never replaces a valid canonical game value.
- Duplicate visible names remain separate options through their canonical values and category.

Development builds should make missing keys easy to detect, but visitors should not see technical diagnostics.

## Testing

Implementation will start with focused tests for the localization boundary. The test suite will cover:

- Representative Japanese names from every supported category.
- Champions-specific Mega Evolution and ability overrides.
- Japanese display names resolving to canonical English values.
- English aliases resolving while Japanese is active.
- English case-insensitive search and Japanese Unicode normalization.
- English fallback for missing Japanese names and interface keys.
- Language persistence and the root document language.
- English default with no automatic browser-language switch.
- Forced English and a hidden language selector in overlay environments.
- Unchanged Pokemon sets and damage results after switching language.
- Invalid localized input preserving the last valid value.

After the focused tests pass, the complete existing test suite and production web build will run. The website will also be checked manually at desktop and phone widths in both themes, with special attention to the header, Pokemon editors, import dialogs, and Battle Arena.

Because the React source is shared, the Windows and Android overlay builds will receive a compatibility check even though their visible language remains English.

## Acceptance Criteria

The feature is complete when:

1. A first-time website visitor sees English.
2. The visitor can select Japanese from the current header and keep that choice after reloading.
3. The current website interface and supported game terms appear in Japanese.
4. Search accepts Japanese and English names and always returns canonical values to the calculator.
5. Switching languages never changes teams, sets, imports, or damage results.
6. Missing Japanese data falls back cleanly to English.
7. `/classic.html`, the Windows overlay, and the Android overlay remain English and otherwise unchanged.
8. Existing tests, new localization tests, and the production build pass.

## Separate Follow-up

The Amazon affiliate recommendation area will be designed and implemented after this localization work. Keeping it separate makes each change easier to review, test, and release safely.
