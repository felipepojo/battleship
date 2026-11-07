import type { CreateAIPlayer } from '../engine';
import { createRandomAI } from './random';

export type { AIDifficulty, AIPlayer, CreateAIPlayer } from '../engine';
export { createRandomAI, unfiredCells } from './random';

/** Every difficulty uses the random placeholder until the real AIs land. */
export const createAI: CreateAIPlayer = (_difficulty, rng) => createRandomAI(rng);
