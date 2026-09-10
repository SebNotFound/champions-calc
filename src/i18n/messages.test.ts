import { describe, expect, it } from 'vitest';
import { getMessage } from './messages';
import { EN_MESSAGES } from './ui.en';
import { JA_MESSAGES } from './ui.ja';

describe('interface messages', () => {
  it('keeps the English and Japanese catalogs in sync', () => {
    expect(Object.keys(JA_MESSAGES).sort()).toEqual(Object.keys(EN_MESSAGES).sort());
  });

  it('returns Japanese text from the Japanese catalog', () => {
    expect(getMessage(JA_MESSAGES, 'header.reset')).toBe('リセット');
  });

  it('fills named parameters without changing the source catalog', () => {
    expect(getMessage(JA_MESSAGES, 'stats.pointsLeft', { left: 12, total: 66 }))
      .toBe('残り 12 / 66');
    expect(EN_MESSAGES['stats.pointsLeft']).toBe('{left} / {total} left');
  });

  it('falls back to English when a loaded catalog has no entry', () => {
    expect(getMessage({}, 'header.reset')).toBe('Reset');
  });
});
