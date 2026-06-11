/**
 * Offline scraper: builds src/champions/data/megas.json from the official
 * Pokémon Showdown Champions calculator's species data.
 *
 * That file (calc/data/species.js) carries every Champions mega forme — the
 * classic ones AND the new Legends Z-A ones (Mega Meganium, Mega Dragonite, …) —
 * each with types, base stats, weight, ability and base species. We extract them
 * all (skipping any whose base species isn't a real Pokémon, e.g. CAP mons) so
 * the app can overlay accurate mega data.
 *
 * Usage: node scripts/fetch-megas.mjs   (re-run to refresh)
 */
import { Dex } from '@pkmn/dex';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = 'https://calc.pokemonshowdown.com/calc/data/species.js';
const OUT = fileURLToPath(new URL('../src/champions/data/megas.json', import.meta.url));
// Showdown's stat abbreviations → our keys.
const STAT = { hp: 'hp', at: 'atk', df: 'def', sa: 'spa', sd: 'spd', sp: 'spe' };

const text = await (await fetch(SRC, { headers: { 'User-Agent': 'Mozilla/5.0' } })).text();

/** Given the index of an opening brace, return the text inside its matching pair. */
function objectAt(open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return text.slice(open + 1, i);
  }
  return '';
}

const byName = new Map();
const entry = /'([A-Z][A-Za-z0-9'. -]*-Mega[A-Za-z-]*)':\s*\{/g;
let match;
while ((match = entry.exec(text))) {
  const name = match[1];
  const inner = objectAt(entry.lastIndex - 1);

  const baseSpecies = (inner.match(/baseSpecies:\s*'([^']*)'/) || [])[1];
  if (!baseSpecies) continue; // a partial override, not the full forme entry
  const base = Dex.species.get(baseSpecies);
  if (!base?.exists) continue; // skip CAP / non-real base species

  const types = [...(inner.match(/types:\s*\[([^\]]*)\]/)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((t) => t[1]);
  const ability = (inner.match(/abilities:\s*\{\s*0:\s*'([^']*)'/) || [])[1] || base.abilities[0];
  const weightkg = Number((inner.match(/weightkg:\s*([\d.]+)/) || [])[1] || base.weightkg);

  // Start from the base stats, then apply the forme's overrides.
  const baseStats = { ...base.baseStats };
  for (const part of (inner.match(/bs:\s*\{([^}]*)\}/)?.[1] ?? '').split(',')) {
    const m = part.trim().match(/(hp|at|df|sa|sd|sp):\s*(\d+)/);
    if (m) baseStats[STAT[m[1]]] = Number(m[2]);
  }

  const label = 'Mega ' + name.replace(/-Mega/, '').replace(/-/g, ' ');
  byName.set(name, { name, label, baseSpecies, types, baseStats, ability, weightkg });
}

const megas = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(megas, null, 0));
console.log(`Wrote ${megas.length} megas to ${OUT}`);
console.log('Sample:', JSON.stringify(megas.find((m) => m.name === 'Meganium-Mega')));
