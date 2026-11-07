# Battleship

Single-player Battleship against an AI. Fully static: Vite + React + TypeScript, no backend.

## Scripts

| Command             | Description                     |
| ------------------- | ------------------------------- |
| `npm run dev`       | Start the Vite dev server       |
| `npm run build`     | Type-check and build to `dist/` |
| `npm run lint`      | ESLint                          |
| `npm run typecheck` | `tsc -b` with no output         |
| `npm run test`      | Run Vitest once                 |
| `npm run format`    | Format with Prettier            |

## Layout

- `src/engine/` — pure, immutable game engine (no React, no DOM). Import from `src/engine`.
  - `types.ts` — domain types and fleet constants
  - `board.ts` — board creation, placement validation, random fleet layout
  - `game.ts` — firing, sink/win detection, turn flow
  - `rng.ts` — seedable RNG for deterministic tests
  - `ai.ts` — `AIPlayer` interface (implementation lives elsewhere)

## Rules

10x10 grid. Fleet: Carrier 5, Battleship 4, Cruiser 3, Submarine 3, Destroyer 2. Ships may touch but not overlap. Turns alternate after every shot, hit or miss.
