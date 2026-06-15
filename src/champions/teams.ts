/**
 * Teams and saved-slot persistence.
 *
 * The app keeps up to 10 of your teams and 10 enemy teams. The whole thing is
 * mirrored to localStorage so your slots survive a refresh. A "team" is just a
 * name plus up to six Pokémon sets.
 */
import { defaultSet, autofillSet } from './factory';
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

/**
 * A Mega seeded the same way the editor does it: the recommended set, but with
 * the held item cleared. A Mega's item slot is its Mega Stone, which the editor
 * shows as "No item (Mega)" and the engine applies through the megaForme overlay,
 * so leaving a stone in the item field would just be noise.
 */
function megaSeed(species: string, megaForme: string): ChampionsSet {
  return { ...autofillSet(species, megaForme), item: undefined };
}

/**
 * The first-run state: one example team on each side so there's something to see.
 *
 * Every member is filled with its recommended Champions set (moves, item,
 * ability, nature, Stat Points) via autofillSet, the same fill you get when you
 * pick a species in the editor, so nothing shows up with empty moves. This only
 * applies on a fresh visit; an existing saved state in localStorage is kept as is.
 */
export function seedState(): SavedState {
  const myTeam: Team = {
    name: 'My Team',
    members: [
      megaSeed('Aerodactyl', 'Aerodactyl-Mega'),
      autofillSet('Ceruledge'),
    ],
  };
  const enemyTeam: Team = {
    name: 'Enemy',
    members: [
      megaSeed('Charizard', 'Charizard-Mega-Y'),
      autofillSet('Incineroar'),
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
