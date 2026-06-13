/**
 * Tuning harness for the free team-report reader. Runs the full pipeline
 * (panel detection → field crops → tesseract OCR → fuzzy match → spread solve)
 * against the two known sample screenshots and scores it against ground truth.
 * Dumps every crop to samples/derived-crops/ so misreads can be eyeballed.
 *
 *   node scripts/report-harness.mjs [--crops]
 */
import { PNG } from 'pngjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createWorker, PSM } from 'tesseract.js';
import {
  detectReportPanels, classifyReportTab, nameRect, statLineRect, abilityRect, itemRect, moveRect,
  toOcrCrop, solveSpread, digitsFromLine,
} from '../src/recognition/reportRead.ts';
import { fuzzyBest } from '../src/recognition/fuzzy.ts';
import { listSpecies, listItems, listMoves, listAbilities, speciesAbilities, speciesMoves, getSpeciesBaseStats } from '../src/champions/index.ts';

const DUMP = process.argv.includes('--crops');
const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

// Ground truth, read by hand from the screenshots (numbers verified to fit the
// stat formula exactly).
const GT = [
  { species: 'Floette-Eternal', nature: 'Timid', sp: { hp: 2, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 }, ability: 'Flower Veil', item: 'Floettite', moves: ['Light of Ruin', 'Moonblast', 'Chilling Water', 'Protect'], slot: 5 },
  { species: 'Mamoswine', nature: 'Adamant', sp: { hp: 30, atk: 32, def: 0, spa: 0, spd: 0, spe: 4 }, ability: 'Thick Fat', item: 'Focus Sash', moves: ['Ice Shard', 'Icicle Crash', 'Earthquake', 'Rock Tomb'], slot: 1 },
  { species: 'Volcarona', nature: 'Timid', sp: { hp: 20, atk: 0, def: 32, spa: 0, spd: 0, spe: 14 }, ability: 'Flame Body', item: 'Sitrus Berry', moves: ['Fiery Dance', 'Morning Sun', 'Giga Drain', 'Quiver Dance'], slot: 2 },
  { species: 'Umbreon', nature: 'Bold', sp: { hp: 32, atk: 0, def: 32, spa: 0, spd: 2, spe: 0 }, ability: 'Inner Focus', item: 'Leftovers', moves: ['Foul Play', 'Wish', 'Protect', 'Yawn'], slot: 3 },
  { species: 'Basculegion', nature: 'Jolly', sp: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 }, ability: 'Adaptability', item: 'Choice Scarf', moves: ['Last Respects', 'Aqua Jet', 'Flip Turn', 'Wave Crash'], slot: 4 },
  { species: 'Dragonite', nature: 'Jolly', sp: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 }, ability: 'Multiscale', item: 'Lum Berry', moves: ['Earthquake', 'Fire Punch', 'Outrage', 'Dragon Dance'], slot: 6 },
].sort((a, b) => a.slot - b.slot);

function loadImg(path) {
  const png = PNG.sync.read(readFileSync(path));
  return { data: png.data, width: png.width, height: png.height };
}

function cropToPng(crop) {
  const png = new PNG({ width: crop.width, height: crop.height });
  png.data = Buffer.from(crop.data.buffer, crop.data.byteOffset, crop.data.byteLength);
  return PNG.sync.write(png);
}

let dumpId = 0;
function dump(tag, buf) {
  if (!DUMP) return;
  mkdirSync('samples/derived-crops', { recursive: true });
  writeFileSync(`samples/derived-crops/${String(dumpId++).padStart(3, '0')}-${tag}.png`, buf);
}

const textWorker = await createWorker('eng', 1, { cachePath: 'node_modules/.cache/tesseract' });
await textWorker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
const digitWorker = await createWorker('eng', 1, { cachePath: 'node_modules/.cache/tesseract' });
await digitWorker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: '0123456789 ' });

async function ocr(img, rect, { digits = false, tag = 'crop' } = {}) {
  const crop = toOcrCrop(img, rect, 3);
  const buf = cropToPng(crop);
  dump(tag, buf);
  const worker = digits ? digitWorker : textWorker;
  const { data } = await worker.recognize(buf);
  return data.text.trim().replace(/\s+/g, ' ');
}

const speciesVocab = listSpecies();
const itemVocab = listItems();
const allMoves = listMoves();
const allAbilities = listAbilities();

// ---- Stats tab ----
const statsImg = loadImg('samples/derived-stats.png');
console.log('stats tab classified as:', classifyReportTab(statsImg));
const panels = detectReportPanels(statsImg);
console.log('panels:', panels.length, panels.map((p) => `${p.x},${p.y} ${p.w}x${p.h}`).join(' | '));

let spOk = 0, natOk = 0, spTotal = 0, speciesOk = 0;
const parsedStats = [];
for (let i = 0; i < panels.length; i++) {
  const p = panels[i];
  const gt = GT[i];
  const nameText = await ocr(statsImg, nameRect(p), { tag: `s${i}-name` });
  const match = fuzzyBest(nameText, speciesVocab);
  let species = match?.value ?? null;

  // Read the six stat lines: rows 0-2 left = HP/Atk/Def, right = SpA/SpD/Spe.
  // Full text mode (not digit-whitelist) reads the "Label 178 32" line far more
  // reliably; we then take the trailing two number groups.
  const reads = {};
  const keysBySide = { left: ['hp', 'atk', 'def'], right: ['spa', 'spd', 'spe'] };
  for (const side of ['left', 'right']) {
    for (let row = 0; row < 3; row++) {
      const key = keysBySide[side][row];
      const text = await ocr(statsImg, statLineRect(p, row, side), { tag: `s${i}-${key}` });
      reads[key] = { ...digitsFromLine(text), raw: text };
    }
  }
  console.log(`   reads: ${STAT_KEYS.map((k) => `${k}=${reads[k].final}/${reads[k].sp}`).join(' ')}`);

  // Forme disambiguation by stat fit: try the matched species and any forme of
  // it; keep whichever the math fits best.
  let bestSolve = null;
  let bestSpecies = species;
  if (species) {
    const baseName = species.split('-')[0];
    const candidates = [...new Set([species, baseName, ...speciesVocab.filter((s) => s.startsWith(baseName + '-'))])]
      .filter((s) => getSpeciesBaseStats(s));
    for (const cand of candidates.slice(0, 8)) {
      const base = getSpeciesBaseStats(cand);
      if (!base) continue;
      const solved = solveSpread(base, reads);
      // Higher fit wins; on a tie prefer the shorter (base) name over a forme.
      if (!bestSolve || solved.fit > bestSolve.fit ||
          (solved.fit === bestSolve.fit && cand.length < bestSpecies.length)) {
        bestSolve = solved; bestSpecies = cand;
      }
    }
  }
  parsedStats.push({ species: bestSpecies, reads, solved: bestSolve });

  const spreadStr = bestSolve ? STAT_KEYS.map((k) => bestSolve.statPoints[k]).join('/') : '-';
  const gtStr = STAT_KEYS.map((k) => gt.sp[k]).join('/');
  const okSpecies = bestSpecies === gt.species;
  const okNature = bestSolve?.nature === gt.nature;
  const okSp = spreadStr === gtStr;
  speciesOk += okSpecies; natOk += okNature; spOk += okSp; spTotal++;
  console.log(`#${i + 1} name="${nameText}" → ${bestSpecies} ${okSpecies ? '✓' : `✗ (gt ${gt.species})`}`);
  console.log(`   sp ${spreadStr} ${okSp ? '✓' : `✗ (gt ${gtStr})`}  nature ${bestSolve?.nature} ${okNature ? '✓' : `✗ (gt ${gt.nature})`} fit ${bestSolve?.fit}`);
  if (bestSolve?.issues.length) console.log('   issues:', bestSolve.issues.join('; '));
}
console.log(`STATS: species ${speciesOk}/6, spreads ${spOk}/6, natures ${natOk}/6\n`);

// ---- Moves tab ----
const movesImg = loadImg('samples/derived-moves.png');
console.log('moves tab classified as:', classifyReportTab(movesImg));
const mPanels = detectReportPanels(movesImg);
let abOk = 0, itOk = 0, mvOk = 0, mvTotal = 0;
for (let i = 0; i < mPanels.length; i++) {
  const p = mPanels[i];
  const gt = GT[i];
  const species = parsedStats[i]?.species ?? gt.species;
  const baseName = species.split('-')[0];
  // Constrained vocab (legal for this Pokémon) ∪ base forme, with a global-list
  // fallback so a correctly-read entry still resolves when the forme's learnset
  // data is incomplete (e.g. Floette-Eternal lacks TM moves like Chilling Water).
  const abilityVocab = [...new Set([...speciesAbilities(species), ...speciesAbilities(baseName)])];
  const moveVocab = [...new Set([...(await speciesMoves(species)), ...(await speciesMoves(baseName))])];
  const matchIn = (text, vocab, globalVocab, tol) =>
    fuzzyBest(text, vocab, tol)?.value ?? fuzzyBest(text, globalVocab, tol)?.value ?? null;

  const abilityText = await ocr(movesImg, abilityRect(p), { tag: `m${i}-ability` });
  const itemText = await ocr(movesImg, itemRect(p), { tag: `m${i}-item` });
  const ability = matchIn(abilityText, abilityVocab, allAbilities, 0.4) ?? abilityText;
  const item = matchIn(itemText, itemVocab, itemVocab, 0.5) ?? itemText;

  const moves = [];
  for (let slot = 0; slot < 4; slot++) {
    const text = await ocr(movesImg, moveRect(p, slot), { tag: `m${i}-move${slot}` });
    moves.push({ raw: text, match: matchIn(text, moveVocab, allMoves, 0.34) });
  }

  const okAb = ability === gt.ability;
  const okIt = item === gt.item;
  abOk += okAb; itOk += okIt;
  const mvResults = moves.map((m, j) => {
    const ok = m.match === gt.moves[j];
    mvOk += ok; mvTotal++;
    return `${m.match ?? `?(${m.raw})`}${ok ? '' : `✗gt:${gt.moves[j]}`}`;
  });
  console.log(`#${i + 1} ${species}: ability ${ability}${okAb ? '✓' : `✗(gt ${gt.ability}, raw "${abilityText}")`} item ${item}${okIt ? '✓' : `✗(gt ${gt.item}, raw "${itemText}")`}`);
  console.log(`   moves: ${mvResults.join(', ')}`);
}
console.log(`MOVES: abilities ${abOk}/6, items ${itOk}/6, moves ${mvOk}/${mvTotal}`);

await textWorker.terminate();
await digitWorker.terminate();
