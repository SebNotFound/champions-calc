/**
 * Showdown / pokepaste team parsing.
 *
 * Teams shared on pokepaste use the standard Pokémon Showdown text format,
 * which is EV-based. Champions uses Stat Points instead, so we convert on
 * import. The conversion is fixed by the stat math: at Lv50, 8 EVs raise a stat
 * by 1, and 1 SP also raises a stat by 1 — so **8 EV = 1 SP** (252 EV → 32 SP,
 * exactly the per-stat cap). We round to the nearest SP, clamp each stat to 32,
 * and trim to the 66-point budget if a spread would exceed it.
 *
 * Example block this parses:
 *
 *   Gholdengo @ Choice Specs
 *   Ability: Good as Gold
 *   Level: 50
 *   Tera Type: Steel            (ignored — Champions has no Tera)
 *   EVs: 4 HP / 252 SpA / 252 Spe
 *   Modest Nature
 *   - Make It Rain
 *   - Shadow Ball
 *   - Nasty Plot
 *   - Protect
 */
import { emptySpread, STAT_KEYS, MAX_SP_PER_STAT, MAX_TOTAL_SP } from './stats';
import { resolveSpeciesName } from './engine';
import type { ChampionsSet, NatureName, StatKey, StatSpread, StatTable } from './types';

const EV_LABELS: Record<string, StatKey> = {
  hp: 'hp', atk: 'atk', def: 'def', spa: 'spa', spd: 'spd', spe: 'spe',
};

const NATURE_BY_ID = new Map<string, NatureName>(
  ([
    'Adamant', 'Bashful', 'Bold', 'Brave', 'Calm', 'Careful', 'Docile', 'Gentle',
    'Hardy', 'Hasty', 'Impish', 'Jolly', 'Lax', 'Lonely', 'Mild', 'Modest',
    'Naive', 'Naughty', 'Quiet', 'Quirky', 'Rash', 'Relaxed', 'Sassy', 'Serious', 'Timid',
  ] as NatureName[]).map((n) => [n.toLowerCase(), n]),
);

/** Parse a "4 HP / 252 Atk / 252 Spe" style line into a partial stat table.
 *  Tolerant of casing and odd spacing in hand-pasted teams. */
function parseStatLine(line: string): Partial<StatTable> {
  const out: Partial<StatTable> = {};
  for (const part of line.split('/')) {
    const m = part.trim().match(/^(\d+)\s+(HP|Atk|Def|SpA|SpD|Spe)$/i);
    if (m) out[EV_LABELS[m[2].toLowerCase()]] = Number(m[1]);
  }
  return out;
}

/**
 * Convert a spread from the paste's "EVs:" field into Champions Stat Points.
 *
 * Champions pastes already store Stat Points (0–32) in that field, while legacy
 * Showdown pastes store EVs (0–252). We tell them apart by magnitude: if nothing
 * exceeds 32 it's already Stat Points and we keep the numbers as-is; otherwise
 * it's EVs and we apply the 8-EV-per-SP conversion.
 */
export function evsToStatPoints(evs: Partial<StatTable>): StatSpread {
  const max = Math.max(0, ...STAT_KEYS.map((k) => evs[k] ?? 0));
  const alreadyStatPoints = max <= MAX_SP_PER_STAT;
  const sp = emptySpread();
  for (const key of STAT_KEYS) {
    const value = evs[key] ?? 0;
    sp[key] = Math.min(MAX_SP_PER_STAT, alreadyStatPoints ? value : Math.round(value / 8));
  }
  // Trim to the 66-point budget, taking from the largest stat first.
  let total = STAT_KEYS.reduce((sum, k) => sum + sp[k], 0);
  while (total > MAX_TOTAL_SP) {
    let biggest: StatKey = STAT_KEYS[0];
    for (const k of STAT_KEYS) if (sp[k] > sp[biggest]) biggest = k;
    sp[biggest] -= 1;
    total -= 1;
  }
  return sp;
}

/** Parse a single Pokémon block. Returns null if it has no species line. */
function parseSet(block: string): ChampionsSet | null {
  const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;

  // First line: "Nick (Species) @ Item" | "Species (M) @ Item" | "Species @ Item" | "Species"
  let header = lines[0];
  let item: string | undefined;
  const at = header.lastIndexOf(' @ ');
  if (at !== -1) {
    item = header.slice(at + 3).trim();
    header = header.slice(0, at).trim();
  }

  // Strip a trailing gender marker first, then unwrap a "Nick (Species)" nickname.
  header = header.replace(/\s*\((?:M|F)\)\s*$/i, '').trim();
  const paren = header.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  let species = paren ? paren[2].trim() : header;
  // Snap to the canonical dex name (forgiving of casing/spacing/typos).
  species = resolveSpeciesName(species);
  if (!species) return null;

  let ability: string | undefined;
  let nature: NatureName = 'Hardy';
  let evs: Partial<StatTable> = {};
  const moves: string[] = [];

  for (const line of lines.slice(1)) {
    const lower = line.toLowerCase();
    if (lower.startsWith('ability:')) ability = line.slice(line.indexOf(':') + 1).trim();
    else if (lower.startsWith('evs:')) evs = parseStatLine(line.slice(line.indexOf(':') + 1));
    else if (line.startsWith('- ')) moves.push(line.slice(2).trim());
    else if (lower.endsWith(' nature')) {
      const n = NATURE_BY_ID.get(line.slice(0, -7).trim().toLowerCase());
      if (n) nature = n;
    }
    // Level / Tera Type / IVs / Shiny / Happiness etc. are intentionally ignored.
  }

  while (moves.length < 4) moves.push('');
  return {
    species,
    level: 50,
    nature,
    statPoints: evsToStatPoints(evs),
    ability: ability || undefined,
    item: item || undefined,
    moves: moves.slice(0, 4),
  };
}

/** Parse a full Showdown/pokepaste team (blocks separated by blank lines). */
export function parseShowdownTeam(text: string): ChampionsSet[] {
  return text
    .replace(/\r\n/g, '\n')
    .trim()
    .split(/\n\s*\n/)
    .map(parseSet)
    .filter((s): s is ChampionsSet => s !== null);
}
