import type { CSSProperties } from 'react';
import battleshipH from '../assets/ships/battleship-h.png';
import battleshipV from '../assets/ships/battleship-v.png';
import carrierH from '../assets/ships/carrier-h.png';
import carrierV from '../assets/ships/carrier-v.png';
import cruiserH from '../assets/ships/cruiser-h.png';
import cruiserV from '../assets/ships/cruiser-v.png';
import destroyerH from '../assets/ships/destroyer-h.png';
import destroyerV from '../assets/ships/destroyer-v.png';
import submarineH from '../assets/ships/submarine-h.png';
import submarineV from '../assets/ships/submarine-v.png';
import type { Coord, Ship, ShipType } from '../engine';

interface ShipSprite {
  readonly horizontal: string;
  readonly vertical: string;
  /** Hull width as a fraction of one cell, close to the image's own aspect ratio. */
  readonly beam: number;
}

export const SHIP_SPRITES: Readonly<Record<ShipType, ShipSprite>> = {
  carrier: { horizontal: carrierH, vertical: carrierV, beam: 1 },
  battleship: { horizontal: battleshipH, vertical: battleshipV, beam: 0.6 },
  cruiser: { horizontal: cruiserH, vertical: cruiserV, beam: 0.55 },
  submarine: { horizontal: submarineH, vertical: submarineV, beam: 0.7 },
  destroyer: { horizontal: destroyerH, vertical: destroyerV, beam: 0.45 },
};

/** Background for one cell of a ship: the cell shows its slice of the whole hull image. */
export function shipSpriteStyle(ship: Ship, coord: Coord): CSSProperties {
  const sprite = SHIP_SPRITES[ship.type];
  const length = ship.cells.length;
  const index = ship.cells.findIndex((c) => c.row === coord.row && c.col === coord.col);
  const along = length > 1 ? (index / (length - 1)) * 100 : 50;
  const beam = `${sprite.beam * 100}%`;
  const horizontal = ship.orientation === 'horizontal';
  return {
    '--sprite': `url("${horizontal ? sprite.horizontal : sprite.vertical}")`,
    '--sprite-size': horizontal ? `${length * 100}% ${beam}` : `${beam} ${length * 100}%`,
    '--sprite-pos': horizontal ? `${along}% 50%` : `50% ${along}%`,
  } as CSSProperties;
}
