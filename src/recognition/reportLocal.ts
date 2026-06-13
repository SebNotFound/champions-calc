/**
 * Free, on-device team-report reader (the zero-cost path).
 *
 * Runs the validated reportRead pipeline in the browser with tesseract.js as the
 * OCR engine: detect the panel grid, crop each field, OCR it, fuzzy-match names
 * to the Pokémon's legal vocabulary, and solve the Stat-Point spread + nature
 * from the numbers via exact stat math. No API key, no per-use cost.
 *
 * tesseract.js is dynamically imported so its ~MB of WASM + language data only
 * loads when someone actually uses this engine (keeping the main bundle small).
 * On a clean 1080p screenshot this reads stats/natures/abilities/moves at ~full
 * accuracy; the odd item with a busy icon may need a fix in the review step.
 */
import type { Img } from './segment';
import {
  detectReportPanels, classifyReportTab, nameRect, statLineRect,
  abilityRect, itemRect, moveRect, toOcrCrop, solveSpread, digitsFromLine,
  type Rect, type OcrCrop, type StatReads,
} from './reportRead';
import { fuzzyBest } from './fuzzy';
import {
  listSpecies, listItems, listMoves, listAbilities,
  speciesAbilities, speciesMoves, getSpeciesBaseStats, emptySpread,
} from '../champions';
import type { ChampionsSet, StatKey, StatSpread, NatureName } from '../champions';

export interface ReportInput { stats?: Blob; moves?: Blob; }
export type ProgressFn = (done: number, total: number, label: string) => void;

/** Letters/spacing only — for name/ability/item/move fields, so an ambiguous
 *  glyph can't become a digit ("Sash" → "Jd51"). Stat lines stay unconstrained. */
const WORD_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .-'";

type ReadFn = (crop: OcrCrop) => Promise<string>;

async function decodeImg(blob: Blob): Promise<Img> {
  const bitmap = await createImageBitmap(blob, { colorSpaceConversion: 'none' });
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not read the image.');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { data, width, height };
}

function cropToCanvas(crop: OcrCrop): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = crop.width;
  canvas.height = crop.height;
  const img = new ImageData(new Uint8ClampedArray(crop.data), crop.width, crop.height);
  canvas.getContext('2d')!.putImageData(img, 0, 0);
  return canvas;
}

async function makeWorkers(): Promise<{ readLine: ReadFn; readWord: ReadFn; terminate: () => Promise<void> }> {
  const { createWorker, PSM } = await import('tesseract.js');
  const line = await createWorker('eng');
  await line.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
  const word = await createWorker('eng'); // lang data is cached after the first
  await word.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: WORD_CHARS });
  const reader = (w: typeof line): ReadFn => async (crop) => {
    if (crop.width < 5 || crop.height < 5) return '';
    const { data } = await w.recognize(cropToCanvas(crop));
    return data.text.trim().replace(/\s+/g, ' ');
  };
  return {
    readLine: reader(line),
    readWord: reader(word),
    terminate: async () => { await line.terminate(); await word.terminate(); },
  };
}

const STAT_SIDES: Record<'left' | 'right', StatKey[]> = {
  left: ['hp', 'atk', 'def'],
  right: ['spa', 'spd', 'spe'],
};

/** Vocab that's legal for a species (its own + its base forme), deduped. */
async function speciesVocab(species: string) {
  const base = species.split('-')[0];
  const abilities = [...new Set([...speciesAbilities(species), ...speciesAbilities(base)])];
  const moves = [...new Set([...(await speciesMoves(species)), ...(await speciesMoves(base))])];
  return { abilities, moves };
}

/** Match an OCR reading to a constrained vocab, falling back to a global list. */
function matchVocab(reading: string, vocab: readonly string[], global: readonly string[], tol: number): string | null {
  return fuzzyBest(reading, vocab, tol)?.value ?? fuzzyBest(reading, global, tol)?.value ?? null;
}

export async function recognizeTeamReportLocal(input: ReportInput, onProgress?: ProgressFn): Promise<ChampionsSet[]> {
  if (!input.stats && !input.moves) throw new Error('Add at least one screenshot.');

  const allSpecies = listSpecies();
  const allItems = listItems();
  const allMoves = listMoves();
  const allAbilities = listAbilities();

  const statsImg = input.stats ? await decodeImg(input.stats) : null;
  const movesImg = input.moves ? await decodeImg(input.moves) : null;

  // Tolerate the two tabs being dropped in the wrong zones.
  let statsPick = statsImg, movesPick = movesImg;
  if (statsImg && classifyReportTab(statsImg) === 'moves' && movesImg && classifyReportTab(movesImg) === 'stats') {
    [statsPick, movesPick] = [movesImg, statsImg];
  } else if (statsImg && !movesImg && classifyReportTab(statsImg) === 'moves') {
    movesPick = statsImg; statsPick = null;
  } else if (movesImg && !statsImg && classifyReportTab(movesImg) === 'stats') {
    statsPick = movesImg; movesPick = null;
  }

  const statsPanels = statsPick ? detectReportPanels(statsPick) : [];
  const movesPanels = movesPick ? detectReportPanels(movesPick) : [];
  const count = Math.max(statsPanels.length, movesPanels.length);
  if (!count) throw new Error('No team panels found — is this the in-game team view?');

  const { readLine, readWord, terminate } = await makeWorkers();
  // Rough op count for progress: per panel ~7 (stats) + ~6 (moves).
  const total = statsPanels.length * 7 + movesPanels.length * 6;
  let done = 0;
  const tick = (label: string) => onProgress?.(++done, total, label);
  // `word` → letter-whitelisted read (names/abilities/items/moves); otherwise the
  // plain reader for stat lines (which carry digits).
  const ocr = async (img: Img, rect: Rect, label: string, word = false) => {
    const t = await (word ? readWord : readLine)(toOcrCrop(img, rect, 3));
    tick(label);
    return t;
  };

  try {
    const sets: ChampionsSet[] = [];
    for (let i = 0; i < count; i++) {
      // --- Stats tab: species + spread + nature ---
      let species: string | null = null;
      let statPoints: StatSpread = emptySpread();
      let nature: NatureName = 'Hardy';

      const sPanel = statsPanels[i];
      if (statsPick && sPanel) {
        const nameText = await ocr(statsPick, nameRect(sPanel), 'name', true);
        species = fuzzyBest(nameText, allSpecies, 0.4)?.value ?? null;

        const reads = {} as StatReads;
        for (const side of ['left', 'right'] as const) {
          for (let row = 0 as 0 | 1 | 2; row < 3; row++) {
            const key = STAT_SIDES[side][row];
            const text = await ocr(statsPick, statLineRect(sPanel, row as 0 | 1 | 2, side), 'stat');
            reads[key] = digitsFromLine(text);
          }
        }
        if (species) {
          // Disambiguate forme by which base-stat set the numbers actually fit.
          const base = species.split('-')[0];
          const candidates = [...new Set([species, base, ...allSpecies.filter((s) => s.startsWith(base + '-'))])]
            .filter((s) => getSpeciesBaseStats(s));
          let best: { species: string; fit: number; sp: StatSpread; nat: NatureName } | null = null;
          for (const cand of candidates.slice(0, 10)) {
            const bs = getSpeciesBaseStats(cand)!;
            const solved = solveSpread(bs, reads);
            if (!best || solved.fit > best.fit || (solved.fit === best.fit && cand.length < best.species.length)) {
              best = { species: cand, fit: solved.fit, sp: solved.statPoints, nat: solved.nature };
            }
          }
          if (best) { species = best.species; statPoints = best.sp; nature = best.nat; }
        }
      }

      // --- Moves tab: ability, item, four moves ---
      let ability: string | undefined;
      let item: string | undefined;
      let moves: string[] = ['', '', '', ''];

      const mPanel = movesPanels[i];
      if (movesPick && mPanel) {
        if (!species) {
          const nameText = await ocr(movesPick, nameRect(mPanel), 'name', true);
          species = fuzzyBest(nameText, allSpecies, 0.4)?.value ?? null;
        }
        const vocab = species ? await speciesVocab(species) : { abilities: allAbilities, moves: allMoves };
        const abilityText = await ocr(movesPick, abilityRect(mPanel), 'ability', true);
        const itemText = await ocr(movesPick, itemRect(mPanel), 'item', true);
        ability = matchVocab(abilityText, vocab.abilities, allAbilities, 0.4) ?? undefined;
        item = matchVocab(itemText, allItems, allItems, 0.5) ?? undefined;
        moves = [];
        for (let slot = 0 as 0 | 1 | 2 | 3; slot < 4; slot++) {
          const text = await ocr(movesPick, moveRect(mPanel, slot as 0 | 1 | 2 | 3), 'move', true);
          moves.push(matchVocab(text, vocab.moves, allMoves, 0.34) ?? '');
        }
        while (moves.length < 4) moves.push('');
      }

      if (!species) continue;
      sets.push({ species, level: 50, nature, statPoints, ability, item: item || undefined, moves: moves.slice(0, 4) });
    }
    if (!sets.length) throw new Error('Couldn’t read any Pokémon from the screenshot(s).');
    return sets;
  } finally {
    await terminate();
  }
}
