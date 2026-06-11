import { describe, it, expect } from 'vitest';
import { hashImage, hashDistance } from './phash';

function gradient(w: number, h: number): Uint8ClampedArray {
  const arr = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const v = Math.round((255 * x) / (w - 1));
      arr[i] = arr[i + 1] = arr[i + 2] = v;
      arr[i + 3] = 255;
    }
  }
  return arr;
}

function solid(w: number, h: number, r: number, g: number, b: number): Uint8ClampedArray {
  const arr = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < arr.length; i += 4) {
    arr[i] = r; arr[i + 1] = g; arr[i + 2] = b; arr[i + 3] = 255;
  }
  return arr;
}

describe('phash', () => {
  it('gives distance 0 for identical images', () => {
    const g = gradient(20, 16);
    expect(hashDistance(hashImage(g, 20, 16), hashImage(g, 20, 16))).toBe(0);
  });

  it('gives a larger distance for clearly different images', () => {
    const grad = hashImage(gradient(20, 16), 20, 16);
    const flat = hashImage(solid(20, 16, 200, 30, 30), 20, 16);
    expect(hashDistance(grad, flat)).toBeGreaterThan(8);
  });

  it('produces 16-hex-char fingerprints', () => {
    const h = hashImage(gradient(16, 16), 16, 16);
    expect(h.a).toHaveLength(16);
    expect(h.d).toHaveLength(16);
  });
});
