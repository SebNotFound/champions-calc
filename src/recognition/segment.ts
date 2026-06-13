/**
 * Team Preview segmentation: find the enemy (red) panel column, split it into
 * the six stacked Pokémon slots, and isolate each sprite from the panel
 * background. Pure functions over raw RGBA, ported from the dev harness
 * (scripts/test-recognize.mjs) so they can be reused and tested.
 *
 * Tuned for the standard doubles Team Preview. Wildly different layouts or
 * heavily distorted phone photos may need the Claude engine instead.
 */

export interface Img {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

/** A pixel colour test (panel background detector). */
export type ColorTest = (r: number, g: number, b: number) => boolean;

/**
 * The dark-crimson Champions enemy panel colour. Red dominates, green is nearly
 * absent, and crucially BLUE sits above green (a magenta tilt: samples read like
 * 94/16/51, 110/8/45). That blue>green test is what separates the panel from the
 * orange/yellow battle fire and red embers, which are also red-ish but lean green
 * over blue (e.g. 200/60/40) — so the fire no longer reads as panel and can't
 * drag the panel-column detection out into the centre of the screen.
 */
export function isPanelRed(r: number, g: number, b: number): boolean {
  return r > 55 && r > g * 1.8 && b > g && r > b * 1.1;
}

/** The blue/indigo Champions player panel colour (B clearly dominant). */
export function isPanelBlue(r: number, g: number, b: number): boolean {
  return b > 70 && b > r * 1.25 && b > g * 1.1;
}

/** Find the panel column [x0, x1] for a colour, scanning from one side in. */
export function detectColumn(img: Img, test: ColorTest, side: 'left' | 'right'): [number, number] {
  const { data, width: W, height: H } = img;
  const colCount = new Array<number>(W).fill(0);
  for (let x = 0; x < W; x++) {
    let c = 0;
    for (let y = 0; y < H; y++) {
      const i = (y * W + x) * 4;
      if (test(data[i], data[i + 1], data[i + 2])) c++;
    }
    colCount[x] = c;
  }
  const thresh = H * 0.12;
  if (side === 'right') {
    let x1 = W - 1;
    while (x1 > 0 && colCount[x1] < thresh) x1--;
    let x0 = x1;
    while (x0 > 0 && colCount[x0 - 1] >= thresh) x0--;
    return [x0, x1];
  }
  let x0 = 0;
  while (x0 < W - 1 && colCount[x0] < thresh) x0++;
  let x1 = x0;
  while (x1 < W - 1 && colCount[x1 + 1] >= thresh) x1++;
  return [x0, x1];
}

/** Find the right-hand red enemy column [x0, x1]. */
export function detectEnemyColumn(img: Img): [number, number] {
  return detectColumn(img, isPanelRed, 'right');
}


/**
 * Split the red column into six evenly-spaced slot y-ranges.
 *
 * Primary path: the standard Team Preview shows six panels with clean gaps, so
 * we read the red row-runs and lay six slots on the panel pitch — this aligns
 * tightly to the real panel edges (best for matching). If that doesn't yield a
 * clean six-panel layout (e.g. the panels merge in a smaller shot), we fall back
 * to fitting an even six-panel "comb" to the red profile. Anything that isn't a
 * Team Preview just produces low-confidence slots, which the caller drops.
 */
export function detectSlots(img: Img, x0: number, x1: number, test: ColorTest = isPanelRed): Array<[number, number]> {
  const byRuns = detectSlotsByRuns(img, x0, x1, test);
  const clean = byRuns.filter(([a, b]) => a >= 0 && b <= img.height && b - a >= 8).length;
  return clean >= 5 ? byRuns : detectSlotsByComb(img, x0, x1, test);
}

/** Panel-colour row-count for each row within the column. */
function rowProfile(img: Img, x0: number, x1: number, test: ColorTest): Float64Array {
  const { data, width: W, height: H } = img;
  const rows = new Float64Array(H);
  for (let y = 0; y < H; y++) {
    let c = 0;
    for (let x = x0; x <= x1; x++) {
      const i = (y * W + x) * 4;
      if (test(data[i], data[i + 1], data[i + 2])) c++;
    }
    rows[y] = c;
  }
  return rows;
}

/** Lay six slots on the pitch derived from the clean (median-height) panel runs. */
function detectSlotsByRuns(img: Img, x0: number, x1: number, test: ColorTest): Array<[number, number]> {
  const { height: H } = img;
  const rowCount = rowProfile(img, x0, x1, test);
  const rowThresh = (x1 - x0) * 0.3;
  const raw: Array<[number, number]> = [];
  let s = -1;
  for (let y = 0; y < H; y++) {
    if (rowCount[y] >= rowThresh) { if (s < 0) s = y; }
    else if (s >= 0) { raw.push([s, y - 1]); s = -1; }
  }
  if (s >= 0) raw.push([s, H - 1]);
  const runs: Array<[number, number]> = [];
  for (const r of raw) {
    const prev = runs[runs.length - 1];
    if (prev && r[0] - prev[1] <= 8) prev[1] = r[1];
    else runs.push([r[0], r[1]]);
  }
  if (!runs.length) return [];

  const heights = runs.map((r) => r[1] - r[0]).sort((a, b) => a - b);
  const medianH = heights[Math.floor(heights.length / 2)] || 1;
  const cleanTops = runs
    .filter((r) => Math.abs(r[1] - r[0] - medianH) <= medianH * 0.25)
    .map((r) => r[0])
    .sort((a, b) => a - b);
  const firstTop = cleanTops[0] ?? runs[0][0];
  let pitch = Infinity;
  for (let i = 1; i < cleanTops.length; i++) pitch = Math.min(pitch, cleanTops[i] - cleanTops[i - 1]);
  if (!isFinite(pitch)) pitch = medianH;

  return Array.from({ length: 6 }, (_, i): [number, number] => [
    Math.round(firstTop + i * pitch),
    Math.round(firstTop + i * pitch + medianH),
  ]);
}

/**
 * Fallback: fit an even six-panel comb to the red profile. Search the period
 * (pitch) and offset that maximise red DENSITY inside the six panel windows
 * while keeping the gaps between them empty. Density (not raw totals) keeps a
 * wider comb from winning just by sweeping in more area.
 */
function detectSlotsByComb(img: Img, x0: number, x1: number, test: ColorTest): Array<[number, number]> {
  const { height: H } = img;
  const rowRed = rowProfile(img, x0, x1, test);
  let totalRed = 0;
  for (let y = 0; y < H; y++) totalRed += rowRed[y];
  if (totalRed === 0) return [];

  const pref = new Float64Array(H + 1);
  for (let y = 0; y < H; y++) pref[y + 1] = pref[y] + rowRed[y];
  const sum = (a: number, b: number) => pref[Math.min(H, Math.max(0, b))] - pref[Math.min(H, Math.max(0, a))];

  const minPitch = Math.max(8, Math.floor(H / 14));
  const maxPitch = Math.max(minPitch + 1, Math.floor(H / 6));
  let best: { firstTop: number; pitch: number } | null = null;
  let bestScore = -Infinity;
  for (let pitch = minPitch; pitch <= maxPitch; pitch++) {
    const win = Math.round(pitch * 0.8);
    const gap = pitch - win;
    const maxTop = H - (5 * pitch + win);
    for (let firstTop = 0; firstTop <= maxTop; firstTop += 2) {
      let inside = 0, gaps = 0;
      for (let k = 0; k < 6; k++) {
        const top = firstTop + k * pitch;
        inside += sum(top, top + win);
        if (k < 5) gaps += sum(top + win, top + pitch);
      }
      const score = inside / (6 * win) - (gap > 0 ? gaps / (5 * gap) : 0);
      if (score > bestScore) { bestScore = score; best = { firstTop, pitch }; }
    }
  }
  if (!best) return [];

  const { firstTop, pitch } = best;
  const slotH = Math.round(pitch * 0.9);
  return Array.from({ length: 6 }, (_, k): [number, number] => {
    const top = firstTop + k * pitch;
    return [top, Math.min(top + slotH, H)];
  });
}

/** Copy a sub-rectangle into a fresh (fully opaque) RGBA buffer. */
export function cropRGBA(img: Img, sx: number, sy: number, cw: number, ch: number): Uint8ClampedArray {
  const { data, width: W } = img;
  const out = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const si = ((sy + y) * W + (sx + x)) * 4;
      const di = (y * cw + x) * 4;
      out[di] = data[si]; out[di + 1] = data[si + 1]; out[di + 2] = data[si + 2]; out[di + 3] = 255;
    }
  }
  return out;
}

/**
 * Border-seeded flood fill: returns a mask (1 = reached) of every pixel
 * connected to the image border through pixels the predicate accepts. Shared by
 * the background removers below.
 */
function floodMask(w: number, h: number, accept: (k: number) => boolean): Uint8Array {
  const mask = new Uint8Array(w * h);
  const stack: number[] = [];
  const seed = (k: number) => { if (!mask[k] && accept(k)) { mask[k] = 1; stack.push(k); } };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  while (stack.length) {
    const k = stack.pop()!;
    const x = k % w;
    const nbrs = [x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1, k - w, k + w];
    for (const n of nbrs) {
      if (n < 0 || n >= w * h || mask[n] || !accept(n)) continue;
      mask[n] = 1; stack.push(n);
    }
  }
  return mask;
}

/** Predicate: pixel k is near one of the sampled border-palette colours. */
function nearBorderPalette(rgba: Uint8ClampedArray, w: number, h: number, tol: number): (k: number) => boolean {
  const palette: number[][] = [];
  const seen = new Set<string>();
  const sample = (k: number) => {
    const i = k * 4, r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
    const key = `${r >> 4}_${g >> 4}_${b >> 4}`;
    if (!seen.has(key)) { seen.add(key); palette.push([r, g, b]); }
  };
  for (let x = 0; x < w; x++) { sample(x); sample((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { sample(y * w); sample(y * w + w - 1); }
  const tol2 = tol * tol;
  return (k: number) => {
    const i = k * 4, r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
    return palette.some((p) => {
      const dr = r - p[0], dg = g - p[1], db = b - p[2];
      return dr * dr + dg * dg + db * db < tol2;
    });
  };
}

/** Predicate: pixel k is the red enemy panel (incl. its dark edges and pale gloss). */
function isRedPanel(rgba: Uint8ClampedArray): (k: number) => boolean {
  return (k: number) => {
    const i = k * 4, r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
    if (r > 45 && r > g * 1.25 && r > b * 1.1) return true; // red panel + dark edges
    return r > 175 && g > 160 && b > 160 && r >= g && r >= b - 4; // pale red-tinted gloss
  };
}

/**
 * Remove the panel background by flood-filling inward from the borders, only
 * into pixels matching the border colour palette (so it can't bleed through the
 * sprite). Cut pixels are made transparent. (Kept for the player/blue path and
 * tests; the enemy path uses {@link removeEnemyBackground}.)
 */
export function removeBackground(rgba: Uint8ClampedArray, w: number, h: number, tol = 46): Uint8ClampedArray {
  const mask = floodMask(w, h, nearBorderPalette(rgba, w, h, tol));
  for (let k = 0; k < w * h; k++) if (mask[k]) rgba[k * 4 + 3] = 0;
  return rgba;
}

/**
 * Remove the red enemy-panel background, robust across every sprite colour.
 *
 * Two border-seeded floods, each with a blind spot, are intersected: a pixel is
 * cut only if BOTH agree it's background. The palette flood ({@link
 * removeBackground}) bridges from the dark-red edges into a sprite's own dark or
 * grey pixels (it eats a purple Noivern, a grey-armoured Hippowdon); the red
 * flood ({@link isRedPanel}) instead bridges into brown/tan fur (it eats a
 * Lycanroc, a Kangaskhan). They fail on opposite colours, so any sprite pixel at
 * least one of them protects survives — while the panel, which both recognise,
 * is removed. Pair with {@link keepLargestComponent} to drop the leftover
 * gender/item icons. Cut pixels are made transparent.
 */
export function removeEnemyBackground(rgba: Uint8ClampedArray, w: number, h: number, tol = 46): Uint8ClampedArray {
  const palette = floodMask(w, h, nearBorderPalette(rgba, w, h, tol));
  const red = floodMask(w, h, isRedPanel(rgba));
  for (let k = 0; k < w * h; k++) if (palette[k] && red[k]) rgba[k * 4 + 3] = 0;
  return rgba;
}

/**
 * Keep only the largest connected blob of opaque pixels, making everything else
 * transparent. After {@link removeBackground} the panel is gone but small opaque
 * islands remain — the gender symbol, the held-item icon, and stray halo specks
 * — and those inflate the foreground bounding box, shrinking the actual sprite
 * within the thumbnail and wrecking the match. The Pokémon is by far the biggest
 * blob, so keeping just it isolates the sprite cleanly and lets us crop a wide
 * window (to fit big mons like Hippowdon) without the side icons leaking in.
 */
export function keepLargestComponent(rgba: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const opaque = (k: number) => rgba[k * 4 + 3] > 16;
  const label = new Int32Array(w * h).fill(-1);
  const stack: number[] = [];
  let best = -1, bestSize = 0;
  for (let start = 0; start < w * h; start++) {
    if (label[start] !== -1 || !opaque(start)) continue;
    label[start] = start;
    stack.push(start);
    let size = 0;
    while (stack.length) {
      const k = stack.pop()!;
      size++;
      const x = k % w;
      const nbrs = [x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1, k - w, k + w];
      for (const n of nbrs) {
        if (n < 0 || n >= w * h || label[n] !== -1 || !opaque(n)) continue;
        label[n] = start;
        stack.push(n);
      }
    }
    if (size > bestSize) { bestSize = size; best = start; }
  }
  if (best < 0) return rgba;
  for (let k = 0; k < w * h; k++) if (label[k] !== best) rgba[k * 4 + 3] = 0;
  return rgba;
}

/** Horizontal mirror (enemy sprites face the player, opposite the references). */
export function flipH(rgba: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4, d = (y * w + (w - 1 - x)) * 4;
      out[d] = rgba[s]; out[d + 1] = rgba[s + 1]; out[d + 2] = rgba[s + 2]; out[d + 3] = rgba[s + 3];
    }
  }
  return out;
}
