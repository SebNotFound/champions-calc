/**
 * Team-report OCR (your own team, via Claude vision).
 *
 * The in-game team view has two tabs — "Stats" (each Pokémon's 6 stats, each
 * showing its invested Stat Points and nature arrows) and "Moves & More"
 * (ability, item, 4 moves). You hand both screenshots to Claude, which reads and
 * merges them into full sets, so your team imports EXACTLY (stats included), not
 * just by species like sprite detection.
 *
 * Claude-only: this is detailed text OCR, which the on-device engine can't do.
 */
import {
  resolveSpeciesName,
  getSpeciesBaseStats,
  getDefaultAbility,
  emptySpread,
  NATURES,
} from '../champions';
import type { ChampionsSet, NatureName, StatTable } from '../champions';

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

const PROMPT = `These image(s) come from a Pokémon Champions team view (a "rental"/team-report screen) showing a team of up to 6 Pokémon. Across the images there can be two tabs:
- "Stats": each Pokémon's six stats. For EVERY stat there are two numbers — the large final stat, and a smaller number which is the Stat Points invested in that stat (0–32). An up arrow marks the nature-boosted stat; a down arrow marks the nature-lowered stat.
- "Moves & More": each Pokémon's Ability, held Item, and four moves.

Read every Pokémon and merge the two tabs by Pokémon name. Respond with ONLY a JSON object, no prose:
{"team":[{"species":"Name","ability":"Ability","item":"Item","nature":"Nature","moves":["m1","m2","m3","m4"],"sp":{"hp":0,"atk":0,"def":0,"spa":0,"spd":0,"spe":0}}]}

Rules:
- "sp" is the INVESTED Stat Points (the smaller number per stat), NOT the final stat. If a stat shows no second number, use 0.
- "nature" is the Pokémon's nature name: the standard nature whose raised stat matches the up arrow and lowered stat matches the down arrow. If there are no arrows, use "Hardy".
- Use official English names, Pokémon Showdown style, including formes and megas (e.g. "Urshifu-Rapid-Strike", "Landorus-Therian").
- Include every Pokémon you can see, in order. Omit a field you genuinely can't read.`;

interface RawSet {
  species?: string;
  ability?: string;
  item?: string;
  nature?: string;
  moves?: string[];
  sp?: Partial<Record<keyof StatTable, number>>;
}

const NATURE_BY_ID = new Map(
  (Object.keys(NATURES) as NatureName[]).map((n) => [n.toLowerCase(), n]),
);

function validNature(name: string | undefined): NatureName {
  return (name && NATURE_BY_ID.get(name.trim().toLowerCase())) || 'Hardy';
}

/** Map one raw entry from Claude to a ChampionsSet, or null if the species is unknown. */
export function toChampionsSet(raw: RawSet): ChampionsSet | null {
  const species = resolveSpeciesName((raw.species ?? '').trim());
  if (!species || !getSpeciesBaseStats(species)) return null;

  const statPoints = emptySpread();
  for (const key of Object.keys(statPoints) as (keyof StatTable)[]) {
    let v = raw.sp?.[key] ?? 0;
    if (!Number.isFinite(v)) v = 0;
    if (v > 32) v = Math.round(v / 8); // safety: if a paste gave EVs, fold to SP
    statPoints[key] = Math.max(0, Math.min(32, Math.round(v)));
  }

  const moves = (raw.moves ?? []).map((m) => (m ?? '').trim()).filter(Boolean).slice(0, 4);
  while (moves.length < 4) moves.push('');

  return {
    species,
    level: 50,
    nature: validNature(raw.nature),
    item: raw.item?.trim() || undefined,
    ability: raw.ability?.trim() || getDefaultAbility(species),
    moves,
    statPoints,
  };
}

/** Pull the first {...} JSON object out of a model response (handles code fences/prose). */
function extractJsonObject(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('No JSON found in the model response.');
  return JSON.parse(text.slice(start, end + 1));
}

function blobToImageBlock(blob: Blob): Promise<{ type: 'image'; source: { type: 'base64'; media_type: string; data: string } }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read a screenshot.'));
    reader.onload = () => {
      const result = String(reader.result);
      resolve({
        type: 'image',
        source: { type: 'base64', media_type: blob.type || 'image/png', data: result.slice(result.indexOf(',') + 1) },
      });
    };
    reader.readAsDataURL(blob);
  });
}

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
}

/** Read 1–2 team-report screenshots into full Champions sets via Claude vision. */
export async function recognizeTeamReport(images: Blob[], apiKey: string): Promise<ChampionsSet[]> {
  if (!apiKey) throw new Error('Add your Anthropic API key to read a team report.');
  if (!images.length) throw new Error('Add at least one screenshot.');

  const imageBlocks = await Promise.all(images.map(blobToImageBlock));

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      messages: [{ role: 'user', content: [...imageBlocks, { type: 'text', text: PROMPT }] }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Claude API error ${res.status}. ${detail.slice(0, 200)}`);
  }

  const json = (await res.json()) as AnthropicResponse;
  const text = json.content?.find((c) => c.type === 'text')?.text ?? '';
  const parsed = extractJsonObject(text) as { team?: RawSet[] };
  const sets = (parsed.team ?? []).map(toChampionsSet).filter((s): s is ChampionsSet => s !== null);
  if (!sets.length) throw new Error('No Pokémon could be read from the screenshot(s).');
  return sets.slice(0, 6);
}
