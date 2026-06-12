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
 * Split the red column into six evenly-spaced slot y-ranges.
 *
 * Primary path: the standard Team Preview shows six panels with clean gaps, so
 * we read the red row-runs and lay six slots on the panel pitch — this aligns
 * tightly to the real panel edges (best for matching). If that doesn't yield a
 * clean six-panel layout (e.g. the panels merge in a smaller shot), we fall back
 * to fitting an even six-panel "comb" to the red profile. Anything that isn't a
 * Team Preview just produces low-confidence slots, which the caller drops.
 */
export function detectSlots(img: Img, x0: number, x1: number): Array<[number, number]> {
  const byRuns = detectSlotsByRuns(img, x0, x1);
  const clean = byRuns.filter(([a, b]) => a >= 0 && b <= img.height && b - a >= 8).length;
  return clean >= 5 ? byRuns : detectSlotsByComb(img, x0, x1);
}

/** Red row-count for each row within the panel column. */
function redRowProfile(img: Img, x0: number, x1: number): Float64Array {
  const { data, width: W, height: H } = img;
  const rows = new Float64Array(H);
  for (let y = 0; y < H; y++) {
    let c = 0;
    for (let x = x0; x <= x1; x++) {
      const i = (y * W + x) * 4;
      if (isPanelRed(data[i], data[i + 1], data[i + 2])) c++;
    }
    rows[y] = c;
  }
  return rows;
}

/** Lay six slots on the pitch derived from the clean (median-height) red runs. */
function detectSlotsByRuns(img: Img, x0: number, x1: number): Array<[number, number]> {
  const { height: H } = img;
  const rowCount = redRowProfile(img, x0, x1);
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
function detectSlotsByComb(img: Img, x0: number, x1: number): Array<[number, number]> {
  const { height: H } = img;
  const rowRed = redRowProfile(img, x0, x1);
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
