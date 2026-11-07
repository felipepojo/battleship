import { describe, expect, it } from 'vitest';
import { describeShot } from './labels';

describe('describeShot', () => {
  it('uses the past tense "sank" for sunk ships', () => {
    expect(describeShot('player', { row: 1, col: 4 }, 'sunk', 'destroyer')).toBe(
      "You fired at E2 and sank the enemy's Destroyer!",
    );
    expect(describeShot('ai', { row: 0, col: 0 }, 'sunk', 'carrier')).toBe(
      'Enemy fired at A1 and sank your Carrier!',
    );
  });

  it('describes hits and misses', () => {
    expect(describeShot('player', { row: 9, col: 9 }, 'hit')).toBe('You fired at J10: hit!');
    expect(describeShot('ai', { row: 2, col: 1 }, 'miss')).toBe('Enemy fired at B3: miss.');
  });
});
