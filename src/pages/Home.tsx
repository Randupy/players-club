import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../store';
import { api } from '../api';
import type { CatalogEntry, Game } from '../types';
import Poster from '../components/Poster';
import { IconPlus } from '../components/Icons';
import { formatRelative } from '../util';
import { Cover } from '../components/GameCover';

// Рекомендации: чем больше вы играли в игры с похожими тегами и жанром, тем выше игра в списке
function recommend(catalog: CatalogEntry[], games: Game[]): CatalogEntry[] {
  const owned = new Set(games.map((g) => g.catalogId).filter(Boolean));
  const weight = new Map<string, number>();
  for (const g of games) {
    const w = 1 + Math.log10(1 + g.playTimeSec / 60);
    for (const t of g.tags || []) weight.set(t, (weight.get(t) || 0) + w);
    weight.set(g.category, (weight.get(g.category) || 0) + w);
  }
  return catalog
    .filter((c) => !owned.has(c.id))
    .map((c) => ({ c, s: [...c.tags, c.category].reduce((a, t) => a + (weight.get(t) || 0), 0) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.c);
}

export default function Home() {
  const { state, navigate, openModal } = useApp();
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  useEffect(() => { api.catalog().then(setCatalog).catch(() => {}); }, []);

  const recent = useMemo(
    () => state.games.filter((g) => g.lastPlayed && g.status === 'ready').sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0)).slice(0, 3),
    [state.games]
  );
  const rec = useMemo(() => recommend(catalog, state.games).slice(0, 5), [catalog, state.games]);
  const all = useMemo(() => [...state.games].sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name, 'ru')), [state.games]);
  const open = (id: string) => navigate({ name: 'library', gameId: id });

  return (
    <div className="page scroll">
      {recent.length > 0 && (
        <section>
          <h2 className="section-title">Продолжить</h2>
          <div className="continue-row">
            {recent.map((g) => (
              <button key={g.id} className="continue-card" onClick={() => open(g.id)}>
                <div className="continue-art"><Cover game={g} /></div>
                <div className="continue-text">
                  <b>{g.name}</b>
                  <span>{formatRelative(g.lastPlayed)}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="section-title">Мои игры</h2>
        <div className="poster-grid">
          {all.map((g) => (
            <Poster key={g.id} game={g} running={state.running.includes(g.id)} onClick={() => open(g.id)} />
          ))}
          <button className="poster add" onClick={() => openModal({ type: 'add' })} aria-label="Добавить игру">
            <IconPlus />
            <span>Добавить игру</span>
          </button>
        </div>
        {all.length === 0 && <p className="muted empty">Здесь пока пусто. Вставьте magnet-ссылку, выберите .torrent, импортируйте игры из Steam или Epic, либо установите что-нибудь из каталога.</p>}
      </section>

      {rec.length > 0 && (
        <section>
          <h2 className="section-title">Рекомендуем попробовать</h2>
          <div className="rec-row">
            {rec.map((c) => (
              <button key={c.id} className="rec-card" onClick={() => navigate({ name: 'discover' })}>
                <b>{c.name}</b>
                <span>{c.category}</span>
                <p>{c.description}</p>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
