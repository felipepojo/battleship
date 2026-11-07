export const BOARD_SIZE = 10;

export interface Coord {
  readonly row: number;
  readonly col: number;
}

export type Orientation = 'horizontal' | 'vertical';

export type ShipType = 'carrier' | 'battleship' | 'cruiser' | 'submarine' | 'destroyer';

export const SHIP_SIZES: Readonly<Record<ShipType, number>> = {
  carrier: 5,
  battleship: 4,
  cruiser: 3,
  submarine: 3,
  destroyer: 2,
};

export const FLEET: readonly ShipType[] = [
  'carrier',
  'battleship',
  'cruiser',
  'submarine',
  'destroyer',
];

export interface Ship {
  readonly type: ShipType;
  readonly size: number;
  readonly origin: Coord;
  readonly orientation: Orientation;
  /** Cells occupied by the ship, ordered from `origin`. */
  readonly cells: readonly Coord[];
  /** `hits[i]` is true when `cells[i]` has been hit. */
  readonly hits: readonly boolean[];
}

export interface Cell {
  /** Ship occupying this cell, if any. Each ship type appears at most once per board. */
  readonly shipType: ShipType | null;
  readonly shot: boolean;
}

export interface Board {
  readonly size: number;
  /** Indexed as `cells[row][col]`. */
  readonly cells: readonly (readonly Cell[])[];
  readonly ships: readonly Ship[];
}

export type ShotResult = 'hit' | 'miss' | 'sunk';

export interface ShotRecord {
  readonly coord: Coord;
  readonly result: ShotResult;
}

export type ShotLog = readonly ShotRecord[];

export type Phase = 'placement' | 'battle' | 'over';

export type PlayerId = 'player' | 'ai';

export interface GameState {
  readonly phase: Phase;
  /** Each player's own board (their ships, and the shots received). */
  readonly boards: Readonly<Record<PlayerId, Board>>;
  /** Shots fired *by* each player, in order. */
  readonly shots: Readonly<Record<PlayerId, ShotLog>>;
  readonly currentTurn: PlayerId;
  readonly winner: PlayerId | null;
}

export type PlacementError = 'out-of-bounds' | 'overlap' | 'already-placed';

export type FireError = 'out-of-bounds' | 'already-fired';

export type TurnError = FireError | 'not-in-battle';

export type StartError = 'not-in-placement' | 'fleet-incomplete';
