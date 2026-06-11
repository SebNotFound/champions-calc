/**
 * Perceptual hashing for sprite matching (the free Team Preview recognizer).
 *
 * Each sprite is reduced to two 64-bit fingerprints — an average hash (aHash)
 * and a difference hash (dHash) — and candidates are compared by Hamming
 * distance. The SAME `hashImage` is used to fingerprint the reference sprites
 * offline (scripts/fetch-sprites.mjs) and the cropped enemy sprites at runtime,
 * so the fingerprints are directly comparable.
 *
 * Transparent pixels are composited over mid-grey, so a sprite's silhouette
 * (not its panel-coloured background) drives the hash.
 */

export interface SpriteHash {
  a: string; // average hash, 16 hex chars (64 bits)
  d: string; // difference hash, 16 hex chars (64 bits)
}

type RGBA = Uint8ClampedArray | Uint8Array | number[];

const W = 9; // working width (dHash compares horizontal neighbours → needs +1 col)
const H = 8;

/** Composite RGBA over a grey background and convert to a grayscale array. */
function toGray(rgba: RGBA, bg = 128): number[] {
  const gray: number[] = [];
  for (let i = 0; i < rgba.length; i += 4) {
    const alpha = rgba[i + 3] / 255;
    const r = rgba[i] * alpha + bg * (1 - alpha);
    const g = rgba[i + 1] * alpha + bg * (1 - alpha);
    const b = rgba[i + 2] * alpha + bg * (1 - alpha);
    gray.push(0.299 * r + 0.587 * g + 0.114 * b);
  }
  return gray;
}

/** Box-average downscale of a grayscale image to dw x dh. */
function downscale(gray: number[], sw: number, sh: number, dw: number, dh: number): number[] {
  const out = new Array<number>(dw * dh).fill(0);
  for (let dy = 0; dy < dh; dy++) {
    const y0 = Math.floor((dy * sh) / dh);
    const y1 = Math.max(y0 + 1, Math.floor(((dy + 1) * sh) / dh));
    for (let dx = 0; dx < dw; dx++) {
      const x0 = Math.floor((dx * sw) / dw);
      const x1 = Math.max(x0 + 1, Math.floor(((dx + 1) * sw) / dw));
      let sum = 0, n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) { sum += gray[y * sw + x]; n++; }
      }
      out[dy * dw + dx] = n ? sum / n : 0;
    }
  }
  return out;
}

function bitsToHex(bits: boolean[]): string {
  let hex = '';
  for (let i = 0; i < bits.length; i += 4) {
    let nibble = 0;
    for (let j = 0; j < 4; j++) if (bits[i + j]) nibble |= 1 << (3 - j);
    hex += nibble.toString(16);
  }
  return hex;
}

/** Fingerprint an RGBA image (any size). */
export function hashImage(rgba: RGBA, w: number, h: number): SpriteHash {
  const small = downscale(toGray(rgba), w, h, W, H);

  // aHash: 8x8 block, bit set when the pixel is brighter than the mean.
  const block: number[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < 8; x++) block.push(small[y * W + x]);
  const mean = block.reduce((s, v) => s + v, 0) / block.length;
  const a = bitsToHex(block.map((v) => v > mean));

  // dHash: each pixel compared with its right neighbour over the 9x8 grid.
  const dBits: boolean[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < 8; x++) dBits.push(small[y * W + x] < small[y * W + x + 1]);
  const d = bitsToHex(dBits);

  return { a, d };
}

const POPCOUNT = Array.from({ length: 16 }, (_, i) => (i & 1) + ((i >> 1) & 1) + ((i >> 2) & 1) + ((i >> 3) & 1));

function hammingHex(x: string, y: string): number {
  let dist = 0;
  for (let i = 0; i < x.length; i++) dist += POPCOUNT[parseInt(x[i], 16) ^ parseInt(y[i], 16)];
  return dist;
}

/** Combined Hamming distance between two fingerprints (0 = identical, max 128). */
export function hashDistance(x: SpriteHash, y: SpriteHash): number {
  return hammingHex(x.a, y.a) + hammingHex(x.d, y.d);
}
