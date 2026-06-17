/**
 * Mega Evolution overlay.
 *
 * Mega formes don't exist in `@smogon/calc`'s generation-9 data, so we build a
 * Pokémon from its base species and overlay the mega's stats / types / ability
 * via the engine's `overrides` hook (see ../engine.ts).
 *
 * The data is generated from the official Pokémon Showdown Champions calculator
 * (every Champions mega — classic and the new Legends Z-A ones). Re-run
 * `node scripts/fetch-megas.mjs` to refresh `data/megas.json`.
 */
import rawMegas from './megas.json';
import type { StatTable, TypeName } from '../types';

export interface MegaForme {
  /** Stable key, also the entry shown in the species list, e.g. "Charizard-Mega-Y". */
  name: string;
  /** Friendly label for chips/menus, e.g. "Mega Charizard Y". */
  label: string;
  /** Base species the skeleton is built from in `@smogon/calc`. */
  baseSpecies: string;
  baseStats: StatTable;
  types: [TypeName] | [TypeName, TypeName];
  ability: string;
  /** Weight in kg (matters for Heavy Slam / Low Kick / Grass Knot). */
  weightkg: number;
}

/**
 * Champions-custom mega abilities the upstream data we scrape doesn't carry yet
 * (it lists a base-species / placeholder ability instead). Applied on load so a
 * `fetch-megas.mjs` refresh can't quietly revert them. From the latest
 * Regulation: Mega Eelektross has Eelevate and Mega Pyroar has Fire Mane.
 * See serebii.net/pokemonchampions/newabilities.shtml.
 */
const ABILITY_OVERRIDES: Record<string, string> = {
  'Eelektross-Mega': 'Eelevate',
  'Pyroar-Mega': 'Fire Mane',
};

export const MEGAS = (rawMegas as MegaForme[]).map((m) =>
  ABILITY_OVERRIDES[m.name] ? { ...m, ability: ABILITY_OVERRIDES[m.name] } : m,
);

const byName = new Map(MEGAS.map((m) => [m.name, m] as const));

/** Look up a mega forme by its key (e.g. "Garchomp-Mega"). */
export function getMega(name: string): MegaForme | undefined {
  return byName.get(name);
}

/** All mega formes available for a base species (e.g. Charizard → X and Y). */
export function getMegaFormesFor(species: string): MegaForme[] {
  const id = species.toLowerCase();
  return MEGAS.filter((m) => m.baseSpecies.toLowerCase() === id);
}

/** Whether a species has at least one Mega Evolution. */
export function hasMega(species: string): boolean {
  return getMegaFormesFor(species).length > 0;
}
