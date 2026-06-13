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
  /** Import from pasted pokepaste / Showdown text. */
  onImportText: () => void;
  /** Import from a screenshot / photo. */
  onImportPhoto: () => void;
  /** Import your own team from its in-game report (player side only). */
  onImportReport?: () => void;
}

export function TeamSlots({ teams, activeIdx, onSelect, onAdd, onRename, onDelete, onImportText, onImportPhoto, onImportReport }: Props) {
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
        <button onClick={onDelete} disabled={teams.length <= 1} title="Delete this team" aria-label="Delete team">🗑</button>
      </div>
      <div className="team-import-row">
        <button className="import-btn" onClick={onImportText} title="Import: paste a pokepaste / Showdown team">Text</button>
        <button className="import-btn" onClick={onImportPhoto} title="Import: from a Team Preview screenshot or photo">Photo</button>
        {onImportReport && (
          <button className="import-btn" onClick={onImportReport} title="Import: from your team's in-game Stats + Moves screenshots">Report</button>
        )}
      </div>
    </div>
  );
}
