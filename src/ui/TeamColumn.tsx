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
  onImportReport?: () => void;
  onAddMember: () => void;
  onRemoveMember: (i: number) => void;
  /** Swap two members by index — enables dragging a list member onto an active
   *  target card (and reordering within the list). Shares the 'text/plain' index
   *  drag format with the defender cards. */
  onMemberReorder?: (from: number, to: number) => void;
  addLabel?: string;
  /** Allegiance colour: 'ally' (your cyan side) or 'foe' (the enemy's rose side). */
  variant?: 'ally' | 'foe';
}

export function TeamColumn(props: Props) {
  const team = props.teams[props.activeIdx];
  const selectable = !!props.onSelectMember;
  const reorderable = !!props.onMemberReorder;

  return (
    <div className={`team-col${props.variant ? ` team-col--${props.variant}` : ''}`}>
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
        onImportReport={props.onImportReport}
      />
      <div className="member-list">
        {team.members.map((m, i) => {
          const label = m.megaForme ? (getMega(m.megaForme)?.label ?? m.species) : m.species;
          const active = selectable && i === props.selectedMemberIdx;
          return (
            <div
              key={i}
              className={`member${active ? ' active' : ''}${selectable ? '' : ' member--static'}${reorderable ? ' member--drag' : ''}`}
              onClick={selectable ? () => props.onSelectMember!(i) : undefined}
              draggable={reorderable || undefined}
              onDragStart={reorderable ? (e) => { e.dataTransfer.setData('text/plain', String(i)); e.dataTransfer.effectAllowed = 'move'; } : undefined}
              onDragOver={reorderable ? (e) => e.preventDefault() : undefined}
              onDrop={reorderable ? (e) => {
                e.preventDefault();
                const from = Number(e.dataTransfer.getData('text/plain'));
                if (!Number.isNaN(from)) props.onMemberReorder!(from, i);
              } : undefined}
              title={reorderable ? 'Drag onto an active target to bring it to the front' : undefined}
            >
              <img
                className="member-sprite"
                src={spriteUrl(m.megaForme ?? m.species)}
                alt=""
                loading="lazy"
                draggable={false}
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
