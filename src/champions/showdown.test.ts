import { describe, it, expect } from 'vitest';
import { parseShowdownTeam, evsToStatPoints } from './showdown';

const SAMPLE = `
Pickle (Gholdengo) @ Choice Specs
Ability: Good as Gold
Level: 50
Tera Type: Steel
EVs: 4 HP / 252 SpA / 252 Spe
Modest Nature
- Make It Rain
- Shadow Ball
- Nasty Plot
- Protect

Garchomp (M) @ Life Orb
Ability: Rough Skin
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Earthquake
- Dragon Claw

Incineroar @ Sitrus Berry
Ability: Intimidate
EVs: 252 HP / 4 Atk / 252 SpD
Careful Nature
- Fake Out
- Knock Off
`;

describe('parseShowdownTeam', () => {
  const team = parseShowdownTeam(SAMPLE);

  it('parses every Pokémon block', () => {
    expect(team).toHaveLength(3);
  });

  it('reads nickname/species, item, ability, nature and moves', () => {
    const gholdengo = team[0];
    expect(gholdengo.species).toBe('Gholdengo'); // species from "Nick (Species)"
    expect(gholdengo.item).toBe('Choice Specs');
    expect(gholdengo.ability).toBe('Good as Gold');
    expect(gholdengo.nature).toBe('Modest');
    expect(gholdengo.moves).toEqual(['Make It Rain', 'Shadow Ball', 'Nasty Plot', 'Protect']);
  });

  it('strips the gender marker from the species', () => {
    expect(team[1].species).toBe('Garchomp');
  });

  it('converts EVs to Stat Points (8 EV = 1 SP, 252 → 32)', () => {
    expect(team[0].statPoints).toMatchObject({ spa: 32, spe: 32, hp: 1 });
    expect(team[1].statPoints).toMatchObject({ atk: 32, spe: 32, spd: 1 });
    expect(team[2].statPoints).toMatchObject({ hp: 32, spd: 32, atk: 1 });
  });

  it('pads movesets to four slots', () => {
    expect(team[1].moves).toHaveLength(4);
    expect(team[1].moves[2]).toBe('');
  });
});

describe('evsToStatPoints', () => {
  it('caps each stat at 32 and the total at 66', () => {
    const sp = evsToStatPoints({ hp: 252, atk: 252, def: 252 });
    const total = sp.hp + sp.atk + sp.def + sp.spa + sp.spd + sp.spe;
    expect(sp.hp).toBeLessThanOrEqual(32);
    expect(total).toBeLessThanOrEqual(66);
  });

  it('converts real EV spreads (252-style) by 8 EV per SP', () => {
    expect(evsToStatPoints({ hp: 4, spa: 252, spe: 252 })).toMatchObject({ hp: 1, spa: 32, spe: 32 });
  });

  it('keeps Champions pastes (Stat Points already in the EVs field) as-is', () => {
    // e.g. Kingambit "32 HP / 25 Atk / 9 Spe" must NOT be divided by 8.
    expect(evsToStatPoints({ hp: 32, atk: 25, spe: 9 })).toMatchObject({ hp: 32, atk: 25, spe: 9 });
  });
});
