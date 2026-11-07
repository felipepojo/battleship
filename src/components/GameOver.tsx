import { useEffect, useId, useRef } from 'react';
import type { PlayerId, ShotLog } from '../engine';

interface GameOverProps {
  readonly winner: PlayerId;
  readonly playerShots: ShotLog;
  readonly onPlayAgain: () => void;
}

export default function GameOver({ winner, playerShots, onPlayAgain }: GameOverProps) {
  const titleId = useId();
  const descId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const hits = playerShots.filter((s) => s.result !== 'miss').length;
  const accuracy = playerShots.length ? Math.round((hits / playerShots.length) * 100) : 0;

  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  return (
    <div className="overlay">
      <div
        className={`dialog ${winner === 'player' ? 'dialog-win' : 'dialog-lose'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <h2 id={titleId}>{winner === 'player' ? 'You win!' : 'You lose'}</h2>
        <p id={descId}>
          {winner === 'player'
            ? 'You sank the entire enemy fleet.'
            : 'The enemy sank your entire fleet.'}{' '}
          {playerShots.length} shots, {hits} hits ({accuracy}% accuracy).
        </p>
        <button ref={buttonRef} type="button" className="primary" onClick={onPlayAgain}>
          Play again
        </button>
      </div>
    </div>
  );
}
