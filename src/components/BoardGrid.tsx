import { useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent } from 'react';
import type { Board, Coord } from '../engine';
import { COLUMN_LABELS, coordLabel } from '../game/labels';

export interface CellView {
  readonly className: string;
  readonly description: string;
  readonly style?: CSSProperties;
}

interface BoardGridProps {
  readonly board: Board;
  readonly label: string;
  readonly getCellView: (coord: Coord) => CellView;
  /** Render cells as focusable buttons. */
  readonly focusable: boolean;
  /** Buttons stay focusable but ignore activation. */
  readonly disabled?: boolean;
  readonly isCellDisabled?: (coord: Coord) => boolean;
  readonly onCellActivate?: (coord: Coord) => void;
  readonly onCellHover?: (coord: Coord | null) => void;
  readonly className?: string;
}

const KEY_DELTAS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

export default function BoardGrid({
  board,
  label,
  getCellView,
  focusable,
  disabled = false,
  isCellDisabled,
  onCellActivate,
  onCellHover,
  className = '',
}: BoardGridProps) {
  const { size } = board;
  const [active, setActive] = useState<Coord>({ row: 0, col: 0 });
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Touch taps emit compatibility mouseover/focus events that would leave a hover preview behind.
  const lastPointerType = useRef<string | null>(null);
  const hoverCell = (coord: Coord) => {
    if (lastPointerType.current !== 'touch') onCellHover?.(coord);
  };

  const moveFocus = (row: number, col: number) => {
    const next = {
      row: Math.min(size - 1, Math.max(0, row)),
      col: Math.min(size - 1, Math.max(0, col)),
    };
    setActive(next);
    cellRefs.current[next.row * size + next.col]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, { row, col }: Coord) => {
    lastPointerType.current = null;
    const delta = KEY_DELTAS[event.key];
    if (delta) {
      event.preventDefault();
      moveFocus(row + delta[0], col + delta[1]);
    } else if (event.key === 'Home') {
      event.preventDefault();
      moveFocus(event.ctrlKey ? 0 : row, 0);
    } else if (event.key === 'End') {
      event.preventDefault();
      moveFocus(event.ctrlKey ? size - 1 : row, size - 1);
    }
  };

  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onCellHover?.(null);
  };

  const columns = Array.from({ length: size }, (_, i) => i);

  return (
    <div
      className={`board ${disabled ? 'board-disabled' : ''} ${className}`}
      role="grid"
      aria-label={label}
      aria-disabled={disabled || undefined}
      onMouseLeave={() => onCellHover?.(null)}
      onBlur={onBlur}
      style={{ ['--board-size' as string]: size }}
    >
      <div className="board-row board-header" aria-hidden="true">
        <span className="board-label" />
        {columns.map((col) => (
          <span key={col} className="board-label">
            {COLUMN_LABELS[col]}
          </span>
        ))}
      </div>
      {columns.map((row) => (
        <div className="board-row" role="row" key={row}>
          <span className="board-label" aria-hidden="true">
            {row + 1}
          </span>
          {columns.map((col) => {
            const coord = { row, col };
            const view = getCellView(coord);
            const name = `${coordLabel(coord)}, ${view.description}`;
            if (!focusable) {
              return (
                <span
                  key={col}
                  role="gridcell"
                  aria-label={name}
                  className={`cell ${view.className}`}
                  style={view.style}
                />
              );
            }
            const cellDisabled = disabled || (isCellDisabled?.(coord) ?? false);
            const isActive = active.row === row && active.col === col;
            return (
              <span key={col} role="gridcell" className="cell-wrap">
                <button
                  type="button"
                  ref={(el) => {
                    cellRefs.current[row * size + col] = el;
                  }}
                  className={`cell ${view.className}`}
                  style={view.style}
                  aria-label={name}
                  aria-disabled={cellDisabled || undefined}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => {
                    setActive(coord);
                    if (!cellDisabled) onCellActivate?.(coord);
                  }}
                  onKeyDown={(e) => onKeyDown(e, coord)}
                  onPointerEnter={(e) => {
                    lastPointerType.current = e.pointerType;
                  }}
                  onPointerDown={(e) => {
                    lastPointerType.current = e.pointerType;
                  }}
                  onFocus={() => {
                    setActive(coord);
                    hoverCell(coord);
                  }}
                  onMouseEnter={() => hoverCell(coord)}
                />
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
