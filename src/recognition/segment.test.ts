import { describe, it, expect } from 'vitest';
import { detectEnemyColumn, detectSlots, cropRGBA, flipH, removeBackground, isPanelRed, type Img } from './segment';

/** A real Champions enemy-panel crimson (red dominant, green minimal, blue > green). */
const CRIMSON: [number, number, number] = [130, 20, 55];

/**
 * A synthetic Team Preview: a neutral-grey image with a crimson panel column on
 * the right made of six evenly-spaced bands (the slots), separated by gaps.
 * Lets us test the geometry without binary fixtures or decoder differences.
 */
function syntheticPreview(): Img {
  const width = 200, height = 660;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = 40; data[i * 4 + 1] = 40; data[i * 4 + 2] = 40; data[i * 4 + 3] = 255;
  }
  const x0 = 140, x1 = 190, panelH = 80, gap = 20, firstTop = 30;
  for (let s = 0; s < 6; s++) {
    const top = firstTop + s * (panelH + gap);
    for (let y = top; y < top + panelH; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = (y * width + x) * 4;
        data[i] = CRIMSON[0]; data[i + 1] = CRIMSON[1]; data[i + 2] = CRIMSON[2]; data[i + 3] = 255;
      }
    }
  }
  return { data, width, height };
}

describe('isPanelRed', () => {
  it('accepts panel crimson, rejects grey, blue, and orange fire', () => {
    expect(isPanelRed(...CRIMSON)).toBe(true);
    expect(isPanelRed(40, 40, 40)).toBe(false);  // grey
    expect(isPanelRed(40, 40, 180)).toBe(false); // blue
    expect(isPanelRed(220, 120, 40)).toBe(false); // orange fire: green over blue
  });
});

describe('Team Preview segmentation', () => {
  const img = syntheticPreview();

  it('finds the right-hand red column', () => {
    expect(detectEnemyColumn(img)).toEqual([140, 190]);
  });

  it('splits the column into six evenly-spaced slots', () => {
    const [x0, x1] = detectEnemyColumn(img);
    const slots = detectSlots(img, x0, x1);
    expect(slots).toHaveLength(6);
    expect(slots[0][0]).toBe(30); // first panel top
    // panelH + gap = 100, so consecutive tops are 100 apart.
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i][0] - slots[i - 1][0]).toBe(100);
    }
  });
});

describe('pixel helpers', () => {
  it('cropRGBA copies a sub-rectangle, fully opaque', () => {
    const img: Img = { data: new Uint8ClampedArray([1, 2, 3, 0, 4, 5, 6, 0]), width: 2, height: 1 };
    expect([...cropRGBA(img, 1, 0, 1, 1)]).toEqual([4, 5, 6, 255]);
  });

  it('flipH mirrors left/right', () => {
    const rgba = new Uint8ClampedArray([10, 0, 0, 255, 20, 0, 0, 255]); // [A][B]
    const f = flipH(rgba, 2, 1);
    expect(f[0]).toBe(20); // -> [B][A]
    expect(f[4]).toBe(10);
  });

  it('removeBackground clears border-coloured pixels but keeps a distinct centre', () => {
    const w = 3, h = 3;
    const rgba = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) { rgba[i * 4] = 180; rgba[i * 4 + 1] = 40; rgba[i * 4 + 2] = 40; rgba[i * 4 + 3] = 255; }
    const centre = (1 * w + 1) * 4;
    rgba[centre] = 40; rgba[centre + 1] = 200; rgba[centre + 2] = 40; // green centre
    removeBackground(rgba, w, h, 46);
    expect(rgba[centre + 3]).toBe(255); // centre kept
    expect(rgba[3]).toBe(0); // a corner (red) cleared
  });
});
