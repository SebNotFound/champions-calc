/**
 * Champions roster helpers.
 *
 * Champions launched with a curated subset of the National Dex (~150 species
 * plus megas). We do NOT yet have a verified, complete legality list, so this
 * module is deliberately conservative:
 *
 *   • `POPULAR_PICKS` is a hand-picked list of commonly-seen competitive
 *     Pokémon, used only to surface a "popular" quick-pick group in the UI.
 *     It is NOT claimed to be the full legal roster.
 *   • `isChampionsLegal()` is permissive on purpose — it never blocks a
 *     species, because wrongly excluding a legal Pokémon is worse than the
 *     reverse. Tighten this once a verified roster is wired in (see TODO).
 *
 * TODO: replace `POPULAR_PICKS` / `isChampionsLegal` with a verified roster,
 * e.g. scraped from the official Champions Pokédex or a trusted datamine.
 */

import { toID } from '@smogon/calc';

/** Commonly-seen competitive picks, shown as a quick-select group in the UI. */
export const POPULAR_PICKS: string[] = [
  'Incineroar', 'Rillaboom', 'Amoonguss', 'Landorus-Therian', 'Tornadus',
  'Urshifu-Rapid-Strike', 'Urshifu', 'Garchomp', 'Dragonite', 'Gholdengo',
  'Flutter Mane', 'Iron Hands', 'Chien-Pao', 'Chi-Yu', 'Tyranitar',
  'Gyarados', 'Gardevoir', 'Metagross', 'Salamence', 'Charizard',
  'Kangaskhan', 'Gengar', 'Scizor', 'Mawile', 'Lucario',
  'Sylveon', 'Togekiss', 'Rotom-Wash', 'Volcarona', 'Heatran',
];

const popularSet = new Set(POPULAR_PICKS.map(toID));

/** Whether a species is one of our highlighted popular picks. */
export function isPopularPick(name: string): boolean {
  return popularSet.has(toID(name));
}

/**
 * Whether a species is legal in Champions. Permissive for now (always true) —
 * see the module note. Kept as a function so callers don't need to change when
 * a real roster is added.
 */
export function isChampionsLegal(_name: string): boolean {
  return true;
}
