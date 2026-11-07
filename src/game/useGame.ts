import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  createAI as defaultCreateAI,
  unfiredCells,
  type AIDifficulty,
  type AIPlayer,
  type CreateAIPlayer,
} from '../ai';
import {
  randomInt,
  randomizeFleet,
  remainingShips,
  takeTurn,
  type Board,
  type Coord,
  type GameState,
  type ShipType,
} from '../engine';
import { createInitialState, reducer } from './state';

export const AI_DELAY_MS = 700;

export interface GameOptions {
  readonly createAI?: CreateAIPlayer;
  readonly createEnemyBoard?: () => Board;
  readonly createPlayerFleet?: () => Board;
  readonly aiDelayMs?: number;
}

/** Asks the AI for a move, falling back to a random unfired cell if it returns an invalid one. */
function chooseAIMove(ai: AIPlayer, game: GameState): Coord {
  try {
    const coord = ai.nextMove(
      game.shots.ai,
      remainingShips(game.boards.player).map((s) => s.size),
    );
    if (takeTurn(game, coord).ok) return coord;
    console.error('AI chose an invalid cell; falling back to a random move.', coord);
  } catch (error) {
    console.error('AI failed to choose a move; falling back to a random move.', error);
  }
  const options = unfiredCells(game.shots.ai, game.boards.player.size);
  return options[randomInt(Math.random, options.length)]!;
}

export function useGame({
  createAI = defaultCreateAI,
  createEnemyBoard = randomizeFleet,
  createPlayerFleet = randomizeFleet,
  aiDelayMs = AI_DELAY_MS,
}: GameOptions = {}) {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);
  const aiRef = useRef<AIPlayer | null>(null);
  const { game } = state;
  const aiTurn = game?.phase === 'battle' && game.currentTurn === 'ai';

  useEffect(() => {
    if (!aiTurn || !game) return;
    const timer = setTimeout(() => {
      const ai = aiRef.current;
      if (!ai) return;
      const coord = chooseAIMove(ai, game);
      const outcome = takeTurn(game, coord);
      dispatch({ type: 'fire', shooter: 'ai', coord });
      if (outcome.ok) ai.notifyResult(coord, outcome.result);
    }, aiDelayMs);
    return () => clearTimeout(timer);
  }, [aiTurn, game, aiDelayMs]);

  return {
    state,
    aiTurn,
    selectShip: useCallback((ship: ShipType) => dispatch({ type: 'selectShip', ship }), []),
    rotate: useCallback(() => dispatch({ type: 'rotate' }), []),
    placeAt: useCallback((origin: Coord) => dispatch({ type: 'placeAt', origin }), []),
    randomize: useCallback(
      () => dispatch({ type: 'setFleet', board: createPlayerFleet() }),
      [createPlayerFleet],
    ),
    resetPlacement: useCallback(() => dispatch({ type: 'resetPlacement' }), []),
    setDifficulty: useCallback(
      (difficulty: AIDifficulty) => dispatch({ type: 'setDifficulty', difficulty }),
      [],
    ),
    start: useCallback(() => {
      aiRef.current = createAI(state.difficulty);
      dispatch({ type: 'start', enemyBoard: createEnemyBoard() });
    }, [createAI, createEnemyBoard, state.difficulty]),
    fireAt: useCallback((coord: Coord) => dispatch({ type: 'fire', shooter: 'player', coord }), []),
    reset: useCallback(() => {
      aiRef.current = null;
      dispatch({ type: 'reset' });
    }, []),
  };
}
