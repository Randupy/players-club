import type { Game } from '../types';
import { Cover } from './GameCover';
import { IconArrowDown, IconCheck } from './Icons';

export default function Poster({ game, running, onClick }: { game: Game; running: boolean; onClick: () => void }) {
  const tone = game.status === 'ready' ? 'ok' : game.status === 'downloading' ? 'busy' : 'warn';
  return (
    <button className={'poster' + (running ? ' running' : '')} onClick={onClick} title={game.name}>
      <Cover game={game} />
      <span className={'corner ' + tone}>{game.status === 'ready' ? <IconCheck /> : <IconArrowDown />}</span>
      {running && <span className="live-dot">В игре</span>}
      <span className="poster-label">{game.name}</span>
    </button>
  );
}
