import { useId } from 'react';
import { FLEET, isSunk, type Board } from '../engine';
import { SHIP_NAMES } from '../game/labels';
import ShipIcon from './ShipIcon';

interface ShipStatusProps {
  readonly title: string;
  readonly board: Board;
  /** Show per-cell damage (only for the player's own fleet). */
  readonly showDamage: boolean;
}

export default function ShipStatus({ title, board, showDamage }: ShipStatusProps) {
  const headingId = useId();
  const ships = FLEET.map((type) => board.ships.find((s) => s.type === type)).filter(
    (s) => s !== undefined,
  );
  const afloat = ships.filter((s) => !isSunk(s)).length;

  return (
    <section className="panel ship-status" aria-labelledby={headingId}>
      <h3 id={headingId}>{title}</h3>
      <p className="remaining">
        {afloat} of {ships.length} remaining
      </p>
      <ul>
        {ships.map((ship) => {
          const sunk = isSunk(ship);
          return (
            <li key={ship.type} className={sunk ? 'sunk' : ''}>
              <ShipIcon type={ship.type} />
              <span className="status-name">{SHIP_NAMES[ship.type]}</span>
              <span className="pips" aria-hidden="true">
                {ship.hits.map((hit, i) => (
                  <span key={i} className={`pip ${showDamage && hit ? 'pip-hit' : ''}`} />
                ))}
              </span>
              <span className="sr-only">{sunk ? ', sunk' : ', afloat'}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
