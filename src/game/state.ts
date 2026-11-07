import type { AIDifficulty } from '../ai';
import {
  FLEET,
  SHIP_SIZES,
  createBoard,
  createGame,
  getCell,
  isFleetComplete,
  placeShip,
  startBattle,
  takeTurn,
  type Board,
  type Coord,
  type GameState,
  type Orientation,
  type PlayerId,
  type ShipType,
  type ShotResult,
} from '../engine';
import { SHIP_NAMES, describeShot } from './labels';

export interface LogEntry {
  readonly id: number;
  readonly shooter: PlayerId;
  readonly coord: Coord;
  readonly result: ShotResult;
  readonly sunkShip?: ShipType;
}

export interface PlacementState {
  readonly board: Board;
  readonly selected: ShipType | null;
  readonly orientation: Orientation;
}

export interface AppState {
  readonly difficulty: AIDifficulty;
  readonly placement: PlacementState;
  /** `null` while the player is placing ships. */
  readonly game: GameState | null;
  readonly log: readonly LogEntry[];
  readonly message: string;
}

export type Action =
  | { readonly type: 'selectShip'; readonly ship: ShipType }
  | { readonly type: 'rotate' }
  | { readonly type: 'placeAt'; readonly origin: Coord }
  | { readonly type: 'setFleet'; readonly board: Board }
  | { readonly type: 'resetPlacement' }
  | { readonly type: 'setDifficulty'; readonly difficulty: AIDifficulty }
  | { readonly type: 'start'; readonly enemyBoard: Board }
  | { readonly type: 'fire'; readonly shooter: PlayerId; readonly coord: Coord }
  | { readonly type: 'reset' };

export const DEFAULT_DIFFICULTY: AIDifficulty = 'medium';

export function createInitialState(): AppState {
  return {
    difficulty: DEFAULT_DIFFICULTY,
    placement: { board: createBoard(), selected: FLEET[0]!, orientation: 'horizontal' },
    game: null,
    log: [],
    message: 'Place your fleet. Select a ship, then choose a cell.',
  };
}

function nextUnplaced(board: Board): ShipType | null {
  return FLEET.find((type) => !board.ships.some((s) => s.type === type)) ?? null;
}

/** Rebuilds the board without `type`. Only valid before any shots are fired. */
function removeShip(board: Board, type: ShipType): Board {
  return board.ships
    .filter((s) => s.type !== type)
    .reduce((b, s) => {
      const result = placeShip(b, s.type, s.origin, s.orientation);
      return result.ok ? result.board : b;
    }, createBoard(board.size));
}

function placementReducer(state: AppState, action: Action): AppState {
  const { placement } = state;
  switch (action.type) {
    case 'selectShip': {
      const placed = placement.board.ships.find((s) => s.type === action.ship);
      const name = SHIP_NAMES[action.ship];
      return {
        ...state,
        placement: {
          ...placement,
          board: placed ? removeShip(placement.board, action.ship) : placement.board,
          selected: action.ship,
          orientation: placed ? placed.orientation : placement.orientation,
        },
        message: `${name} (${SHIP_SIZES[action.ship]}) selected.`,
      };
    }
    case 'rotate': {
      const orientation = placement.orientation === 'horizontal' ? 'vertical' : 'horizontal';
      return {
        ...state,
        placement: { ...placement, orientation },
        message: `Orientation: ${orientation}.`,
      };
    }
    case 'placeAt': {
      const { selected, board, orientation } = placement;
      if (!selected) {
        const shipType = getCell(board, action.origin)?.shipType;
        return shipType ? placementReducer(state, { type: 'selectShip', ship: shipType }) : state;
      }
      const result = placeShip(board, selected, action.origin, orientation);
      const name = SHIP_NAMES[selected];
      if (!result.ok) {
        const reason =
          result.error === 'overlap' ? 'would overlap another ship' : "doesn't fit there";
        return { ...state, message: `${name} ${reason}.` };
      }
      const next = nextUnplaced(result.board);
      return {
        ...state,
        placement: { ...placement, board: result.board, selected: next },
        message: next
          ? `${name} placed. Next: ${SHIP_NAMES[next]}.`
          : `${name} placed. Fleet ready, start the battle!`,
      };
    }
    case 'setFleet':
      return {
        ...state,
        placement: { ...placement, board: action.board, selected: nextUnplaced(action.board) },
        message: 'Fleet randomized.',
      };
    case 'resetPlacement':
      return {
        ...state,
        placement: { ...placement, board: createBoard(), selected: FLEET[0]! },
        message: 'Board cleared.',
      };
    case 'setDifficulty':
      return { ...state, difficulty: action.difficulty };
    case 'start': {
      if (!isFleetComplete(placement.board)) return state;
      const boards = { player: placement.board, ai: action.enemyBoard };
      const outcome = startBattle(createGame(boards, 'player'));
      if (!outcome.ok) return state;
      return { ...state, game: outcome.state, log: [], message: 'Battle started. Your turn.' };
    }
    default:
      return state;
  }
}

function battleReducer(state: AppState, game: GameState, shooter: PlayerId, coord: Coord) {
  if (game.phase !== 'battle' || game.currentTurn !== shooter) return state;
  const outcome = takeTurn(game, coord);
  if (!outcome.ok) return state;

  const sunkShip = outcome.sunkShip?.type;
  const entry: LogEntry = {
    id: state.log.length + 1,
    shooter,
    coord,
    result: outcome.result,
    ...(sunkShip ? { sunkShip } : {}),
  };
  let message = describeShot(shooter, coord, outcome.result, sunkShip);
  if (outcome.state.phase === 'over') {
    message += outcome.state.winner === 'player' ? ' You win!' : ' You lose.';
  }
  return { ...state, game: outcome.state, log: [...state.log, entry], message };
}

export function reducer(state: AppState, action: Action): AppState {
  if (action.type === 'reset') return createInitialState();
  if (action.type === 'fire') {
    return state.game ? battleReducer(state, state.game, action.shooter, action.coord) : state;
  }
  return state.game ? state : placementReducer(state, action);
}
