import { randomInt, type AIPlayer, type Coord, type Rng } from '../engine';
import { AXES, key, ORTHOGONAL, stateAt, step, type Analysis } from './grid';
import { createPlayer, pick } from './player';

/**
 * Unfired cells just beyond each end of a line of 2+ open hits, starting from the
 * most recent hit's line.
 */
function axisTargets(analysis: Analysis): Coord[] {
  const isOpenHit = (r: number, c: number) => stateAt(analysis, r, c) === 'hit';
  for (let i = analysis.openHits.length - 1; i >= 0; i--) {
    const h = analysis.openHits[i]!;
    for (const axis of AXES) {
      const [dr, dc] = step(axis);
      if (!isOpenHit(h.row + dr, h.col + dc) && !isOpenHit(h.row - dr, h.col - dc)) continue;
      const ends: Coord[] = [];
      for (const sign of [1, -1]) {
        let r = h.row + sign * dr;
        let c = h.col + sign * dc;
        while (isOpenHit(r, c)) {
          r += sign * dr;
          c += sign * dc;
        }
        if (stateAt(analysis, r, c) === 'unknown') ends.push({ row: r, col: c });
      }
      if (ends.length > 0) return ends;
    }
  }
  return [];
}

/**
 * The target queue: in-bounds, unfired orthogonal neighbours of each open hit, in
 * hit order. Hits belonging to sunk ships are not open, so their neighbours drop
 * out of the queue automatically. Returns the neighbours of the oldest hit that
 * still has any.
 */
function queueTargets(analysis: Analysis): Coord[] {
  const queued = new Set<number>();
  for (const h of analysis.openHits) {
    const front: Coord[] = [];
    for (const [dr, dc] of ORTHOGONAL) {
      const r = h.row + dr;
      const c = h.col + dc;
      if (stateAt(analysis, r, c) === 'unknown' && !queued.has(key(r, c))) {
        queued.add(key(r, c));
        front.push({ row: r, col: c });
      }
    }
    if (front.length > 0) return front;
  }
  return [];
}

/** Hunt on a checkerboard; on hits, target neighbours, preferring the hit line's axis. */
export function createMediumAI(rng: Rng): AIPlayer {
  const parity = randomInt(rng, 2);
  return createPlayer(rng, (analysis) => {
    if (analysis.openHits.length > 0) {
      const target = pick(rng, axisTargets(analysis)) ?? pick(rng, queueTargets(analysis));
      if (target) return target;
    }
    const hunt = analysis.unknown.filter((c) => (c.row + c.col) % 2 === parity);
    return pick(rng, hunt.length > 0 ? hunt : analysis.unknown);
  });
}
