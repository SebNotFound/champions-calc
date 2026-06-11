/**
 * Parsing helpers for recognizer responses. Kept separate (and pure) so the
 * fiddly "pull JSON out of a model reply" logic is unit-tested.
 */

export interface RawTeams {
  player: string[];
  enemy: string[];
}

/**
 * Extract `{ player: [...], enemy: [...] }` from a model reply, tolerating
 * markdown code fences or surrounding prose by taking the outermost JSON object.
 */
export function extractTeams(text: string): RawTeams {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new Error('No JSON object found in the response.');
  }
  const obj = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  const list = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [];
  return { player: list(obj.player), enemy: list(obj.enemy) };
}
