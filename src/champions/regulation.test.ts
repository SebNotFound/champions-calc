import { describe, expect, it } from 'vitest';
import { listItems, listSpeciesOptions } from './engine';

describe('Regulation M-C roster data', () => {
  it('includes all 24 newly eligible Pokémon', () => {
    const additions = [
      'Persian-Alola',
      'Arboliva',
      'Baxcalibur',
      'Cinderace',
      'Farfetch’d',
      'Gogoat',
      'Golisopod',
      'Grapploct',
      'Indeedee',
      'Inteleon',
      'Mabosstiff',
      'Mr. Mime',
      'Perrserker',
      'Persian',
      'Pincurchin',
      'Rillaboom',
      'Salamence',
      'Sirfetch’d',
      'Squawkabilly',
      'Swalot',
      'Thievul',
      'Toxtricity',
      'Wigglytuff',
      'Pawmot',
    ];

    expect(listSpeciesOptions()).toEqual(expect.arrayContaining(additions));
  });

  it('includes the newly available held items', () => {
    const additions = [
      'Leek',
      'Rocky Helmet',
      'Air Balloon',
      'Red Card',
      'Binding Band',
      'Eject Button',
      'Normal Gem',
      'Terrain Extender',
      'Electric Seed',
      'Psychic Seed',
      'Misty Seed',
      'Grassy Seed',
      'Absolite Z',
      'Garchompite Z',
      'Lucarionite Z',
      'Golisopite',
      'Baxcalibrite',
      'Salamencite',
    ];

    expect(listItems()).toEqual(expect.arrayContaining(additions));
  });
});
