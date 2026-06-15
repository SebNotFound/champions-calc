/**
 * Tuning harness for the type-icon prior (typeIcons.ts).
 *
 * For each enemy panel it prints the top match WITHOUT the prior (shape + colour
 * only) and WITH it (plus the type bonus), the colour buckets read from the
 * panel's type icons, and the per-sample accuracy of each. Use it to retune the
 * bonus size or the hue->bucket bands without regressing the clean sample.
 *
 *   node scripts/enemy-type-harness.mjs [bonus]   (default bonus 0.12)
 *
 * The two fixtures are the clean Team Preview (team-preview-1, must stay 6/6) and
 * the fire-occluded one (team sample 3), where the prior is what earns its keep.
 */
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { readFileSync } from 'node:fs';
import { detectColumn, detectSlots, cropRGBA, removeEnemyBackground, keepLargestComponent, flipH, isPanelRed } from '../src/recognition/segment.ts';
import { spriteThumbnail, colorThumbnail, normalizeThumb, similarity, decodeThumb } from '../src/champions/phash.ts';
import { detectIconBuckets, speciesTypeBuckets, typeMatchBonus } from '../src/recognition/typeIcons.ts';
import { getSpeciesTypes } from '../src/champions/engine.ts';

const COLOR_WEIGHT = 0.45;
const FRAC = 0.7;
const BONUS = Number(process.argv[2] ?? 0.12);

const refs = JSON.parse(readFileSync('src/champions/data/sprite-hashes.json', 'utf8')).map((r) => ({
  species: r.species,
  v: normalizeThumb(decodeThumb(r.t)),
  cv: r.c ? normalizeThumb(decodeThumb(r.c)) : null,
  buckets: speciesTypeBuckets(getSpeciesTypes(r.species)),
}));
const decode = (b) => (b[0] === 0xff && b[1] === 0xd8 ? jpeg.decode(b, { useTArray: true }) : PNG.sync.read(b));

function run(file, GT) {
  const { width, height, data } = decode(readFileSync(file));
  const img = { data, width, height };
  const [x0, x1] = detectColumn(img, isPanelRed, 'right');
  const slots = detectSlots(img, x0, x1, isPanelRed);
  const spriteW = Math.round((x1 - x0) * FRAC);
  let base = 0;
  let typed = 0;
  console.log(`\n${file}  (bonus ${BONUS})`);
  slots.forEach(([y0, y1], i) => {
    const ch = y1 - y0;
    if (ch < 8) return;
    const rgba = keepLargestComponent(removeEnemyBackground(cropRGBA(img, x0, y0, spriteW, ch), spriteW, ch), spriteW, ch);
    const v = normalizeThumb(spriteThumbnail(rgba, spriteW, ch));
    const vf = normalizeThumb(spriteThumbnail(flipH(rgba, spriteW, ch), spriteW, ch));
    const cv = normalizeThumb(colorThumbnail(rgba, spriteW, ch));
    const cvf = normalizeThumb(colorThumbnail(flipH(rgba, spriteW, ch), spriteW, ch));
    const det = detectIconBuckets(img, x0, x1, y0, y1);
    const ranked = refs.map((r) => {
      const g = Math.max(similarity(v, r.v), similarity(vf, r.v));
      const c = r.cv ? Math.max(similarity(cv, r.cv), similarity(cvf, r.cv)) : 0;
      const sc = r.cv ? (1 - COLOR_WEIGHT) * g + COLOR_WEIGHT * c : g;
      // typeMatchBonus returns the shipped constant; rescale to this run's BONUS
      // so the harness can sweep the size without editing the module.
      const matched = typeMatchBonus(r.buckets, det) > 0;
      return { species: r.species, sc, scT: sc + (matched ? BONUS : 0) };
    });
    const top0 = [...ranked].sort((a, b) => b.sc - a.sc)[0];
    const top1 = [...ranked].sort((a, b) => b.scT - a.scT)[0];
    if (top0.species === GT[i]) base++;
    if (top1.species === GT[i]) typed++;
    const ok0 = top0.species === GT[i] ? 'OK' : '  ';
    const ok1 = top1.species === GT[i] ? 'OK' : 'XX';
    console.log(`  ${i + 1} det{${[...det].join(',')}}  base:${ok0}${top0.species}(${top0.sc.toFixed(2)})  typed:${ok1}${top1.species}(${top1.scT.toFixed(2)})  [GT ${GT[i]}]`);
  });
  console.log(`  => base ${base}/${GT.length}, typed ${typed}/${GT.length}`);
}

run('samples/team-preview-1.png', ['Noivern', 'Lycanroc', 'Politoed', 'Rotom', 'Kangaskhan', 'Hippowdon']);
run('samples/team sample 3.jpeg', ['Charizard', 'Garchomp', 'Gardevoir', 'Whimsicott', 'Venusaur', 'Medicham']);
