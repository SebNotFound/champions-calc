/**
 * Offline scraper: builds src/champions/data/sprite-hashes.json from the EXACT
 * in-game Champions menu sprites hosted on Bulbagarden Archives
 * (Category:Champions_menu_sprites). These are what the Team Preview shows, so
 * matching against them is far more reliable than generic sprites.
 *
 * The category is read live, so re-running picks up roster changes (e.g. the new
 * regulation on 2026-06-17 that adds megas like Mega Raichu).
 *
 * Output is an ARRAY of { species, a, d } fingerprints. Several reference
 * sprites can map to the same species (cosmetic formes — Vivillon patterns,
 * Alcremie flavours, Furfrou trims — are mechanically identical, so they all
 * point at the base species). Mechanically distinct formes (Alola, Galar, Hisui,
 * Therian, Paldea, …) keep their own name. Mega sprites are skipped because the
 * preview shows base forms.
 *
 * Usage: node scripts/fetch-sprites.mjs
 */
import { PNG } from 'pngjs';
import { Dex } from '@pkmn/dex';
import { Generations } from '@pkmn/data';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spriteThumbnail, encodeThumb } from '../src/champions/phash.ts';

const API = 'https://archives.bulbagarden.net/w/api.php';
const OUT = fileURLToPath(new URL('../src/champions/data/sprite-hashes.json', import.meta.url));
const UA = { 'User-Agent': 'ChampionsCalc/1.0 (sprite fingerprinting; educational)' };
const toID = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

// `() => true` keeps the National Dex (Champions includes mons not in Scarlet/
// Violet, which the default gen-9 filter would otherwise drop).
const gen = new Generations(Dex, () => true).get(9);

// National-dex number -> base species name. Every species (forme or not) knows
// its base via `baseSpecies`, so this covers mons whose base entry carries a
// forme tag (e.g. Aegislash, Aerodactyl, Kangaskhan).
const numToBase = {};
for (const s of gen.species) {
  if (s.num > 0 && !(s.num in numToBase)) numToBase[s.num] = s.baseSpecies || s.name;
}

const sameStats = (a, b) => ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].every((k) => a[k] === b[k]);

/** Resolve a "Menu CP 0645-Therian.png" filename to a species the calc can build. */
function resolveSpecies(title) {
  const m = title.match(/Menu CP (\d+)(?:-(.+))?\.png$/i);
  if (!m) return null;
  if (m[2] && /^Mega/i.test(m[2])) return null; // megas don't appear in Team Preview
  const base = numToBase[parseInt(m[1], 10)];
  if (!base) return null;
  if (!m[2]) return base;

  const baseSpecie = gen.species.get(base);
  const forme = gen.species.get(toID(`${base}-${m[2].trim().replace(/\s+/g, '-')}`));
  // Keep the forme only if it's mechanically different (types or base stats);
  // otherwise it's cosmetic and we point it at the base species.
  if (forme?.exists && (forme.types.join() !== baseSpecie.types.join() || !sameStats(forme.baseStats, baseSpecie.baseStats))) {
    return forme.name;
  }
  return base;
}

async function fetchBuffer(url, tries = 3) {
  for (let t = 0; t < tries; t++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return Buffer.from(await r.arrayBuffer());
    } catch (e) {
      if (t === tries - 1) throw e;
      await new Promise((s) => setTimeout(s, 400 * (t + 1)));
    }
  }
}

async function listFiles() {
  const url = `${API}?action=query&list=categorymembers&cmtitle=Category:Champions_menu_sprites&cmlimit=500&cmtype=file&format=json&formatversion=2`;
  const j = await (await fetch(url, { headers: UA })).json();
  return (j.query?.categorymembers ?? []).map((m) => m.title);
}

async function imageUrls(titles) {
  const urls = {};
  for (let i = 0; i < titles.length; i += 50) {
    const chunk = titles.slice(i, i + 50);
    const url = `${API}?action=query&format=json&formatversion=2&prop=imageinfo&iiprop=url&titles=${encodeURIComponent(chunk.join('|'))}`;
    const j = await (await fetch(url, { headers: UA })).json();
    for (const p of j.query?.pages ?? []) {
      if (p.imageinfo?.[0]?.url) urls[p.title] = p.imageinfo[0].url;
    }
  }
  return urls;
}

async function pool(items, size, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

const titles = await listFiles();
console.log(`Category files: ${titles.length}`);
const urls = await imageUrls(titles);

const entries = [];
let done = 0, skipped = 0;
const speciesSeen = new Set();
await pool(titles, 5, async (title) => {
  const species = resolveSpecies(title);
  const url = urls[title];
  if (!species || !url) { skipped++; return; }
  try {
    const png = PNG.sync.read(await fetchBuffer(url));
    entries.push({ species, t: encodeThumb(spriteThumbnail(png.data, png.width, png.height)) });
    speciesSeen.add(toID(species));
  } catch {
    skipped++;
  }
  if (++done % 40 === 0) console.log(`  ${done}/${titles.length}`);
});

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(entries));
console.log(`Wrote ${entries.length} sprite fingerprints (${speciesSeen.size} species), skipped ${skipped}.`);
