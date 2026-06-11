import type { DetectedPokemon, RecognitionResult, TeamPreviewRecognizer } from './types';
import { resolveSpeciesName } from '../champions/engine';
import { spriteThumbnail, normalizeThumb, similarity, decodeThumb } from '../champions/phash';
import { detectEnemyColumn, detectSlots, cropRGBA, removeBackground, flipH, type Img } from './segment';
import rawHashes from '../champions/data/sprite-hashes.json';

/**
 * Free, on-device Team Preview recognizer (the default engine).
 *
 * It reads the ENEMY side (the red panels on the right) — the half that's
 * actually worth automating, since you already know your own team and can load
 * a saved one. The pipeline, validated against real screenshots in
 * scripts/test-recognize.mjs:
 *
 *   1. Decode the image to RGBA on a canvas.
 *   2. Find the red enemy column and split it into six slots (segment.ts).
 *   3. Crop each sprite, flood-fill away the panel background.
 *   4. Reduce to a normalized grayscale thumbnail and match it (and its mirror,
 *      since enemy sprites face the player) against the reference set by cosine
 *      similarity (phash.ts).
 *   5. Keep matches above a confidence threshold; leave the rest blank so a
 *      shaky guess never silently fills the wrong Pokémon.
 *
 * It's tuned for the standard doubles Team Preview. For odd layouts, distorted
 * phone photos, or the player side, switch on "More precise" (Claude).
 */

interface RefVec {
  species: string;
  v: Float32Array;
}

/** Reference thumbnails, decoded + normalized once on first use. */
let refVecs: RefVec[] | null = null;
function references(): RefVec[] {
  if (!refVecs) {
    refVecs = (rawHashes as Array<{ species: string; t: string }>).map((r) => ({
      species: r.species,
      v: normalizeThumb(decodeThumb(r.t)),
    }));
  }
  return refVecs;
}

/**
 * Accept a match only above this cosine similarity; below it the slot is left
 * blank. On the validation screenshot the correct sprites scored 0.66–0.89 and
 * the one genuine miss scored 0.41, so this cleanly keeps the hits and drops
 * the guess.
 */
const MATCH_THRESHOLD = 0.55;

/**
 * Below {@link MATCH_THRESHOLD} but still worth showing as a "best guess" hint
 * (rather than auto-filling). Below this we treat the slot as unrecognised.
 */
const MENTION_THRESHOLD = 0.4;

/** Fraction of each panel's width that contains the sprite (the rest is text/icons). */
const SPRITE_WIDTH_FRACTION = 0.6;

/** Decode a user-selected image Blob to raw RGBA via a canvas. Colour management
 *  is disabled so the decoded pixels match the reference fingerprints (which
 *  were generated without an ICC transform), keeping similarity scores stable. */
async function decodeToImg(image: Blob): Promise<Img> {
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

/** Best reference match for one cropped, background-removed sprite. */
function bestMatch(rgba: Uint8ClampedArray, w: number, h: number): { species: string; sim: number } {
  const v = normalizeThumb(spriteThumbnail(rgba, w, h));
  const vf = normalizeThumb(spriteThumbnail(flipH(rgba, w, h), w, h));
  let bestSpecies = '';
  let bestSim = -1;
  for (const r of references()) {
    const sim = Math.max(similarity(v, r.v), similarity(vf, r.v));
    if (sim > bestSim) { bestSim = sim; bestSpecies = r.species; }
  }
  return { species: bestSpecies, sim: bestSim };
}

export class LocalRecognizer implements TeamPreviewRecognizer {
  readonly id = 'local' as const;
  readonly label = 'On-device (free)';

  async recognize(image: Blob): Promise<RecognitionResult> {
    const img = await decodeToImg(image);
    const [x0, x1] = detectEnemyColumn(img);
    if (x1 - x0 < 20) {
      return {
        player: [],
        enemy: [],
        engine: 'local',
        notes: ['Could not find the red enemy panel — is this a Team Preview screenshot? Try "More precise".'],
      };
    }

    const slots = detectSlots(img, x0, x1);
    const spriteW = Math.round((x1 - x0) * SPRITE_WIDTH_FRACTION);
    const enemy: DetectedPokemon[] = [];
    const unsure: string[] = [];

    for (const [y0, y1] of slots) {
      const ch = y1 - y0;
      if (ch < 8 || y0 < 0 || y1 > img.height) continue;
      const rgba = removeBackground(cropRGBA(img, x0, y0, spriteW, ch), spriteW, ch);
      const { species, sim } = bestMatch(rgba, spriteW, ch);
      if (sim >= MATCH_THRESHOLD) {
        enemy.push({
          side: 'enemy',
          species: resolveSpeciesName(species),
          confidence: sim,
          box: { x: x0, y: y0, w: spriteW, h: ch },
        });
      } else if (sim >= MENTION_THRESHOLD) {
        // Too shaky to fill automatically, but a plausible guess worth showing.
        unsure.push(`${resolveSpeciesName(species)} (${Math.round(sim * 100)}%)`);
      }
    }

    const notes: string[] = [];
    if (!enemy.length && !unsure.length) {
      notes.push('No enemy Pokémon could be matched on-device. Try "More precise" (Claude).');
    }
    if (unsure.length) {
      const s = unsure.length > 1 ? 's' : '';
      notes.push(`Not sure about ${unsure.length} slot${s} — best guess${unsure.length > 1 ? 'es' : ''}: ${unsure.join(', ')}. Add ${unsure.length > 1 ? 'them' : 'it'} manually if right, or try "More precise".`);
    }
    notes.push('Your own (blue) team isn’t read on-device yet — load a saved team or fill it in.');

    return { player: [], enemy, engine: 'local', notes };
  }
}
