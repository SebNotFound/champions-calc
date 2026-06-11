/** Factories for fresh, valid Pokémon sets used to seed the UI. */
import { emptySpread } from './stats';
import { getDefaultAbility } from './engine';
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
