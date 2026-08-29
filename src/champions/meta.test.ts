import { describe, expect, it } from 'vitest';
import { moveInfo } from './meta';

describe('moveInfo', () => {
  it('returns metadata only for complete move names', () => {
    expect(moveInfo('C')).toBeUndefined();
    expect(moveInfo('Close')).toBeUndefined();
    expect(moveInfo('Close Combat')).toEqual({
      type: 'Fighting',
      category: 'Physical',
      pp: 5,
      basePower: 120,
    });
  });
});
