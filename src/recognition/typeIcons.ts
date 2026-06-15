/**
 * Type-icon prior for the enemy (red) Team Preview matcher.
 *
 * Each enemy panel shows the Pokémon's type icon(s) in its top-right corner, and
 * those icons survive the things that wreck the sprite itself: battle fire over
 * the centre, low resolution, lasers. So when the shape/colour fingerprint is
 * unsure, the typing is a strong second opinion. We read the coarse colour of the
 * icons and reward candidates whose own typing is consistent with what we see.
 *
 * It is deliberately a small additive nudge, never a penalty: a wrong-but-similar
 * sprite can still be overruled, but a confident shape match is never pushed off
 * the top. Validated to keep a clean Team Preview at 6/6 while lifting an occluded
 * one (fire across the board) from 2/6 to 4/6 best-guess accuracy.
 *
 * The colour buckets are coarse on purpose. The in-game palette puts several
 * types in the same hue band (Water/Flying both blue, Dragon/Poison both purple,
 * Psychic/Fairy both pink), and the icons are tiny, so a precise 18-way read is
 * not reliable. Coarse buckets that a type can satisfy with ANY of its colours,
 * matched against ALL of a candidate's types, give the discrimination we need
 * (Grass/Poison Venusaur over Water/Flying Pelipper) without overclaiming.
 */
import type { Img } from './segment';

/** Coarse colour families the in-game type icons fall into. */
export type ColorBucket = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink';

/**
 * Score added to a candidate whose every type is corroborated by the panel's
 * icons. Sized to break a near-tie and lift a shape-unsure read to the top,
 * but small enough that it cannot dethrone a confident shape match (those clear
 * the field by 0.2+). Tuned on the sample set; stable across 0.12 to 0.15.
 */
export const TYPE_MATCH_BONUS = 0.12;

/**
 * Type to the colour bucket(s) its icon can read as. A type matches if ANY of
 * its buckets is present (Fire shows as red or orange depending on the icon).
 * Types whose icon is low-saturation or grey (Normal, Dark, Steel) are left
 * empty: we can't read them reliably, so they simply never earn the bonus rather
 * than risk a wrong one.
 */
export const TYPE_COLOR_BUCKETS: Record<string, ColorBucket[]> = {
  Normal: [],
  Fire: ['red', 'orange'],
  Water: ['blue'],
  Electric: ['yellow'],
  Grass: ['green'],
  Ice: ['blue'],
  Fighting: ['red', 'orange'],
  Poison: ['purple'],
  Ground: ['orange'],
  Flying: ['blue'],
  Psychic: ['pink'],
  Bug: ['green'],
  Rock: ['orange'],
  Ghost: ['purple', 'pink'],
  Dragon: ['purple'],
  Dark: [],
  Steel: [],
  Fairy: ['pink'],
};

/**
 * A species' typing as a list of per-type bucket options, dropping types we
 * can't read (empty buckets). A candidate is type-consistent when each of these
 * groups is satisfied by at least one detected colour (see {@link typeMatchBonus}).
 */
export function speciesTypeBuckets(types: readonly string[] | undefined): ColorBucket[][] {
  return (types ?? []).map((t) => TYPE_COLOR_BUCKETS[t] ?? []).filter((b) => b.length > 0);
}

/** Bucket for one averaged cell colour, or null if it's background / unsaturated. */
function classifyBucket(h: number, s: number, v: number): ColorBucket | null {
  // The crimson panel and dim pixels carry no type signal.
  if (s < 0.3 || v < 0.45) return null;
  if (h >= 70 && h < 175) return 'green';
  if (h >= 48 && h < 70) return 'yellow';
  if (h >= 15 && h < 48) return 'orange';
  if (h >= 190 && h < 245) return 'blue';
  if (h >= 245 && h < 300) return 'purple';
  // Pink and red overlap the panel's crimson in hue, so they additionally
  // require a bright, less-saturated pixel than the deep panel background.
  if (h >= 300 && h < 348 && v > 0.6 && s < 0.72) return 'pink';
  if ((h >= 348 || h < 15) && v > 0.6 && s < 0.8) return 'red';
  return null;
}

/** RGB (0-255) to HSV with hue in degrees, s and v in 0..1. */
function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, mx ? d / mx : 0, mx / 255];
}

/**
 * Detect the type-icon colour buckets in one panel.
 *
 * The icons sit in the top-right of the panel, above the gender symbol, so we
 * scan a small grid over the right of the panel and only its top portion (the
 * gender row below would otherwise read as blue/pink and pollute the result).
 * A bucket counts only when it shows up in two or more cells, which drops single
 * stray pixels from anti-aliasing or a bit of fire that crept to the edge.
 */
export function detectIconBuckets(img: Img, x0: number, x1: number, y0: number, y1: number): Set<ColorBucket> {
  const { data, width } = img;
  const w = x1 - x0;
  // The icons start past the sprite and run to (just past) the panel edge.
  const ix0 = x0 + Math.round(w * 0.58);
  const ix1 = Math.min(width, x1 + Math.round(w * 0.16));
  const yTop = y0;
  const yBot = y0 + Math.round((y1 - y0) * 0.55);
  const found = new Set<ColorBucket>();
  if (ix1 - ix0 < 6 || yBot - yTop < 6) return found;

  const gx = 12;
  const gy = 6;
  const cw = (ix1 - ix0) / gx;
  const chh = (yBot - yTop) / gy;
  const counts = new Map<ColorBucket, number>();
  for (let cy = 0; cy < gy; cy++) {
    for (let cx = 0; cx < gx; cx++) {
      let rs = 0, gs = 0, bs = 0, n = 0;
      const px0 = Math.round(ix0 + cx * cw);
      const px1 = Math.round(ix0 + (cx + 1) * cw);
      const py0 = Math.round(yTop + cy * chh);
      const py1 = Math.round(yTop + (cy + 1) * chh);
      for (let yy = py0; yy < py1; yy++) {
        for (let xx = px0; xx < px1; xx++) {
          const s = (yy * width + xx) * 4;
          rs += data[s]; gs += data[s + 1]; bs += data[s + 2]; n++;
        }
      }
      if (!n) continue;
      const bucket = classifyBucket(...rgbToHsv(rs / n, gs / n, bs / n));
      if (bucket) counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    }
  }
  for (const [bucket, count] of counts) if (count >= 2) found.add(bucket);
  return found;
}

/**
 * The bonus for a candidate given the panel's detected icon colours: the full
 * {@link TYPE_MATCH_BONUS} when every readable type of the candidate is backed by
 * a detected colour, otherwise nothing. Requiring all types (not just one) is
 * what tells two single-shared-type mons apart.
 */
export function typeMatchBonus(buckets: ColorBucket[][], detected: Set<ColorBucket>): number {
  if (!buckets.length || !detected.size) return 0;
  const allMatched = buckets.every((group) => group.some((b) => detected.has(b)));
  return allMatched ? TYPE_MATCH_BONUS : 0;
}
