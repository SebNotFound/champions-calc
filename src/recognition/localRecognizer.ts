import type { DetectedPokemon, RecognitionResult, TeamPreviewRecognizer, CropRect } from './types';
import { resolveSpeciesName, getSpeciesTypes } from '../champions/engine';
import type { Side } from '../champions';
import { spriteThumbnail, colorThumbnail, normalizeThumb, similarity, decodeThumb } from '../champions/phash';
import { detectColumn, detectSlots, cropRGBA, removeEnemyBackground, keepLargestComponent, flipH, isPanelRed, type Img } from './segment';
import { detectIconBuckets, speciesTypeBuckets, typeMatchBonus, type ColorBucket } from './typeIcons';
import rawHashes from '../champions/data/sprite-hashes.json';

/**
 * Free, on-device Team Preview recognizer (the default engine).
 *
 * Reads the ENEMY (red) side of a Team Preview reliably. The player (blue) side
 * blends into the blue background, so on-device sprite detection there isn't
 * dependable yet — `recognize(_, 'player')` returns a note steering you to
 * Claude (which reads blue via vision), text import, or manual entry. The enemy
 * pipeline:
 *
 *   1. Decode the image to RGBA (jpeg-js for JPEGs, canvas otherwise).
 *   2. Find the red column and split it into six slots (segment.ts).
 *   3. Crop each sprite, strip the red panel (removeEnemyBackground), and keep
 *      only the largest blob so the gender/item icons drop out.
 *   4. Match each sprite (and its mirror) against the reference set by cosine
 *      similarity, blending a grayscale "shape" score with a coarse colour score
 *      so similarly-shaped mons of different colours don't get confused (phash.ts).
 *      The panel's type icons add a small consistency bonus (typeIcons.ts): they
 *      survive the fire/low-res that ruins the sprite, so they break near-ties and
 *      rescue a read the fingerprint alone can't make.
 *   5. Keep matches above a confidence threshold; weaker ones become "best
 *      guesses" so a shaky guess never silently fills the wrong Pokémon.
 *
 * It's tuned for the standard doubles Team Preview. For odd layouts, distorted
 * phone photos, or your team's full stat/move report, use "More precise" (Claude).
 */

interface RefVec {
  species: string;
  v: Float32Array;  // grayscale shape fingerprint
  cv: Float32Array; // coarse colour fingerprint
  buckets: ColorBucket[][]; // type-icon colour groups, one per readable type
}

/** Reference thumbnails, decoded + normalized once on first use. */
let refVecs: RefVec[] | null = null;
function references(): RefVec[] {
  if (!refVecs) {
    refVecs = (rawHashes as Array<{ species: string; t: string; c: string }>).map((r) => ({
      species: r.species,
      v: normalizeThumb(decodeThumb(r.t)),
      cv: normalizeThumb(decodeThumb(r.c)),
      buckets: speciesTypeBuckets(getSpeciesTypes(r.species)),
    }));
  }
  return refVecs;
}

/**
 * How much the colour signature counts vs the grayscale shape when scoring a
 * match (0 = shape only, 1 = colour only). Colour is the tiebreaker that tells
 * same-shaped mons apart (a tan Hippowdon from a pink Slowbro); shape still
 * leads. Validated on the sample team where every correct sprite ranked #1.
 */
const COLOR_WEIGHT = 0.45;

/**
 * Auto-fill a slot only above this combined similarity. With colour blended in,
 * correctly-matched sprites on a clean Team Preview score 0.80–0.96, while a
 * mis-segmented screenshot (e.g. a low-res shot where the panels can't be cleanly
 * separated from battle effects) tops out around 0.5–0.65 — so the bar sits high
 * enough that a shaky read is shown as a best guess instead of confidently
 * filling the wrong Pokémon. Better to ask than to be wrong.
 */
const MATCH_THRESHOLD = 0.7;

/**
 * A slightly lower bar to auto-fill, used only when the match is type-consistent
 * (its every readable type is corroborated by the panel's icons; see typeIcons.ts).
 * The icons are independent evidence that survives the occlusion which drags the
 * fingerprint score down, so a type-backed 0.66 is about as trustworthy as a
 * fingerprint-only 0.70. Kept just 0.04 below the main bar on purpose: on the
 * occluded sample it promotes the correct type-backed reads (Charizard 0.68,
 * Gardevoir 0.67) to auto-fill while leaving a same-typed lookalike (0.66) and a
 * true shape tie (0.59) as best guesses, and it changes nothing on a clean shot
 * where the right answer already clears 0.80. It is still possible for a strongly
 * type-consistent lookalike to fill on a badly occluded shot, so this trades a
 * little of "ask, don't guess" for fewer slots left empty. Verify a low one.
 */
const TYPE_CONSISTENT_THRESHOLD = 0.66;

/**
 * Below {@link MATCH_THRESHOLD} but still worth showing as a "best guess" hint
 * (rather than auto-filling). Below this we treat the slot as unrecognised.
 */
const MENTION_THRESHOLD = 0.45;

/**
 * Whether a scored match is confident enough to auto-fill rather than be offered
 * as a best guess. A plain match needs {@link MATCH_THRESHOLD}; a type-consistent
 * one (corroborated by the panel's type icons) only needs the lower
 * {@link TYPE_CONSISTENT_THRESHOLD}.
 */
export function acceptsAutoFill(sim: number, typeConsistent: boolean): boolean {
  return sim >= MATCH_THRESHOLD || (typeConsistent && sim >= TYPE_CONSISTENT_THRESHOLD);
}

/**
 * Fraction of each panel's width taken as the sprite window. Wide enough to fit
 * big mons (Hippowdon) without clipping; the gender/item icons that fall inside
 * it are removed by {@link keepLargestComponent}, not by cropping them out.
 */
const SPRITE_WIDTH_FRACTION = 0.7;

/**
 * Decode a user-selected image Blob to raw RGBA.
 *
 * JPEGs are decoded with jpeg-js rather than the canvas: the browser's native
 * JPEG decoder upsamples chroma a little differently, which shifted similarity
 * scores enough to drop borderline matches (Rotom 0.82 → 0.46) versus the
 * reference pipeline this matcher was tuned against. PNG/webp (lossless or
 * canvas-only) go through the canvas, where they already match. Colour
 * management is disabled so pixels line up with the ICC-free reference sprites.
 */
async function decodeToImg(image: Blob): Promise<Img> {
  const buf = new Uint8Array(await image.arrayBuffer());
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    const { default: jpeg } = await import('jpeg-js');
    const { data, width, height } = jpeg.decode(buf, { useTArray: true, maxMemoryUsageInMB: 1024 });
    return { data, width, height };
  }
  const bitmap = await createImageBitmap(image, { colorSpaceConversion: 'none' });
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get a 2D canvas context to read the image.');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { data, width, height };
}

/**
 * Best reference match for one cropped, background-removed sprite. Each sprite is
 * compared both ways (it and its mirror, since enemy sprites face the player) on
 * a grayscale shape fingerprint and a coarse colour fingerprint; the two scores
 * are blended by {@link COLOR_WEIGHT}. A candidate whose typing matches the
 * panel's type icons gets a small bonus on top (see typeIcons.ts), which breaks
 * near-ties and rescues sprites the fingerprint alone can't read (occluded by
 * fire, low-res). `iconBuckets` is the set of colours read from this panel's
 * icons; pass an empty set to score on the fingerprint alone.
 */
function bestMatch(rgba: Uint8ClampedArray, w: number, h: number, iconBuckets: Set<ColorBucket>): { species: string; sim: number; typeConsistent: boolean } {
  const flipped = flipH(rgba, w, h);
  const v = normalizeThumb(spriteThumbnail(rgba, w, h));
  const vf = normalizeThumb(spriteThumbnail(flipped, w, h));
  const cv = normalizeThumb(colorThumbnail(rgba, w, h));
  const cvf = normalizeThumb(colorThumbnail(flipped, w, h));
  let bestSpecies = '';
  let bestSim = -1;
  let bestTypeConsistent = false;
  for (const r of references()) {
    const shape = Math.max(similarity(v, r.v), similarity(vf, r.v));
    const color = Math.max(similarity(cv, r.cv), similarity(cvf, r.cv));
    const bonus = typeMatchBonus(r.buckets, iconBuckets);
    const sim = (1 - COLOR_WEIGHT) * shape + COLOR_WEIGHT * color + bonus;
    if (sim > bestSim) { bestSim = sim; bestSpecies = r.species; bestTypeConsistent = bonus > 0; }
  }
  return { species: bestSpecies, sim: bestSim, typeConsistent: bestTypeConsistent };
}

/**
 * Match one enemy column [x0, x1] split into the given slot rows — shared by the
 * automatic path and the manual-crop path. Each slot is cropped to the sprite
 * (the left {@link SPRITE_WIDTH_FRACTION} of the panel), stripped of the red
 * panel, reduced to its largest blob (dropping the gender/item icons), then
 * matched. Confident hits go to `enemy`; shaky ones to `uncertain`.
 */
function matchEnemyColumn(img: Img, x0: number, x1: number, slots: Array<[number, number]>) {
  const spriteW = Math.round((x1 - x0) * SPRITE_WIDTH_FRACTION);
  const enemy: DetectedPokemon[] = [];
  const uncertain: DetectedPokemon[] = [];
  if (spriteW < 8) return { enemy, uncertain };
  for (const [y0, y1] of slots) {
    const ch = y1 - y0;
    if (ch < 8 || y0 < 0 || y1 > img.height) continue;
    const rgba = keepLargestComponent(
      removeEnemyBackground(cropRGBA(img, x0, y0, spriteW, ch), spriteW, ch),
      spriteW, ch,
    );
    // Read this panel's type icons (top-right, full panel width) as a prior; they
    // survive fire/low-res that the sprite itself does not.
    const iconBuckets = detectIconBuckets(img, x0, x1, y0, y1);
    const { species, sim, typeConsistent } = bestMatch(rgba, spriteW, ch, iconBuckets);
    const mon: DetectedPokemon = {
      side: 'enemy',
      species: resolveSpeciesName(species),
      // The type-icon bonus can lift sim past 1.0; clamp so the shown confidence
      // never reads as more than 100%.
      confidence: Math.min(1, sim),
      box: { x: x0, y: y0, w: spriteW, h: ch },
    };
    if (acceptsAutoFill(sim, typeConsistent)) enemy.push(mon);
    else if (sim >= MENTION_THRESHOLD) uncertain.push(mon); // shaky — offer, don't fill
  }
  return { enemy, uncertain };
}

/**
 * If nothing cleared the confidence bar, steer the user to a surer path — even
 * when there are weak guesses, since on a hard screenshot (low-res, or panels
 * lost in battle effects) those guesses are unreliable.
 */
function lowConfidenceNotes(enemy: DetectedPokemon[], uncertain: DetectedPokemon[]): string[] {
  if (enemy.length) return [];
  return [uncertain.length
    ? 'Couldn’t confidently read the enemy team — the guesses below are low-confidence. Crop the six panels yourself, pick/add them manually, or try “More precise” (Claude).'
    : 'Couldn’t match any enemy Pokémon — crop the six panels yourself, add them below, or try “More precise” (Claude).'];
}

export class LocalRecognizer implements TeamPreviewRecognizer {
  readonly id = 'local' as const;
  readonly label = 'On-device (free)';

  async recognize(image: Blob, side: Side): Promise<RecognitionResult> {
    if (side === 'player') {
      return {
        player: [], enemy: [], uncertain: [], engine: 'local',
        notes: ['On-device can’t read your own (blue) side reliably yet — use “More precise” (Claude), import from text, or add your Pokémon below.'],
      };
    }

    const img = await decodeToImg(image);
    const [x0, x1] = detectColumn(img, isPanelRed, 'right');
    if (x1 - x0 < 20) {
      return {
        player: [], enemy: [], engine: 'local',
        notes: ['Couldn’t find the red enemy panels — crop them yourself below, or try “More precise”.'],
      };
    }

    const slots = detectSlots(img, x0, x1, isPanelRed);
    const { enemy, uncertain } = matchEnemyColumn(img, x0, x1, slots);
    return { player: [], enemy, uncertain, engine: 'local', notes: lowConfidenceNotes(enemy, uncertain) };
  }

  /**
   * Auto-detect the enemy column's bounding box (in source-image pixels) so the
   * manual crop can be pre-filled with a sensible guess. Null if no red column.
   */
  async detectEnemyBox(image: Blob): Promise<CropRect | null> {
    const img = await decodeToImg(image);
    const [x0, x1] = detectColumn(img, isPanelRed, 'right');
    if (x1 - x0 < 20) return null;
    const slots = detectSlots(img, x0, x1, isPanelRed)
      .filter(([y0, y1]) => y1 - y0 >= 8 && y0 >= 0 && y1 <= img.height);
    if (!slots.length) return null;
    return { x: x0, y: slots[0][0], w: x1 - x0, h: slots[slots.length - 1][1] - slots[0][0] };
  }

  /**
   * Read the enemy team from a user-drawn crop of the six panels. The crop IS
   * the column and is split into six equal rows — no fragile locate/row step —
   * so it works when auto-detect can't find the panels (off-centre shots, a
   * trainer-name banner, odd layouts). It can't recover sprites that are
   * themselves covered by battle effects; those stay low-confidence.
   */
  async recognizeCrop(image: Blob, rect: CropRect): Promise<RecognitionResult> {
    const img = await decodeToImg(image);
    const x0 = Math.max(0, Math.round(rect.x));
    const x1 = Math.min(img.width, Math.round(rect.x + rect.w));
    const top = Math.max(0, Math.round(rect.y));
    const bottom = Math.min(img.height, Math.round(rect.y + rect.h));
    if (x1 - x0 < 16 || bottom - top < 24) {
      return { player: [], enemy: [], engine: 'local', notes: ['That crop is too small — draw a box around the six enemy panels.'] };
    }

    // Work inside the crop only — the user has already excluded the header and
    // everything off to the side, so the brittle locate-on-the-whole-screen step
    // is gone.
    const sub: Img = {
      data: cropRGBA(img, x0, top, x1 - x0, bottom - top),
      width: x1 - x0,
      height: bottom - top,
    };

    // Re-detect within the crop so a sloppy box still works: detectColumn trims
    // any margin the user left on the sides, and detectSlots nails the panel
    // pitch. Only if that doesn't yield a clean six-panel split (e.g. effects
    // bleed across the panels) do we fall back to six equal rows over the crop.
    let cx0 = 0, cx1 = sub.width;
    let slots: Array<[number, number]>;
    const [dx0, dx1] = detectColumn(sub, isPanelRed, 'right');
    const detected = dx1 - dx0 >= sub.width * 0.3
      ? detectSlots(sub, dx0, dx1, isPanelRed).filter(([a, b]) => b - a >= 8 && a >= 0 && b <= sub.height)
      : [];
    if (detected.length === 6) {
      cx0 = dx0; cx1 = dx1; slots = detected;
    } else {
      slots = Array.from({ length: 6 }, (_, i): [number, number] => [
        Math.round((i * sub.height) / 6),
        Math.round(((i + 1) * sub.height) / 6),
      ]);
    }

    const { enemy, uncertain } = matchEnemyColumn(sub, cx0, cx1, slots);
    return { player: [], enemy, uncertain, engine: 'local', notes: lowConfidenceNotes(enemy, uncertain) };
  }
}
