/**
 * Battlefield conditions shared by every matchup in the view: weather, terrain,
 * Helping Hand (attacker side) and screens (defender side). These all feed the
 * damage formula, so they live once at the top and apply to all targets.
 */
import { makeField } from '../champions';
import type { Field } from '@smogon/calc';

type Weather = 'Sun' | 'Rain' | 'Sand' | 'Snow';
type Terrain = 'Electric' | 'Grassy' | 'Psychic' | 'Misty';

export interface FieldState {
  weather?: Weather;
  terrain?: Terrain;
  /** Doubles support move on the attacker's side (×1.5). */
  helpingHand: boolean;
  reflect: boolean;
  lightScreen: boolean;
  auroraVeil: boolean;
}

export const defaultFieldState: FieldState = {
  weather: undefined,
  terrain: undefined,
  helpingHand: false,
  reflect: false,
  lightScreen: false,
  auroraVeil: false,
};

/** Convert the UI field state into a `@smogon/calc` Field for calculations. */
export function toField(state: FieldState): Field {
  return makeField({
    weather: state.weather,
    terrain: state.terrain,
    attackerSide: { isHelpingHand: state.helpingHand },
    defenderSide: {
      isReflect: state.reflect,
      isLightScreen: state.lightScreen,
      isAuroraVeil: state.auroraVeil,
    },
  });
}

interface Props {
  value: FieldState;
  onChange: (next: FieldState) => void;
}

export function FieldControls({ value, onChange }: Props) {
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

      <div className="field-toggles">
        <label><input type="checkbox" checked={value.helpingHand} onChange={(e) => patch({ helpingHand: e.target.checked })} /> Helping Hand</label>
        <label><input type="checkbox" checked={value.reflect} onChange={(e) => patch({ reflect: e.target.checked })} /> Reflect</label>
        <label><input type="checkbox" checked={value.lightScreen} onChange={(e) => patch({ lightScreen: e.target.checked })} /> Light Screen</label>
        <label><input type="checkbox" checked={value.auroraVeil} onChange={(e) => patch({ auroraVeil: e.target.checked })} /> Aurora Veil</label>
      </div>
    </div>
  );
}
