import BattleScreen from './components/BattleScreen';
import GameOver from './components/GameOver';
import PlacementScreen from './components/PlacementScreen';
import { useGame, type GameOptions } from './game/useGame';

export default function Game(options: GameOptions) {
  const game = useGame(options);
  const { state, aiTurn } = game;
  const over = state.game?.phase === 'over';

  return (
    <div className="app">
      <header className="app-header">
        <h1>Battleship</h1>
        <p className="message" role="status" aria-live="polite">
          {state.message}
        </p>
      </header>
      <main inert={over}>
        {state.game ? (
          <BattleScreen
            game={state.game}
            log={state.log}
            aiTurn={aiTurn}
            onFire={game.fireAt}
            onNewGame={game.reset}
          />
        ) : (
          <PlacementScreen
            placement={state.placement}
            difficulty={state.difficulty}
            onSelectShip={game.selectShip}
            onRotate={game.rotate}
            onPlaceAt={game.placeAt}
            onRandomize={game.randomize}
            onReset={game.resetPlacement}
            onDifficultyChange={game.setDifficulty}
            onStart={game.start}
          />
        )}
      </main>
      {over && state.game?.winner && (
        <GameOver
          winner={state.game.winner}
          playerShots={state.game.shots.player}
          onPlayAgain={game.reset}
        />
      )}
    </div>
  );
}
