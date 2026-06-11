/**
 * Champions format / regulation constants.
 *
 * Pokémon Champions launched as the official VGC platform (Regulation "MA").
 * Compared with the Scarlet/Violet era it makes three rules changes that the
 * calculator has to respect:
 *
 *   • Terastallization is **removed**.
 *   • Mega Evolution is **back**, via the Omni Ring — but only **one** Mega
 *     per team.
 *   • The roster is a subset of the National Dex (see ./data/roster).
 *
 * Mechanically the damage *formula* is the familiar modern one, so we run the
 * underlying `@smogon/calc` engine on generation 9 and layer the Champions
 * rules on top.
 */

/** Generation whose damage mechanics Champions reuses. */
export const CHAMPIONS_GEN = 9 as const;

export const CHAMPIONS_FORMAT = {
  /** Regulation label shown in the UI. */
  regulation: 'Reg MA',
  /** All battles are level-50 doubles. */
  level: 50,
  gameType: 'Doubles',
  /** Tera is gone in Champions. */
  teraAllowed: false,
  /** Mega Evolution is allowed, capped at one per team. */
  megaAllowed: true,
  maxMegasPerTeam: 1,
  /** You build six and bring four (the Team Preview pick). */
  teamSize: 6,
  bringCount: 4,
} as const;
