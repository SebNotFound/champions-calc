<script lang="ts">
  /** Weather and terrain: the field-wide conditions. Lives centered in the header. */
  import type { FieldState, Weather, Terrain } from './field';

  let { value, onChange }: { value: FieldState; onChange: (next: FieldState) => void } = $props();

  const patch = (changes: Partial<FieldState>) => onChange({ ...value, ...changes });
</script>

<div class="weather-terrain">
  <label class="field">
    <span>Weather</span>
    <select
      value={value.weather ?? ''}
      onchange={(e) => patch({ weather: (e.currentTarget.value || undefined) as Weather | undefined })}
    >
      <option value="">None</option>
      <option value="Sun">Sun</option>
      <option value="Rain">Rain</option>
      <option value="Sand">Sand</option>
      <option value="Snow">Snow</option>
    </select>
  </label>
  <label class="field">
    <span>Terrain</span>
    <select
      value={value.terrain ?? ''}
      onchange={(e) => patch({ terrain: (e.currentTarget.value || undefined) as Terrain | undefined })}
    >
      <option value="">None</option>
      <option value="Electric">Electric</option>
      <option value="Grassy">Grassy</option>
      <option value="Psychic">Psychic</option>
      <option value="Misty">Misty</option>
    </select>
  </label>
</div>
