/**
 * Teams and saved-slot persistence.
 *
 * The app keeps up to 10 of your teams and 10 enemy teams. The whole thing is
 * mirrored to localStorage so your slots survive a refresh. A "team" is just a
 * name plus up to six Pokémon sets.
 */
import { defaultSet } from './factory';
import type { ChampionsSet } from './types';

export interface Team {
  name: string;
  members: ChampionsSet[];
}

export const MAX_TEAMS = 10;
export const MAX_TEAM_SIZE = 6;

/** Everything we persist between sessions. */
export interface SavedState {
  playerTeams: Team[];
  enemyTeams: Team[];
  playerTeamIdx: number;
  enemyTeamIdx: number;
}

export function emptyTeam(name = 'New team'): Team {
  return { name, members: [defaultSet('Garchomp')] };
}

/** The first-run state: one example team on each side so there's something to see. */
export function seedState(): SavedState {
  const myTeam: Team = {
    name: 'My Team',
    members: [
      {
        ...defaultSet('Garchomp'),
        nature: 'Jolly',
        item: 'Life Orb',
        statPoints: { hp: 0, atk: 32, def: 0, spa: 0, spd: 2, spe: 32 },
        moves: ['Earthquake', 'Dragon Claw', 'Stone Edge', ''],
      },
      { ...defaultSet('Gholdengo'), nature: 'Modest', item: 'Choice Specs',
        statPoints: { hp: 4, atk: 0, def: 0, spa: 32, spd: 0, spe: 30 },
        moves: ['Make It Rain', 'Shadow Ball', 'Nasty Plot', 'Protect'] },
    ],
  };
  const enemyTeam: Team = {
    name: 'Enemy',
    members: [
      { ...defaultSet('Amoonguss'), nature: 'Calm', statPoints: { hp: 32, atk: 0, def: 20, spa: 0, spd: 14, spe: 0 } },
      { ...defaultSet('Incineroar'), nature: 'Careful', statPoints: { hp: 32, atk: 0, def: 16, spa: 0, spd: 18, spe: 0 } },
    ],
  };
  return { playerTeams: [myTeam], enemyTeams: [enemyTeam], playerTeamIdx: 0, enemyTeamIdx: 0 };
}

const STORAGE_KEY = 'champions-calc/v1';

/** Load saved state from localStorage, or null if there's nothing valid stored. */
export function loadState(): SavedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedState;
    if (!parsed.playerTeams?.length || !parsed.enemyTeams?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Persist state to localStorage (best-effort; ignores quota/serialisation errors). */
export function saveState(state: SavedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage might be full or unavailable (private mode) — non-fatal.
  }
}
