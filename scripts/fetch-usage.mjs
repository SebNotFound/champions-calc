/**
 * Offline scraper: builds src/champions/data/usage.json from munchstats.
 *
 * munchstats exposes a by-name usage API for the Champions Reg M-A format:
 *   https://munchstats.com/api/pokemon-usage/gen9championsvgc2026regma/<Name>
 * It returns moves_list / items_list / abilities_list / spreads_list (each
 * sorted by usage %), plus pokemon_names (the full roster). We take the top of
 * each to build a "most-used set" per Pokémon, and bundle it so the app can
 * auto-fill a Pokémon's common set on first pick.
 *
 * Usage:
 *   node scripts/fetch-usage.mjs --test   # fetch a few, print, don't write
 *   node scripts/fetch-usage.mjs          # fetch the whole roster, write json
 *
 * Re-run any time to refresh the snapshot.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const FORMAT = 'gen9championsvgc2026regma';
const API = (name) =>
  `https://munchstats.com/api/pokemon-usage/${FORMAT}/${encodeURIComponent(name)}`;
const OUT = fileURLToPath(new URL('../src/champions/data/usage.json', import.meta.url));
const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

async function fetchUsage(name) {
  const res = await fetch(API(name), { headers: { 'User-Agent': 'Mozilla/5.0 (usage scraper)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** "Adamant:2/32/0/0/0/32" -> { nature, sp:{hp,atk,...} } */
function parseSpread(spread) {
  if (!spread) return {};
  const [nature, nums] = spread.split(':');
  const parts = (nums ?? '').split('/').map((n) => Number(n) || 0);
  if (parts.length !== 6) return { nature };
  const sp = {};
  STAT_KEYS.forEach((k, i) => { sp[k] = parts[i]; });
  return { nature, sp };
}

async function scrapeMon(name) {
  const j = await fetchUsage(name);
  const { nature, sp } = parseSpread(j.spreads_list?.[0]?.[0]);
  return {
    name,
    moves: (j.moves_list ?? []).slice(0, 4).map((m) => m[0]),
    item: j.items_list?.[0]?.[0],
    ability: j.abilities_list?.[0]?.[0],
    nature,
    sp,
  };
}

async function getRoster() {
  const j = await fetchUsage('Basculegion');
  return (j.pokemon_names ?? []).map((e) => e[0]);
}

/** Run a list through `fn` with limited concurrency. */
async function pool(items, size, fn) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); }
  }));
  return out;
}

const toID = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

if (process.argv.includes('--test')) {
  for (const name of ['Basculegion', 'Flutter Mane', 'Landorus-Therian', 'Incineroar']) {
    console.log(name, '=>', JSON.stringify(await scrapeMon(name)));
  }
} else {
  const roster = await getRoster();
  console.log(`Roster: ${roster.length} Pokémon. Scraping…`);
  let done = 0;
  const results = await pool(roster, 8, async (name) => {
    try {
      const set = await scrapeMon(name);
      if (++done % 25 === 0) console.log(`  ${done}/${roster.length}`);
      return set;
    } catch (e) {
      console.warn(`  skip ${name}: ${e.message}`);
      return null;
    }
  });
  const usage = {};
  for (const r of results) if (r && r.moves.length) usage[toID(r.name)] = r;
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(usage));
  console.log(`Wrote ${Object.keys(usage).length} sets to ${OUT}`);
}
