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
import { Dex } from '@pkmn/dex';
import rawMegas from './megas.json';
import type { StatTable, TypeName, ChampionsSet } from '../types';

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

/**
 * Items that mega-evolve the holder. Champions uses generic mega items, so a team
 * report / paste shows e.g. "Mega Gem" or "Mega Orb"; real per-species Mega Stones
 * (Charizardite Y, ...) are resolved through the dex in {@link megaFormeFromItem}.
 */
export const MEGA_ITEMS = ['Mega Gem', 'Mega Orb', 'Mega Stone'];

/**
 * The Mega forme a held item evolves `species` into, or undefined if the item is
 * not a mega item (or the species has no Mega).
 *
 * A real per-species Mega Stone resolves to its exact forme (including the X/Y
 * variant) via the dex. A generic Champions mega item resolves to the species'
 * Mega, defaulting to the first if the species has X/Y formes (the user can flip
 * it in the editor).
 */
export function megaFormeFromItem(species: string, item: string | undefined): string | undefined {
  if (!item) return undefined;
  const formes = getMegaFormesFor(species);
  if (!formes.length) return undefined;

  // Real per-species Mega Stone (Charizardite Y, Aerodactylite, ...): the dex
  // names the exact forme, so we don't guess the X/Y variant.
  const dexItem = Dex.items.get(item);
  const stone = dexItem.exists ? (dexItem as { megaStone?: unknown }).megaStone : undefined;
  if (stone) {
    const formeName = typeof stone === 'string'
      ? stone
      : String(Object.values(stone as Record<string, string>)[0] ?? '');
    const exact = formes.find((f) => f.name === formeName);
    if (exact) return exact.name;
  }

  // Generic Champions mega item (Mega Gem / Mega Orb / Mega Stone / Omni ...).
  const norm = item.toLowerCase();
  if (norm.includes('mega') || norm.includes('omni')) {
    return formes[0].name;
  }
  return undefined;
}

/**
 * If a set holds a mega item, return it already mega-evolved: the forme is set and
 * the item cleared (a Champions Mega's slot is the mega item, not a held item).
 * Used by the team importers so a mon holding a Mega Gem / Orb (or a Mega Stone)
 * comes in as its Mega version directly. A no-op for everything else.
 */
export function applyMegaItem(set: ChampionsSet): ChampionsSet {
  if (set.megaForme) return set;
  const forme = megaFormeFromItem(set.species, set.item);
  return forme ? { ...set, megaForme: forme, item: undefined } : set;
}
