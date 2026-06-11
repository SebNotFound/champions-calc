import { describe, it, expect } from 'vitest';
import { extractTeams } from './parse';

describe('extractTeams', () => {
  it('parses a clean JSON object', () => {
    const r = extractTeams('{"player":["Garchomp"],"enemy":["Incineroar","Amoonguss"]}');
    expect(r.player).toEqual(['Garchomp']);
    expect(r.enemy).toEqual(['Incineroar', 'Amoonguss']);
  });

  it('tolerates markdown fences and surrounding prose', () => {
    const text = 'Here you go:\n```json\n{"player": ["Flutter Mane"], "enemy": ["Landorus-Therian"]}\n```\nHope that helps!';
    const r = extractTeams(text);
    expect(r.player).toEqual(['Flutter Mane']);
    expect(r.enemy).toEqual(['Landorus-Therian']);
  });

  it('drops empty/non-string entries', () => {
    const r = extractTeams('{"player":["Garchomp","",null,5],"enemy":[]}');
    expect(r.player).toEqual(['Garchomp']);
    expect(r.enemy).toEqual([]);
  });

  it('throws when there is no JSON', () => {
    expect(() => extractTeams('sorry, I cannot tell')).toThrow();
  });
});
