/**
 * Builds a single self-contained team-finder.html from the VGCPastes "Champions
 * M-C" Google Sheet (Sheet A). The sheet already lists each team's six species
 * (cols 37-42) and their held items (cols 7,10,13,16,19,22), plus metadata, so
 * no pokepaste fetching is needed.
 *
 * Re-run to refresh: `node team-finder/build.mjs`
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Icons } from '@pkmn/img';
import { Dex } from '@pkmn/dex';
const gen = Dex.forGen(9);

const SHEET = '1axlwmzPA49rYkqXh7zHvAtSP-TKbM0ijGYBPRflLSWw';
const GID = '2001945654';
const CSV = `https://docs.google.com/spreadsheets/d/${SHEET}/export?format=csv&gid=${GID}`;
// Output into the app's public/ so Vite serves and deploys it at /team-finder.html.
const OUT = fileURLToPath(new URL('../public/team-finder.html', import.meta.url));
// Credited in the footer next to the M-C Team List link. Set once known.
const SHEET_B_CREATOR = '<a href="https://x.com/DonutsVGC" target="_blank" rel="noopener">DonutsVGC</a>';

const SPEC = [37, 38, 39, 40, 41, 42];
const ITEM = [7, 10, 13, 16, 19, 22];
const COL = { id: 0, desc: 1, creator: 3, paste: 24, date: 29, event: 30, rank: 31 };

const toID = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
// Team Preview shows the pre-mega sprite, so we match on the base species: strip
// the Mega suffix but keep real formes (Indeedee-F, Arcanine-Hisui, ...).
const baseName = (s) => String(s).replace(/-Mega(-[XYZ])?$/i, '').trim();
// Normalise the long dashes some team names use down to a plain hyphen.
const clean = (s) => String(s || '').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();

/** Minimal RFC-4180 CSV parser (handles quotes, commas and newlines in cells). */
function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c === '\r') { /* skip */ }
    else cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const res = await fetch(CSV, { headers: { 'User-Agent': 'Mozilla/5.0' } });
if (!res.ok) throw new Error(`sheet fetch failed: HTTP ${res.status}`);
const rows = parseCSV(await res.text());

const teams = [];
for (const r of rows) {
  if (!r[COL.id] || !/^MC\d+/.test(r[COL.id].trim())) continue;
  const mons = SPEC.map((sc, k) => {
    const s = (r[sc] || '').trim();
    const it = (r[ITEM[k]] || '').trim();
    return s ? { s, i: it, k: toID(baseName(s)), j: it ? toID(it) : '' } : null;
  }).filter(Boolean);
  if (mons.length < 5) continue; // skip malformed rows
  teams.push({
    id: r[COL.id].trim(),
    d: clean(r[COL.desc]),
    c: (r[COL.creator] || '').trim(),
    e: (r[COL.event] || '').trim(),
    r: (r[COL.rank] || '').trim(),
    dt: (r[COL.date] || '').trim(),
    u: (r[COL.paste] || '').trim(),
    m: mons,
  });
}

// ---- Sheet B: a small curated list with tiers. Its species aren't in columns,
// so we parse the pokepaste of each team that Sheet A does not already have. ----
const SHEET_B = '1RQcl7m7HsVZGZzqbEOEoX-a5PGStgNOmUC6_pUWJjN4';
const GID_B = '489731103';
const pasteId = (u) => (String(u).match(/pokepast\.es\/([0-9a-f]+)/) || [])[1];

/** Parse a raw pokepaste into [{s, i, k, j}] (species+item), mega-forme aware. */
function parsePaste(text) {
  return text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean).map((block) => {
    let line = block.split('\n')[0].trim();
    let item = '';
    const at = line.split(' @ ');
    if (at.length > 1) { item = at[1].trim(); line = at[0].trim(); }
    const paren = line.match(/\(([^)]+)\)\s*$/);
    let sp = paren ? paren[1].trim() : line.trim();
    if (sp === 'M' || sp === 'F') sp = line.replace(/\s*\([MF]\)\s*$/, '').trim();
    if (!sp) return null;
    // A held Mega Stone means the Mega forme (Sheet A stores names that way too).
    const stone = item ? gen.items.get(item)?.megaStone : undefined;
    if (stone) sp = Object.values(stone)[0];
    return { s: sp, i: item, k: toID(baseName(sp)), j: item ? toID(item) : '' };
  }).filter(Boolean).slice(0, 6);
}

async function pool(items, size, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); }
  }));
  return out;
}

async function sheetBTeams(existingPasteIds) {
  try {
    const res = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_B}/export?format=csv&gid=${GID_B}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return [];
    const rows = parseCSV(await res.text());
    // Header: Team | Priority? | Link | Has EVs? | Description | ... | Last Updated
    const cand = [];
    for (const r of rows.slice(1)) {
      const name = (r[0] || '').trim(); if (!name) continue;
      const link = (r[2] || '').trim();
      const id = pasteId(link); if (!id || existingPasteIds.has(id)) continue; // skip non-pokepaste + dupes
      existingPasteIds.add(id);
      cand.push({ name, tier: (r[1] || '').trim(), url: `https://pokepast.es/${id}`, id, dt: (r[9] || '').trim() });
    }
    const built = await pool(cand, 6, async (c) => {
      try {
        const t = await fetch(`${c.url}/raw`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!t.ok) return null;
        const mons = parsePaste(await t.text());
        if (mons.length < 5) return null;
        return { id: `B-${c.id}`, d: clean(c.name), c: '', e: 'Curated', r: c.tier.replace(/^\d+\s*-\s*/, ''), dt: c.dt, u: c.url, m: mons };
      } catch { return null; }
    });
    return built.filter(Boolean);
  } catch { return []; }
}

const teamsB = await sheetBTeams(new Set(teams.map((t) => pasteId(t.u)).filter(Boolean)));
for (const t of teamsB) teams.push(t);
console.error(`Sheet B added ${teamsB.length} unique curated teams`);

// Picker options: distinct base species (popularity first) + distinct items.
const spCount = new Map(), itCount = new Map();
for (const t of teams) for (const m of t.m) {
  const b = baseName(m.s);
  spCount.set(b, (spCount.get(b) || 0) + 1);
  if (m.i) itCount.set(m.i, (itCount.get(m.i) || 0) + 1);
}
const teamSpecies = [...spCount.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
const items = [...itCount.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);

// So ANY Champions Pokemon is searchable (not only those already on a team), pull
// the full Champions roster from the Pikalytics champions calc ranking. Cosmetic
// formes (Vivillon patterns, Alcremie flavours) fold onto their base.
async function champRoster() {
  try {
    const r = await fetch('https://cdn.pikalytics.com/images/s/ranking_champions_v12.js', { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!r.ok) return [];
    const list = JSON.parse('[' + (await r.text()).match(/\[(.*)\]/s)[1] + ']');
    const skey = (s) => { const b = s.baseStats || {}; return `${b.hp},${b.atk},${b.def},${b.spa},${b.spd},${b.spe}|${s.types}`; };
    const out = new Set();
    for (const name of list) {
      if (/-Mega/.test(name)) continue;
      const sp = gen.species.get(name);
      let n = name;
      if (sp?.exists && sp.baseSpecies && sp.baseSpecies !== sp.name) {
        const bs = gen.species.get(sp.baseSpecies);
        if (bs?.exists && skey(bs) === skey(sp)) n = sp.baseSpecies; // cosmetic -> base
      }
      out.add(n);
    }
    return [...out];
  } catch { return []; }
}
const roster = await champRoster();
const teamIds = new Set(teamSpecies.map(toID));
const extra = roster.filter((n) => !teamIds.has(toID(n))).sort();
// Popular team mons first (nice autocomplete), then the rest of the roster.
const species = [...teamSpecies, ...extra];

// Icon CSS from @pkmn/img (the same sprite sheets the calc uses), precomputed and
// deduped: a map keyed by the id we already store on each mon (base species, item).
// The mon shows its base-species icon (matches Team Preview; the Mega Stone gives
// away the mega anyway).
const sprites = {};
for (const b of species) {
  try { sprites[toID(b)] = Icons.getPokemon(b).style; } catch { /* skip */ }
}
const itemicons = {};
for (const it of itCount.keys()) {
  try { itemicons[toID(it)] = Icons.getItem(it).style; } catch { /* skip */ }
}

const html = readFileSync(fileURLToPath(new URL('./template.html', import.meta.url)), 'utf-8')
  .replace('/*__TEAMS__*/null', JSON.stringify(teams))
  .replace('/*__SPECIES__*/null', JSON.stringify(species))
  .replace('/*__ITEMS__*/null', JSON.stringify(items))
  .replace('/*__SPRITES__*/null', JSON.stringify(sprites))
  .replace('/*__ITEMICONS__*/null', JSON.stringify(itemicons))
  .replace('__COUNT__', String(teams.length))
  .replace('__DATE__', new Date().toISOString().slice(0, 10))
  .replace('__SHEETB_BY__', SHEET_B_CREATOR ? ` by ${SHEET_B_CREATOR}` : '');

writeFileSync(OUT, html);
console.log(`Wrote ${OUT}\n  ${teams.length} teams, ${species.length} species, ${items.length} items`);
