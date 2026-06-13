import type { DetectedPokemon, RecognitionResult, TeamPreviewRecognizer } from './types';
import { resolveSpeciesName } from '../champions/engine';
import type { Side } from '../champions';
import { spriteThumbnail, colorThumbnail, normalizeThumb, similarity, decodeThumb } from '../champions/phash';
import { detectColumn, detectSlots, cropRGBA, removeEnemyBackground, keepLargestComponent, flipH, isPanelRed, type Img } from './segment';
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
}

/** Reference thumbnails, decoded + normalized once on first use. */
let refVecs: RefVec[] | null = null;
function references(): RefVec[] {
  if (!refVecs) {
    refVecs = (rawHashes as Array<{ species: string; t: string; c: string }>).map((r) => ({
      species: r.species,
      v: normalizeThumb(decodeThumb(r.t)),
      cv: normalizeThumb(decodeThumb(r.c)),
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
 * Accept a match only above this combined similarity; below it the slot is left
 * blank. With colour blended in, every correct sprite on the validation
 * screenshot scored 0.80–0.96, so this cleanly keeps the hits.
 */
const MATCH_THRESHOLD = 0.55;

/**
 * Below {@link MATCH_THRESHOLD} but still worth showing as a "best guess" hint
 * (rather than auto-filling). Below this we treat the slot as unrecognised.
 */
const MENTION_THRESHOLD = 0.4;

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
 * are blended by {@link COLOR_WEIGHT}.
 */
function bestMatch(rgba: Uint8ClampedArray, w: number, h: number): { species: string; sim: number } {
  const flipped = flipH(rgba, w, h);
  const v = normalizeThumb(spriteThumbnail(rgba, w, h));
  const vf = normalizeThumb(spriteThumbnail(flipped, w, h));
  const cv = normalizeThumb(colorThumbnail(rgba, w, h));
  const cvf = normalizeThumb(colorThumbnail(flipped, w, h));
  let bestSpecies = '';
  let bestSim = -1;
  for (const r of references()) {
    const shape = Math.max(similarity(v, r.v), similarity(vf, r.v));
    const color = Math.max(similarity(cv, r.cv), similarity(cvf, r.cv));
    const sim = (1 - COLOR_WEIGHT) * shape + COLOR_WEIGHT * color;
    if (sim > bestSim) { bestSim = sim; bestSpecies = r.species; }
  }
  return { species: bestSpecies, sim: bestSim };
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
        notes: ['Couldn’t find the red enemy panels — is this a Team Preview screenshot? Add them below, or try “More precise”.'],
      };
    }

    const slots = detectSlots(img, x0, x1, isPanelRed);
    const spriteW = Math.round((x1 - x0) * SPRITE_WIDTH_FRACTION);
    const enemy: DetectedPokemon[] = [];
    const uncertain: DetectedPokemon[] = [];

    for (const [y0, y1] of slots) {
      const ch = y1 - y0;
      if (ch < 8 || y0 < 0 || y1 > img.height) continue;
      const rgba = keepLargestComponent(
        removeEnemyBackground(cropRGBA(img, x0, y0, spriteW, ch), spriteW, ch),
        spriteW, ch,
      );
      const { species, sim } = bestMatch(rgba, spriteW, ch);
      const mon: DetectedPokemon = {
        side: 'enemy',
        species: resolveSpeciesName(species),
        confidence: sim,
        box: { x: x0, y: y0, w: spriteW, h: ch },
      };
      if (sim >= MATCH_THRESHOLD) enemy.push(mon);
      else if (sim >= MENTION_THRESHOLD) uncertain.push(mon); // shaky — offer, don't fill
    }

    const notes: string[] = [];
    if (!enemy.length && !uncertain.length) {
      notes.push('Couldn’t match any enemy Pokémon on-device — add them below, or try “More precise”.');
    }

    return { player: [], enemy, uncertain, engine: 'local', notes };
  }
}
