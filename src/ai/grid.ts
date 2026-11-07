import { BOARD_SIZE, FLEET, SHIP_SIZES, type Coord, type ShotLog } from '../engine';

export type CellState = 'unknown' | 'miss' | 'hit' | 'sunk';

export type Axis = 'horizontal' | 'vertical';

export const AXES: readonly Axis[] = ['horizontal', 'vertical'];

/** Up, right, down, left. */
export const ORTHOGONAL: readonly (readonly [number, number])[] = [
  [-1, 0],
  [0, 1],
  [1, 0],
  [0, -1],
];

export const FLEET_SIZES: readonly number[] = FLEET.map((type) => SHIP_SIZES[type]);

export function inBounds(row: number, col: number): boolean {
  return (
    Number.isInteger(row) &&
    Number.isInteger(col) &&
    row >= 0 &&
    col >= 0 &&
    row < BOARD_SIZE &&
    col < BOARD_SIZE
  );
}

export function step(axis: Axis): readonly [number, number] {
  return axis === 'horizontal' ? [0, 1] : [1, 0];
}

export const key = (row: number, col: number): number => row * BOARD_SIZE + col;

export interface Analysis {
  /** Indexed as `grid[row][col]`. */
  readonly grid: readonly (readonly CellState[])[];
  /** Hits not attributed to a sunk ship, in shot order. */
  readonly openHits: readonly Coord[];
  /** Unfired in-bounds cells, row-major. */
  readonly unknown: readonly Coord[];
}

export function stateAt(analysis: Analysis, row: number, col: number): CellState | undefined {
  return inBounds(row, col) ? analysis.grid[row]![col] : undefined;
}

/** Removes one occurrence of each element of `b` from `a`. */
export function multisetDiff(a: readonly number[], b: readonly number[]): number[] {
  const out = [...a];
  for (const x of b) {
    const i = out.indexOf(x);
    if (i >= 0) out.splice(i, 1);
  }
  return out;
}

function runLength(grid: CellState[][], s: Coord, axis: Axis): number {
  const [dr, dc] = step(axis);
  let len = 1;
  for (const sign of [1, -1]) {
    let r = s.row + sign * dr;
    let c = s.col + sign * dc;
    while (inBounds(r, c) && grid[r]![c] === 'hit') {
      len++;
      r += sign * dr;
      c += sign * dc;
    }
  }
  return len;
}

/**
 * Finds the cells of the ship sunk by the shot at `s`: a straight segment through
 * `s` made only of unresolved hits. Prefers a size whose segment exactly matches
 * the run of hits on that axis, then segments ending at `s` (the shot that sinks a
 * ship usually extends a line). Returns null if no candidate fits.
 */
function resolveSunk(
  grid: CellState[][],
  s: Coord,
  sizes: readonly number[],
): { size: number; cells: Coord[] } | null {
  let best: { size: number; cells: Coord[]; score: number } | null = null;
  for (const size of sizes) {
    for (const axis of AXES) {
      const [dr, dc] = step(axis);
      const run = runLength(grid, s, axis);
      for (let offset = 0; offset < size; offset++) {
        const cells: Coord[] = [];
        for (let i = 0; i < size; i++) {
          cells.push({ row: s.row + (i - offset) * dr, col: s.col + (i - offset) * dc });
        }
        if (!cells.every((c) => inBounds(c.row, c.col) && grid[c.row]![c.col] === 'hit')) continue;
        const score = (run === size ? 4 : 0) + (offset === 0 || offset === size - 1 ? 2 : 0);
        if (!best || score > best.score) best = { size, cells, score };
      }
    }
  }
  return best && { size: best.size, cells: best.cells };
}

/**
 * Replays the shot log into a grid of cell states. Out-of-bounds and repeated
 * entries are ignored. Each sunk shot's ship is attributed to a straight run of
 * hits, using `knownSunkSizes` (log index → ship size) when available and
 * otherwise the sizes missing from `remainingShipSizes`.
 */
export function analyzeShots(
  log: ShotLog,
  remainingShipSizes: readonly number[],
  knownSunkSizes: ReadonlyMap<number, number> = new Map(),
): Analysis {
  const grid: CellState[][] = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, (): CellState => 'unknown'),
  );
  let pending = multisetDiff(multisetDiff(FLEET_SIZES, remainingShipSizes), [
    ...knownSunkSizes.values(),
  ]);

  log.forEach(({ coord, result }, index) => {
    const { row, col } = coord;
    if (!inBounds(row, col) || grid[row]![col] !== 'unknown') return;
    if (result === 'miss') {
      grid[row]![col] = 'miss';
      return;
    }
    grid[row]![col] = 'hit';
    if (result !== 'sunk') return;

    const known = knownSunkSizes.get(index);
    const candidates =
      known !== undefined
        ? [known]
        : [...new Set(pending.length > 0 ? pending : FLEET_SIZES)].sort((a, b) => b - a);
    const ship = resolveSunk(grid, coord, candidates);
    if (!ship) {
      grid[row]![col] = 'sunk';
      return;
    }
    for (const c of ship.cells) grid[c.row]![c.col] = 'sunk';
    if (known === undefined) pending = multisetDiff(pending, [ship.size]);
  });

  const openHits: Coord[] = [];
  const seen = new Set<number>();
  for (const { coord } of log) {
    const { row, col } = coord;
    if (inBounds(row, col) && grid[row]![col] === 'hit' && !seen.has(key(row, col))) {
      seen.add(key(row, col));
      openHits.push({ row, col });
    }
  }
  const unknown: Coord[] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (grid[row]![col] === 'unknown') unknown.push({ row, col });
    }
  }
  return { grid, openHits, unknown };
}
