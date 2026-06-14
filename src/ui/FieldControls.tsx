/**
 * Battlefield conditions shared by every matchup in the view: weather, terrain,
 * Helping Hand (your side) and screens.
 *
 * Screens are per-side, because a screen belongs to one side of the field:
 *   - "Your screens" reduce the damage you TAKE  → applied to the incoming calc.
 *   - "Their screens" reduce the damage you DEAL → applied to the outgoing calc.
 * So the two directions each use the right side's screens.
 */
import { makeField } from '../champions';
import type { Field } from '@smogon/calc';

type Weather = 'Sun' | 'Rain' | 'Sand' | 'Snow';
type Terrain = 'Electric' | 'Grassy' | 'Psychic' | 'Misty';

export interface Screens {
  reflect: boolean;
  lightScreen: boolean;
  auroraVeil: boolean;
}

export interface FieldState {
  weather?: Weather;
  terrain?: Terrain;
  /** Helping Hand on your side — ×1.5 to the damage you deal (outgoing). */
  helpingHand: boolean;
  /** Helping Hand on the enemy side — ×1.5 to the damage you take (incoming). */
  enemyHelpingHand: boolean;
  /** Screens on your side — reduce the damage you take (incoming). */
  yours: Screens;
  /** Screens on their side — reduce the damage you deal (outgoing). */
  theirs: Screens;
}

const noScreens = (): Screens => ({ reflect: false, lightScreen: false, auroraVeil: false });

export const defaultFieldState: FieldState = {
  weather: undefined,
  terrain: undefined,
  helpingHand: false,
  enemyHelpingHand: false,
  yours: noScreens(),
  theirs: noScreens(),
};

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

/**
 * Weather + terrain — the field-wide conditions that affect both directions.
 * Lives centered in the header.
 */
export function WeatherTerrain({ value, onChange }: { value: FieldState; onChange: (next: FieldState) => void }) {
  const patch = (changes: Partial<FieldState>) => onChange({ ...value, ...changes });
  return (
    <div className="weather-terrain">
      <label className="field">
        <span>Weather</span>
        <select
          value={value.weather ?? ''}
          onChange={(e) => patch({ weather: (e.target.value || undefined) as Weather | undefined })}
        >
          <option value="">None</option>
          <option value="Sun">Sun</option>
          <option value="Rain">Rain</option>
          <option value="Sand">Sand</option>
          <option value="Snow">Snow</option>
        </select>
      </label>
      <label className="field">
        <span>Terrain</span>
        <select
          value={value.terrain ?? ''}
          onChange={(e) => patch({ terrain: (e.target.value || undefined) as Terrain | undefined })}
        >
          <option value="">None</option>
          <option value="Electric">Electric</option>
          <option value="Grassy">Grassy</option>
          <option value="Psychic">Psychic</option>
          <option value="Misty">Misty</option>
        </select>
      </label>
    </div>
  );
}

/**
 * One side's battle conditions, shown as a box beneath that side's team:
 *   - Your side  (ally): Helping Hand + your screens (cut the damage you take).
 *   - Enemy side (foe):  their screens (cut the damage you deal).
 */
export function SideConditions({
  variant, title, screens, onScreens, helpingHand, onHelpingHand,
}: {
  variant: 'ally' | 'foe';
  title: string;
  screens: Screens;
  onScreens: (changes: Partial<Screens>) => void;
  /** Only the ally side passes these (Helping Hand is your support move). */
  helpingHand?: boolean;
  onHelpingHand?: (v: boolean) => void;
}) {
  return (
    <div className={`side-cond side-cond--${variant}`}>
      <div className="side-cond-head">{title}</div>
      {onHelpingHand && (
        <label className="cond-row">
          <input type="checkbox" checked={!!helpingHand} onChange={(e) => onHelpingHand(e.target.checked)} />
          <span>Helping Hand</span>
        </label>
      )}
      <label className="cond-row">
        <input type="checkbox" checked={screens.reflect} onChange={(e) => onScreens({ reflect: e.target.checked })} />
        <span>Reflect</span>
      </label>
      <label className="cond-row">
        <input type="checkbox" checked={screens.lightScreen} onChange={(e) => onScreens({ lightScreen: e.target.checked })} />
        <span>Light Screen</span>
      </label>
      <label className="cond-row">
        <input type="checkbox" checked={screens.auroraVeil} onChange={(e) => onScreens({ auroraVeil: e.target.checked })} />
        <span>Aurora Veil</span>
      </label>
    </div>
  );
}
