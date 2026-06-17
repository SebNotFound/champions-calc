/**
 * Download sprites for the Champions-original Megas that Pokemon Showdown has no
 * art for (Mega Eelektross, Mega Raichu X/Y, ...), from Serebii's Pokemon HOME
 * renders. Those are 120x120, the same size as the Showdown dex sprites we use
 * everywhere else, so they drop in cleanly.
 *
 * Writes the images to public/sprites/champions/ and a name -> filename manifest
 * to src/champions/data/champions-sprites.json, which spriteUrl() reads to serve
 * the local file for those formes. Re-run when a Regulation adds new Megas:
 *
 *   node scripts/fetch-champions-sprites.mjs
 *
 * Anything the script can't map or that Serebii doesn't carry is simply left out;
 * the app falls back to the base-species sprite for those (see baseSpriteUrl).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { Sprites } from '@pkmn/img';
import { Dex } from '@pkmn/dex';

const OUT_DIR = 'public/sprites/champions';
const MANIFEST = 'src/champions/data/champions-sprites.json';
mkdirSync(OUT_DIR, { recursive: true });

const megas = JSON.parse(readFileSync('src/champions/data/megas.json', 'utf8'));
const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

/** Serebii's filename suffix for a mega forme name. */
function serebiiSuffix(name) {
  if (/-Mega-X$/.test(name)) return '-mx';
  if (/-Mega-Y$/.test(name)) return '-my';
  if (/-Mega-Z$/.test(name)) return '-mz';
  if (/-Mega$/.test(name)) return '-m';
  return null;
}

async function fetchOk(url) {
  try { const r = await fetch(url); return r.ok ? r : null; } catch { return null; }
}

const manifest = {};
let bundled = 0;
for (const m of megas) {
  // Skip the real Megas: Showdown already serves their art.
  let showdownUrl = '';
  try { showdownUrl = Sprites.getDexPokemon(m.name).url; } catch { /* unknown to @pkmn/img */ }
  if (showdownUrl && (await fetchOk(showdownUrl))) continue;

  const suffix = serebiiSuffix(m.name);
  const num = Dex.species.get(m.baseSpecies)?.num;
  if (!suffix || !num) { console.log('skip (no map):  ', m.name); continue; }

  const dex = String(num).padStart(3, '0');
  const url = `https://www.serebii.net/pokemonhome/pokemon/small/${dex}${suffix}.png`;
  const res = await fetchOk(url);
  if (!res) { console.log('no Serebii art:  ', m.name, `(${dex}${suffix})`); continue; }

  const buf = Buffer.from(await res.arrayBuffer());
  // A Serebii miss returns an HTML page, not a PNG — guard on the PNG magic bytes.
  if (!(buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)) {
    console.log('not a PNG:       ', m.name); continue;
  }
  const file = `${slug(m.name)}.png`;
  writeFileSync(`${OUT_DIR}/${file}`, buf);
  manifest[m.name] = file;
  bundled++;
  console.log('bundled:         ', m.name.padEnd(24), '<-', url);
}

writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
console.log(`\n${bundled} sprites bundled into ${OUT_DIR}\nmanifest: ${MANIFEST}`);
