import { useId } from 'react';
import { describeShot } from '../game/labels';
import type { LogEntry } from '../game/state';

export default function MoveLog({ log }: { readonly log: readonly LogEntry[] }) {
  const headingId = useId();
  return (
    <section className="panel move-log" aria-labelledby={headingId}>
      <h3 id={headingId}>Move log</h3>
      {log.length === 0 ? (
        <p className="hint">No shots fired yet.</p>
      ) : (
        <ol reversed>
          {[...log].reverse().map((entry) => (
            <li key={entry.id} className={`log-${entry.shooter} log-${entry.result}`}>
              {describeShot(entry.shooter, entry.coord, entry.result, entry.sunkShip)}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
