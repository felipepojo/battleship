import { BOARD_SIZE, type AIPlayer, type Coord, type Rng } from '../engine';
import { AXES, step, type Analysis } from './grid';
import { createPlayer, pick } from './player';

/** Weight multiplier per open hit a placement covers. */
export const HIT_WEIGHT = 50;

/**
 * For each unfired cell, the weighted count of placements of the remaining ships
 * that cover it. A placement may not cross misses or sunk cells; each open hit it
 * covers multiplies its weight by `HIT_WEIGHT`.
 */
export function densityMap(analysis: Analysis, remainingShipSizes: readonly number[]): number[][] {
  const density = Array.from({ length: BOARD_SIZE }, () => new Array<number>(BOARD_SIZE).fill(0));
  const { grid } = analysis;
  for (const size of remainingShipSizes) {
    for (const axis of AXES) {
      const [dr, dc] = step(axis);
      const maxRow = BOARD_SIZE - 1 - dr * (size - 1);
      const maxCol = BOARD_SIZE - 1 - dc * (size - 1);
      for (let row = 0; row <= maxRow; row++) {
        for (let col = 0; col <= maxCol; col++) {
          let hits = 0;
          let blocked = false;
          for (let i = 0; i < size && !blocked; i++) {
            const s = grid[row + i * dr]![col + i * dc];
            if (s === 'miss' || s === 'sunk') blocked = true;
            else if (s === 'hit') hits++;
          }
          if (blocked) continue;
          const weight = HIT_WEIGHT ** hits;
          for (let i = 0; i < size; i++) {
            const r = row + i * dr;
            const c = col + i * dc;
            if (grid[r]![c] === 'unknown') density[r]![c]! += weight;
          }
        }
      }
    }
  }
  return density;
}

/** Fire at the highest-density unfired cell, breaking ties at random. */
export function createHardAI(rng: Rng): AIPlayer {
  return createPlayer(rng, (analysis, remainingShipSizes) => {
    const density = densityMap(analysis, remainingShipSizes);
    let max = 0;
    let best: Coord[] = [];
    for (const c of analysis.unknown) {
      const d = density[c.row]![c.col]!;
      if (d > max) {
        max = d;
        best = [c];
      } else if (d === max && d > 0) {
        best.push(c);
      }
    }
    return pick(rng, best);
  });
}
