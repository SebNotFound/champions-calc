import { describe, it, expect } from 'vitest';
import { spriteThumbnail, normalizeThumb, similarity, encodeThumb, decodeThumb, THUMB } from './phash';

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
  for (let i = 0; i < arr.length; i += 4) { arr[i] = r; arr[i + 1] = g; arr[i + 2] = b; arr[i + 3] = 255; }
  return arr;
}

const vec = (rgba: Uint8ClampedArray, w: number, h: number) => normalizeThumb(spriteThumbnail(rgba, w, h));

describe('sprite thumbnails', () => {
  it('produces a THUMB×THUMB thumbnail', () => {
    expect(spriteThumbnail(gradient(40, 30), 40, 30)).toHaveLength(THUMB * THUMB);
  });

  it('an image is identical to itself (similarity ~1)', () => {
    const g = gradient(40, 30);
    expect(similarity(vec(g, 40, 30), vec(g, 40, 30))).toBeCloseTo(1, 5);
  });

  it('a horizontal gradient and a vertical gradient are clearly different', () => {
    const horiz = vec(gradient(40, 40), 40, 40);
    // vertical gradient
    const arr = new Uint8ClampedArray(40 * 40 * 4);
    for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) {
      const i = (y * 40 + x) * 4; const v = Math.round((255 * y) / 39);
      arr[i] = arr[i + 1] = arr[i + 2] = v; arr[i + 3] = 255;
    }
    expect(similarity(horiz, normalizeThumb(spriteThumbnail(arr, 40, 40)))).toBeLessThan(0.5);
  });

  it('matches a sprite better than an unrelated flat image', () => {
    const g = gradient(40, 30);
    const self = similarity(vec(g, 40, 30), vec(g, 40, 30));
    const other = similarity(vec(g, 40, 30), vec(solid(40, 30, 200, 30, 30), 40, 30));
    expect(self).toBeGreaterThan(other);
  });

  it('round-trips through base64', () => {
    const t = spriteThumbnail(gradient(40, 30), 40, 30);
    const back = decodeThumb(encodeThumb(t));
    expect([...back]).toEqual([...t]);
  });
});
