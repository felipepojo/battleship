import { randomInt, type Rng } from './rng';
import {
  BOARD_SIZE,
  FLEET,
  SHIP_SIZES,
  type Board,
  type Cell,
  type Coord,
  type Orientation,
  type PlacementError,
  type Ship,
  type ShipType,
} from './types';

export type PlaceResult =
  | { readonly ok: true; readonly board: Board }
  | { readonly ok: false; readonly error: PlacementError; readonly board: Board };

const EMPTY_CELL: Cell = { shipType: null, shot: false };
const ORIENTATIONS: readonly Orientation[] = ['horizontal', 'vertical'];

export const DEFAULT_MAX_FLEET_ATTEMPTS = 100;

export function createBoard(size: number = BOARD_SIZE): Board {
  if (!Number.isInteger(size) || size <= 0) {
    throw new RangeError(`Board size must be a positive integer, got ${size}`);
  }
  const row: readonly Cell[] = Array.from({ length: size }, () => EMPTY_CELL);
  return { size, cells: Array.from({ length: size }, () => row), ships: [] };
}

export function isInBounds(board: Board, coord: Coord): boolean {
  const { row, col } = coord;
  return (
    Number.isInteger(row) &&
    Number.isInteger(col) &&
    row >= 0 &&
    col >= 0 &&
    row < board.size &&
    col < board.size
  );
}

export function getCell(board: Board, coord: Coord): Cell | undefined {
  return isInBounds(board, coord) ? board.cells[coord.row]?.[coord.col] : undefined;
}

export function shipCells(origin: Coord, orientation: Orientation, size: number): Coord[] {
  return Array.from({ length: size }, (_, i) =>
    orientation === 'horizontal'
      ? { row: origin.row, col: origin.col + i }
      : { row: origin.row + i, col: origin.col },
  );
}

export function validatePlacement(
  board: Board,
  type: ShipType,
  origin: Coord,
  orientation: Orientation,
): PlacementError | null {
  if (board.ships.some((s) => s.type === type)) return 'already-placed';
  const cells = shipCells(origin, orientation, SHIP_SIZES[type]);
  if (!cells.every((c) => isInBounds(board, c))) return 'out-of-bounds';
  if (cells.some((c) => getCell(board, c)?.shipType != null)) return 'overlap';
  return null;
}

export function canPlaceShip(
  board: Board,
  type: ShipType,
  origin: Coord,
  orientation: Orientation,
): boolean {
  return validatePlacement(board, type, origin, orientation) === null;
}

export function placeShip(
  board: Board,
  type: ShipType,
  origin: Coord,
  orientation: Orientation,
): PlaceResult {
  const error = validatePlacement(board, type, origin, orientation);
  if (error) return { ok: false, error, board };

  const size = SHIP_SIZES[type];
  const cells = shipCells(origin, orientation, size);
  const ship: Ship = {
    type,
    size,
    origin: { row: origin.row, col: origin.col },
    orientation,
    cells,
    hits: Array.from({ length: size }, () => false),
  };
  const occupied = new Set(cells.map((c) => `${c.row},${c.col}`));
  const newCells = board.cells.map((row, r) =>
    row.some((_, c) => occupied.has(`${r},${c}`))
      ? row.map((cell, c) => (occupied.has(`${r},${c}`) ? { ...cell, shipType: type } : cell))
      : row,
  );
  return { ok: true, board: { ...board, cells: newCells, ships: [...board.ships, ship] } };
}

/** True when every ship in `fleet` is on the board exactly once and nothing else is. */
export function isFleetComplete(board: Board, fleet: readonly ShipType[] = FLEET): boolean {
  if (board.ships.length !== fleet.length) return false;
  const placed = board.ships.map((s) => s.type).sort();
  const expected = [...fleet].sort();
  return placed.every((t, i) => t === expected[i]);
}

function validPlacements(board: Board, type: ShipType) {
  const out: { origin: Coord; orientation: Orientation }[] = [];
  for (let row = 0; row < board.size; row++) {
    for (let col = 0; col < board.size; col++) {
      for (const orientation of ORIENTATIONS) {
        if (canPlaceShip(board, type, { row, col }, orientation)) {
          out.push({ origin: { row, col }, orientation });
        }
      }
    }
  }
  return out;
}

function tryRandomLayout(rng: Rng, size: number, fleet: readonly ShipType[]): Board | null {
  let board = createBoard(size);
  for (const type of fleet) {
    const options = validPlacements(board, type);
    if (options.length === 0) return null;
    const { origin, orientation } = options[randomInt(rng, options.length)]!;
    const result = placeShip(board, type, origin, orientation);
    if (!result.ok) return null;
    board = result.board;
  }
  return board;
}

/** Deterministic first-fit layout: row-major scan, horizontal before vertical. */
export function fallbackFleet(
  size: number = BOARD_SIZE,
  fleet: readonly ShipType[] = FLEET,
): Board {
  let board = createBoard(size);
  for (const type of fleet) {
    const first = validPlacements(board, type)[0];
    if (!first) throw new Error(`Fleet cannot fit on a ${size}x${size} board`);
    const result = placeShip(board, type, first.origin, first.orientation);
    if (!result.ok) throw new Error(`Fleet cannot fit on a ${size}x${size} board`);
    board = result.board;
  }
  return board;
}

export interface RandomizeFleetOptions {
  readonly size?: number;
  readonly fleet?: readonly ShipType[];
  /** Random layouts to try before using `fallbackFleet`. */
  readonly maxAttempts?: number;
}

/**
 * Random valid layout. Each ship is placed uniformly among its currently valid
 * placements; if a ship has none, the layout restarts. After `maxAttempts`
 * restarts the deterministic `fallbackFleet` is returned, so this always terminates.
 */
export function randomizeFleet(rng: Rng = Math.random, options: RandomizeFleetOptions = {}): Board {
  const { size = BOARD_SIZE, fleet = FLEET, maxAttempts = DEFAULT_MAX_FLEET_ATTEMPTS } = options;
  if (new Set(fleet).size !== fleet.length) {
    throw new Error('Fleet must not contain duplicate ship types');
  }
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const board = tryRandomLayout(rng, size, fleet);
    if (board) return board;
  }
  return fallbackFleet(size, fleet);
}
