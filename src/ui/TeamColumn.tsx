/**
 * A team box: saved-team slots + the member chips for the active team. Used on
 * both sides so the layout is symmetric — your team on the left, the enemy team
 * on the right. On the player side the chips are clickable to choose the
 * attacker; on the enemy side they're a static roster (edited via the target
 * cards in the centre).
 */
import { TeamSlots } from './TeamSlots';
import { spriteUrl, getMega, MAX_TEAM_SIZE } from '../champions';
import type { Team } from '../champions';

interface Props {
  title: string;
  teams: Team[];
  activeIdx: number;
  /** Highlighted/selected member (player side); omit to make chips static. */
  selectedMemberIdx?: number;
  onSelectMember?: (i: number) => void;
  onSelectTeam: (i: number) => void;
  onAddTeam: () => void;
  onRenameTeam: (name: string) => void;
  onDeleteTeam: () => void;
  onImportText: () => void;
  onImportPhoto: () => void;
  onAddMember: () => void;
  onRemoveMember: (i: number) => void;
  addLabel?: string;
}

export function TeamColumn(props: Props) {
  const team = props.teams[props.activeIdx];
  const selectable = !!props.onSelectMember;

  return (
    <div className="team-col">
      <h2 className="col-title">{props.title}</h2>
      <TeamSlots
        teams={props.teams}
        activeIdx={props.activeIdx}
        onSelect={props.onSelectTeam}
        onAdd={props.onAddTeam}
        onRename={props.onRenameTeam}
        onDelete={props.onDeleteTeam}
        onImportText={props.onImportText}
        onImportPhoto={props.onImportPhoto}
      />
      <div className="member-list">
        {team.members.map((m, i) => {
          const label = m.megaForme ? (getMega(m.megaForme)?.label ?? m.species) : m.species;
          const active = selectable && i === props.selectedMemberIdx;
          return (
            <div
              key={i}
              className={`member${active ? ' active' : ''}${selectable ? '' : ' member--static'}`}
              onClick={selectable ? () => props.onSelectMember!(i) : undefined}
            >
              <img
                className="member-sprite"
                src={spriteUrl(m.megaForme ?? m.species)}
                alt=""
                loading="lazy"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
              />
              <span className="member-name">{label}</span>
              {team.members.length > 1 && (
                <button
                  className="icon-btn"
                  onClick={(e) => { e.stopPropagation(); props.onRemoveMember(i); }}
                  title="Remove"
                  aria-label="Remove Pokémon"
                >×</button>
              )}
            </div>
          );
        })}
        {team.members.length < MAX_TEAM_SIZE && (
          <button className="member-add" onClick={props.onAddMember}>{props.addLabel ?? '+ Add Pokémon'}</button>
        )}
      </div>
    </div>
  );
}
