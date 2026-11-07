import type { AIPlayer, Rng } from '../engine';
import { createPlayer, pick } from './player';

/** Uniformly random among unfired cells. */
export function createEasyAI(rng: Rng): AIPlayer {
  return createPlayer(rng, (analysis) => pick(rng, analysis.unknown));
}
