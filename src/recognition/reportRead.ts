/**
 * Free, on-device team-report reading: everything EXCEPT the OCR engine itself.
 *
 * The in-game team view (Stats / "Moves & More" tabs) is a fixed 2×3 grid of
 * purple panels. This module finds those panels, crops each field (name, the
 * six stat lines, ability, item, the four moves), preprocesses the crops for
 * OCR, and — crucially — turns the OCR'd numbers into a validated Stat-Point
 * spread.
 *
 * Why this can be accurate without a cloud model: every reading is checked
 * against something we already know.
 *   - Names snap to known vocabularies (species list, the species' own legal
 *     abilities and learnset, the item list) via fuzzy matching.
 *   - Numbers obey exact arithmetic: at Lv50 a final stat is a deterministic
 *     function of (base stat, invested SP, nature multiplier). Reading BOTH the
 *     final stat and the SP per line over-determines the system, so the solver
 *     can detect and repair a misread digit, and the nature falls out of which
 *     lines need a ×1.1 / ×0.9 to fit — no need to read the tiny arrows at all.
 *
 * The actual OCR engine (tesseract.js) is injected by the caller, so the same
 * pipeline runs in the browser (production) and in Node (the tuning harness).
 */
import type { Img } from './segment';
import { computeStat, NATURES } from '../champions/stats';
import type { NatureName, StatKey, StatSpread, StatTable } from '../champions/types';

export interface Rect { x: number; y: number; w: number; h: number; }

/** A preprocessed, OCR-ready crop: black ink on white, already upscaled. */
export interface OcrCrop { data: Uint8ClampedArray; width: number; height: number; }

/** The injected OCR engine: returns the text it sees in a crop. */
export type OcrFn = (crop: OcrCrop, opts: { digitsOnly?: boolean }) => Promise<string>;

// ---------------------------------------------------------------------------
// Panel detection
// ---------------------------------------------------------------------------

/** The purple team-report panel colour (blue clearly above green, not too bright). */
function isPanelPurple(r: number, g: number, b: number): boolean {
  return b > 100 && b - g > 18 && r > g - 12 && b < 235;
}

function runsOf(profile: Float64Array | number[], thresh: number, mergeGap: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let s = -1;
  for (let i = 0; i < profile.length; i++) {
    if (profile[i] >= thresh) { if (s < 0) s = i; }
    else if (s >= 0) { out.push([s, i - 1]); s = -1; }
  }
  if (s >= 0) out.push([s, profile.length - 1]);
  const merged: Array<[number, number]> = [];
  for (const r of out) {
    const p = merged[merged.length - 1];
    if (p && r[0] - p[1] <= mergeGap) p[1] = r[1];
    else merged.push([r[0], r[1]]);
  }
  return merged;
}

/** Keep the N longest runs, in ascending order. */
function longest(rs: Array<[number, number]>, n: number): Array<[number, number]> {
  return [...rs].sort((a, b) => (b[1] - b[0]) - (a[1] - a[0])).slice(0, n).sort((a, b) => a[0] - b[0]);
}

/**
 * Find the up-to-six panel rectangles, in team order (row-major: 1 top-left,
 * 2 top-right, …). Works on any resolution: panels are located by their purple
 * colour below the header band (the header is purple too, so the top ~22% is
 * ignored).
 */
export function detectReportPanels(img: Img): Rect[] {
  const { data, width: W, height: H } = img;
  const purple = (x: number, y: number) => {
    const i = (y * W + x) * 4;
    return isPanelPurple(data[i], data[i + 1], data[i + 2]);
  };
  const top = Math.floor(H * 0.22);
  const bot = Math.floor(H * 0.97);

  const colCount = new Float64Array(W);
  for (let x = 0; x < W; x++) {
    let c = 0;
    for (let y = top; y < bot; y++) if (purple(x, y)) c++;
    colCount[x] = c;
  }
  // Small merge gap: the gap between the two panel columns must stay a gap.
  const cols = longest(runsOf(colCount, (bot - top) * 0.12, Math.floor(W * 0.012)), 2);

  const panels: Array<Rect & { col: number }> = [];
  cols.forEach(([cx0, cx1], colIdx) => {
    const rowCount = new Float64Array(H);
    for (let y = top; y < bot; y++) {
      let c = 0;
      for (let x = cx0; x <= cx1; x++) if (purple(x, y)) c++;
      rowCount[y] = c;
    }
    for (const [ry0, ry1] of longest(runsOf(rowCount, (cx1 - cx0) * 0.25, Math.floor(H * 0.02)), 3)) {
      if (ry1 - ry0 < H * 0.05) continue;
      panels.push({ x: cx0, y: ry0, w: cx1 - cx0 + 1, h: ry1 - ry0 + 1, col: colIdx });
    }
  });
  // Row-major team order: sort by row band, then column.
  panels.sort((a, b) => (Math.abs(a.y - b.y) > Math.min(a.h, b.h) / 2 ? a.y - b.y : a.col - b.col));
  return panels.map(({ x, y, w, h }) => ({ x, y, w, h }));
}

/**
 * Which tab is this screenshot showing? The active tab pill is the bright
 * yellow-green one; "Moves & More" is the left pill, "Stats" the right.
 */
export function classifyReportTab(img: Img): 'stats' | 'moves' | null {
  const { data, width: W, height: H } = img;
  let count = 0;
  let sumX = 0;
  const y0 = Math.floor(H * 0.16);
  const y1 = Math.floor(H * 0.26);
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (g > 170 && g - b > 80 && g - r > 25) { count++; sumX += x; }
    }
  }
  if (count < W * 0.5) return null; // no obvious active pill
  return sumX / count > W / 2 ? 'stats' : 'moves';
}

// ---------------------------------------------------------------------------
// Field geometry (fractions of a panel rect, tuned on 1080p screenshots but
// resolution-independent since they scale with the detected panel)
// ---------------------------------------------------------------------------

const frac = (p: Rect, x: number, y: number, w: number, h: number): Rect => ({
  x: Math.round(p.x + p.w * x),
  y: Math.round(p.y + p.h * y),
  w: Math.round(p.w * w),
  h: Math.round(p.h * h),
});

/** The Pokémon's name, to the right of its menu sprite. */
export const nameRect = (p: Rect): Rect => frac(p, 0.085, 0.02, 0.46, 0.27);

/** One stat line ("HP 215 — 30"): row 0–2, left or right block. */
export function statLineRect(p: Rect, row: 0 | 1 | 2, side: 'left' | 'right'): Rect {
  const y = 0.30 + row * 0.225;
  return side === 'left' ? frac(p, 0.05, y, 0.43, 0.21) : frac(p, 0.52, y, 0.45, 0.21);
}

/** Moves & More tab: ability and item lines (left), and the four moves (right).
 *  The item line carries a held-item icon on the left, so its crop starts further
 *  in to skip it. */
export const abilityRect = (p: Rect): Rect => frac(p, 0.07, 0.33, 0.42, 0.22);
export const itemRect = (p: Rect): Rect => frac(p, 0.115, 0.60, 0.43, 0.22);
export const moveRect = (p: Rect, slot: 0 | 1 | 2 | 3): Rect =>
  frac(p, 0.645, 0.06 + slot * 0.225, 0.345, 0.21);

// ---------------------------------------------------------------------------
// Crop preprocessing: grayscale → Otsu threshold → black ink on white, upscaled
// ---------------------------------------------------------------------------

/** Bilinear-upscale + grayscale a region of the source image. */
function grayCrop(img: Img, r: Rect, scale: number): { g: Float32Array; w: number; h: number } {
  const w = Math.max(1, Math.round(r.w * scale));
  const h = Math.max(1, Math.round(r.h * scale));
  const g = new Float32Array(w * h);
  const { data, width: W, height: H } = img;
  for (let y = 0; y < h; y++) {
    const sy = Math.min(H - 1.001, r.y + (y / scale));
    const y0 = Math.floor(sy), fy = sy - y0;
    for (let x = 0; x < w; x++) {
      const sx = Math.min(W - 1.001, r.x + (x / scale));
      const x0 = Math.floor(sx), fx = sx - x0;
      let acc = 0;
      for (const [dx, dy, wgt] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]] as const) {
        const i = ((y0 + dy) * W + (x0 + dx)) * 4;
        acc += wgt * (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      }
      g[y * w + x] = acc;
    }
  }
  return { g, w, h };
}

/** Otsu's threshold over a grayscale buffer. */
function otsu(g: Float32Array): number {
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < g.length; i++) hist[Math.max(0, Math.min(255, Math.round(g[i])))]++;
  const total = g.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, best = 127, bestVar = -1;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const v = wB * wF * (mB - mF) * (mB - mF);
    if (v > bestVar) { bestVar = v; best = t; }
  }
  return best;
}

/**
 * Make an OCR-ready crop: upscale, binarize, orient so the text (the minority
 * class) is black on white, and surround it with a white margin. The padding
 * matters — tesseract misreads glyphs that touch the crop edge (it was turning
 * an edge-touching "Focus Sash" into "TOCUS Jodi").
 */
export function toOcrCrop(img: Img, r: Rect, scale = 3, pad = 12): OcrCrop {
  const { g, w, h } = grayCrop(img, r, scale);
  const t = otsu(g);
  let dark = 0;
  for (let i = 0; i < g.length; i++) if (g[i] < t) dark++;
  const inkIsDark = dark <= g.length / 2; // minority side = ink

  const W = w + pad * 2;
  const H = h + pad * 2;
  const out = new Uint8ClampedArray(W * H * 4).fill(255); // white background + margin
  for (let i = 3; i < out.length; i += 4) out[i] = 255;   // opaque
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if ((inkIsDark ? g[y * w + x] < t : g[y * w + x] >= t)) {
        const o = ((y + pad) * W + (x + pad)) * 4;
        out[o] = out[o + 1] = out[o + 2] = 0;
      }
    }
  }
  return { data: out, width: W, height: H };
}

// ---------------------------------------------------------------------------
// The spread solver: OCR'd numbers → validated SP spread + nature
// ---------------------------------------------------------------------------

export interface StatLineRead { final: number | null; sp: number | null; }
export type StatReads = Record<StatKey, StatLineRead>;

export interface SolvedSpread {
  statPoints: StatSpread;
  nature: NatureName;
  /** Human-readable repairs/doubts, e.g. "Atk: SP read 12, stat math says 32". */
  issues: string[];
  /** How many of the five non-HP lines fit the math exactly (5 = perfect). */
  fit: number;
}

const NON_HP: Exclude<StatKey, 'hp'>[] = ['atk', 'def', 'spa', 'spd', 'spe'];
type Tag = '+' | '=' | '-';

/** Nature whose (plus, minus) pair matches; neutral pairs map to Hardy. */
function natureFor(plus: StatKey | null, minus: StatKey | null): NatureName | null {
  if (!plus && !minus) return 'Hardy';
  if (!plus || !minus) return null;
  for (const [name, eff] of Object.entries(NATURES) as [NatureName, { plus?: StatKey; minus?: StatKey }][]) {
    if (eff.plus === plus && eff.minus === minus) return name;
  }
  return null;
}

/**
 * Solve the spread from per-line readings. For each non-HP line the final stat
 * pins SP for each possible nature multiplier; the solver picks one multiplier
 * per line so that at most one line is boosted and one lowered (a real nature),
 * preferring choices that agree with the OCR'd SP. HP has no multiplier, so its
 * final stat alone determines SP exactly.
 */
export function solveSpread(base: StatTable, reads: StatReads): SolvedSpread {
  const issues: string[] = [];

  // HP: exact. final = core + level + 10 + sp  →  sp = final - computeStat(sp=0).
  const hpRead = reads.hp;
  let hpSp: number | null = null;
  if (hpRead.final != null) {
    const sp = hpRead.final - computeStat('hp', base.hp, 0, 'Hardy');
    if (sp >= 0 && sp <= 32) {
      hpSp = sp;
      if (hpRead.sp != null && hpRead.sp !== sp) issues.push(`HP: SP read ${hpRead.sp}, stat math says ${sp}`);
    }
  }
  if (hpSp == null) {
    hpSp = hpRead.sp != null && hpRead.sp >= 0 && hpRead.sp <= 32 ? hpRead.sp : 0;
    if (hpRead.final != null) issues.push(`HP ${hpRead.final} doesn't fit the species' base ${base.hp}`);
  }

  // Each non-HP line: viable (tag, sp) candidates.
  interface Cand { tag: Tag; sp: number; agrees: boolean; fromFinal: boolean; }
  const candidates: Record<string, Cand[]> = {};
  for (const key of NON_HP) {
    const { final, sp } = reads[key];
    const list: Cand[] = [];
    if (final != null) {
      // Which SP investments reproduce the observed final stat under each
      // multiplier? Brute force 0–32 — exact regardless of where the game
      // applies SP relative to the nature (floor collisions under ×0.9 can
      // yield two adjacent SP values; the OCR'd SP disambiguates).
      for (const tag of ['-', '=', '+'] as Tag[]) {
        const nature: NatureName = tag === '+' ? pickNature(key, 'plus') : tag === '-' ? pickNature(key, 'minus') : 'Hardy';
        for (let spCand = 0; spCand <= 32; spCand++) {
          if (computeStat(key, base[key], spCand, nature) === final) {
            list.push({ tag, sp: spCand, agrees: sp != null && spCand === sp, fromFinal: true });
          }
        }
      }
    }
    if (!list.length) {
      list.push({ tag: '=', sp: sp != null && sp >= 0 && sp <= 32 ? sp : 0, agrees: sp != null, fromFinal: false });
      if (final != null) issues.push(`${key}: ${final} doesn't fit the species' base ${base[key]}`);
    }
    candidates[key] = list;
  }

  // Pick one candidate per line: a legal nature shape (≤1 plus, ≤1 minus, both
  // or neither), maximizing agreement with the OCR'd SP numbers.
  let best: { picks: Record<string, Cand>; score: number } | null = null;
  const keys = NON_HP;
  const walk = (i: number, picks: Record<string, Cand>, plus: number, minus: number, score: number) => {
    if (plus > 1 || minus > 1) return;
    if (i === keys.length) {
      if (plus !== minus) return; // a nature has both or neither
      const total = hpSp! + keys.reduce((s, k) => s + picks[k].sp, 0);
      if (total > 66) return;
      const finalScore = score + (total === 66 ? 0.5 : 0); // competitive teams spend all 66
      if (!best || finalScore > best.score) best = { picks: { ...picks }, score: finalScore };
      return;
    }
    for (const cand of candidates[keys[i]]) {
      picks[keys[i]] = cand;
      walk(
        i + 1,
        picks,
        plus + (cand.tag === '+' ? 1 : 0),
        minus + (cand.tag === '-' ? 1 : 0),
        score + (cand.agrees ? 1 : 0) + (cand.fromFinal ? 0.25 : 0) + (cand.tag === '=' ? 0.05 : 0),
      );
    }
  };
  walk(0, {}, 0, 0, 0);

  const statPoints: StatSpread = { hp: hpSp, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  let plusStat: StatKey | null = null;
  let minusStat: StatKey | null = null;
  let fit = 0;
  if (best !== null) {
    const picked = best as { picks: Record<string, Cand>; score: number };
    for (const key of keys) {
      const cand = picked.picks[key];
      statPoints[key] = cand.sp;
      if (cand.tag === '+') plusStat = key;
      if (cand.tag === '-') minusStat = key;
      if (cand.fromFinal) fit++;
      const ocrSp = reads[key].sp;
      if (cand.fromFinal && ocrSp != null && ocrSp !== cand.sp) {
        issues.push(`${key.toUpperCase()}: SP read ${ocrSp}, stat math says ${cand.sp}`);
      }
    }
  }
  const nature = natureFor(plusStat, minusStat) ?? 'Hardy';
  return { statPoints, nature, issues, fit };
}

/** Any nature that boosts (or lowers) the given stat — only its multiplier matters. */
function pickNature(stat: Exclude<StatKey, 'hp'>, dir: 'plus' | 'minus'): NatureName {
  for (const [name, eff] of Object.entries(NATURES) as [NatureName, { plus?: StatKey; minus?: StatKey }][]) {
    if (eff[dir] === stat) return name;
  }
  return 'Hardy';
}

// ---------------------------------------------------------------------------
// Text helpers for the OCR'd strings
// ---------------------------------------------------------------------------

/** The trailing digit groups of a stat line: […, final, sp]. */
export function digitsFromLine(text: string): { final: number | null; sp: number | null } {
  const groups = text.match(/\d+/g);
  if (!groups || groups.length === 0) return { final: null, sp: null };
  if (groups.length === 1) return { final: Number(groups[0]), sp: null };
  return { final: Number(groups[groups.length - 2]), sp: Number(groups[groups.length - 1]) };
}
