import {
  BOARD_SIZE,
  randomInt,
  type AIPlayer,
  type Coord,
  type Rng,
  type ShotLog,
} from '../engine';

export function unfiredCells(shots: ShotLog, size: number = BOARD_SIZE): Coord[] {
  const fired = new Set(shots.map(({ coord }) => `${coord.row},${coord.col}`));
  const cells: Coord[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!fired.has(`${row},${col}`)) cells.push({ row, col });
    }
  }
  return cells;
}

/** Placeholder AI: fires at a uniformly random cell it has not fired at yet. */
export function createRandomAI(rng: Rng = Math.random): AIPlayer {
  return {
    nextMove(shotsAtPlayer) {
      const options = unfiredCells(shotsAtPlayer);
      if (options.length === 0) throw new Error('No unfired cells left');
      return options[randomInt(rng, options.length)]!;
    },
    notifyResult() {},
  };
}
