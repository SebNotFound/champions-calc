import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Generations } from '@smogon/calc';

const sources = {
  species: 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species_names.csv',
  forms: 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_form_names.csv',
  move: 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/move_names.csv',
  ability: 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/ability_names.csv',
  item: 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/item_names.csv',
  nature: 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/nature_names.csv',
  type: 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/type_names.csv',
};

const outputPath = fileURLToPath(new URL('../src/i18n/data/ja.generated.ts', import.meta.url));
const megaPath = fileURLToPath(new URL('../src/champions/data/megas.json', import.meta.url));
const checkOnly = process.argv.includes('--check');

const natureNames = [
  'Adamant', 'Bashful', 'Bold', 'Brave', 'Calm',
  'Careful', 'Docile', 'Gentle', 'Hardy', 'Hasty',
  'Impish', 'Jolly', 'Lax', 'Lonely', 'Mild',
  'Modest', 'Naive', 'Naughty', 'Quiet', 'Quirky',
  'Rash', 'Relaxed', 'Sassy', 'Serious', 'Timid',
];

const typeNames = [
  'Normal', 'Fighting', 'Flying', 'Poison', 'Ground', 'Rock',
  'Bug', 'Ghost', 'Steel', 'Fire', 'Water', 'Grass',
  'Electric', 'Psychic', 'Ice', 'Dragon', 'Dark', 'Fairy',
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(cell);
      cell = '';
    } else if (character === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (character !== '\r') {
      cell += character;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  if (rows[0]?.[0]) rows[0][0] = rows[0][0].replace(/^\uFEFF/, '');
  return rows;
}

function normalizeEnglish(value) {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/♀/g, 'f')
    .replace(/♂/g, 'm')
    .replace(/[^a-z0-9]+/gi, '')
    .toLowerCase();
}

function compareEnglish(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function pairedNames(csv, nameColumn = 2) {
  const byId = new Map();

  for (const row of parseCsv(csv).slice(1)) {
    const [resourceId, languageId] = row;
    if (languageId !== '1' && languageId !== '9' && languageId !== '11') continue;

    const entry = byId.get(resourceId) ?? {};
    if (languageId === '9') entry.english = row[nameColumn];
    if (languageId === '1') entry.japanese = row[nameColumn];
    if (languageId === '11') entry.japaneseFallback = row[nameColumn];
    byId.set(resourceId, entry);
  }

  const names = new Map();
  for (const entry of byId.values()) {
    const japanese = entry.japanese || entry.japaneseFallback;
    if (!entry.english || !japanese) continue;
    names.set(normalizeEnglish(entry.english), japanese);
  }
  return names;
}

function pairedForms(csv) {
  const byId = new Map();

  for (const row of parseCsv(csv).slice(1)) {
    const [formId, languageId, formName = '', pokemonName = ''] = row;
    if (languageId !== '1' && languageId !== '9' && languageId !== '11') continue;

    const entry = byId.get(formId) ?? {};
    const value = { formName, pokemonName };
    if (languageId === '9') entry.english = value;
    if (languageId === '1') entry.japanese = value;
    if (languageId === '11') entry.japaneseFallback = value;
    byId.set(formId, entry);
  }

  return [...byId.values()].flatMap((entry) => {
    const japanese = entry.japanese || entry.japaneseFallback;
    return entry.english && japanese ? [{ english: entry.english, japanese }] : [];
  });
}

function formAliases(baseSpecies, forme, canonical) {
  const readableForme = forme.replaceAll('-', ' ');
  const aliases = new Set([
    canonical,
    `${baseSpecies} ${readableForme}`,
    `${readableForme} ${baseSpecies}`,
    `${baseSpecies} ${readableForme} Form`,
    `${readableForme} Form ${baseSpecies}`,
    `${baseSpecies} ${readableForme} Forme`,
    `${readableForme} Forme ${baseSpecies}`,
  ]);

  const regionalNames = {
    Alola: 'Alolan',
    Galar: 'Galarian',
    Hisui: 'Hisuian',
    Paldea: 'Paldean',
  };

  for (const [region, adjective] of Object.entries(regionalNames)) {
    if (!forme.includes(region)) continue;
    const regionalForme = readableForme.replace(region, adjective);
    aliases.add(`${regionalForme} ${baseSpecies}`);
    aliases.add(`${baseSpecies} ${regionalForme}`);
  }

  const mega = forme.match(/^Mega(?:-([XYZ]))?$/);
  if (mega) aliases.add(`Mega ${baseSpecies}${mega[1] ? ` ${mega[1]}` : ''}`);
  if (forme === 'Gmax') aliases.add(`Gigantamax ${baseSpecies}`);

  const specialAliases = {
    'Darmanitan-Galar': ['Standard Galarian Darmanitan'],
    'Darmanitan-Galar-Zen': ['Zen Galarian Darmanitan'],
    'Greninja-Bond': ['Battle Bond Greninja'],
    'Minior-Meteor': ['Red Meteor Minior'],
    'Rockruff-Dusk': ['Own Tempo Rockruff'],
    'Tauros-Paldea-Aqua': ['Paldean Tauros Aqua Breed'],
    'Tauros-Paldea-Blaze': ['Paldean Tauros Blaze Breed'],
    'Tauros-Paldea-Combat': ['Paldean Tauros Combat Breed'],
    'Toxtricity-Gmax': ['Gigantamax Amped Toxtricity'],
    'Toxtricity-Low-Key-Gmax': ['Gigantamax Low Key Toxtricity'],
    'Urshifu-Gmax': ['Gigantamax Single Strike Urshifu'],
    'Urshifu-Rapid-Strike-Gmax': ['Gigantamax Rapid Strike Urshifu'],
  };

  for (const alias of specialAliases[canonical] ?? []) aliases.add(alias);

  return [...aliases].map(normalizeEnglish);
}

function findForm(record, forms) {
  const aliases = new Set(formAliases(record.baseSpecies, record.forme, record.name));
  const exact = forms.find((entry) => aliases.has(normalizeEnglish(entry.english.pokemonName)));
  if (exact) return exact;

  const baseKey = normalizeEnglish(record.baseSpecies);
  const formKey = normalizeEnglish(record.forme);
  const candidates = forms.filter((entry) => {
    const pokemonKey = normalizeEnglish(entry.english.pokemonName);
    const labelKey = normalizeEnglish(entry.english.formName);
    return pokemonKey.includes(baseKey) && (pokemonKey.includes(formKey) || labelKey.includes(formKey));
  });

  return candidates.length === 1 ? candidates[0] : undefined;
}

function japaneseFormName(form, baseJapanese) {
  const fullName = form.japanese.pokemonName.trim();
  if (fullName) return fullName;

  const formName = form.japanese.formName.trim();
  if (!formName) return baseJapanese;
  if (!baseJapanese || formName.includes(baseJapanese) || formName.startsWith('メガ')) return formName;
  return `${baseJapanese}（${formName}）`;
}

function megaName(canonical, baseJapanese) {
  const match = canonical.match(/-Mega(?:-([XYZ]))?$/);
  if (!match || !baseJapanese) return undefined;

  const suffix = { X: 'Ｘ', Y: 'Ｙ', Z: 'Ｚ' }[match[1]] ?? '';
  return `メガ${baseJapanese}${suffix}`;
}

function typedSpeciesName(record, baseJapanese, typeNameMap) {
  if (record.baseSpecies !== 'Silvally' || !typeNames.includes(record.forme)) return undefined;
  const japaneseType = typeNameMap.get(normalizeEnglish(record.forme));
  return baseJapanese && japaneseType ? `${baseJapanese}（${japaneseType}タイプ）` : undefined;
}

function findBaseSpecies(record, baseNames) {
  const candidates = [];
  if (record.baseSpecies) candidates.push(record.baseSpecies);

  const parts = record.name.split('-');
  for (let end = parts.length - 1; end > 0; end -= 1) {
    candidates.push(parts.slice(0, end).join('-'));
  }

  return candidates.find((candidate) => baseNames.has(normalizeEnglish(candidate)))
    || record.baseSpecies
    || record.name;
}

function buildSpeciesNames(species, megas, speciesCsv, formCsv, typeNameMap) {
  const baseNames = pairedNames(speciesCsv);
  const forms = pairedForms(formCsv);
  const records = new Map(species.map((entry) => [entry.name, entry]));

  for (const mega of megas) {
    if (records.has(mega.name)) continue;
    records.set(mega.name, {
      name: mega.name,
      baseSpecies: mega.baseSpecies,
      forme: mega.name.slice(mega.baseSpecies.length + 1),
    });
  }

  const names = {};
  for (const sourceRecord of records.values()) {
    const baseSpecies = findBaseSpecies(sourceRecord, baseNames);
    const record = {
      ...sourceRecord,
      baseSpecies,
      forme: sourceRecord.forme || (
        sourceRecord.name.startsWith(`${baseSpecies}-`)
          ? sourceRecord.name.slice(baseSpecies.length + 1)
          : ''
      ),
    };
    const direct = baseNames.get(normalizeEnglish(record.name));
    if (direct) {
      names[record.name] = direct;
      continue;
    }

    const baseJapanese = baseNames.get(normalizeEnglish(record.baseSpecies));
    const form = record.forme ? findForm(record, forms) : undefined;
    const localizedForm = form ? japaneseFormName(form, baseJapanese) : undefined;
    const localizedMega = megaName(record.name, baseJapanese);
    const localizedType = typedSpeciesName(record, baseJapanese, typeNameMap);
    const localized = localizedForm || localizedMega || localizedType;
    if (localized) names[record.name] = localized;
  }

  for (const record of records.values()) {
    if (names[record.name]) continue;

    const equivalent = record.name === 'Ogerpon-Teal-Tera'
      ? 'Ogerpon'
      : record.name
        .replace(/-Totem$/, '')
        .replace(/-Tera$/, '')
        .replace(/-Bond$/, '');
    const equivalentName = names[equivalent]
      || baseNames.get(normalizeEnglish(equivalent));
    if (equivalentName) names[record.name] = equivalentName;
  }

  if (!names['Aegislash-Both']) {
    const aegislash = baseNames.get(normalizeEnglish('Aegislash'));
    if (aegislash) names['Aegislash-Both'] = aegislash;
  }

  return names;
}

function selectNames(canonicalNames, localizedNames) {
  const selected = {};
  for (const canonical of canonicalNames) {
    const localized = localizedNames.get(normalizeEnglish(canonical));
    if (localized) selected[canonical] = localized;
  }
  return selected;
}

function sortedRecord(record) {
  return Object.fromEntries(Object.entries(record).sort(([left], [right]) => compareEnglish(left, right)));
}

function addHiddenPowerNames(moveNames, moveNameMap, typeNameMap) {
  const hiddenPower = moveNameMap.get(normalizeEnglish('Hidden Power'));
  if (!hiddenPower) return;

  for (const type of typeNames) {
    const canonical = `Hidden Power ${type}`;
    const japaneseType = typeNameMap.get(normalizeEnglish(type));
    if (japaneseType) moveNames[canonical] = `${hiddenPower}（${japaneseType}）`;
  }
}

function addAbilityVariants(abilityNames, abilityNameMap, canonicalAbilities) {
  for (const canonical of canonicalAbilities) {
    if (abilityNames[canonical]) continue;
    const baseName = canonical.replace(/ \([^)]*\)$/, '');
    const japanese = abilityNameMap.get(normalizeEnglish(baseName));
    if (japanese) abilityNames[canonical] = japanese;
  }
}

async function fetchSource(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'exo-calc-localization' } });
  if (!response.ok) throw new Error(`Could not fetch ${url}: ${response.status}`);
  return response.text();
}

const sourceEntries = await Promise.all(
  Object.entries(sources).map(async ([key, url]) => [key, await fetchSource(url)]),
);
const csv = Object.fromEntries(sourceEntries);

const generation = Generations.get(9);
const species = [...generation.species];
const megas = JSON.parse(readFileSync(megaPath, 'utf8'));

const canonical = {
  species: [...new Set([...species.map((entry) => entry.name), ...megas.map((entry) => entry.name)])],
  move: [...generation.moves].map((entry) => entry.name),
  ability: [...generation.abilities].map((entry) => entry.name),
  item: [...generation.items].map((entry) => entry.name),
  nature: natureNames,
  type: typeNames,
};

const abilityNameMap = pairedNames(csv.ability);
const moveNameMap = pairedNames(csv.move);
const typeNameMap = pairedNames(csv.type);
const abilityNames = selectNames(canonical.ability, abilityNameMap);
const moveNames = selectNames(canonical.move, moveNameMap);
addAbilityVariants(abilityNames, abilityNameMap, canonical.ability);
addHiddenPowerNames(moveNames, moveNameMap, typeNameMap);

const output = {
  ability: sortedRecord(abilityNames),
  item: sortedRecord(selectNames(canonical.item, pairedNames(csv.item))),
  move: sortedRecord(moveNames),
  nature: sortedRecord(selectNames(canonical.nature, pairedNames(csv.nature))),
  species: sortedRecord(buildSpeciesNames(species, megas, csv.species, csv.forms, typeNameMap)),
  type: sortedRecord(selectNames(canonical.type, typeNameMap)),
};

const file = [
  "import type { JapaneseNameCatalog } from '../types';",
  '',
  `export const JAPANESE_NAMES: JapaneseNameCatalog = ${JSON.stringify(output, null, 2)};`,
  '',
].join('\n');

const missing = Object.fromEntries(
  Object.entries(canonical).map(([category, values]) => [
    category,
    values.filter((value) => !output[category][value]).sort(compareEnglish),
  ]),
);

if (checkOnly) {
  let current = '';
  try {
    current = readFileSync(outputPath, 'utf8');
  } catch {
    console.error('The generated Japanese catalog does not exist.');
    process.exitCode = 1;
  }

  if (current && current !== file) {
    console.error('The generated Japanese catalog is out of date.');
    process.exitCode = 1;
  } else if (current) {
    console.log('The generated Japanese catalog is current.');
  }
} else {
  writeFileSync(outputPath, file, 'utf8');
  console.log(`Wrote ${Object.values(output).reduce((total, entries) => total + Object.keys(entries).length, 0)} Japanese names.`);
}

for (const [category, values] of Object.entries(missing)) {
  if (values.length) console.log(`${category}: ${values.length} unmatched (${values.join(', ')})`);
}
