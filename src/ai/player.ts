import {
  randomInt,
  type AIPlayer,
  type Coord,
  type Rng,
  type ShotLog,
  type ShotRecord,
} from '../engine';
import { analyzeShots, FLEET_SIZES, inBounds, key, multisetDiff, type Analysis } from './grid';

/** Picks the next cell, or null to fall back to a random unfired cell. */
export type Strategy = (analysis: Analysis, remainingShipSizes: readonly number[]) => Coord | null;

/**
 * Learns which ship size each sunk shot destroyed by diffing `remainingShipSizes`
 * between consecutive calls (one AI shot per turn means at most one new sink).
 */
class SunkSizeTracker {
  private prevRemaining: readonly number[] = FLEET_SIZES;
  private prevLength = 0;
  private known = new Map<number, number>();

  update(log: ShotLog, remaining: readonly number[]): ReadonlyMap<number, number> {
    if (log.length < this.prevLength) {
      this.prevRemaining = FLEET_SIZES;
      this.prevLength = 0;
      this.known = new Map();
    }
    const newSunk: number[] = [];
    for (let i = this.prevLength; i < log.length; i++) {
      if (log[i]!.result === 'sunk') newSunk.push(i);
    }
    const gone = multisetDiff(this.prevRemaining, remaining);
    if (newSunk.length === 1 && gone.length === 1) this.known.set(newSunk[0]!, gone[0]!);
    this.prevRemaining = [...remaining];
    this.prevLength = log.length;
    return this.known;
  }
}

/** `shots` plus any in-bounds notified results it is missing. */
function mergeLogs(shots: ShotLog, notified: readonly ShotRecord[]): ShotLog {
  if (notified.length === 0) return shots;
  const valid = ({ coord }: ShotRecord) => inBounds(coord.row, coord.col);
  const seen = new Set(shots.filter(valid).map(({ coord }) => key(coord.row, coord.col)));
  const extra = notified.filter((record) => {
    if (!valid(record)) return false;
    const k = key(record.coord.row, record.coord.col);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return extra.length > 0 ? [...shots, ...extra] : shots;
}

/**
 * Wraps a strategy with the guarantees every level shares: the returned cell is
 * always in bounds and unfired (per both `shotsAtPlayer` and `notifyResult`),
 * falling back to a random unfired cell. Throws only when no unfired cell exists.
 */
export function createPlayer(rng: Rng, strategy: Strategy): AIPlayer {
  const tracker = new SunkSizeTracker();
  let notified: ShotRecord[] = [];
  let lastShotsLength = 0;

  return {
    nextMove(shotsAtPlayer, remainingShipSizes) {
      if (shotsAtPlayer.length < lastShotsLength) notified = [];
      lastShotsLength = shotsAtPlayer.length;

      const log = mergeLogs(shotsAtPlayer, notified);
      const sizes = remainingShipSizes.filter((s) => Number.isInteger(s) && s > 0);
      const analysis = analyzeShots(log, sizes, tracker.update(log, sizes));
      if (analysis.unknown.length === 0) throw new Error('No unfired cells left');

      const choice = strategy(analysis, sizes);
      if (
        choice &&
        inBounds(choice.row, choice.col) &&
        analysis.grid[choice.row]![choice.col] === 'unknown'
      ) {
        return { row: choice.row, col: choice.col };
      }
      const fallback = analysis.unknown[randomInt(rng, analysis.unknown.length)]!;
      return { row: fallback.row, col: fallback.col };
    },
    notifyResult(coord, result) {
      notified.push({ coord: { row: coord.row, col: coord.col }, result });
    },
  };
}

export function pick<T>(rng: Rng, items: readonly T[]): T | null {
  return items.length > 0 ? items[randomInt(rng, items.length)]! : null;
}
