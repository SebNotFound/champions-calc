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
  /** Doubles support move on your side (×1.5 to your attacks). */
  helpingHand: boolean;
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

/** Field for the INCOMING calc (they attack you): your screens, shared weather/terrain. */
export function toIncomingField(state: FieldState): Field {
  return makeField({
    weather: state.weather,
    terrain: state.terrain,
    defenderSide: toSide(state.yours),
  });
}

interface Props {
  value: FieldState;
  onChange: (next: FieldState) => void;
  /** Clear every battle condition (field + each Pokémon's status/boosts). */
  onReset: () => void;
}

export function FieldControls({ value, onChange, onReset }: Props) {
  const patch = (changes: Partial<FieldState>) => onChange({ ...value, ...changes });

  return (
    <div className="field-controls">
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

      <label className="field-hh">
        <input type="checkbox" checked={value.helpingHand} onChange={(e) => patch({ helpingHand: e.target.checked })} />
        Helping Hand
      </label>

      <ScreenToggles
        label="Your screens"
        hint="On your side — cut the damage you take (incoming)"
        screens={value.yours}
        onChange={(c) => patch({ yours: { ...value.yours, ...c } })}
      />
      <ScreenToggles
        label="Their screens"
        hint="On their side — cut the damage you deal (outgoing)"
        screens={value.theirs}
        onChange={(c) => patch({ theirs: { ...value.theirs, ...c } })}
      />

      <button className="reset-btn" onClick={onReset} title="Clear weather, terrain, screens, statuses and boosts">
        Reset conditions
      </button>
    </div>
  );
}

function ScreenToggles({
  label, hint, screens, onChange,
}: {
  label: string;
  hint: string;
  screens: Screens;
  onChange: (changes: Partial<Screens>) => void;
}) {
  return (
    <div className="screen-group" title={hint}>
      <span className="screen-label">{label}</span>
      <label><input type="checkbox" checked={screens.reflect} onChange={(e) => onChange({ reflect: e.target.checked })} /> Reflect</label>
      <label><input type="checkbox" checked={screens.lightScreen} onChange={(e) => onChange({ lightScreen: e.target.checked })} /> Light Screen</label>
      <label><input type="checkbox" checked={screens.auroraVeil} onChange={(e) => onChange({ auroraVeil: e.target.checked })} /> Aurora Veil</label>
    </div>
  );
}
