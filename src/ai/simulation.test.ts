import { describe, expect, it } from 'vitest';
import type { AIDifficulty } from '../engine';
import { simulateGame } from './simulate';

const GAMES = 500;
const LEVELS: readonly AIDifficulty[] = ['easy', 'medium', 'hard'];
const TIMEOUT = 120_000;

const averages = new Map<AIDifficulty, number>();

/** Plays (once) and checks GAMES games for a level; returns average shots to win. */
function runLevel(level: AIDifficulty): number {
  const cached = averages.get(level);
  if (cached !== undefined) return cached;
  let total = 0;
  for (let seed = 1; seed <= GAMES; seed++) {
    const game = simulateGame(level, seed);
    expect(game.duplicates, `${level} seed ${seed}: duplicate shots`).toBe(0);
    expect(game.outOfBounds, `${level} seed ${seed}: out-of-bounds shots`).toBe(0);
    expect(game.finished, `${level} seed ${seed}: game did not end`).toBe(true);
    expect(game.shots).toBeLessThanOrEqual(100);
    total += game.shots;
  }
  const average = total / GAMES;
  averages.set(level, average);
  return average;
}

describe.each(LEVELS)('%s AI', (level) => {
  it(
    `plays ${GAMES} full games to the end with no duplicate or out-of-bounds shots`,
    () => {
      runLevel(level);
    },
    TIMEOUT,
  );
});

describe('difficulty ordering', () => {
  it(
    'needs fewer shots to win on average as difficulty increases (hard < medium < easy)',
    () => {
      const [easy, medium, hard] = LEVELS.map(runLevel) as [number, number, number];
      console.log(
        `Average shots to win over ${GAMES} games: ` +
          `easy=${easy.toFixed(2)}, medium=${medium.toFixed(2)}, hard=${hard.toFixed(2)}`,
      );
      expect(hard).toBeLessThan(medium);
      expect(medium).toBeLessThan(easy);
    },
    TIMEOUT,
  );
});
