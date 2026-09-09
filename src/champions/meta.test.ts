import { describe, expect, it } from 'vitest';
import { moveInfo, speciesMoves } from './meta';

describe('moveInfo', () => {
  it('returns metadata only for complete move names', () => {
    expect(moveInfo('C')).toBeUndefined();
    expect(moveInfo('Close')).toBeUndefined();
    expect(moveInfo('Close Combat')).toEqual({
      type: 'Fighting',
      category: 'Physical',
      pp: 5,
      basePower: 120,
    });
  });

  it.each([
    ['Slash', 80],
    ['Bone Rush', 30],
    ['Night Daze', 90],
    ['First Impression', 100],
    ['Spirit Shackle', 90],
    ['Fire Lash', 90],
    ['Trop Kick', 85],
    ['Beak Blast', 120],
    ['Snipe Shot', 85],
    ['Apple Acid', 90],
    ['Grav Apple', 90],
    ['Meteor Assault', 170],
    ['Psyshield Bash', 90],
    ['Mountain Gale', 120],
    ['Infernal Parade', 65],
  ] as const)('shows the Champions base power for %s', (move, basePower) => {
    expect(moveInfo(move)?.basePower).toBe(basePower);
  });

  it.each([
    ['Crabhammer', 12],
    ['Bone Rush', 12],
    ['Iron Head', 16],
    ['Night Daze', 12],
    ['Moonblast', 16],
    ['First Impression', 12],
    ['Spirit Shackle', 12],
    ['Fire Lash', 16],
    ['Trop Kick', 16],
    ['Beak Blast', 8],
    ['Snipe Shot', 16],
    ['Snap Trap', 16],
    ['Apple Acid', 12],
    ['Grav Apple', 12],
    ['Meteor Assault', 8],
    ['Dire Claw', 16],
    ['Psyshield Bash', 12],
    ['Mountain Gale', 12],
    ['Infernal Parade', 16],
    ['Make It Rain', 8],
    ['Double Shock', 8],
    ['Syrup Bomb', 12],
    ['Wish', 8],
    ['Strength Sap', 8],
  ] as const)('shows the current Champions PP for %s', (move, pp) => {
    expect(moveInfo(move)?.pp).toBe(pp);
  });

  it.each([
    ['Growth', 'Grass'],
    ['Snap Trap', 'Steel'],
  ] as const)('shows the Champions type for %s', (move, type) => {
    expect(moveInfo(move)?.type).toBe(type);
  });
});

describe('Regulation M-C move availability', () => {
  it('removes Pound from Politoed', async () => {
    expect(await speciesMoves('Politoed')).not.toContain('Pound');
  });

  it('removes Mirror Coat and Metal Burst from Archaludon', async () => {
    const moves = await speciesMoves('Archaludon');
    expect(moves).not.toContain('Mirror Coat');
    expect(moves).not.toContain('Metal Burst');
  });

  it('keeps Slash available to Archaludon', async () => {
    expect(await speciesMoves('Archaludon')).toContain('Slash');
  });
});
