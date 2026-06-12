import { resolveSpeciesName } from '../champions';
import type { Side } from '../champions';
import { extractTeams } from './parse';
import type { DetectedPokemon, RecognitionResult, TeamPreviewRecognizer } from './types';

/**
 * High-accuracy Team Preview recognizer using the Claude vision API — the
 * "more precise" option.
 *
 * It sends the screenshot/photo plus a structured prompt asking Claude to read
 * the Team Preview and return JSON of the two teams, then snaps the names to
 * known species. Runs straight from the browser with the user's own Anthropic
 * API key (so it still works on static hosting), via Anthropic's
 * direct-browser-access header. Handles both clean screenshots and phone photos.
 */
const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6'; // strong vision at a reasonable cost

const PROMPT = `This image is a Pokémon "Team Preview" screen (the screen where you see both full teams before choosing which to bring).

Identify every Pokémon on each side. The player's own team is shown on the BLUE side/background; the opponent's team is on the RED side/background.

Respond with ONLY a JSON object, no prose:
{"player": ["Species", ...], "enemy": ["Species", ...]}

Use official English names in Pokémon Showdown style, including formes and megas exactly, e.g. "Landorus-Therian", "Urshifu-Rapid-Strike", "Flutter Mane", "Charizard-Mega-Y". List up to 6 per side, in the order shown left-to-right, top-to-bottom. If a sprite is ambiguous, give your single best guess.`;

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
}

/** Read a Blob into base64 (no data: prefix) plus its media type. */
function blobToBase64(blob: Blob): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the image.'));
    reader.onload = () => {
      const result = String(reader.result);
      const base64 = result.slice(result.indexOf(',') + 1);
      resolve({ base64, mediaType: blob.type || 'image/png' });
    };
    reader.readAsDataURL(blob);
  });
}

export class ClaudeRecognizer implements TeamPreviewRecognizer {
  readonly id = 'claude' as const;
  readonly label = 'Claude vision (more precise)';
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  // Claude reads the whole Team Preview, so it returns both sides regardless of
  // `side`; the dialog uses whichever side it asked for.
  async recognize(image: Blob, _side: Side): Promise<RecognitionResult> {
    if (!this.apiKey) throw new Error('Add your Anthropic API key to use the precise (Claude) engine.');

    const { base64, mediaType } = await blobToBase64(image);

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text', text: PROMPT },
          ],
        }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Claude API error ${res.status}. ${detail.slice(0, 200)}`);
    }

    const json = (await res.json()) as AnthropicResponse;
    const text = json.content?.find((c) => c.type === 'text')?.text ?? '';
    const teams = extractTeams(text);

    const toDetected = (names: string[], side: DetectedPokemon['side']): DetectedPokemon[] =>
      names.slice(0, 6).map((n) => ({ side, species: resolveSpeciesName(n), confidence: 0.9 }));

    return {
      engine: 'claude',
      player: toDetected(teams.player, 'player'),
      enemy: toDetected(teams.enemy, 'enemy'),
    };
  }
}
