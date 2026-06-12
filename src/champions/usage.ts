/**
 * Most-used set lookup.
 *
 * Sourced from a munchstats snapshot of the Champions Reg M-A metagame (top
 * move(s), item, ability, nature and Stat Point spread per Pokémon). Re-run
 * `node scripts/fetch-usage.mjs` to refresh `data/usage.json`.
 *
 * The app uses this to auto-fill a Pokémon's common set the moment you pick it,
 * so you don't have to enter a realistic set by hand.
 */
import { toID } from '@smogon/calc';
import { Dex } from '@pkmn/dex';
import rawUsage from './data/usage.json';
import { emptySpread } from './stats';
import type { NatureName, StatSpread } from './types';

interface RawEntry {
  name: string;
  moves: string[];
  item?: string;
  ability?: string;
  nature?: string;
  sp?: Partial<StatSpread>;
}

const USAGE = rawUsage as Record<string, RawEntry>;

/** A Pokémon's most-used set, shaped to drop straight into a ChampionsSet. */
export interface UsageSet {
  moves: string[];
  item?: string;
  ability?: string;
  nature?: NatureName;
  statPoints?: StatSpread;
}

/**
 * Base species → most-used forme key, for species that only ever play as a
 * forme.
 *
 * A few Pokémon are recognised (and picked from the species list) by their BASE
 * name — "Rotom", "Lycanroc" — but only ever appear competitively as a specific
 * forme, so the snapshot is keyed by those formes (rotomwash, rotomheat, …;
 * lycanrocdusk) with no plain `rotom`/`lycanroc` entry. Without help they'd be
 * the only detected Pokémon to autofill blank.
 *
 * This index folds such a base onto its most-used forme. The scraper writes keys
 * in descending-usage order, so for each base we keep the FIRST forme we see —
 * i.e. the most popular one. Megas are skipped on purpose: Team Preview shows
 * the base sprite, a Mega autofills through its own `megaForme` set (see
 * factory.ts), and its held item is a Mega Stone that doesn't belong on the
 * un-evolved base.
 *
 * Built lazily and consulted only on a miss, so a base form that carries its own
 * (even rare) usage is always served directly and never overwritten.
 */
let formeFallback: Map<string, string> | null = null;
function fallbackKeyFor(speciesId: string): string | undefined {
  if (!formeFallback) {
    formeFallback = new Map();
    for (const key of Object.keys(USAGE)) {
      const specie = Dex.species.get(key);
      if (!specie.exists || !specie.forme || specie.isMega) continue;
      const baseId = toID(specie.baseSpecies);
      if (!formeFallback.has(baseId)) formeFallback.set(baseId, key);
    }
  }
  return formeFallback.get(speciesId);
}

/**
 * The raw usage entry for a species: its own if we have one, otherwise its
 * most-used forme's (see {@link fallbackKeyFor}). Undefined if we have neither.
 */
function lookupEntry(species: string): RawEntry | undefined {
  const id = toID(species);
  const exact = USAGE[id];
  if (exact) return exact;
  const fallbackKey = fallbackKeyFor(id);
  return fallbackKey ? USAGE[fallbackKey] : undefined;
}

/** The most-used Champions set for a species, or undefined if we have no data. */
export function getUsage(species: string): UsageSet | undefined {
  const entry = lookupEntry(species);
  if (!entry) return undefined;
  return {
    // The usage source occasionally lists a "Nothing" placeholder for an unused
    // move slot — drop it so a set never autofills a bogus move.
    moves: (entry.moves ?? []).filter((m) => m && m !== 'Nothing'),
    item: entry.item,
    ability: entry.ability,
    nature: entry.nature as NatureName | undefined,
    statPoints: entry.sp ? { ...emptySpread(), ...entry.sp } : undefined,
  };
}

/** Whether we have usage data for a species (directly or via a forme fallback). */
export function hasUsage(species: string): boolean {
  return lookupEntry(species) !== undefined;
}
