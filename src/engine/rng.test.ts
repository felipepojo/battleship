import { describe, expect, it } from 'vitest';
import { createRng, randomInt } from './rng';

describe('createRng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 20 }, a);
    const seqB = Array.from({ length: 20 }, b);
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = Array.from({ length: 5 }, createRng(1));
    const b = Array.from({ length: 5 }, createRng(2));
    expect(a).not.toEqual(b);
  });

  it('always returns values in [0, 1)', () => {
    for (const seed of [0, 1, -1, 2 ** 32 - 1, 123456789]) {
      const rng = createRng(seed);
      for (let i = 0; i < 1000; i++) {
        const v = rng();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    }
  });
});

describe('randomInt', () => {
  it('returns integers within [0, max)', () => {
    const rng = createRng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const v = randomInt(rng, 5);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(5);
      seen.add(v);
    }
    expect(seen.size).toBe(5);
  });

  it('clamps an rng that returns values at the upper edge', () => {
    expect(randomInt(() => 0.9999999999999999, 10)).toBe(9);
    expect(randomInt(() => 0, 10)).toBe(0);
  });

  it.each([0, -1, 1.5, Number.NaN])('rejects invalid max %s', (max) => {
    expect(() => randomInt(createRng(1), max)).toThrow(RangeError);
  });
});
