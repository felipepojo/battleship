import { getCell, isFleetComplete } from './board';
import {
  type Board,
  type Coord,
  type FireError,
  type GameState,
  type PlayerId,
  type Ship,
  type ShotResult,
  type StartError,
  type TurnError,
} from './types';

export type FireOutcome =
  | {
      readonly ok: true;
      readonly board: Board;
      readonly result: ShotResult;
      readonly sunkShip?: Ship;
    }
  | { readonly ok: false; readonly error: FireError; readonly board: Board };

export type TurnOutcome =
  | {
      readonly ok: true;
      readonly state: GameState;
      readonly result: ShotResult;
      readonly sunkShip?: Ship;
    }
  | { readonly ok: false; readonly error: TurnError; readonly state: GameState };

export type StartOutcome =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly error: StartError; readonly state: GameState };

export function isSunk(ship: Ship): boolean {
  return ship.hits.length > 0 && ship.hits.every(Boolean);
}

export function remainingShips(board: Board): readonly Ship[] {
  return board.ships.filter((s) => !isSunk(s));
}

/** True when the board has ships and all are sunk. An empty board is never a win. */
export function isWin(board: Board): boolean {
  return board.ships.length > 0 && board.ships.every(isSunk);
}

/**
 * Fire at `coord`. Out-of-bounds or already-fired cells return `ok: false`
 * with the original board reference, unchanged.
 */
export function fire(board: Board, coord: Coord): FireOutcome {
  const cell = getCell(board, coord);
  if (!cell) return { ok: false, error: 'out-of-bounds', board };
  if (cell.shot) return { ok: false, error: 'already-fired', board };

  const { row, col } = coord;
  const cells = board.cells.map((r, ri) =>
    ri === row ? r.map((c, ci) => (ci === col ? { ...c, shot: true } : c)) : r,
  );

  if (cell.shipType === null) {
    return { ok: true, board: { ...board, cells }, result: 'miss' };
  }

  let hitShip: Ship | undefined;
  const ships = board.ships.map((ship) => {
    if (ship.type !== cell.shipType) return ship;
    const updated: Ship = {
      ...ship,
      hits: ship.hits.map(
        (h, i) => h || (ship.cells[i]!.row === row && ship.cells[i]!.col === col),
      ),
    };
    hitShip = updated;
    return updated;
  });

  const newBoard: Board = { ...board, cells, ships };
  if (hitShip && isSunk(hitShip)) {
    return { ok: true, board: newBoard, result: 'sunk', sunkShip: hitShip };
  }
  return { ok: true, board: newBoard, result: 'hit' };
}

export function opponentOf(player: PlayerId): PlayerId {
  return player === 'player' ? 'ai' : 'player';
}

export function createGame(
  boards: Readonly<Record<PlayerId, Board>>,
  firstTurn: PlayerId = 'player',
): GameState {
  return {
    phase: 'placement',
    boards,
    shots: { player: [], ai: [] },
    currentTurn: firstTurn,
    winner: null,
  };
}

/** Move from placement to battle, with the given (or existing) boards. Both fleets must be complete. */
export function startBattle(
  state: GameState,
  boards: Readonly<Record<PlayerId, Board>> = state.boards,
): StartOutcome {
  if (state.phase !== 'placement') return { ok: false, error: 'not-in-placement', state };
  if (!isFleetComplete(boards.player) || !isFleetComplete(boards.ai)) {
    return { ok: false, error: 'fleet-incomplete', state };
  }
  return { ok: true, state: { ...state, boards, phase: 'battle' } };
}

/**
 * The current player fires at the opponent's board. On success the turn always
 * passes to the opponent (hit or miss), unless the shot wins the game.
 * Invalid shots return `ok: false` with the original state; the turn does not change.
 */
export function takeTurn(state: GameState, coord: Coord): TurnOutcome {
  if (state.phase !== 'battle') return { ok: false, error: 'not-in-battle', state };

  const shooter = state.currentTurn;
  const target = opponentOf(shooter);
  const outcome = fire(state.boards[target], coord);
  if (!outcome.ok) return { ok: false, error: outcome.error, state };

  const won = isWin(outcome.board);
  const next: GameState = {
    phase: won ? 'over' : 'battle',
    boards: { ...state.boards, [target]: outcome.board },
    shots: {
      ...state.shots,
      [shooter]: [...state.shots[shooter], { coord: { ...coord }, result: outcome.result }],
    },
    currentTurn: won ? shooter : target,
    winner: won ? shooter : null,
  };
  return {
    ok: true,
    state: next,
    result: outcome.result,
    ...(outcome.sunkShip ? { sunkShip: outcome.sunkShip } : {}),
  };
}
