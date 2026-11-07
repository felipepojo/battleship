import { placeShip } from './board';
import type { Board, Coord, Orientation, ShipType } from './types';

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

export function place(
  board: Board,
  type: ShipType,
  origin: Coord,
  orientation: Orientation = 'horizontal',
): Board {
  const result = placeShip(board, type, origin, orientation);
  if (!result.ok) throw new Error(`Test setup: cannot place ${type}: ${result.error}`);
  return result.board;
}

/** Collects every occupied coordinate on the board, as "row,col" keys. */
export function occupiedKeys(board: Board): string[] {
  const out: string[] = [];
  board.cells.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (cell.shipType) out.push(`${r},${c}`);
    }),
  );
  return out;
}
