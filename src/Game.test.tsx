import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRandomAI } from './ai';
import {
  createRng,
  fallbackFleet,
  randomizeFleet,
  type AIPlayer,
  type CreateAIPlayer,
} from './engine';
import Game from './Game';
import { coordLabel } from './game/labels';
import { AI_DELAY_MS } from './game/useGame';

// fallbackFleet: Carrier A1–E1, Battleship F1–I1, Cruiser J1–J3, Submarine A2–C2, Destroyer D2–E2.
const ENEMY_SHIP_CELLS = fallbackFleet()
  .ships.flatMap((s) => s.cells)
  .map(coordLabel);
const ALL_CELLS = Array.from({ length: 100 }, (_, i) =>
  coordLabel({ row: Math.floor(i / 10), col: i % 10 }),
);

function renderGame() {
  const ais: { nextMove: ReturnType<typeof vi.fn>; notifyResult: ReturnType<typeof vi.fn> }[] = [];
  const createAI = vi.fn<CreateAIPlayer>(() => {
    const inner = createRandomAI(createRng(7));
    const ai = { nextMove: vi.fn(inner.nextMove), notifyResult: vi.fn() };
    ais.push(ai);
    return ai;
  });
  const utils = render(
    <Game
      createAI={createAI}
      createEnemyBoard={() => fallbackFleet()}
      createPlayerFleet={() => randomizeFleet(createRng(3))}
    />,
  );
  return { ...utils, createAI, ais };
}

const enemyGrid = () => screen.getByRole('grid', { name: 'Enemy waters' });
const enemyCell = (label: string) =>
  within(enemyGrid()).getByRole('button', { name: new RegExp(`^${label},`) });
const placementCell = (label: string) =>
  within(screen.getByRole('grid', { name: 'Your board' })).getByRole('button', {
    name: new RegExp(`^${label},`),
  });
const logEntries = () =>
  within(screen.getByRole('region', { name: 'Move log' })).queryAllByRole('listitem');
const status = () => screen.getByRole('status');
// jsdom queues a 0 ms selectionchange task whenever focus moves.
const flushFocusTasks = () =>
  act(() => {
    vi.advanceTimersByTime(0);
  });
const advanceAI = (ms = AI_DELAY_MS) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

function startBattle() {
  fireEvent.click(screen.getByRole('button', { name: 'Randomize' }));
  fireEvent.click(screen.getByRole('button', { name: 'Start battle' }));
  flushFocusTasks();
}

function sinkEnemyFleet() {
  for (const label of ENEMY_SHIP_CELLS) {
    fireEvent.click(enemyCell(label));
    if (screen.queryByText('AI is thinking…')) advanceAI();
  }
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('placement', () => {
  it('enables Start only once all five ships are placed', () => {
    renderGame();
    const start = screen.getByRole('button', { name: 'Start battle' });
    ['A1', 'A2', 'A3', 'A4'].forEach((label) => fireEvent.click(placementCell(label)));
    expect(start).toBeDisabled();
    fireEvent.click(placementCell('A5'));
    expect(start).toBeEnabled();
    expect(status()).toHaveTextContent('Fleet ready');
  });

  it('previews green when valid and red when out of bounds or overlapping', () => {
    renderGame();
    act(() => placementCell('A1').focus());
    expect(placementCell('E1')).toHaveClass('preview-valid');

    act(() => placementCell('G1').focus()); // carrier would run off the right edge
    expect(placementCell('J1')).toHaveClass('preview-invalid');

    fireEvent.click(placementCell('A1')); // carrier A1–E1, battleship now selected
    act(() => placementCell('C1').focus());
    expect(placementCell('C1')).toHaveClass('preview-invalid');
    expect(status()).toHaveTextContent('Next: Battleship');
  });

  it('rotates with the R key and the Rotate button', () => {
    renderGame();
    fireEvent.keyDown(document.body, { key: 'r' });
    expect(status()).toHaveTextContent('Orientation: vertical.');
    act(() => placementCell('A1').focus());
    expect(placementCell('A5')).toHaveClass('preview-valid');
    expect(placementCell('B1')).not.toHaveClass('preview-valid');

    fireEvent.click(screen.getByRole('button', { name: 'Rotate' }));
    expect(status()).toHaveTextContent('Orientation: horizontal.');
  });

  it('reports invalid placement and leaves the board unchanged', () => {
    renderGame();
    fireEvent.click(placementCell('H1'));
    expect(status()).toHaveTextContent("Carrier doesn't fit there.");
    expect(screen.getByRole('button', { name: 'Carrier, 5 cells' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('Reset clears placed ships', () => {
    renderGame();
    fireEvent.click(screen.getByRole('button', { name: 'Randomize' }));
    expect(screen.getByRole('button', { name: 'Start battle' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByRole('button', { name: 'Start battle' })).toBeDisabled();
    expect(screen.queryAllByRole('button', { name: /placed$/ })).toHaveLength(0);
  });
});

describe('battle', () => {
  it('cannot fire during the AI turn', () => {
    const { ais } = renderGame();
    startBattle();

    fireEvent.click(enemyCell('J10'));
    expect(screen.getByText('AI is thinking…')).toBeInTheDocument();
    expect(enemyGrid()).toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(enemyCell('I10'));
    expect(enemyCell('I10')).toHaveAccessibleName('I10, not fired');
    expect(logEntries()).toHaveLength(1);

    advanceAI(AI_DELAY_MS - 1);
    expect(ais[0]!.nextMove).not.toHaveBeenCalled();
    advanceAI(1);
    expect(ais[0]!.nextMove).toHaveBeenCalledTimes(1);
    expect(ais[0]!.notifyResult).toHaveBeenCalledTimes(1);
    expect(logEntries()).toHaveLength(2);
    expect(screen.getByText('Your turn: fire at the enemy')).toBeInTheDocument();

    fireEvent.click(enemyCell('I10'));
    expect(enemyCell('I10')).toHaveAccessibleName('I10, miss');
    expect(logEntries()).toHaveLength(3);
  });

  it('ignores a duplicate click on an already-fired cell', () => {
    const { ais } = renderGame();
    startBattle();

    fireEvent.click(enemyCell('J10'));
    advanceAI();
    const message = status().textContent;
    fireEvent.click(enemyCell('J10'));
    expect(logEntries()).toHaveLength(2);
    expect(status()).toHaveTextContent(message ?? '');
    expect(screen.queryByText('AI is thinking…')).not.toBeInTheDocument();

    fireEvent.click(enemyCell('A1'));
    expect(status()).toHaveTextContent('You fired at A1: hit!');
    advanceAI();
    fireEvent.click(enemyCell('A1'));
    expect(logEntries()).toHaveLength(4);
    advanceAI();
    expect(ais[0]!.nextMove).toHaveBeenCalledTimes(2);
  });

  it('announces sunk ships by name and updates the remaining panel', () => {
    renderGame();
    startBattle();
    fireEvent.click(enemyCell('D2'));
    advanceAI();
    fireEvent.click(enemyCell('E2'));
    expect(status()).toHaveTextContent("You fired at E2 and sank the enemy's Destroyer!");
    const enemyShips = screen.getByRole('region', { name: 'Enemy ships' });
    expect(enemyShips).toHaveTextContent('4 of 5 remaining');
    expect(enemyCell('D2')).toHaveAccessibleName('D2, sunk Destroyer');
  });

  it('shows the win screen and blocks further shots once the game ends', () => {
    renderGame();
    startBattle();
    sinkEnemyFleet();

    expect(screen.getByRole('dialog', { name: 'You win!' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play again' })).toHaveFocus();
    const count = logEntries().length;
    fireEvent.click(enemyCell('J10'));
    advanceAI(5000);
    expect(logEntries()).toHaveLength(count);
  });

  it('falls back to a random cell when the AI returns an invalid move', () => {
    const errorSpy = vi.mocked(console.error).mockImplementation(() => {});
    const badAI: AIPlayer = { nextMove: () => ({ row: 99, col: 99 }), notifyResult: vi.fn() };
    render(
      <Game
        createAI={() => badAI}
        createEnemyBoard={() => fallbackFleet()}
        createPlayerFleet={() => randomizeFleet(createRng(3))}
      />,
    );
    startBattle();
    fireEvent.click(enemyCell('J10'));
    advanceAI();
    expect(logEntries()).toHaveLength(2);
    expect(screen.getByText('Your turn: fire at the enemy')).toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    errorSpy.mockClear();
  });
});

describe('real AI', { timeout: 30_000 }, () => {
  it.each(['Easy', 'Medium', 'Hard'])('plays a full game on %s without errors', (level) => {
    render(
      <Game
        createEnemyBoard={() => fallbackFleet()}
        createPlayerFleet={() => randomizeFleet(createRng(3))}
      />,
    );
    fireEvent.click(screen.getByRole('radio', { name: level }));
    startBattle();
    const enemyShips = new Set(ENEMY_SHIP_CELLS);
    const order = [...ALL_CELLS.filter((c) => !enemyShips.has(c)), ...ENEMY_SHIP_CELLS];
    for (const label of order) {
      if (screen.queryByRole('dialog')) break;
      fireEvent.click(enemyCell(label));
      advanceAI();
    }
    expect(screen.getByRole('dialog', { name: /You (win|lose)/ })).toBeInTheDocument();
  });
});

describe('reset', () => {
  it('Play again fully resets the game', () => {
    const { createAI, ais } = renderGame();
    fireEvent.click(screen.getByRole('radio', { name: 'Hard' }));
    startBattle();
    expect(createAI).toHaveBeenLastCalledWith('hard');
    sinkEnemyFleet();

    fireEvent.click(screen.getByRole('button', { name: 'Play again' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Place your fleet' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start battle' })).toBeDisabled();
    expect(screen.queryAllByRole('button', { name: /placed$/ })).toHaveLength(0);
    expect(screen.getByRole('radio', { name: 'Medium' })).toBeChecked();
    expect(status()).toHaveTextContent('Place your fleet.');
    const aiCalls = ais[0]!.nextMove.mock.calls.length;
    advanceAI(5000);
    expect(ais[0]!.nextMove).toHaveBeenCalledTimes(aiCalls);

    startBattle();
    expect(createAI).toHaveBeenLastCalledWith('medium');
    expect(logEntries()).toHaveLength(0);
    expect(within(enemyGrid()).getAllByRole('button', { name: /not fired$/ })).toHaveLength(100);
    expect(screen.getByText('Your turn: fire at the enemy')).toBeInTheDocument();
  });

  it('New game during the AI turn cancels the pending AI move', () => {
    const { ais } = renderGame();
    startBattle();
    fireEvent.click(enemyCell('J10'));
    expect(vi.getTimerCount()).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: 'New game' }));
    flushFocusTasks();
    expect(vi.getTimerCount()).toBe(0);
    advanceAI(5000);
    expect(ais[0]!.nextMove).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Place your fleet' })).toBeInTheDocument();
  });

  it('clears the pending AI timer on unmount', () => {
    const { unmount, ais } = renderGame();
    startBattle();
    fireEvent.click(enemyCell('J10'));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    advanceAI(5000);
    expect(ais[0]!.nextMove).not.toHaveBeenCalled();
  });
});

describe('focus management', () => {
  const placementHeading = () => screen.getByRole('heading', { name: 'Place your fleet' });

  it('does not move focus on first load', () => {
    renderGame();
    expect(document.body).toHaveFocus();
  });

  it('moves focus to the enemy board when the battle starts', () => {
    renderGame();
    startBattle();
    expect(enemyCell('A1')).toHaveFocus();
  });

  it('moves focus to the placement heading after New game and Play again', () => {
    renderGame();
    startBattle();
    fireEvent.click(screen.getByRole('button', { name: 'New game' }));
    expect(placementHeading()).toHaveFocus();

    startBattle();
    sinkEnemyFleet();
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
    expect(placementHeading()).toHaveFocus();
  });
});

describe('touch placement', () => {
  it('does not leave a stuck preview after tapping a cell', () => {
    renderGame();
    const a1 = placementCell('A1');
    // Event sequence a touchscreen tap produces, including compatibility mouse events.
    fireEvent.pointerOver(a1, { pointerType: 'touch' });
    fireEvent.pointerDown(a1, { pointerType: 'touch' });
    fireEvent.pointerUp(a1, { pointerType: 'touch' });
    fireEvent.mouseOver(a1);
    act(() => a1.focus());
    fireEvent.click(a1);

    expect(status()).toHaveTextContent('Carrier placed');
    const grid = screen.getByRole('grid', { name: 'Your board' });
    expect(grid.querySelectorAll('.preview-valid, .preview-invalid')).toHaveLength(0);
  });

  it('still previews on mouse hover', () => {
    renderGame();
    const a1 = placementCell('A1');
    fireEvent.pointerOver(a1, { pointerType: 'mouse' });
    fireEvent.mouseOver(a1);
    expect(placementCell('E1')).toHaveClass('preview-valid');
  });
});
