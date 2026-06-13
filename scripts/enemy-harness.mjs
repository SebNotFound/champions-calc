/**
 * Tuning harness for the free ENEMY (red Team Preview) sprite matcher. Runs the
 * shipped segment.ts + phash matching on the sample, dumps each cropped sprite,
 * and prints how each slot scores against its known species — grayscale, colour,
 * and the combined score — plus the top combined matches. Use it to tune the
 * colour weight and accept threshold. Node via tsx.
 *
 *   node scripts/enemy-harness.mjs   (or: npx tsx scripts/enemy-harness.mjs)
 */
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { detectColumn, detectSlots, cropRGBA, removeEnemyBackground, keepLargestComponent, flipH, isPanelRed } from '../src/recognition/segment.ts';
import { spriteThumbnail, colorThumbnail, normalizeThumb, similarity, decodeThumb } from '../src/champions/phash.ts';

/** Known enemy team in samples/team-preview-1.png, top to bottom. */
const GT = ['Noivern', 'Lycanroc', 'Politoed', 'Rotom', 'Kangaskhan', 'Hippowdon'];
/** How much the colour signature counts vs grayscale shape (0..1). */
const COLOR_WEIGHT = process.argv[2] ? Number(process.argv[2]) : 0.4;
/** Background flood-fill colour tolerance (lower = removes less). */
const BG_TOL = process.argv[3] ? Number(process.argv[3]) : 46;
/** Fraction of panel width taken as the sprite window. */
const FRAC = process.argv[4] ? Number(process.argv[4]) : 0.6;

const refs = JSON.parse(readFileSync('src/champions/data/sprite-hashes.json', 'utf8'))
  .map((r) => ({ species: r.species, v: normalizeThumb(decodeThumb(r.t)), cv: r.c ? normalizeThumb(decodeThumb(r.c)) : null }));
const hasColor = refs.every((r) => r.cv);
const decode = (b) => (b[0] === 0xff && b[1] === 0xd8 ? jpeg.decode(b, { useTArray: true }) : PNG.sync.read(b));

const { width, height, data } = decode(readFileSync('samples/team-preview-1.png'));
const img = { data, width, height };
const [x0, x1] = detectColumn(img, isPanelRed, 'right');
const slots = detectSlots(img, x0, x1, isPanelRed);
const spriteW = Math.round((x1 - x0) * FRAC);
console.log(`${width}x${height}  red col ${x0}..${x1}  ${slots.length} slots  spriteW ${spriteW}  frac=${FRAC} tol=${BG_TOL}  colour=${hasColor ? COLOR_WEIGHT : 'n/a'}`);

mkdirSync('samples/derived-enemy', { recursive: true });
let correct = 0;
slots.forEach(([y0, y1], i) => {
  const ch = y1 - y0;
  if (ch < 8) { console.log(`slot ${i + 1}: (too small)`); return; }
  const rgba = keepLargestComponent(removeEnemyBackground(cropRGBA(img, x0, y0, spriteW, ch), spriteW, ch, BG_TOL), spriteW, ch);
  const png = new PNG({ width: spriteW, height: ch });
  png.data = Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength);
  writeFileSync(`samples/derived-enemy/slot${i + 1}.png`, PNG.sync.write(png));

  const v = normalizeThumb(spriteThumbnail(rgba, spriteW, ch));
  const vf = normalizeThumb(spriteThumbnail(flipH(rgba, spriteW, ch), spriteW, ch));
  const cv = normalizeThumb(colorThumbnail(rgba, spriteW, ch));
  const cvf = normalizeThumb(colorThumbnail(flipH(rgba, spriteW, ch), spriteW, ch));
  const ranked = refs.map((r) => {
    const g = Math.max(similarity(v, r.v), similarity(vf, r.v));
    const c = r.cv ? Math.max(similarity(cv, r.cv), similarity(cvf, r.cv)) : 0;
    const sc = r.cv ? (1 - COLOR_WEIGHT) * g + COLOR_WEIGHT * c : g;
    return { species: r.species, g, c, sc };
  }).sort((a, b) => b.sc - a.sc);

  const want = ranked.find((r) => r.species === GT[i]);
  const ok = ranked[0].species === GT[i];
  if (ok) correct++;
  const wantStr = want
    ? `${GT[i]} g${want.g.toFixed(2)} c${want.c.toFixed(2)} =${want.sc.toFixed(3)} rank#${ranked.indexOf(want) + 1}`
    : `${GT[i]} (not in refs!)`;
  console.log(`slot ${i + 1} ${ok ? 'OK' : 'XX'}  want[${wantStr}]`);
  console.log(`       top3: ${ranked.slice(0, 3).map((r) => `${r.species} g${r.g.toFixed(2)} c${r.c.toFixed(2)} =${r.sc.toFixed(3)}`).join('  |  ')}`);
});
console.log(`\n${correct}/${GT.length} correct  (colour weight ${COLOR_WEIGHT})`);
