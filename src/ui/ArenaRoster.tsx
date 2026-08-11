/**
 * The arena management bar's roster for one side.
 *
 * Unlike the classic team column (a vertical list with import buttons), the arena
 * shows the whole team as a row of six Poké-ring tiles, with the saved-team tabs
 * beside the side label. The two active battlers are outlined in the side's
 * colour, and tapping a tile makes that Pokémon active by swapping it into one of
 * the two front slots.
 */
import { Sprite, typeHex } from './widgets';
import { getMega, getSpeciesTypes, MAX_TEAM_SIZE, MAX_TEAMS } from '../champions';
import type { Team } from '../champions';

/** A faint radial ring tint keyed by a Pokémon's primary type. */
function ringTint(species: string, megaForme?: string): string {
  const types = megaForme ? (getMega(megaForme)?.types ?? []) : (getSpeciesTypes(species) ?? []);
  return `radial-gradient(circle, #fff 30%, color-mix(in srgb, ${typeHex(types[0] ?? 'Normal')} 26%, #fff))`;
}

/** Short label for a tile (the full name rarely fits under a 34px ring). */
function shortName(name: string): string {
  const base = name.split('-')[0];
  return base.length > 8 ? `${base.slice(0, 7)}.` : base;
}

interface Props {
  side: 'ally' | 'foe';
  label: string;
  teams: Team[];
  activeIdx: number;
  onSelectTeam: (i: number) => void;
  onAddTeam: () => void;
  /** Bring the clicked member into the front line (swap with slot 0 or 1). */
  onActivate: (index: number) => void;
  onAddMember: () => void;
  /** Opens the side's import dialog (text / photo). */
  onImport: () => void;
}

export function ArenaRoster({
  side, label, teams, activeIdx, onSelectTeam, onAddTeam, onActivate, onAddMember, onImport,
}: Props) {
  const team = teams[activeIdx];
  const members = team.members;

  return (
    <div className={`arena-roster arena-roster--${side}`}>
      <div className="arena-roster-head">
        <span className="arena-roster-label">{label}</span>
        <div className="arena-roster-tabs">
          {teams.map((t, i) => (
            <button
              key={i}
              className={`arena-team-tab${i === activeIdx ? ' active' : ''}`}
              onClick={() => onSelectTeam(i)}
              title={t.name}
            >
              {t.name || `Team ${i + 1}`}
            </button>
          ))}
          {teams.length < MAX_TEAMS && (
            <button className="arena-team-tab arena-team-tab--add" onClick={onAddTeam} title="New team" aria-label="New team">+</button>
          )}
          <button className="arena-team-tab arena-team-tab--import" onClick={onImport} title="Import a team">Import</button>
        </div>
      </div>

      <div className="arena-roster-grid">
        {members.map((m, i) => {
          const name = m.megaForme ?? m.species;
          return (
            <button
              key={i}
              className={`arena-tile${i < 2 ? ' active' : ''}`}
              onClick={() => onActivate(i)}
              /* Also draggable onto a battleground card, which swaps the two.
                 The cards read this same 'text/plain' index on drop. */
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', String(i));
                e.dataTransfer.effectAllowed = 'move';
              }}
              title={`${name} — click to send to the front line, or drag it onto a card`}
            >
              <span className="arena-tile-ring" style={{ background: ringTint(m.species, m.megaForme) }}>
                <Sprite className="arena-tile-sprite" species={name} />
              </span>
              <span className="arena-tile-name">{shortName(name)}</span>
            </button>
          );
        })}
        {members.length < MAX_TEAM_SIZE && (
          <button className="arena-tile arena-tile--add" onClick={onAddMember} title="Add a Pokémon">
            <span className="arena-tile-ring arena-tile-ring--add">+</span>
            <span className="arena-tile-name">Add</span>
          </button>
        )}
      </div>
    </div>
  );
}
