import { describe, it, expect } from 'vitest';
import { buildPokemon, calcOne, calcSpread, makeField, countMegas, isTeamMegaLegal } from './engine';
import { emptySpread } from './stats';
import type { ChampionsSet } from './types';

/** Small helper to build a set with sensible defaults for tests. */
function set(partial: Partial<ChampionsSet> & { species: string }): ChampionsSet {
  return {
    level: 50,
    nature: 'Hardy',
    statPoints: emptySpread(),
    moves: [],
    ...partial,
  };
}

describe('buildPokemon injects Champions stats', () => {
  it('uses the SP HP formula for max HP (Garchomp base 108 → 183 at 0 SP)', () => {
    const chomp = buildPokemon(set({ species: 'Garchomp', nature: 'Jolly' }));
    expect(chomp.maxHP()).toBe(183);
  });

  it('uses the SP formula for offensive stats (Garchomp base 130 Atk, Adamant → 165)', () => {
    const chomp = buildPokemon(set({ species: 'Garchomp', nature: 'Adamant' }));
    expect(chomp.rawStats.atk).toBe(165);
  });
});

describe('Mega overlay', () => {
  it('applies mega stats, types and ability (Mega Charizard Y)', () => {
    const zardY = buildPokemon(
      set({ species: 'Charizard', megaForme: 'Charizard-Mega-Y', nature: 'Modest' }),
    );
    // Mega Y base SpA 159, Modest, 0 SP → floor((floor((318+31)/2)+5)*1.1) = 196
    expect(zardY.rawStats.spa).toBe(196);
    expect(zardY.types).toContain('Fire');
    expect(zardY.types).toContain('Flying');
    expect(zardY.hasAbility('Drought')).toBe(true);
  });
});

describe('damage + type chart flow through the engine', () => {
  const attacker = set({
    species: 'Garchomp',
    nature: 'Adamant',
    statPoints: { ...emptySpread(), atk: 32 },
    ability: 'Rough Skin',
    item: 'Life Orb',
    moves: ['Earthquake'],
  });

  it('deals 0 to a Ground-immune (Flying) target', () => {
    const result = calcOne(buildPokemon(attacker), buildPokemon(set({ species: 'Tornadus' })), 'Earthquake');
    expect(result.maxDamage).toBe(0);
  });

  it('deals real damage to a non-immune target, with sane percentages', () => {
    const result = calcOne(buildPokemon(attacker), buildPokemon(set({ species: 'Amoonguss' })), 'Earthquake');
    expect(result.maxDamage).toBeGreaterThan(0);
    expect(result.minDamage).toBeLessThanOrEqual(result.maxDamage);
    expect(result.maxPercent).toBeGreaterThan(0);
    expect(result.maxPercent).toBe(Math.round((result.maxDamage / result.defenderMaxHP) * 1000) / 10);
  });
});

describe('Stat Points reach the damage formula', () => {
  // Regression: `calculate()` clones its inputs and clone() rebuilds stats from
  // base/IV/EV/nature, so a naive rawStats override is discarded. More invested
  // Attack MUST produce more damage.
  const atkSet = (atkSP: number) =>
    set({
      species: 'Garchomp',
      nature: 'Adamant',
      statPoints: { ...emptySpread(), atk: atkSP },
      moves: ['Earthquake'],
    });

  it('more Atk Stat Points = more damage', () => {
    const defender = buildPokemon(set({ species: 'Amoonguss' }));
    const low = calcOne(buildPokemon(atkSet(0)), defender, 'Earthquake').maxDamage;
    const high = calcOne(buildPokemon(atkSet(32)), defender, 'Earthquake').maxDamage;
    expect(high).toBeGreaterThan(low);
  });

  it('more HP Stat Points = lower damage taken (%)', () => {
    const attacker = buildPokemon(atkSet(32));
    const frail = calcOne(attacker, buildPokemon(set({ species: 'Amoonguss', statPoints: emptySpread() })), 'Earthquake').maxPercent;
    const bulky = calcOne(attacker, buildPokemon(set({ species: 'Amoonguss', statPoints: { ...emptySpread(), hp: 32, spd: 32 } })), 'Earthquake').maxPercent;
    expect(bulky).toBeLessThan(frail);
  });
});

describe('custom Champions mega abilities', () => {
  it('Dragonize retypes Normal moves to Dragon (so they are immune vs Fairy)', () => {
    const fairy = buildPokemon(set({ species: 'Clefable' }));
    const mega = buildPokemon(set({ species: 'Feraligatr', megaForme: 'Feraligatr-Mega' }));
    const plain = buildPokemon(set({ species: 'Feraligatr' }));
    // Dragon is immune to Fairy → Dragonized Double-Edge does 0; Normal does not.
    expect(calcOne(mega, fairy, 'Double-Edge').maxDamage).toBe(0);
    expect(calcOne(plain, fairy, 'Double-Edge').maxDamage).toBeGreaterThan(0);
  });

  it('Dragonize adds the -ate boost + Dragon STAB-less super-effective hit', () => {
    const chomp = buildPokemon(set({ species: 'Garchomp' })); // Dragon/Ground: weak to Dragon
    const mega = buildPokemon(set({ species: 'Feraligatr', megaForme: 'Feraligatr-Mega', statPoints: { ...emptySpread(), atk: 32 } }));
    const plain = buildPokemon(set({ species: 'Feraligatr', statPoints: { ...emptySpread(), atk: 32 } }));
    // Normal (1x) vs Dragon-retyped (2x) + 1.2 ≈ well over double the damage.
    expect(calcOne(mega, chomp, 'Double-Edge').maxDamage)
      .toBeGreaterThan(calcOne(plain, chomp, 'Double-Edge').maxDamage * 2);
  });

  it('Mega Sol makes the holder attack as if under Sun, regardless of real weather', () => {
    const meg = buildPokemon(set({ species: 'Meganium', megaForme: 'Meganium-Mega', statPoints: { ...emptySpread(), spa: 32 } }));
    const target = buildPokemon(set({ species: 'Amoonguss' }));
    // Weather Ball is Fire under Sun, Water under Rain — Mega Sol forces Sun, so
    // Rain and Sun give the same result.
    const inRain = calcOne(meg, target, 'Weather Ball', makeField({ weather: 'Rain' }));
    const inSun = calcOne(meg, target, 'Weather Ball', makeField({ weather: 'Sun' }));
    expect(inRain.maxDamage).toBe(inSun.maxDamage);
    expect(inRain.maxDamage).toBeGreaterThan(0);
  });
});

describe('multi-target (spread) calc', () => {
  it('returns one summary per defender', () => {
    const attacker = buildPokemon(
      set({ species: 'Garchomp', nature: 'Adamant', statPoints: { ...emptySpread(), atk: 32 }, moves: ['Earthquake'] }),
    );
    const defenders = ['Amoonguss', 'Tyranitar', 'Gyarados'].map((s) => buildPokemon(set({ species: s })));
    const results = calcSpread(attacker, defenders, 'Earthquake');
    expect(results).toHaveLength(3);
    expect(results.every((r) => typeof r.maxPercent === 'number')).toBe(true);
  });
});

describe('one-Mega-per-team rule', () => {
  it('counts megas and flags illegal teams', () => {
    const team: ChampionsSet[] = [
      set({ species: 'Charizard', megaForme: 'Charizard-Mega-Y' }),
      set({ species: 'Garchomp' }),
      set({ species: 'Gengar', megaForme: 'Gengar-Mega' }),
    ];
    expect(countMegas(team)).toBe(2);
    expect(isTeamMegaLegal(team)).toBe(false);
    expect(isTeamMegaLegal(team.slice(1))).toBe(true);
  });
});
