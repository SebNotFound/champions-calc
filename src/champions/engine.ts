/**
 * The calculation engine.
 *
 * This is the bridge between our Champions domain model and `@smogon/calc`.
 * The plan, in one sentence: let `@smogon/calc` own the damage *formula*
 * (type chart, STAB, items, abilities, weather, spread reduction, crits, …)
 * while we own the *stats* (the Champions SP model) and the *roster* (Mega
 * overlays). We do that by building a normal `@smogon/calc` Pokémon and then
 * overwriting its stat tables with Champions-computed values.
 *
 * Why this works (verified against the library source):
 *   • The damage formula reads `pokemon.rawStats[stat]` and then applies stat
 *     stage boosts, so overwriting `rawStats` controls the offence/defence
 *     used in the calc.
 *   • `maxHP()` and HP-percentage math read `rawStats.hp`.
 *   • `overrides` is merged onto the species, which is how Mega base stats,
 *     types and weight get in even though gen 9 has no megas.
 */

import { Generations, Pokemon, Move, Field, calculate, toID } from '@smogon/calc';
import type { State } from '@smogon/calc';
import { CHAMPIONS_GEN, CHAMPIONS_FORMAT } from './format';
import { computeChampionsStats } from './stats';
import { getMega, MEGAS } from './data/megas';
import type { ChampionsSet, StatTable } from './types';

/** A loaded game generation (gen 9 mechanics, which Champions reuses). */
type Generation = ReturnType<typeof Generations.get>;
/** The result object `calculate()` returns. */
type CalcResult = ReturnType<typeof calculate>;

// The generation bundles a fair amount of data, so load it once and reuse.
let cachedGen: Generation | null = null;
export function getGen(): Generation {
  if (!cachedGen) cachedGen = Generations.get(CHAMPIONS_GEN);
  return cachedGen;
}

// ---------------------------------------------------------------------------
// Custom Champions abilities
//
// A few new mega abilities don't exist in @smogon/calc, so we apply their
// effects ourselves by transforming the calc inputs:
//   • Dragonize      — Normal-type moves become Dragon-type with the -ate ×1.2.
//   • Mega Sol       — the holder always attacks as if the sun is out.
//   • Piercing Drill — like Unseen Fist (contact hits through Protect); mapped
//                      to Unseen Fist so the engine handles it natively.
//   • Spicy Spray    — (Mega Scovillain) burns whatever damages it. That's a
//                      reactive status, not a per-hit damage change, so the calc
//                      needs no adjustment (set the attacker's status to Burn to
//                      model the resulting Attack drop on follow-up hits).
// ---------------------------------------------------------------------------

/** Custom abilities mapped to an equivalent ability @smogon/calc understands. */
const ABILITY_ALIAS: Record<string, string> = { 'Piercing Drill': 'Unseen Fist' };

/** Moves that "-ate" abilities never retype (their type is already variable). */
const ATE_EXCLUDED = new Set(['Weather Ball', 'Terrain Pulse', 'Struggle']);

// ---------------------------------------------------------------------------
// Building a Pokémon
// ---------------------------------------------------------------------------

/**
 * Turn a {@link ChampionsSet} into an `@smogon/calc` Pokémon with Champions
 * stats baked in. Throws if the species is unknown to the engine.
 */
export function buildPokemon(set: ChampionsSet): Pokemon {
  const gen = getGen();
  const mega = set.megaForme ? getMega(set.megaForme) : undefined;
  const speciesName = mega ? mega.baseSpecies : set.species;

  const specie = gen.species.get(toID(speciesName));
  if (!specie) throw new Error(`Unknown species: "${speciesName}"`);

  // Real base stats (mega overlay if Mega Evolved) → final Champions stats.
  const sourceBaseStats = (mega ? mega.baseStats : specie.baseStats) as StatTable;
  const champStats = computeChampionsStats(sourceBaseStats, set.statPoints, set.nature, set.level);

  // IMPORTANT: `calculate()` runs on `attacker.clone()`, and `clone()` rebuilds
  // the Pokémon from its base stats / IVs / EVs / nature — so overwriting
  // `rawStats` after construction is silently discarded inside every calc.
  // Instead we encode our final stats as *synthetic base stats* (which live on
  // the species and DO survive cloning) and pair them with a neutral nature and
  // zero IVs/EVs. At Lv50 the engine's formula reduces to:
  //     stat = base + 5     (HP: base + 60)
  // so inverting it gives base stats that reproduce our numbers exactly. The
  // real nature is already baked into `champStats`, so we must not re-apply it.
  const synth = (final: number) => Math.max(1, final - 5);
  const baseStatsOverride: StatTable = {
    hp: Math.max(1, champStats.hp - 60),
    atk: synth(champStats.atk),
    def: synth(champStats.def),
    spa: synth(champStats.spa),
    spd: synth(champStats.spd),
    spe: synth(champStats.spe),
  };

  const overrides = {
    baseStats: baseStatsOverride,
    ...(mega ? { types: mega.types, weightkg: mega.weightkg } : {}),
  };
  const zero = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

  return new Pokemon(gen, speciesName, {
    level: set.level,
    nature: 'Hardy', // neutral — the real nature is already in champStats
    ability: mega ? (ABILITY_ALIAS[mega.ability] ?? mega.ability) : set.ability,
    // In Champions a Mega Evolution holds no item (the Omni Ring replaces it).
    item: mega ? undefined : set.item,
    moves: set.moves,
    boosts: set.boosts,
    ivs: zero,
    evs: zero,
    curHP: set.curHP,
    // Casts keep our domain types decoupled from the library's branded ones.
    status: set.status as never,
    overrides: overrides as never,
  });
}

// ---------------------------------------------------------------------------
// Running calculations
// ---------------------------------------------------------------------------

/** Build a Champions battle field (Doubles by default). */
export function makeField(overrides?: Partial<State.Field>): Field {
  return new Field({ gameType: CHAMPIONS_FORMAT.gameType, ...overrides });
}

/** A compact, UI-friendly summary of one damage result. */
export interface DamageSummary {
  /** Lowest and highest raw damage across the 16 rolls. */
  minDamage: number;
  maxDamage: number;
  /** Same, expressed as a percentage of the defender's max HP. */
  minPercent: number;
  maxPercent: number;
  /** Defender's max HP, handy for the UI. */
  defenderMaxHP: number;
  /** KO-chance text from the engine, e.g. "Guaranteed 2HKO". */
  koChance: string;
  /** The individual damage rolls (empty for multi-hit moves). */
  rolls: number[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Distil a raw engine result into the numbers the UI actually shows. */
export function summarize(result: CalcResult): DamageSummary {
  const defenderMaxHP = result.defender.maxHP();
  const [min, max] = result.range();
  let koChance = '';
  try {
    koChance = result.kochance().text ?? '';
  } catch {
    // kochance can throw on degenerate inputs (e.g. 0-damage status moves).
    koChance = '';
  }
  return {
    minDamage: min,
    maxDamage: max,
    minPercent: round1((min / defenderMaxHP) * 100),
    maxPercent: round1((max / defenderMaxHP) * 100),
    defenderMaxHP,
    koChance,
    rolls: Array.isArray(result.damage) && typeof result.damage[0] === 'number'
      ? (result.damage as number[])
      : [],
  };
}

/**
 * Build the Move and Field for a calc, applying custom Champions abilities that
 * @smogon/calc doesn't know: Dragonize re-types Normal moves to Dragon (with the
 * -ate ×1.2 power boost), and Mega Sol forces Sun for the attacker.
 */
function prepareMoveAndField(attacker: Pokemon, moveName: string, field: Field): { move: Move; field: Field } {
  const gen = getGen();
  let move = new Move(gen, moveName);

  if (attacker.hasAbility('Dragonize') && move.type === 'Normal' && !ATE_EXCLUDED.has(move.name)) {
    // Overrides survive the engine's internal clone (unlike mutating move.type).
    move = new Move(gen, moveName, {
      overrides: { type: 'Dragon', basePower: Math.round(move.bp * 1.2) },
    });
  }

  let resolvedField = field;
  if (attacker.hasAbility('Mega Sol') && !field.hasWeather('Sun', 'Harsh Sunshine')) {
    resolvedField = field.clone();
    resolvedField.weather = 'Sun';
  }

  return { move, field: resolvedField };
}

/** Calculate one attacker's move against one defender. */
export function calcOne(
  attacker: Pokemon,
  defender: Pokemon,
  moveName: string,
  field: Field = makeField(),
): DamageSummary {
  const { move, field: resolved } = prepareMoveAndField(attacker, moveName, field);
  return summarize(calculate(getGen(), attacker, defender, move, resolved));
}

/**
 * Calculate one attacker's move against several defenders at once — the core
 * of the "multi calc" view. `@smogon/calc` automatically applies the 0.75
 * spread-move reduction in Doubles, so each per-target number is already
 * battle-accurate.
 */
export function calcSpread(
  attacker: Pokemon,
  defenders: Pokemon[],
  moveName: string,
  field: Field = makeField(),
): DamageSummary[] {
  const gen = getGen();
  const { move, field: resolved } = prepareMoveAndField(attacker, moveName, field);
  return defenders.map((defender) =>
    summarize(calculate(gen, attacker, defender, move, resolved)),
  );
}

// ---------------------------------------------------------------------------
// Data lookups for the UI (memoised — these lists are static per session)
// ---------------------------------------------------------------------------

let speciesList: string[] | null = null;
let moveList: string[] | null = null;
let itemList: string[] | null = null;
let abilityList: string[] | null = null;

/** All species the engine knows (gen 9 National Dex). Sorted for menus. */
export function listSpecies(): string[] {
  if (!speciesList) {
    speciesList = Array.from(getGen().species, (s) => s.name).sort();
  }
  return speciesList;
}

let speciesOptions: string[] | null = null;
/**
 * Species picker options: every base species PLUS each Mega forme as its own
 * entry (e.g. "Charizard", "Charizard-Mega-X", "Charizard-Mega-Y"), so a Mega
 * can be chosen directly from the list. The "-Mega" names sort right after their
 * base species.
 */
export function listSpeciesOptions(): string[] {
  if (!speciesOptions) {
    // The gen-9 dex already lists mega formes, so dedupe; the spread also keeps
    // any overlay-only megas (e.g. future Legends Z-A ones) that aren't in it.
    const names = new Set<string>([...Array.from(getGen().species, (s) => s.name), ...MEGAS.map((m) => m.name)]);
    speciesOptions = [...names].sort();
  }
  return speciesOptions;
}

export function listMoves(): string[] {
  if (!moveList) {
    moveList = Array.from(getGen().moves, (m) => m.name).sort();
  }
  return moveList;
}

export function listItems(): string[] {
  if (!itemList) {
    itemList = Array.from(getGen().items, (i) => i.name).sort();
  }
  return itemList;
}

export function listAbilities(): string[] {
  if (!abilityList) {
    abilityList = Array.from(getGen().abilities, (a) => a.name).sort();
  }
  return abilityList;
}

/** A species' base stats, or undefined if unknown. */
export function getSpeciesBaseStats(name: string): StatTable | undefined {
  const specie = getGen().species.get(toID(name));
  return specie ? (specie.baseStats as StatTable) : undefined;
}

/** A species' primary ability (the engine's slim data only exposes this one). */
export function getDefaultAbility(name: string): string | undefined {
  const specie = getGen().species.get(toID(name));
  return specie?.abilities?.[0] || undefined;
}

/** A species' type(s), or undefined if unknown. */
export function getSpeciesTypes(name: string): string[] | undefined {
  const specie = getGen().species.get(toID(name));
  return specie ? [...specie.types] : undefined;
}

/** Snap a (possibly loosely-spelled) name to the canonical species name, if known. */
export function resolveSpeciesName(name: string): string {
  return getGen().species.get(toID(name))?.name ?? name;
}

// ---------------------------------------------------------------------------
// Team-level rules
// ---------------------------------------------------------------------------

/** How many Pokémon on a team are currently Mega Evolved. */
export function countMegas(team: ChampionsSet[]): number {
  return team.filter((s) => !!s.megaForme).length;
}

/** Champions allows at most one Mega Evolution per team. */
export function isTeamMegaLegal(team: ChampionsSet[]): boolean {
  return countMegas(team) <= CHAMPIONS_FORMAT.maxMegasPerTeam;
}
