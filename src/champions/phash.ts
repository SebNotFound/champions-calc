/**
 * Sprite fingerprinting + matching for the free Team Preview recognizer.
 *
 * Each sprite is reduced to a small, normalized grayscale "thumbnail" and
 * candidates are compared by cosine similarity. This keeps full grayscale detail
 * (unlike a 1-bit perceptual hash), preserves aspect ratio (letterboxed into a
 * square), and is brightness-normalized, so it tolerates the scaling and JPEG
 * compression of a screenshot crop while still telling similar sprites apart.
 *
 * The SAME `spriteThumbnail` fingerprints the reference sprites offline
 * (scripts/fetch-sprites.mjs) and the cropped enemy sprites at runtime, so the
 * fingerprints are directly comparable. Transparent pixels are composited over
 * mid-grey so the silhouette (not the panel background) drives the match.
 */

export const THUMB = 16; // thumbnail size (THUMB x THUMB grayscale)

type RGBA = Uint8ClampedArray | Uint8Array | number[];

/**
 * Bounding box of the foreground, robust to stray specks: rows/columns are kept
 * only if their opaque-pixel count is a meaningful fraction of the densest
 * row/column, so a few leftover background pixels in a corner don't blow up the
 * box (which would shrink the sprite to a dot).
 */
function foregroundBBox(rgba: RGBA, w: number, h: number): [number, number, number, number] {
  const rowCount = new Array<number>(h).fill(0);
  const colCount = new Array<number>(w).fill(0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (rgba[(y * w + x) * 4 + 3] > 16) { rowCount[y]++; colCount[x]++; }
    }
  }
  const maxRow = Math.max(...rowCount);
  const maxCol = Math.max(...colCount);
  if (maxRow === 0) return [0, 0, w, h];
  const rowThresh = Math.max(1, maxRow * 0.06);
  const colThresh = Math.max(1, maxCol * 0.06);
  let minY = 0; while (minY < h && rowCount[minY] < rowThresh) minY++;
  let maxY = h - 1; while (maxY > minY && rowCount[maxY] < rowThresh) maxY--;
  let minX = 0; while (minX < w && colCount[minX] < colThresh) minX++;
  let maxX = w - 1; while (maxX > minX && colCount[maxX] < colThresh) maxX--;
  return [minX, minY, maxX - minX + 1, maxY - minY + 1];
}

/**
 * Reduce an RGBA image to a THUMB×THUMB grayscale thumbnail (Uint8): trim to the
 * sprite, letterbox into a square (neutral-grey padding to keep aspect ratio),
 * then box-average down to THUMB×THUMB.
 */
export function spriteThumbnail(rgba: RGBA, w: number, h: number): Uint8Array {
  const [bx, by, bw, bh] = foregroundBBox(rgba, w, h);
  const side = Math.max(bw, bh);
  const square = new Float32Array(side * side).fill(128); // neutral letterbox
  const offX = (side - bw) >> 1;
  const offY = (side - bh) >> 1;
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const i = ((by + y) * w + (bx + x)) * 4;
      const a = rgba[i + 3] / 255;
      const r = rgba[i] * a + 128 * (1 - a);
      const g = rgba[i + 1] * a + 128 * (1 - a);
      const b = rgba[i + 2] * a + 128 * (1 - a);
      square[(offY + y) * side + (offX + x)] = 0.299 * r + 0.587 * g + 0.114 * b;
    }
  }

  const out = new Uint8Array(THUMB * THUMB);
  for (let ty = 0; ty < THUMB; ty++) {
    const y0 = Math.floor((ty * side) / THUMB);
    const y1 = Math.max(y0 + 1, Math.floor(((ty + 1) * side) / THUMB));
    for (let tx = 0; tx < THUMB; tx++) {
      const x0 = Math.floor((tx * side) / THUMB);
      const x1 = Math.max(x0 + 1, Math.floor(((tx + 1) * side) / THUMB));
      let sum = 0, n = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { sum += square[y * side + x]; n++; }
      out[ty * THUMB + tx] = Math.round(sum / n);
    }
  }
  return out;
}

/** Pack a thumbnail to base64 (compact JSON storage). */
export function encodeThumb(thumb: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < thumb.length; i++) bin += String.fromCharCode(thumb[i]);
  return typeof btoa === 'function' ? btoa(bin) : Buffer.from(thumb).toString('base64');
}

/** Unpack a base64 thumbnail back to bytes. */
export function decodeThumb(b64: string): Uint8Array {
  if (typeof atob === 'function') {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

/** Mean-subtract + L2-normalize a thumbnail into a comparison vector. */
export function normalizeThumb(thumb: Uint8Array): Float32Array {
  const v = new Float32Array(thumb.length);
  let mean = 0;
  for (let i = 0; i < thumb.length; i++) mean += thumb[i];
  mean /= thumb.length;
  let norm = 0;
  for (let i = 0; i < thumb.length; i++) { v[i] = thumb[i] - mean; norm += v[i] * v[i]; }
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= norm;
  return v;
}

/** Cosine similarity of two normalized vectors (1 = identical, ~0 = unrelated). */
export function similarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}
