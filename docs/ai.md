# AI opponents

`createAI(difficulty, rng?)` from `src/ai` returns an `AIPlayer` (interface in `src/engine/ai.ts`).
Pass a seeded RNG (`createRng(seed)`) for fully deterministic play; it defaults to `Math.random`.

## Shared behaviour

Every level rebuilds its view of the board on each `nextMove` call from `shotsAtPlayer`, plus any
results received through `notifyResult` that the log is missing. Each cell is _unknown_, _miss_,
_hit_ (an open hit, not yet attributed to a sunk ship) or _sunk_.

When a shot sinks a ship, the AI works out which ship size it was by comparing
`remainingShipSizes` with the previous call, then marks the straight run of hits through that cell
with that length as sunk. Any other hits stay open, so a ship hit while sinking another is still
chased.

Safety guarantees, for every level and every input:

- the returned cell is always inside `0..9` and has never been fired at;
- if a strategy has no candidate, the AI falls back to a random unfired cell;
- `nextMove` throws only when every cell has already been fired.

## Easy: random

Picks uniformly at random among unfired cells. Averages about 95 shots to win.

## Medium: hunt / target

- **Hunt:** fire at random cells of a single checkerboard colour (chosen randomly at creation).
  Every ship is at least 2 long, so it must cover a cell of each colour. When no cell of that colour
  is left, any unfired cell is used.
- **Target:** after a hit, the in-bounds, unfired orthogonal neighbours of each open hit form the
  target queue (oldest hit first).
- **Axis:** once two open hits line up, fire at the unfired cell just past either end of that line
  first.
- **Sunk:** the sunk ship's cells are no longer open hits, so their neighbours leave the queue. With
  no open hits left, the AI goes back to hunting.

Averages about 51 shots to win.

## Hard: probability density

For each remaining ship size (duplicates counted separately) and both orientations, every placement
that crosses no miss and no sunk cell is counted. Each open hit a placement covers multiplies its
weight by `HIT_WEIGHT` (50). So placements through unresolved hits dominate, and placements through
two lined-up hits dominate even more. Each placement adds its weight to the unfired cells it covers.
The AI fires at the highest-density cell and breaks ties with the RNG.

Averages about 45 shots to win.

## Tests

`src/ai/simulation.test.ts` plays 500 seeded games per level against random fleets. It checks that
there are no duplicate or out-of-bounds shots, that every game ends, and that average shots to win
go hard < medium < easy. The averages are printed to the console.
