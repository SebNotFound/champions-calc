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

/** The most-used Champions set for a species, or undefined if we have no data. */
export function getUsage(species: string): UsageSet | undefined {
  const entry = USAGE[toID(species)];
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

/** Whether we have usage data for a species. */
export function hasUsage(species: string): boolean {
  return toID(species) in USAGE;
}
