import type { Game } from '../types';
import { mediaUrl, posterGradient } from '../util';

export function GameIcon({ game, size = 56 }: { game: Pick<Game, 'name' | 'iconFile' | 'coverFile'>; size?: number }) {
  const src = mediaUrl(game.iconFile);
  return (
    <div className="game-icon" style={{ width: size, height: size, background: src ? 'rgba(255,255,255,.08)' : posterGradient(game.name) }}>
      {src ? <img src={src} alt="" /> : <span style={{ fontSize: size * 0.42 }}>{game.name.trim().charAt(0).toUpperCase()}</span>}
    </div>
  );
}

// Постер 2:3. Если нет обложки, рисуем градиент из названия, а по центру показываем иконку игры
export function Cover({ game }: { game: Pick<Game, 'name' | 'iconFile' | 'coverFile'> }) {
  const cover = mediaUrl(game.coverFile);
  if (cover) return <img className="cover-img" src={cover} alt="" draggable={false} />;
  return (
    <div className="cover-gen" style={{ background: posterGradient(game.name) }}>
      <GameIcon game={game} size={64} />
    </div>
  );
}
