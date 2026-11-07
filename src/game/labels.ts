import type { Coord, PlayerId, ShipType, ShotResult } from '../engine';

export const SHIP_NAMES: Readonly<Record<ShipType, string>> = {
  carrier: 'Carrier',
  battleship: 'Battleship',
  cruiser: 'Cruiser',
  submarine: 'Submarine',
  destroyer: 'Destroyer',
};

export const COLUMN_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function coordLabel({ row, col }: Coord): string {
  return `${COLUMN_LABELS[col] ?? '?'}${row + 1}`;
}

export function describeShot(
  shooter: PlayerId,
  coord: Coord,
  result: ShotResult,
  sunkShip?: ShipType,
): string {
  const at = coordLabel(coord);
  if (result === 'sunk' && sunkShip) {
    return shooter === 'player'
      ? `You fired at ${at} and sunk the enemy's ${SHIP_NAMES[sunkShip]}!`
      : `Enemy fired at ${at} and sunk your ${SHIP_NAMES[sunkShip]}!`;
  }
  const who = shooter === 'player' ? 'You' : 'Enemy';
  return result === 'hit' ? `${who} fired at ${at}: hit!` : `${who} fired at ${at}: miss.`;
}
