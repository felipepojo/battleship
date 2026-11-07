import { useId } from 'react';
import { getCell, isSunk, type Board, type Coord, type GameState } from '../engine';
import { SHIP_NAMES } from '../game/labels';
import type { LogEntry } from '../game/state';
import BoardGrid, { type CellView } from './BoardGrid';
import MoveLog from './MoveLog';
import { shipSpriteStyle } from './shipSprites';
import ShipStatus from './ShipStatus';

interface BattleScreenProps {
  readonly game: GameState;
  readonly log: readonly LogEntry[];
  readonly aiTurn: boolean;
  readonly onFire: (coord: Coord) => void;
  readonly onNewGame: () => void;
}

function shipAt(board: Board, coord: Coord) {
  const type = getCell(board, coord)?.shipType;
  return type ? board.ships.find((s) => s.type === type) : undefined;
}

function ownCellView(board: Board, coord: Coord): CellView {
  const shot = getCell(board, coord)?.shot ?? false;
  const ship = shipAt(board, coord);
  if (!ship)
    return shot
      ? { className: 'water miss', description: 'miss' }
      : { className: 'water', description: 'water' };
  const name = SHIP_NAMES[ship.type];
  const style = shipSpriteStyle(ship, coord);
  if (isSunk(ship)) return { className: 'ship sprite sunk', description: `${name}, sunk`, style };
  if (shot) return { className: 'ship sprite hit', description: `${name}, hit`, style };
  return { className: 'ship sprite', description: name, style };
}

function enemyCellView(board: Board, coord: Coord, reveal: boolean): CellView {
  const shot = getCell(board, coord)?.shot ?? false;
  const ship = shipAt(board, coord);
  if (ship && isSunk(ship)) {
    return {
      className: 'ship sprite sunk',
      description: `sunk ${SHIP_NAMES[ship.type]}`,
      style: shipSpriteStyle(ship, coord),
    };
  }
  if (shot)
    return ship
      ? { className: 'hit', description: 'hit' }
      : { className: 'water miss', description: 'miss' };
  if (reveal && ship) {
    return {
      className: 'ship sprite revealed',
      description: SHIP_NAMES[ship.type],
      style: shipSpriteStyle(ship, coord),
    };
  }
  return { className: 'water unknown', description: 'not fired' };
}

export default function BattleScreen({ game, log, aiTurn, onFire, onNewGame }: BattleScreenProps) {
  const enemyHeadingId = useId();
  const ownHeadingId = useId();
  const over = game.phase === 'over';
  const enemy = game.boards.ai;
  const own = game.boards.player;

  return (
    <div className="battle">
      <div className="battle-bar">
        <p className={`turn ${aiTurn ? 'turn-ai' : 'turn-player'}`}>
          {over ? (
            'Game over'
          ) : aiTurn ? (
            <>
              <span className="spinner" aria-hidden="true" />
              AI is thinking…
            </>
          ) : (
            'Your turn: fire at the enemy'
          )}
        </p>
        <button type="button" onClick={onNewGame}>
          New game
        </button>
      </div>

      <div className="boards">
        <section className="board-section" aria-labelledby={enemyHeadingId}>
          <h2 id={enemyHeadingId}>Enemy waters</h2>
          <BoardGrid
            board={enemy}
            label="Enemy waters"
            focusable
            disabled={aiTurn || over}
            isCellDisabled={(c) => getCell(enemy, c)?.shot ?? true}
            getCellView={(c) => enemyCellView(enemy, c, over)}
            onCellActivate={onFire}
            className="enemy-board"
          />
        </section>
        <section className="board-section" aria-labelledby={ownHeadingId}>
          <h2 id={ownHeadingId}>Your fleet</h2>
          <BoardGrid
            board={own}
            label="Your fleet"
            focusable={false}
            getCellView={(c) => ownCellView(own, c)}
          />
        </section>
      </div>

      <div className="sidebar">
        <ShipStatus title="Enemy ships" board={enemy} showDamage={false} />
        <ShipStatus title="Your ships" board={own} showDamage />
        <MoveLog log={log} />
      </div>
    </div>
  );
}
