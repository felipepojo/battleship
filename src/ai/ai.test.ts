import { describe, expect, it } from 'vitest';
import {
  BOARD_SIZE,
  createRng,
  type AIDifficulty,
  type Coord,
  type ShotRecord,
  type ShotResult,
} from '../engine';
import { createAI } from '.';
import { analyzeShots } from './grid';
import { densityMap } from './hard';
import { simulateGame } from './simulate';

const LEVELS: readonly AIDifficulty[] = ['easy', 'medium', 'hard'];
const ALL_SIZES = [5, 4, 3, 3, 2];

const shot = (row: number, col: number, result: ShotResult = 'miss'): ShotRecord => ({
  coord: { row, col },
  result,
});
const k = ({ row, col }: Coord) => `${row},${col}`;

/** Every cell except `keep`, as misses. */
function allMissesExcept(keep: readonly Coord[]): ShotRecord[] {
  const keepKeys = new Set(keep.map(k));
  const out: ShotRecord[] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (!keepKeys.has(`${row},${col}`)) out.push(shot(row, col));
    }
  }
  return out;
}

describe('createAI', () => {
  it('throws on an unknown difficulty', () => {
    expect(() => createAI('impossible' as AIDifficulty)).toThrow(/Unknown AI difficulty/);
  });

  it.each(LEVELS)('%s works with the default Math.random rng', (level) => {
    const move = createAI(level).nextMove([], ALL_SIZES);
    expect(move.row).toBeGreaterThanOrEqual(0);
    expect(move.row).toBeLessThan(BOARD_SIZE);
    expect(move.col).toBeGreaterThanOrEqual(0);
    expect(move.col).toBeLessThan(BOARD_SIZE);
  });
});

describe.each(LEVELS)('%s AI safety', (level) => {
  it('is deterministic for a given seed', () => {
    for (const seed of [1, 42, 1234]) {
      expect(simulateGame(level, seed)).toEqual(simulateGame(level, seed));
    }
    const sequence = (seed: number) => {
      const ai = createAI(level, createRng(seed));
      const log: ShotRecord[] = [];
      for (let i = 0; i < 20; i++) {
        const move = ai.nextMove(log, ALL_SIZES);
        log.push(shot(move.row, move.col));
      }
      return log;
    };
    expect(sequence(7)).toEqual(sequence(7));
  });

  it('returns the only unfired cell, for every corner and edge cell', () => {
    const targets: Coord[] = [
      { row: 0, col: 0 },
      { row: 0, col: 9 },
      { row: 9, col: 0 },
      { row: 9, col: 9 },
      { row: 0, col: 5 },
      { row: 9, col: 4 },
      { row: 3, col: 0 },
      { row: 6, col: 9 },
    ];
    for (const target of targets) {
      const ai = createAI(level, createRng(1));
      expect(ai.nextMove(allMissesExcept([target]), [2])).toEqual(target);
    }
  });

  it('stays in bounds when targeting hits in corners', () => {
    for (const [row, col] of [
      [0, 0],
      [0, 9],
      [9, 0],
      [9, 9],
    ] as const) {
      for (let seed = 0; seed < 20; seed++) {
        const ai = createAI(level, createRng(seed));
        const move = ai.nextMove([shot(row, col, 'hit')], ALL_SIZES);
        expect(move.row).toBeGreaterThanOrEqual(0);
        expect(move.row).toBeLessThan(BOARD_SIZE);
        expect(move.col).toBeGreaterThanOrEqual(0);
        expect(move.col).toBeLessThan(BOARD_SIZE);
        expect(k(move)).not.toBe(`${row},${col}`);
      }
    }
  });

  it('never repeats a shot even with inconsistent or malformed input', () => {
    const log: ShotRecord[] = [
      shot(-1, 3, 'hit'),
      shot(10, 10, 'hit'),
      shot(4.5, 2, 'hit'),
      shot(5, 5, 'sunk'),
      shot(5, 5, 'miss'),
      shot(0, 0, 'hit'),
      shot(0, 1, 'sunk'),
    ];
    const fired = new Set(log.map((s) => k(s.coord)));
    const ai = createAI(level, createRng(3));
    for (let i = 0; i < 90; i++) {
      const move = ai.nextMove(log, [5, 4, 3, 99, -1]);
      expect(fired.has(k(move))).toBe(false);
      fired.add(k(move));
      log.push(shot(move.row, move.col, i % 7 === 0 ? 'hit' : 'miss'));
    }
  });

  it('avoids cells reported only through notifyResult', () => {
    const ai = createAI(level, createRng(9));
    const fired = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const move = ai.nextMove([], ALL_SIZES);
      expect(fired.has(k(move))).toBe(false);
      fired.add(k(move));
      ai.notifyResult(move, 'miss');
    }
    expect(() => ai.nextMove([], ALL_SIZES)).toThrow(/No unfired cells/);
  });

  it('keeps notified shots that share a numeric key with invalid log entries', () => {
    const ai = createAI(level, createRng(5));
    ai.notifyResult({ row: 0, col: 0 }, 'miss');
    const log = [
      shot(-1, 10),
      ...allMissesExcept([
        { row: 0, col: 0 },
        { row: 9, col: 9 },
      ]),
    ];
    expect(ai.nextMove(log, [2])).toEqual({ row: 9, col: 9 });
  });

  it('throws when every cell has been fired', () => {
    expect(() => createAI(level, createRng(1)).nextMove(allMissesExcept([]), [2])).toThrow(
      /No unfired cells/,
    );
  });
});

describe('medium AI', () => {
  it('hunts on a single checkerboard parity', () => {
    for (let seed = 0; seed < 10; seed++) {
      const ai = createAI('medium', createRng(seed));
      const log: ShotRecord[] = [];
      for (let i = 0; i < 50; i++) {
        const move = ai.nextMove(log, ALL_SIZES);
        log.push(shot(move.row, move.col, 'miss'));
      }
      const parities = new Set(log.map(({ coord }) => (coord.row + coord.col) % 2));
      expect(parities.size).toBe(1);
    }
  });

  it('targets in-bounds unfired neighbours after a hit', () => {
    for (let seed = 0; seed < 20; seed++) {
      const ai = createAI('medium', createRng(seed));
      const move = ai.nextMove([shot(0, 1), shot(0, 0, 'hit')], ALL_SIZES);
      expect(k(move)).toBe('1,0');
    }
  });

  it('prioritizes the axis once two hits line up', () => {
    for (let seed = 0; seed < 20; seed++) {
      const ai = createAI('medium', createRng(seed));
      const move = ai.nextMove([shot(4, 4, 'hit'), shot(4, 5, 'hit')], ALL_SIZES);
      expect(['4,3', '4,6']).toContain(k(move));
    }
  });

  it('extends the other end when one end of the line is blocked', () => {
    const ai = createAI('medium', createRng(1));
    const move = ai.nextMove([shot(4, 6), shot(4, 4, 'hit'), shot(4, 5, 'hit')], ALL_SIZES);
    expect(k(move)).toBe('4,3');
  });

  it('drops a sunk ship from the target queue and returns to hunting', () => {
    for (let seed = 0; seed < 20; seed++) {
      const ai = createAI('medium', createRng(seed));
      const log = [shot(4, 4, 'hit'), shot(4, 5, 'sunk')];
      ai.nextMove(log.slice(0, 1), ALL_SIZES);
      const move = ai.nextMove(log, [5, 4, 3, 3]);
      const neighbours = ['3,4', '5,4', '4,3', '3,5', '5,5', '4,6'];
      // A hunt shot may land on a neighbour by chance, but must follow the hunt parity.
      if (neighbours.includes(k(move))) {
        const hunt = createAI('medium', createRng(seed)).nextMove([], ALL_SIZES);
        expect((move.row + move.col) % 2).toBe((hunt.row + hunt.col) % 2);
      }
    }
    const analysis = analyzeShots([shot(4, 4, 'hit'), shot(4, 5, 'sunk')], [5, 4, 3, 3]);
    expect(analysis.openHits).toEqual([]);
  });

  it('keeps targeting a second ship that was hit while sinking the first', () => {
    const ai = createAI('medium', createRng(2));
    const log = [shot(2, 2, 'hit'), shot(3, 2, 'hit'), shot(2, 3, 'hit'), shot(2, 4, 'sunk')];
    const move = ai.nextMove(log, [5, 4, 3, 2]);
    // The cruiser is attributed to row 2, leaving (3,2) as an open hit to work from.
    expect(['3,1', '3,3', '4,2']).toContain(k(move));
  });
});

describe('sunk ship attribution', () => {
  it('uses the size that left remainingShipSizes', () => {
    const analysis = analyzeShots(
      [shot(0, 0, 'hit'), shot(0, 1, 'hit'), shot(0, 2, 'sunk')],
      [5, 4, 3, 2],
    );
    expect(analysis.grid[0]!.slice(0, 3)).toEqual(['sunk', 'sunk', 'sunk']);
    expect(analysis.openHits).toEqual([]);
  });

  it('leaves a hit open when a sunk ship could lie on either axis', () => {
    // Cruiser hit at (4,4); destroyer at (3,5)-(4,5) sunk at (4,5).
    const analysis = analyzeShots(
      [shot(4, 4, 'hit'), shot(3, 5, 'hit'), shot(4, 5, 'sunk')],
      [5, 4, 3, 3],
    );
    expect(analysis.grid[4]![5]).toBe('sunk');
    expect(analysis.openHits).toEqual([
      { row: 4, col: 4 },
      { row: 3, col: 5 },
    ]);
  });

  it('leaves extra hits on the line open when the sunk ship is shorter', () => {
    const analysis = analyzeShots(
      [shot(0, 0, 'hit'), shot(0, 1, 'hit'), shot(0, 2, 'sunk')],
      [5, 4, 3, 3],
    );
    expect(analysis.grid[0]!.slice(0, 3)).toEqual(['hit', 'sunk', 'sunk']);
    expect(analysis.openHits).toEqual([{ row: 0, col: 0 }]);
  });
});

describe('hard AI', () => {
  it('weights the center above corners on an empty board', () => {
    const density = densityMap(analyzeShots([], ALL_SIZES), ALL_SIZES);
    expect(density[4]![4]!).toBeGreaterThan(density[0]![0]!);
    expect(density[0]![0]!).toBeGreaterThan(0);
  });

  it('gives misses, hits and sunk cells zero density', () => {
    const log = [shot(0, 0), shot(5, 5, 'hit'), shot(9, 8, 'hit'), shot(9, 9, 'sunk')];
    const density = densityMap(analyzeShots(log, [5, 4, 3, 3]), [5, 4, 3, 3]);
    expect(density[0]![0]).toBe(0);
    expect(density[5]![5]).toBe(0);
    expect(density[9]![9]).toBe(0);
    expect(density[9]![8]).toBe(0);
  });

  it('fires next to an unresolved hit', () => {
    for (let seed = 0; seed < 20; seed++) {
      const move = createAI('hard', createRng(seed)).nextMove([shot(5, 5, 'hit')], ALL_SIZES);
      expect(['4,5', '6,5', '5,4', '5,6']).toContain(k(move));
    }
  });

  it('follows the axis of two lined-up hits', () => {
    for (let seed = 0; seed < 20; seed++) {
      const move = createAI('hard', createRng(seed)).nextMove(
        [shot(5, 5, 'hit'), shot(5, 6, 'hit')],
        ALL_SIZES,
      );
      expect(['5,4', '5,7']).toContain(k(move));
    }
  });

  it('ignores placements that cross misses', () => {
    // Only column 0 and the isolated cell (5,5) are unfired; a 3-ship cannot fit at (5,5).
    const keep: Coord[] = [{ row: 5, col: 5 }];
    for (let row = 0; row < BOARD_SIZE; row++) keep.push({ row, col: 0 });
    const move = createAI('hard', createRng(4)).nextMove(allMissesExcept(keep), [3]);
    expect(move.col).toBe(0);
  });

  it('breaks density ties using the rng', () => {
    const moves = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      moves.add(k(createAI('hard', createRng(seed)).nextMove([], ALL_SIZES)));
    }
    expect(moves.size).toBeGreaterThan(1);
  });
});
