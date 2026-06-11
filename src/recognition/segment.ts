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

/** The dark-red Champions enemy panel colour (R clearly dominant). */
export function isPanelRed(r: number, g: number, b: number): boolean {
  return r > 60 && r > g * 1.5 && r > b * 1.35;
}

/** Find the right-hand red panel column [x0, x1]. */
export function detectEnemyColumn(img: Img): [number, number] {
  const { data, width: W, height: H } = img;
  const colCount = new Array<number>(W).fill(0);
  for (let x = 0; x < W; x++) {
    let c = 0;
    for (let y = 0; y < H; y++) {
      const i = (y * W + x) * 4;
      if (isPanelRed(data[i], data[i + 1], data[i + 2])) c++;
    }
    colCount[x] = c;
  }
  const thresh = H * 0.12;
  let x1 = W - 1;
  while (x1 > 0 && colCount[x1] < thresh) x1--;
  let x0 = x1;
  while (x0 > 0 && colCount[x0 - 1] >= thresh) x0--;
  return [x0, x1];
}

/**
 * Split the red column into six evenly-spaced slot y-ranges. The six panels are
 * equal height; we find the "clean" red runs (median height, excluding the
 * header, the Standing-By button and any merged double-runs), derive the first
 * panel's top and the pitch, then lay out six slots.
 */
export function detectSlots(img: Img, x0: number, x1: number): Array<[number, number]> {
  const { data, width: W, height: H } = img;
  const rowCount = new Array<number>(H).fill(0);
  for (let y = 0; y < H; y++) {
    let c = 0;
    for (let x = x0; x <= x1; x++) {
      const i = (y * W + x) * 4;
      if (isPanelRed(data[i], data[i + 1], data[i + 2])) c++;
    }
    rowCount[y] = c;
  }
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
 * Remove the panel background by flood-filling inward from the borders, only
 * into pixels matching the border colour palette (so it can't bleed through the
 * sprite). Cut pixels are made transparent.
 */
export function removeBackground(rgba: Uint8ClampedArray, w: number, h: number, tol = 46): Uint8ClampedArray {
  const col = (x: number, y: number) => { const i = (y * w + x) * 4; return [rgba[i], rgba[i + 1], rgba[i + 2]]; };
  const near = (a: number[], b: number[]) => {
    const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
    return dr * dr + dg * dg + db * db < tol * tol;
  };
  const palette: number[][] = [];
  const seen = new Set<string>();
  const sample = (x: number, y: number) => {
    const c = col(x, y);
    const k = `${c[0] >> 4}_${c[1] >> 4}_${c[2] >> 4}`;
    if (!seen.has(k)) { seen.add(k); palette.push(c); }
  };
  for (let x = 0; x < w; x++) { sample(x, 0); sample(x, h - 1); }
  for (let y = 0; y < h; y++) { sample(0, y); sample(w - 1, y); }
  const isBg = (x: number, y: number) => { const c = col(x, y); return palette.some((p) => near(c, p)); };

  const visited = new Uint8Array(w * h);
  const stack: number[] = [];
  const seed = (x: number, y: number) => { const k = y * w + x; if (!visited[k]) { visited[k] = 1; stack.push(x, y); } };
  for (let x = 0; x < w; x++) { seed(x, 0); seed(x, h - 1); }
  for (let y = 0; y < h; y++) { seed(0, y); seed(w - 1, y); }
  while (stack.length) {
    const y = stack.pop()!, x = stack.pop()!;
    const nbrs = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
    for (const [nx, ny] of nbrs) {
      if (nx < 0 || nx >= w || ny < 0 || ny >= h || visited[ny * w + nx]) continue;
      if (isBg(nx, ny)) { visited[ny * w + nx] = 1; stack.push(nx, ny); }
    }
  }
  for (let k = 0; k < w * h; k++) if (visited[k]) rgba[k * 4 + 3] = 0;
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
