import { describe, expect, it } from 'vitest';
import { createBoard, randomizeFleet } from './board';
import { createGame, fire, isSunk, isWin, remainingShips, startBattle, takeTurn } from './game';
import { createRng } from './rng';
import { deepFreeze, place } from './testUtils';
import { FLEET, type Board, type Coord, type GameState, type Ship } from './types';

/** destroyer at (0,0)-(0,1), cruiser at (2,0)-(2,2) */
function smallBoard(): Board {
  let board = createBoard();
  board = place(board, 'destroyer', { row: 0, col: 0 }, 'horizontal');
  board = place(board, 'cruiser', { row: 2, col: 0 }, 'horizontal');
  return board;
}

function fullBoard(): Board {
  let board = createBoard();
  FLEET.forEach((type, i) => (board = place(board, type, { row: i * 2, col: 0 })));
  return board;
}

function fireAll(board: Board, coords: Coord[]): Board {
  return coords.reduce((b, c) => {
    const out = fire(b, c);
    if (!out.ok) throw new Error(`Test setup: fire failed: ${out.error}`);
    return out.board;
  }, board);
}

function shipCoords(board: Board): Coord[] {
  return board.ships.flatMap((s) => s.cells);
}

describe('fire', () => {
  it('reports a miss on an empty cell and marks it shot', () => {
    const out = fire(smallBoard(), { row: 5, col: 5 });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.result).toBe('miss');
    expect(out.sunkShip).toBeUndefined();
    expect(out.board.cells[5]![5]!.shot).toBe(true);
    expect(out.board.ships).toEqual(smallBoard().ships);
  });

  it('reports a hit and records it on the ship', () => {
    const out = fire(smallBoard(), { row: 2, col: 1 });
    expect(out.ok && out.result).toBe('hit');
    if (!out.ok) return;
    const cruiser = out.board.ships.find((s) => s.type === 'cruiser')!;
    expect(cruiser.hits).toEqual([false, true, false]);
    expect(out.board.cells[2]![1]!.shot).toBe(true);
  });

  it('reports sunk on the final hit and returns the sunk ship', () => {
    const board = fireAll(smallBoard(), [{ row: 0, col: 0 }]);
    const out = fire(board, { row: 0, col: 1 });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.result).toBe('sunk');
    expect(out.sunkShip?.type).toBe('destroyer');
    expect(out.sunkShip && isSunk(out.sunkShip)).toBe(true);
  });

  it('sinks a ship regardless of hit order', () => {
    const board = fireAll(smallBoard(), [
      { row: 2, col: 2 },
      { row: 2, col: 0 },
    ]);
    const out = fire(board, { row: 2, col: 1 });
    expect(out.ok && out.result).toBe('sunk');
  });

  it('does not affect other ships when one is hit', () => {
    const out = fire(smallBoard(), { row: 0, col: 0 });
    if (!out.ok) throw new Error('unexpected');
    expect(out.board.ships.find((s) => s.type === 'cruiser')!.hits).toEqual([false, false, false]);
  });

  it.each([
    ['a miss', { row: 9, col: 9 }],
    ['a hit', { row: 2, col: 0 }],
    ['a sinking hit', { row: 0, col: 1 }],
  ])('returns already-fired and leaves state untouched when repeating %s', (_, coord) => {
    const board = deepFreeze(fireAll(smallBoard(), [{ row: 0, col: 0 }, coord]));
    const snapshot = structuredClone(board);
    const out = fire(board, coord);
    expect(out).toEqual({ ok: false, error: 'already-fired', board });
    expect(out.board).toBe(board);
    expect(board).toEqual(snapshot);
  });

  it.each([
    { row: -1, col: 0 },
    { row: 0, col: 10 },
    { row: 10, col: 10 },
    { row: 1.5, col: 2 },
  ])('returns out-of-bounds for %o without changing state', (coord) => {
    const board = smallBoard();
    const out = fire(board, coord);
    expect(out).toEqual({ ok: false, error: 'out-of-bounds', board });
    expect(out.board).toBe(board);
  });

  it('never mutates the input board', () => {
    const board = deepFreeze(smallBoard());
    const snapshot = structuredClone(board);
    for (const coord of [
      { row: 0, col: 0 },
      { row: 9, col: 9 },
    ]) {
      const out = fire(board, coord);
      expect(out.ok).toBe(true);
      expect(out.board).not.toBe(board);
    }
    expect(board).toEqual(snapshot);
  });

  it('shares unchanged rows with the previous board', () => {
    const board = smallBoard();
    const out = fire(board, { row: 5, col: 5 });
    if (!out.ok) throw new Error('unexpected');
    expect(out.board.cells[4]).toBe(board.cells[4]);
    expect(out.board.cells[5]).not.toBe(board.cells[5]);
  });
});

describe('isSunk', () => {
  const base: Ship = smallBoard().ships[0]!;

  it('is false with no hits', () => {
    expect(isSunk(base)).toBe(false);
  });

  it('is false when partially hit', () => {
    expect(isSunk({ ...base, hits: [true, false] })).toBe(false);
  });

  it('is true when every cell is hit', () => {
    expect(isSunk({ ...base, hits: [true, true] })).toBe(true);
  });

  it('is false for a degenerate zero-length ship', () => {
    expect(isSunk({ ...base, size: 0, cells: [], hits: [] })).toBe(false);
  });
});

describe('remainingShips', () => {
  it('lists every ship on a fresh board', () => {
    expect(remainingShips(fullBoard()).map((s) => s.type)).toEqual([...FLEET]);
  });

  it('keeps damaged but afloat ships', () => {
    const board = fireAll(smallBoard(), [{ row: 2, col: 0 }]);
    expect(remainingShips(board).map((s) => s.type)).toEqual(['destroyer', 'cruiser']);
  });

  it('removes sunk ships', () => {
    const board = fireAll(smallBoard(), [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ]);
    expect(remainingShips(board).map((s) => s.type)).toEqual(['cruiser']);
  });

  it('is empty when every ship is sunk', () => {
    const board = smallBoard();
    expect(remainingShips(fireAll(board, shipCoords(board)))).toEqual([]);
  });

  it('is empty for an empty board', () => {
    expect(remainingShips(createBoard())).toEqual([]);
  });
});

describe('isWin', () => {
  it('is false on a fresh board', () => {
    expect(isWin(fullBoard())).toBe(false);
  });

  it('is false with one ship cell remaining', () => {
    const board = fullBoard();
    const coords = shipCoords(board);
    expect(isWin(fireAll(board, coords.slice(0, -1)))).toBe(false);
  });

  it('is true once every ship cell is hit', () => {
    const board = fullBoard();
    expect(isWin(fireAll(board, shipCoords(board)))).toBe(true);
  });

  it('is unaffected by misses', () => {
    const board = fullBoard();
    const misses = [
      { row: 9, col: 9 },
      { row: 1, col: 9 },
    ];
    expect(isWin(fireAll(board, misses))).toBe(false);
    expect(isWin(fireAll(board, [...misses, ...shipCoords(board)]))).toBe(true);
  });

  it('is false for an empty board', () => {
    expect(isWin(createBoard())).toBe(false);
  });

  it('is true after sinking a randomized fleet', () => {
    const board = randomizeFleet(createRng(5));
    expect(isWin(fireAll(board, shipCoords(board)))).toBe(true);
  });
});

describe('game flow', () => {
  function battle(): GameState {
    const out = startBattle(createGame({ player: fullBoard(), ai: randomizeFleet(createRng(1)) }));
    if (!out.ok) throw new Error('Test setup: cannot start battle');
    return out.state;
  }

  function turn(state: GameState, coord: Coord): GameState {
    const out = takeTurn(state, coord);
    if (!out.ok) throw new Error(`Test setup: turn failed: ${out.error}`);
    return out.state;
  }

  it('starts in placement with the chosen first player', () => {
    const state = createGame({ player: createBoard(), ai: createBoard() }, 'ai');
    expect(state.phase).toBe('placement');
    expect(state.currentTurn).toBe('ai');
    expect(state.winner).toBeNull();
  });

  it('refuses to start battle with an incomplete fleet', () => {
    const state = createGame({ player: smallBoard(), ai: fullBoard() });
    expect(startBattle(state)).toEqual({ ok: false, error: 'fleet-incomplete', state });
  });

  it('refuses to start battle twice', () => {
    const state = battle();
    expect(startBattle(state)).toEqual({ ok: false, error: 'not-in-placement', state });
  });

  it('accepts boards passed to startBattle', () => {
    const state = createGame({ player: createBoard(), ai: createBoard() });
    const out = startBattle(state, { player: fullBoard(), ai: fullBoard() });
    expect(out.ok && out.state.phase).toBe('battle');
  });

  it('rejects shots outside the battle phase', () => {
    const state = createGame({ player: fullBoard(), ai: fullBoard() });
    expect(takeTurn(state, { row: 0, col: 0 })).toEqual({
      ok: false,
      error: 'not-in-battle',
      state,
    });
  });

  it('alternates turns after a hit and after a miss', () => {
    let state = battle();
    expect(state.currentTurn).toBe('player');
    const aiShip = state.boards.ai.ships[0]!.cells[0]!;
    state = turn(state, aiShip); // player hits
    expect(state.currentTurn).toBe('ai');
    state = turn(state, { row: 9, col: 9 }); // ai misses
    expect(state.currentTurn).toBe('player');
    state = turn(state, { row: 0, col: 0 }); // player fires again
    expect(state.currentTurn).toBe('ai');
    state = turn(state, { row: 0, col: 0 }); // ai hits player's carrier
    expect(state.currentTurn).toBe('player');
  });

  it('fires at the opponent board and logs shots per shooter', () => {
    let state = battle();
    state = turn(state, { row: 9, col: 9 });
    state = turn(state, { row: 0, col: 0 });
    expect(state.boards.ai.cells[9]![9]!.shot).toBe(true);
    expect(state.boards.player.cells[9]![9]!.shot).toBe(false);
    expect(state.boards.player.cells[0]![0]!.shot).toBe(true);
    expect(state.shots.player).toEqual([
      { coord: { row: 9, col: 9 }, result: expect.stringMatching(/hit|miss|sunk/) },
    ]);
    expect(state.shots.ai).toEqual([{ coord: { row: 0, col: 0 }, result: 'hit' }]);
  });

  it('keeps the turn and state on an invalid shot', () => {
    let state = battle();
    state = turn(state, { row: 9, col: 9 }); // player
    state = turn(state, { row: 9, col: 9 }); // ai
    const frozen = deepFreeze(state);
    const dup = takeTurn(frozen, { row: 9, col: 9 });
    expect(dup).toEqual({ ok: false, error: 'already-fired', state: frozen });
    expect(dup.state).toBe(frozen);
    const oob = takeTurn(frozen, { row: 10, col: 0 });
    expect(oob).toEqual({ ok: false, error: 'out-of-bounds', state: frozen });
  });

  it('ends the game on the winning shot and rejects further shots', () => {
    let state = battle();
    const targets = shipCoords(state.boards.ai);
    const filler: Coord[] = [];
    for (let r = 0; r < 10 && filler.length < targets.length; r++) {
      for (let c = 0; c < 10 && filler.length < targets.length; c++) {
        if (state.boards.player.cells[r]![c]!.shipType === null) filler.push({ row: r, col: c });
      }
    }
    targets.forEach((coord, i) => {
      expect(state.phase).toBe('battle');
      state = turn(state, coord);
      if (state.phase === 'battle') state = turn(state, filler[i]!);
    });
    expect(state.phase).toBe('over');
    expect(state.winner).toBe('player');
    expect(state.shots.player.at(-1)?.result).toBe('sunk');
    expect(takeTurn(state, { row: 9, col: 9 })).toMatchObject({
      ok: false,
      error: 'not-in-battle',
    });
  });

  it('reports the sunk ship from takeTurn', () => {
    // fullBoard places the destroyer at (8,0)-(8,1)
    const started = startBattle(createGame({ player: fullBoard(), ai: fullBoard() }));
    if (!started.ok) throw new Error('Test setup: cannot start battle');
    let state = turn(started.state, { row: 8, col: 0 });
    state = turn(state, { row: 9, col: 9 });
    const out = takeTurn(state, { row: 8, col: 1 });
    expect(out.ok && out.result).toBe('sunk');
    expect(out.ok && out.sunkShip?.type).toBe('destroyer');
    expect(out.ok && out.state.currentTurn).toBe('ai');
  });
});
