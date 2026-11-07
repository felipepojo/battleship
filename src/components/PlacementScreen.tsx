import { useEffect, useId, useState } from 'react';
import type { AIDifficulty } from '../ai';
import {
  FLEET,
  SHIP_SIZES,
  canPlaceShip,
  getCell,
  isFleetComplete,
  isInBounds,
  shipCells,
  type Coord,
  type ShipType,
} from '../engine';
import { SHIP_NAMES } from '../game/labels';
import type { PlacementState } from '../game/state';
import BoardGrid, { type CellView } from './BoardGrid';

const DIFFICULTIES: readonly { value: AIDifficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

interface PlacementScreenProps {
  readonly placement: PlacementState;
  readonly difficulty: AIDifficulty;
  readonly onSelectShip: (ship: ShipType) => void;
  readonly onRotate: () => void;
  readonly onPlaceAt: (origin: Coord) => void;
  readonly onRandomize: () => void;
  readonly onReset: () => void;
  readonly onDifficultyChange: (difficulty: AIDifficulty) => void;
  readonly onStart: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLSelectElement) return true;
  return (
    target instanceof HTMLInputElement && !['radio', 'checkbox', 'button'].includes(target.type)
  );
}

export default function PlacementScreen({
  placement,
  difficulty,
  onSelectShip,
  onRotate,
  onPlaceAt,
  onRandomize,
  onReset,
  onDifficultyChange,
  onStart,
}: PlacementScreenProps) {
  const { board, selected, orientation } = placement;
  const [hover, setHover] = useState<Coord | null>(null);
  const headingId = useId();
  const helpId = useId();
  const orientationId = useId();
  const complete = isFleetComplete(board);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'r' && event.key !== 'R') return;
      if (event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) return;
      event.preventDefault();
      onRotate();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onRotate]);

  const preview =
    hover && selected
      ? {
          cells: new Set(
            shipCells(hover, orientation, SHIP_SIZES[selected])
              .filter((c) => isInBounds(board, c))
              .map((c) => `${c.row},${c.col}`),
          ),
          valid: canPlaceShip(board, selected, hover, orientation),
        }
      : null;

  const getCellView = (coord: Coord): CellView => {
    const shipType = getCell(board, coord)?.shipType ?? null;
    const classes = [shipType ? 'ship' : 'water'];
    if (preview?.cells.has(`${coord.row},${coord.col}`)) {
      classes.push(preview.valid ? 'preview-valid' : 'preview-invalid');
    }
    return { className: classes.join(' '), description: shipType ? SHIP_NAMES[shipType] : 'empty' };
  };

  return (
    <section className="placement" aria-labelledby={headingId}>
      <h2 id={headingId}>Place your fleet</h2>
      <p id={helpId} className="hint">
        Pick a ship, then choose a cell for its top-left end. Press <kbd>R</kbd> or Rotate to turn
        it. Arrow keys move around the grid.
      </p>

      <div className="placement-layout">
        <div className="panel tray-panel">
          <h3>Ships</h3>
          <ul className="tray">
            {FLEET.map((type) => {
              const placed = board.ships.some((s) => s.type === type);
              const isSelected = selected === type;
              return (
                <li key={type}>
                  <button
                    type="button"
                    className={`tray-ship ${placed ? 'placed' : ''} ${isSelected ? 'selected' : ''}`}
                    aria-pressed={isSelected}
                    aria-label={`${SHIP_NAMES[type]}, ${SHIP_SIZES[type]} cells${placed ? ', placed' : ''}`}
                    onClick={() => onSelectShip(type)}
                  >
                    <span className="tray-name">{SHIP_NAMES[type]}</span>
                    <span className="pips" aria-hidden="true">
                      {Array.from({ length: SHIP_SIZES[type] }, (_, i) => (
                        <span key={i} className="pip" />
                      ))}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="button-row">
            <button type="button" onClick={onRotate} aria-describedby={orientationId}>
              Rotate
            </button>
            <span id={orientationId} className="orientation">
              {orientation === 'horizontal' ? 'Horizontal' : 'Vertical'}
            </span>
          </div>
        </div>

        <BoardGrid
          board={board}
          label="Your board"
          focusable
          getCellView={getCellView}
          onCellActivate={onPlaceAt}
          onCellHover={setHover}
          className="placement-board"
        />

        <div className="panel controls-panel">
          <div className="button-row">
            <button type="button" onClick={onRandomize}>
              Randomize
            </button>
            <button type="button" onClick={onReset}>
              Reset
            </button>
          </div>
          <fieldset className="difficulty">
            <legend>Difficulty</legend>
            {DIFFICULTIES.map(({ value, label }) => (
              <label key={value}>
                <input
                  type="radio"
                  name="difficulty"
                  value={value}
                  checked={difficulty === value}
                  onChange={() => onDifficultyChange(value)}
                />
                {label}
              </label>
            ))}
          </fieldset>
          <button type="button" className="primary" disabled={!complete} onClick={onStart}>
            Start battle
          </button>
          {!complete && <p className="hint">Place all {FLEET.length} ships to start.</p>}
        </div>
      </div>
    </section>
  );
}
