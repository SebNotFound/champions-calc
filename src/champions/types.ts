/**
 * Shared domain types for the Pokémon Champions damage calculator.
 *
 * These are intentionally kept independent of `@smogon/calc`'s own types so
 * that the pure parts of the app (the stat model especially) can be unit
 * tested without spinning up a game "Generation". Where the names line up
 * with `@smogon/calc` (StatKey ~ StatID, etc.) the values are compatible.
 */

/** The six battle stats, in the canonical game order. */
export type StatKey = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';

/** A full set of values keyed by stat (e.g. base stats, computed stats, SP). */
export type StatTable<T = number> = Record<StatKey, T>;

/**
 * How many Stat Points are invested in each stat. In Champions each value is
 * 0–32 and the six must sum to 66 or less (see {@link ./stats}).
 */
export type StatSpread = StatTable<number>;

/** The 25 natures. A nature raises one stat 10% and lowers another 10%. */
export type NatureName =
  | 'Adamant' | 'Bashful' | 'Bold' | 'Brave' | 'Calm'
  | 'Careful' | 'Docile' | 'Gentle' | 'Hardy' | 'Hasty'
  | 'Impish' | 'Jolly' | 'Lax' | 'Lonely' | 'Mild'
  | 'Modest' | 'Naive' | 'Naughty' | 'Quiet' | 'Quirky'
  | 'Rash' | 'Relaxed' | 'Sassy' | 'Serious' | 'Timid';

/** Pokémon elemental types. (Champions has no Tera, but the chart is the same.) */
export type TypeName =
  | 'Normal' | 'Fighting' | 'Flying' | 'Poison' | 'Ground' | 'Rock'
  | 'Bug' | 'Ghost' | 'Steel' | 'Fire' | 'Water' | 'Grass'
  | 'Electric' | 'Psychic' | 'Ice' | 'Dragon' | 'Dark' | 'Fairy';

/** Which side of the battle a Pokémon belongs to (used by photo import). */
export type Side = 'player' | 'enemy';

/**
 * A single Pokémon as configured in the calculator UI. This is the input the
 * engine turns into an `@smogon/calc` Pokémon.
 */
export interface ChampionsSet {
  /** Base species name as known to `@smogon/calc`, e.g. "Garchomp". */
  species: string;
  /**
   * If Mega Evolved, the mega forme key from {@link ./data/megas}, e.g.
   * "Garchomp-Mega". When set, the engine overlays the mega's stats, types
   * and ability on top of the base species.
   */
  megaForme?: string;
  /** Always 50 in Champions, but kept explicit so the model stays general. */
  level: number;
  nature: NatureName;
  /** Stat Points invested per stat (0–32 each, ≤66 total). */
  statPoints: StatSpread;
  ability?: string;
  item?: string;
  /** Up to four move names. */
  moves: string[];

  // ---- In-battle state (optional; defaults to "fresh, unboosted") ----
  /** Stat stage changes, -6..+6 per stat (HP unused). */
  boosts?: Partial<StatTable>;
  /** Major status, e.g. "brn" (relevant for physical attackers / Facade). */
  status?: string;
  /** Current HP; defaults to full. */
  curHP?: number;
}
