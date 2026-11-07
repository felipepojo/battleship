import type { AIDifficulty, AIPlayer, CreateAIPlayer, Rng } from '../engine';
import { createEasyAI } from './easy';
import { createHardAI } from './hard';
import { createMediumAI } from './medium';

export { createEasyAI } from './easy';
export { createMediumAI } from './medium';
export { createHardAI } from './hard';

/** Creates an AI opponent. Pass a seeded `rng` (see `createRng`) for deterministic play. */
export const createAI: CreateAIPlayer = (
  difficulty: AIDifficulty,
  rng: Rng = Math.random,
): AIPlayer => {
  switch (difficulty) {
    case 'easy':
      return createEasyAI(rng);
    case 'medium':
      return createMediumAI(rng);
    case 'hard':
      return createHardAI(rng);
    default:
      throw new Error(`Unknown AI difficulty: ${String(difficulty)}`);
  }
};
