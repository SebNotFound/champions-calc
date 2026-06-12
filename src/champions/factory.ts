/** Factories for fresh, valid Pokémon sets used to seed the UI. */
import { emptySpread } from './stats';
import { getDefaultAbility } from './engine';
import { getUsage } from './usage';
import type { ChampionsSet } from './types';

/** A blank, legal set for the given species (level 50, neutral nature, 0 SP). */
export function defaultSet(species = 'Garchomp'): ChampionsSet {
  return {
    species,
    level: 50,
    nature: 'Hardy',
    statPoints: emptySpread(),
    ability: getDefaultAbility(species),
    moves: ['', '', '', ''],
  };
}

/**
 * A set pre-filled with the species' most-used Champions kit (moves, item,
 * ability, nature, Stat Points) when we have usage data — the same fill you get
 * when you pick a species in the editor. Falls back to a blank legal set.
 *
 * Used for Team Preview import and the "best guess" picker so detected Pokémon
 * arrive battle-ready instead of empty.
 */
export function autofillSet(species: string, megaForme?: string): ChampionsSet {
  const usage = getUsage(megaForme ?? species) ?? getUsage(species);
  const moves = usage ? [...usage.moves] : [];
  while (moves.length < 4) moves.push('');
  return {
    species,
    level: 50,
    megaForme,
    nature: usage?.nature ?? 'Hardy',
    statPoints: usage?.statPoints ?? emptySpread(),
    ability: usage?.ability ?? getDefaultAbility(species),
    item: usage?.item,
    moves: moves.slice(0, 4),
  };
}
