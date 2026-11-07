import type { Rng } from './rng';
import type { Coord, ShotLog, ShotResult } from './types';

export type AIDifficulty = 'easy' | 'medium' | 'hard';

export interface AIPlayer {
  /**
   * Choose the next cell to fire at on the human player's board.
   * `shotsAtPlayer` is every shot the AI has fired so far, with results;
   * `remainingShipSizes` lists sizes of the player's ships not yet sunk.
   */
  nextMove(shotsAtPlayer: ShotLog, remainingShipSizes: number[]): Coord;
  /** Called after the AI's shot at `coord` resolves. */
  notifyResult(coord: Coord, result: ShotResult): void;
}

export type CreateAIPlayer = (difficulty: AIDifficulty, rng?: Rng) => AIPlayer;
