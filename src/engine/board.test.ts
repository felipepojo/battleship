import { describe, expect, it } from 'vitest';
import {
  canPlaceShip,
  createBoard,
  fallbackFleet,
  isFleetComplete,
  placeShip,
  randomizeFleet,
  validatePlacement,
} from './board';
import { createRng } from './rng';
import { deepFreeze, occupiedKeys, place } from './testUtils';
import { BOARD_SIZE, FLEET, SHIP_SIZES, type Board, type Orientation } from './types';

const TOTAL_FLEET_CELLS = FLEET.reduce((n, t) => n + SHIP_SIZES[t], 0);

function expectValidFleet(board: Board) {
  expect(board.size).toBe(BOARD_SIZE);
  expect(isFleetComplete(board)).toBe(true);
  const keys = occupiedKeys(board);
  expect(keys).toHaveLength(TOTAL_FLEET_CELLS);
  for (const ship of board.ships) {
    expect(ship.cells).toHaveLength(SHIP_SIZES[ship.type]);
    expect(ship.hits.every((h) => !h)).toBe(true);
    for (const { row, col } of ship.cells) {
      expect(row).toBeGreaterThanOrEqual(0);
      expect(col).toBeGreaterThanOrEqual(0);
      expect(row).toBeLessThan(BOARD_SIZE);
      expect(col).toBeLessThan(BOARD_SIZE);
      expect(board.cells[row]![col]!.shipType).toBe(ship.type);
    }
  }
}

describe('createBoard', () => {
  it('creates an empty 10x10 board by default', () => {
    const board = createBoard();
    expect(board.size).toBe(10);
    expect(board.cells).toHaveLength(10);
    expect(board.cells.every((row) => row.length === 10)).toBe(true);
    expect(board.cells.flat().every((c) => c.shipType === null && !c.shot)).toBe(true);
    expect(board.ships).toEqual([]);
  });

  it.each([0, -3, 2.5])('rejects invalid size %s', (size) => {
    expect(() => createBoard(size)).toThrow(RangeError);
  });
});

describe('placement validation', () => {
  const orientations: Orientation[] = ['horizontal', 'vertical'];

  it.each(orientations)('places a ship %s and marks its cells', (orientation) => {
    const result = placeShip(createBoard(), 'cruiser', { row: 2, col: 3 }, orientation);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const expected =
      orientation === 'horizontal'
        ? [
            { row: 2, col: 3 },
            { row: 2, col: 4 },
            { row: 2, col: 5 },
          ]
        : [
            { row: 2, col: 3 },
            { row: 3, col: 3 },
            { row: 4, col: 3 },
          ];
    expect(result.board.ships).toHaveLength(1);
    expect(result.board.ships[0]!.cells).toEqual(expected);
    expect(occupiedKeys(result.board).sort()).toEqual(
      expected.map((c) => `${c.row},${c.col}`).sort(),
    );
  });

  it('allows a ship flush against the far edge (horizontal)', () => {
    expect(canPlaceShip(createBoard(), 'carrier', { row: 9, col: 5 }, 'horizontal')).toBe(true);
  });

  it('allows a ship flush against the far edge (vertical)', () => {
    expect(canPlaceShip(createBoard(), 'carrier', { row: 5, col: 9 }, 'vertical')).toBe(true);
  });

  it('allows ships in all four corners', () => {
    let board = createBoard();
    board = place(board, 'destroyer', { row: 0, col: 0 }, 'horizontal');
    board = place(board, 'cruiser', { row: 0, col: 9 }, 'vertical');
    board = place(board, 'submarine', { row: 9, col: 0 }, 'horizontal');
    board = place(board, 'battleship', { row: 6, col: 9 }, 'vertical');
    expect(board.ships).toHaveLength(4);
  });

  it('rejects a ship overflowing the right edge by one cell', () => {
    expect(validatePlacement(createBoard(), 'carrier', { row: 0, col: 6 }, 'horizontal')).toBe(
      'out-of-bounds',
    );
  });

  it('rejects a ship overflowing the bottom edge by one cell', () => {
    expect(validatePlacement(createBoard(), 'carrier', { row: 6, col: 0 }, 'vertical')).toBe(
      'out-of-bounds',
    );
  });

  it.each([
    { row: -1, col: 0 },
    { row: 0, col: -1 },
    { row: 10, col: 0 },
    { row: 0, col: 10 },
    { row: 0.5, col: 0 },
    { row: Number.NaN, col: 0 },
  ])('rejects an origin outside the grid %o', (origin) => {
    expect(validatePlacement(createBoard(), 'destroyer', origin, 'horizontal')).toBe(
      'out-of-bounds',
    );
  });

  it('rejects an overlap where ships cross', () => {
    const board = place(createBoard(), 'carrier', { row: 4, col: 2 }, 'horizontal');
    expect(validatePlacement(board, 'battleship', { row: 2, col: 4 }, 'vertical')).toBe('overlap');
  });

  it('rejects an overlap sharing only a single end cell', () => {
    const board = place(createBoard(), 'destroyer', { row: 0, col: 0 }, 'horizontal');
    expect(validatePlacement(board, 'cruiser', { row: 0, col: 1 }, 'vertical')).toBe('overlap');
  });

  it('allows ships that touch but do not overlap', () => {
    const board = place(createBoard(), 'destroyer', { row: 0, col: 0 }, 'horizontal');
    expect(canPlaceShip(board, 'cruiser', { row: 0, col: 2 }, 'horizontal')).toBe(true);
    expect(canPlaceShip(board, 'cruiser', { row: 1, col: 0 }, 'horizontal')).toBe(true);
  });

  it('rejects placing the same ship type twice', () => {
    const board = place(createBoard(), 'destroyer', { row: 0, col: 0 });
    expect(validatePlacement(board, 'destroyer', { row: 5, col: 5 }, 'horizontal')).toBe(
      'already-placed',
    );
  });

  it('returns an error and the original board reference when placement fails', () => {
    const board = createBoard();
    const result = placeShip(board, 'carrier', { row: 0, col: 8 }, 'horizontal');
    expect(result).toEqual({ ok: false, error: 'out-of-bounds', board });
    expect(result.board).toBe(board);
  });

  it('does not mutate the input board', () => {
    const board = deepFreeze(place(createBoard(), 'destroyer', { row: 0, col: 0 }));
    const snapshot = structuredClone(board);
    const result = placeShip(board, 'carrier', { row: 5, col: 0 }, 'vertical');
    expect(result.ok).toBe(true);
    expect(board).toEqual(snapshot);
    expect(result.board).not.toBe(board);
  });

  it('copies the origin so later caller mutations cannot affect the ship', () => {
    const origin = { row: 1, col: 1 };
    const board = place(createBoard(), 'destroyer', origin);
    origin.row = 7;
    expect(board.ships[0]!.origin).toEqual({ row: 1, col: 1 });
  });
});

describe('isFleetComplete', () => {
  it('is false for an empty board', () => {
    expect(isFleetComplete(createBoard())).toBe(false);
  });

  it('is false with a partial fleet', () => {
    let board = createBoard();
    FLEET.slice(0, 4).forEach((type, i) => (board = place(board, type, { row: i * 2, col: 0 })));
    expect(isFleetComplete(board)).toBe(false);
  });

  it('is true once every ship is placed', () => {
    let board = createBoard();
    FLEET.forEach((type, i) => (board = place(board, type, { row: i * 2, col: 0 })));
    expect(isFleetComplete(board)).toBe(true);
  });

  it('supports a custom fleet', () => {
    const board = place(createBoard(), 'destroyer', { row: 0, col: 0 });
    expect(isFleetComplete(board, ['destroyer'])).toBe(true);
    expect(isFleetComplete(board, ['cruiser'])).toBe(false);
  });
});

describe('randomizeFleet', () => {
  it('produces a valid, complete fleet for 1000 seeds', () => {
    for (let seed = 0; seed < 1000; seed++) {
      expectValidFleet(randomizeFleet(createRng(seed)));
    }
  });

  it('is deterministic for a given seed', () => {
    expect(randomizeFleet(createRng(99))).toEqual(randomizeFleet(createRng(99)));
  });

  it('varies across seeds', () => {
    const layouts = new Set(
      Array.from({ length: 20 }, (_, seed) =>
        JSON.stringify(randomizeFleet(createRng(seed)).ships),
      ),
    );
    expect(layouts.size).toBeGreaterThan(1);
  });

  it('stays valid with a degenerate rng that always returns the same value', () => {
    expectValidFleet(randomizeFleet(() => 0));
    expectValidFleet(randomizeFleet(() => 0.9999999999999999));
  });

  it('works with Math.random by default', () => {
    expectValidFleet(randomizeFleet());
  });

  it('falls back to the deterministic layout when attempts are exhausted', () => {
    const board = randomizeFleet(createRng(1), { maxAttempts: 0 });
    expect(board).toEqual(fallbackFleet());
    expectValidFleet(board);
  });

  it('terminates with an explicit error when the fleet cannot fit', () => {
    expect(() => randomizeFleet(createRng(1), { size: 4 })).toThrow(/cannot fit/);
  });

  it('rejects a fleet with duplicate ship types', () => {
    expect(() => randomizeFleet(createRng(1), { fleet: ['destroyer', 'destroyer'] })).toThrow(
      /duplicate/,
    );
  });

  it('places a custom fleet on a smaller board', () => {
    const board = randomizeFleet(createRng(3), { size: 5, fleet: ['carrier', 'destroyer'] });
    expect(board.size).toBe(5);
    expect(isFleetComplete(board, ['carrier', 'destroyer'])).toBe(true);
  });
});
