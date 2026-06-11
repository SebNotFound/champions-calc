/**
 * Dev harness for the Team Preview matcher. Runs segmentation + sprite matching
 * on a sample screenshot, prints the top guesses per enemy slot, and saves the
 * crops so the segmentation can be eyeballed. Not shipped.
 *
 * Usage: node scripts/test-recognize.mjs samples/team-preview-1.png
 */
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename } from 'node:path';
import { spriteThumbnail, decodeThumb, normalizeThumb, similarity } from '../src/champions/phash.ts';

const file = process.argv[2] ?? 'samples/team-preview-1.png';
const refs = JSON.parse(readFileSync('src/champions/data/sprite-hashes.json', 'utf8'));
const refVecs = refs.map((r) => ({ species: r.species, v: normalizeThumb(decodeThumb(r.t)) }));

function decode(path) {
  const buf = readFileSync(path);
  if (buf[0] === 0xff && buf[1] === 0xd8) return jpeg.decode(buf, { useTArray: true });
  return PNG.sync.read(buf);
}

const { width: W, height: H, data } = decode(file);
const at = (x, y) => { const i = (y * W + x) * 4; return [data[i], data[i + 1], data[i + 2]]; };
const isRed = (r, g, b) => r > 60 && r > g * 1.5 && r > b * 1.35;
console.log(`${basename(file)}: ${W}x${H}`);

// 1) Right-side red panel x-range.
const colRed = new Array(W).fill(0);
for (let x = 0; x < W; x++) { let c = 0; for (let y = 0; y < H; y++) if (isRed(...at(x, y))) c++; colRed[x] = c; }
let x1 = W - 1; while (x1 > 0 && colRed[x1] < H * 0.12) x1--;
let x0 = x1; while (x0 > 0 && colRed[x0 - 1] >= H * 0.12) x0--;
console.log(`enemy x-range: ${x0}..${x1} (w ${x1 - x0})`);

// 2) Red row-runs in that x-range = panels/header/button.
const rowRed = new Array(H).fill(0);
for (let y = 0; y < H; y++) { let c = 0; for (let x = x0; x <= x1; x++) if (isRed(...at(x, y))) c++; rowRed[y] = c; }
const rowThresh = (x1 - x0) * 0.3;
const raw = [];
let s = -1;
for (let y = 0; y < H; y++) {
  if (rowRed[y] >= rowThresh) { if (s < 0) s = y; }
  else if (s >= 0) { raw.push([s, y - 1]); s = -1; }
}
if (s >= 0) raw.push([s, H - 1]);
const runs = [];
for (const r of raw) {
  if (runs.length && r[0] - runs[runs.length - 1][1] <= 8) runs[runs.length - 1][1] = r[1];
  else runs.push([...r]);
}
console.log('runs:', runs.map((r) => `${r[0]}-${r[1]}(h${r[1] - r[0]})`).join(' '));

// The six mon panels are evenly spaced and equal height. Use the "clean" runs
// (those near the median height — excludes the header, the Standing-By button,
// and any two-panel runs that merged) to derive the first panel's top and the
// pitch, then lay out six aligned slots.
const hs = runs.map((r) => r[1] - r[0]).sort((a, b) => a - b);
const medianH = hs[Math.floor(hs.length / 2)] || 1;
const cleanTops = runs.filter((r) => Math.abs(r[1] - r[0] - medianH) <= medianH * 0.25).map((r) => r[0]).sort((a, b) => a - b);
const firstTop = cleanTops[0] ?? 0;
let pitch = Infinity;
for (let i = 1; i < cleanTops.length; i++) pitch = Math.min(pitch, cleanTops[i] - cleanTops[i - 1]);
if (!isFinite(pitch)) pitch = medianH;
console.log(`firstTop ${firstTop}, pitch ${pitch}, panelH ${medianH}`);
const panels = Array.from({ length: 6 }, (_, i) => [Math.round(firstTop + i * pitch), Math.round(firstTop + i * pitch + medianH)]);

// 3) Crop the sprite (left portion of each panel), neutralize panel-red bg, match.
mkdirSync('samples/crops', { recursive: true });
function crop(sx, sy, cw, ch) {
  const out = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const si = ((sy + y) * W + (sx + x)) * 4, di = (y * cw + x) * 4;
    out[di] = data[si]; out[di + 1] = data[si + 1]; out[di + 2] = data[si + 2]; out[di + 3] = 255;
  }
  return out;
}
// Remove the background: flood-fill inward from the crop borders, but only into
// pixels whose colour matches the BACKGROUND PALETTE sampled from the borders
// (panel red, its gradient, rounded corners, arena bleed). Matching against a
// fixed palette (not the neighbour) stops the fill bleeding through the sprite.
function removeBg(rgba, w, h, tol = 46) {
  const col = (x, y) => { const i = (y * w + x) * 4; return [rgba[i], rgba[i + 1], rgba[i + 2]]; };
  const near = (a, b) => { const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2]; return dr * dr + dg * dg + db * db < tol * tol; };

  // Background palette = the (quantised, deduped) colours along the borders.
  const palette = [];
  const seen = new Set();
  const sample = (x, y) => {
    const c = col(x, y);
    const k = `${c[0] >> 4}_${c[1] >> 4}_${c[2] >> 4}`;
    if (!seen.has(k)) { seen.add(k); palette.push(c); }
  };
  for (let x = 0; x < w; x++) { sample(x, 0); sample(x, h - 1); }
  for (let y = 0; y < h; y++) { sample(0, y); sample(w - 1, y); }
  const isBg = (x, y) => { const c = col(x, y); return palette.some((p) => near(c, p)); };

  const visited = new Uint8Array(w * h);
  const stack = [];
  const seed = (x, y) => { const k = y * w + x; if (!visited[k]) { visited[k] = 1; stack.push(x, y); } };
  for (let x = 0; x < w; x++) { seed(x, 0); seed(x, h - 1); }
  for (let y = 0; y < h; y++) { seed(0, y); seed(w - 1, y); }
  while (stack.length) {
    const y = stack.pop(), x = stack.pop();
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      if (visited[ny * w + nx]) continue;
      if (isBg(nx, ny)) { visited[ny * w + nx] = 1; stack.push(nx, ny); }
    }
  }
  for (let k = 0; k < w * h; k++) if (visited[k]) rgba[k * 4 + 3] = 0;
  return rgba;
}
// Enemy sprites face the player, so they're mirrored vs the reference sprites.
function flipH(rgba, w, h) {
  const out = new Uint8ClampedArray(rgba.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = (y * w + x) * 4, d = (y * w + (w - 1 - x)) * 4;
    out[d] = rgba[s]; out[d + 1] = rgba[s + 1]; out[d + 2] = rgba[s + 2]; out[d + 3] = rgba[s + 3];
  }
  return out;
}
// Ground truth for samples/team-preview-1.png (for tuning only).
const GT = (basename(file).includes('-1')) ? ['Noivern', 'Lycanroc', 'Politoed', 'Rotom', 'Kangaskhan', ''] : [];
const spriteW = Math.round((x1 - x0) * 0.6); // contain the sprite with bg padding (icons are further right)
panels.forEach(([py0, py1], idx) => {
  const ch = py1 - py0;
  const rgba = removeBg(crop(x0, py0, spriteW, ch), spriteW, ch);
  const cropVec = normalizeThumb(spriteThumbnail(rgba, spriteW, ch));
  const flipVec = normalizeThumb(spriteThumbnail(flipH(rgba, spriteW, ch), spriteW, ch));
  const all = refVecs.map((r) => ({ species: r.species, sim: Math.max(similarity(cropVec, r.v), similarity(flipVec, r.v)) })).sort((a, b) => b.sim - a.sim);
  const png = new PNG({ width: spriteW, height: ch });
  png.data = Buffer.from(rgba);
  writeFileSync(`samples/crops/slot-${idx + 1}.png`, PNG.sync.write(png));
  const gt = GT[idx];
  const rank = gt ? all.findIndex((e) => e.species === gt) : -1;
  const gtInfo = gt ? `   [${gt}: ${rank < 0 ? 'NOT IN REFS' : `rank ${rank}, sim ${all[rank].sim.toFixed(3)}`}]` : '';
  console.log(`slot ${idx + 1}: ` + all.slice(0, 3).map((t) => `${t.species}(${t.sim.toFixed(3)})`).join(', ') + gtInfo);
});
