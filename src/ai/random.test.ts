import { describe, expect, it } from 'vitest';
import { createRng, type ShotLog } from '../engine';
import { createAI } from './index';
import { createRandomAI, unfiredCells } from './random';

describe('unfiredCells', () => {
  it('returns all 100 cells when nothing has been fired', () => {
    expect(unfiredCells([])).toHaveLength(100);
  });

  it('excludes fired cells', () => {
    const shots: ShotLog = [
      { coord: { row: 0, col: 0 }, result: 'miss' },
      { coord: { row: 9, col: 9 }, result: 'hit' },
    ];
    const cells = unfiredCells(shots);
    expect(cells).toHaveLength(98);
    expect(cells).not.toContainEqual({ row: 0, col: 0 });
    expect(cells).not.toContainEqual({ row: 9, col: 9 });
  });
});

describe('createRandomAI', () => {
  it('never repeats a cell across a full game', () => {
    const ai = createRandomAI(createRng(1));
    const shots: { coord: { row: number; col: number }; result: 'miss' }[] = [];
    for (let i = 0; i < 100; i++) {
      const coord = ai.nextMove(shots, [5]);
      shots.push({ coord, result: 'miss' });
      ai.notifyResult(coord, 'miss');
    }
    expect(new Set(shots.map((s) => `${s.coord.row},${s.coord.col}`)).size).toBe(100);
  });

  it('throws when every cell has been fired', () => {
    const shots: ShotLog = unfiredCells([]).map((coord) => ({ coord, result: 'miss' }));
    expect(() => createRandomAI(createRng(1)).nextMove(shots, [])).toThrow(/No unfired/);
  });

  it('is deterministic with a seeded rng', () => {
    const a = createRandomAI(createRng(5)).nextMove([], [5]);
    const b = createRandomAI(createRng(5)).nextMove([], [5]);
    expect(a).toEqual(b);
  });
});

describe('createAI', () => {
  it.each(['easy', 'medium', 'hard'] as const)('returns a working AI for %s', (difficulty) => {
    const coord = createAI(difficulty, createRng(1)).nextMove([], [5, 4, 3, 3, 2]);
    expect(coord.row).toBeGreaterThanOrEqual(0);
    expect(coord.row).toBeLessThan(10);
    expect(coord.col).toBeGreaterThanOrEqual(0);
    expect(coord.col).toBeLessThan(10);
  });
});
