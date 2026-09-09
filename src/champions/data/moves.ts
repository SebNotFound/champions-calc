/**
 * Move data that differs between Pokémon Champions and Scarlet/Violet.
 * See serebii.net/pokemonchampions/updatedattacks.shtml.
 */
export interface ChampionsMoveChange {
  basePower?: number;
  pp?: number;
  type?: 'Grass' | 'Steel';
  slicing?: boolean;
  punching?: boolean;
}

const moveId = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '');

const MOVE_CHANGES: Record<string, ChampionsMoveChange> = {
  growth: { type: 'Grass' },
  crabhammer: { pp: 12 },
  slash: { basePower: 80 },
  bonerush: { basePower: 30, pp: 12 },
  ironhead: { pp: 16 },
  nightdaze: { basePower: 90, pp: 12 },
  moonblast: { pp: 16 },
  firstimpression: { basePower: 100, pp: 12 },
  spiritshackle: { basePower: 90, pp: 12 },
  firelash: { basePower: 90, pp: 16 },
  tropkick: { basePower: 85, pp: 16 },
  beakblast: { basePower: 120, pp: 8 },
  snipeshot: { basePower: 85, pp: 16 },
  snaptrap: { pp: 16, type: 'Steel' },
  appleacid: { basePower: 90, pp: 12 },
  gravapple: { basePower: 90, pp: 12 },
  meteorassault: { basePower: 170, pp: 8 },
  direclaw: { pp: 16 },
  psyshieldbash: { basePower: 90, pp: 12 },
  mountaingale: { basePower: 120, pp: 12 },
  infernalparade: { basePower: 65, pp: 16 },
  makeitrain: { pp: 8 },
  doubleshock: { pp: 8, punching: true },
  syrupbomb: { pp: 12 },
  wish: { pp: 8 },
  strengthsap: { pp: 8 },
  crushclaw: { slicing: true },
  shadowclaw: { slicing: true },
  dragonclaw: { slicing: true },
};

const REMOVED_MOVES: Record<string, ReadonlySet<string>> = {
  politoed: new Set(['pound']),
  archaludon: new Set(['mirrorcoat', 'metalburst']),
};

export function championsMoveChange(name: string): ChampionsMoveChange | undefined {
  return MOVE_CHANGES[moveId(name)];
}

export function isChampionsMoveAvailable(species: string, move: string): boolean {
  return !REMOVED_MOVES[moveId(species)]?.has(moveId(move));
}
