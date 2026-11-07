import { SHIP_SIZES, type ShipType } from '../engine';
import { SHIP_SPRITES } from './shipSprites';

export default function ShipIcon({ type }: { readonly type: ShipType }) {
  return (
    <img
      className="ship-icon"
      src={SHIP_SPRITES[type].horizontal}
      alt=""
      style={{ ['--len' as string]: SHIP_SIZES[type] }}
    />
  );
}
