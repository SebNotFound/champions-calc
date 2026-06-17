/**
 * Rich species metadata sourced from the full `@pkmn` dex.
 *
 * `@smogon/calc`'s bundled data is intentionally slim — it only exposes a
 * species' *primary* ability and has no learnsets. To show only the abilities
 * and moves a Pokémon can actually have, we load the complete dex here via
 * `@pkmn/dex` + `@pkmn/data` (the same data family `@smogon/calc` is built on,
 * so species/move/ability names line up). This generation is used purely for
 * UI metadata; the damage calc still runs on `@smogon/calc`'s own generation.
 */
import { Dex } from '@pkmn/dex';
import { Generations } from '@pkmn/data';
import { Sprites } from '@pkmn/img';
import { getMega } from './data/megas';
import championsSprites from './data/champions-sprites.json';

/**
 * Champions-original Mega formes (Mega Eelektross, Mega Raichu X/Y, ...) that
 * Showdown has no sprite for, mapped to a locally bundled 120x120 sprite under
 * public/sprites/champions/. Regenerate with `node scripts/fetch-champions-sprites.mjs`.
 */
const LOCAL_SPRITES = championsSprites as Record<string, string>;

// National-dex filter: Champions' roster spans past gens, so species/formes
// that never made it into Scarlet/Violet (Floette-Eternal, …) must still
// resolve here. The default gen-9 filter would return nothing for them.
const metaGen = new Generations(Dex, () => true).get(9);

/** Every ability a species can legally have (primary, secondary, hidden). */
export function speciesAbilities(species: string): string[] {
  let specie = metaGen.species.get(species);
  if (specie && !specie.abilities[0] && specie.baseSpecies) specie = metaGen.species.get(specie.baseSpecies);
  if (!specie) return [];
  const a = specie.abilities as { 0?: string; 1?: string; H?: string; S?: string };
  return Array.from(new Set([a[0], a[1], a.H, a.S].filter((x): x is string => !!x)));
}

// Learnsets are loaded lazily (and are large), so cache the resolved move lists.
const moveCache = new Map<string, string[]>();

/**
 * Every move a species can learn, as display names, sorted. Async because the
 * dex loads learnset data on demand. Results are cached per species.
 */
export async function speciesMoves(species: string): Promise<string[]> {
  const key = species.toLowerCase();
  const cached = moveCache.get(key);
  if (cached) return cached;

  const learnable = await metaGen.learnsets.learnable(species);
  const names = learnable
    ? Object.keys(learnable)
        .map((id) => metaGen.moves.get(id)?.name as string | undefined)
        .filter((n): n is string => !!n)
        .sort()
    : [];

  moveCache.set(key, names);
  return names;
}

/**
 * Sprite URL for a species (or mega forme name).
 *
 * Uses `@pkmn/img`, which resolves the right Pokémon Showdown sprite for any
 * name — including alternate formes and megas — instead of guessing a slug.
 * This fixed the many broken sprites the naive pokemondb slug produced.
 */
export function spriteUrl(species: string): string {
  // Champions-original Megas have a bundled local sprite (Showdown has none).
  const local = LOCAL_SPRITES[species];
  if (local) return `/sprites/champions/${local}`;
  try {
    return Sprites.getDexPokemon(species).url;
  } catch {
    return '';
  }
}

/**
 * Fallback sprite for a name, or '' if there isn't a sensible one.
 *
 * Many Champions Megas are original to the game (Mega Eelektross, Mega Raichu X/Y,
 * Mega Pyroar, …), so Pokémon Showdown — where the sprites come from — has no art
 * for the forme and the request 404s. When that happens we show the base species
 * sprite (which always exists) instead of a blank box. Real Megas keep their own
 * art and never hit this. Returns '' for a non-mega so the caller knows there's
 * nothing better to try.
 */
export function baseSpriteUrl(species: string): string {
  const mega = getMega(species);
  return mega ? spriteUrl(mega.baseSpecies) : '';
}
