/**
 * Fuzzy text matching for OCR output.
 *
 * On-device OCR of the team report gets most characters right but rarely a
 * whole name ("Aqua Jef", "Thick Fa", "Icicle=Crash"). Every name it reads,
 * though, comes from a KNOWN vocabulary — species, the species' legal
 * abilities, its learnset, the item list — so we snap each reading to the
 * closest known entry and refuse matches that are too far off. Constraining
 * candidates to what's legal for the Pokémon is what makes this reliable.
 */

/** Lowercase and strip everything but letters and digits ("Sp. Atk" → "spatk"). */
export function normalizeText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** Classic Levenshtein edit distance (iterative, two rows). */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const sub = prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      curr[j] = Math.min(sub, prev[j] + 1, curr[j - 1] + 1);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

export interface FuzzyMatch {
  /** The matched vocabulary entry (its original, un-normalized form). */
  value: string;
  /** Edit distance / max length — 0 is exact, 1 is nothing in common. */
  score: number;
}

/**
 * Best vocabulary match for an OCR reading, or null when nothing is close
 * enough. `maxScore` is the normalized-distance cutoff: 0.34 tolerates roughly
 * one bad character in three, which absorbs typical OCR slips without letting
 * a genuinely different word through.
 */
export function fuzzyBest(reading: string, vocabulary: readonly string[], maxScore = 0.34): FuzzyMatch | null {
  const norm = normalizeText(reading);
  if (!norm) return null;
  let best: FuzzyMatch | null = null;
  for (const value of vocabulary) {
    const cand = normalizeText(value);
    if (!cand) continue;
    // Cheap length gate before the O(n·m) distance.
    if (Math.abs(cand.length - norm.length) / Math.max(cand.length, norm.length) > maxScore) continue;
    const score = editDistance(norm, cand) / Math.max(norm.length, cand.length);
    if (score <= maxScore && (!best || score < best.score)) {
      best = { value, score };
      if (score === 0) break;
    }
  }
  return best;
}
