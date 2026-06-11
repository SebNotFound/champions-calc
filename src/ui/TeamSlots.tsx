/**
 * The saved-team slot bar: numbered buttons to switch between up to 10 teams,
 * a "+" to add one, an editable name, and Import / Delete actions. Used on both
 * the player and enemy sides.
 */
import { MAX_TEAMS } from '../champions';
import type { Team } from '../champions';

interface Props {
  teams: Team[];
  activeIdx: number;
  onSelect: (i: number) => void;
  onAdd: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onImport: () => void;
}

export function TeamSlots({ teams, activeIdx, onSelect, onAdd, onRename, onDelete, onImport }: Props) {
  const active = teams[activeIdx];
  return (
    <div className="team-slots">
      <div className="slot-numbers">
        {teams.map((t, i) => (
          <button
            key={i}
            className={i === activeIdx ? 'slot active' : 'slot'}
            onClick={() => onSelect(i)}
            title={t.name}
          >
            {i + 1}
          </button>
        ))}
        {teams.length < MAX_TEAMS && (
          <button className="slot slot-add" onClick={onAdd} title="New team">+</button>
        )}
      </div>
      <div className="team-slots-actions">
        <input
          className="team-name"
          value={active.name}
          onChange={(e) => onRename(e.target.value)}
          aria-label="Team name"
        />
        <button onClick={onImport} title="Import a pokepaste / Showdown team">Import</button>
        <button onClick={onDelete} disabled={teams.length <= 1} title="Delete this team" aria-label="Delete team">🗑</button>
      </div>
    </div>
  );
}
