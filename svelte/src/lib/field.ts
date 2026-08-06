/**
 * Battlefield conditions: weather, terrain, Helping Hand and screens.
 *
 * This mirrors the React app's FieldControls helpers. The logic is entirely
 * framework-free, but over there it lives inside a .tsx alongside the components,
 * so it can't be imported from here. It is the one bit of shared logic this
 * workspace has to restate rather than reuse (a good argument for lifting it into
 * the core one day).
 */
import { makeField } from '@core';
import type { Field } from '@smogon/calc';

export type Weather = 'Sun' | 'Rain' | 'Sand' | 'Snow';
export type Terrain = 'Electric' | 'Grassy' | 'Psychic' | 'Misty';

export interface Screens {
  reflect: boolean;
  lightScreen: boolean;
  auroraVeil: boolean;
}

export interface FieldState {
  weather?: Weather;
  terrain?: Terrain;
  /** Helping Hand on your side: x1.5 to the damage you deal (outgoing). */
  helpingHand: boolean;
  /** Helping Hand on the enemy side: x1.5 to the damage you take (incoming). */
  enemyHelpingHand: boolean;
  /** Screens on your side: reduce the damage you take (incoming). */
  yours: Screens;
  /** Screens on their side: reduce the damage you deal (outgoing). */
  theirs: Screens;
}

const noScreens = (): Screens => ({ reflect: false, lightScreen: false, auroraVeil: false });

export const defaultFieldState = (): FieldState => ({
  weather: undefined,
  terrain: undefined,
  helpingHand: false,
  enemyHelpingHand: false,
  yours: noScreens(),
  theirs: noScreens(),
});

const toSide = (s: Screens) => ({ isReflect: s.reflect, isLightScreen: s.lightScreen, isAuroraVeil: s.auroraVeil });

/** Field for the OUTGOING calc (you attack them): your Helping Hand, their screens. */
export function toField(state: FieldState): Field {
  return makeField({
    weather: state.weather,
    terrain: state.terrain,
    attackerSide: { isHelpingHand: state.helpingHand },
    defenderSide: toSide(state.theirs),
  });
}

/** Field for the INCOMING calc (they attack you): their Helping Hand, your screens. */
export function toIncomingField(state: FieldState): Field {
  return makeField({
    weather: state.weather,
    terrain: state.terrain,
    attackerSide: { isHelpingHand: state.enemyHelpingHand },
    defenderSide: toSide(state.yours),
  });
}
