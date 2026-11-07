import {
  BOARD_SIZE,
  createRng,
  fire,
  randomizeFleet,
  remainingShips,
  type AIDifficulty,
  type Coord,
  type ShotRecord,
} from '../engine';
import { createAI } from '.';

export interface GameReport {
  readonly shots: number;
  readonly duplicates: number;
  readonly outOfBounds: number;
  readonly finished: boolean;
}

const MAX_SHOTS = BOARD_SIZE * BOARD_SIZE;

const isInBounds = ({ row, col }: Coord) =>
  Number.isInteger(row) &&
  Number.isInteger(col) &&
  row >= 0 &&
  col >= 0 &&
  row < BOARD_SIZE &&
  col < BOARD_SIZE;

/** Plays one AI-only game against a random fleet; invalid shots are counted and skipped. */
export function simulateGame(difficulty: AIDifficulty, seed: number): GameReport {
  let board = randomizeFleet(createRng(seed));
  const ai = createAI(difficulty, createRng(seed ^ 0x9e3779b9));
  const log: ShotRecord[] = [];
  const fired = new Set<string>();
  let duplicates = 0;
  let outOfBounds = 0;

  for (let turn = 0; turn < MAX_SHOTS * 2; turn++) {
    const remaining = remainingShips(board).map((s) => s.size);
    if (remaining.length === 0) break;
    const coord = ai.nextMove(log, remaining);
    if (!isInBounds(coord)) {
      outOfBounds++;
      continue;
    }
    const k = `${coord.row},${coord.col}`;
    if (fired.has(k)) {
      duplicates++;
      continue;
    }
    fired.add(k);
    const outcome = fire(board, coord);
    if (!outcome.ok) throw new Error(`Unexpected fire error: ${outcome.error}`);
    board = outcome.board;
    log.push({ coord, result: outcome.result });
    ai.notifyResult(coord, outcome.result);
  }
  return {
    shots: log.length,
    duplicates,
    outOfBounds,
    finished: remainingShips(board).length === 0,
  };
}
