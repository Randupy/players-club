import { useEffect, useState } from 'react';
import { useApp } from '../store';
import { api } from '../api';
import type { CatalogEntry } from '../types';
import { posterGradient, formatBytes } from '../util';

export default function Discover() {
  const { state, navigate } = useApp();
  const [list, setList] = useState<CatalogEntry[] | null>(null);
  const [q, setQ] = useState('');
  useEffect(() => { api.catalog().then(setList); }, [state.settings.catalogUrl]);

  const shown = (list || []).filter((c) => (c.name + c.category + c.tags.join(' ')).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="page scroll">
      <div className="page-head">
        <div>
          <h1>Каталог</h1>
          <p className="muted">Свободные и бесплатные игры. Лаунчер сам скачает последнюю версию, распакует её и добавит в библиотеку.</p>
        </div>
        <input className="input search" placeholder="Поиск по названию или жанру" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {!list && <p className="muted">Загружаем каталог…</p>}
      <div className="catalog-grid">
        {shown.map((c) => {
          const inst = state.catalogInstalls[c.id];
          const game = state.games.find((g) => g.catalogId === c.id);
          const working = inst && ['resolving', 'downloading', 'extracting'].includes(inst.phase);
          return (
            <article key={c.id} className="catalog-card">
              <div className="catalog-art" style={{ background: posterGradient(c.name) }}><span>{c.name.charAt(0)}</span></div>
              <div className="catalog-body">
                <h3>{c.name}</h3>
                <div className="chips">
                  <span className="tag">{c.category}</span>
                  {c.license && <span className="tag soft">{c.license}</span>}
                </div>
                <p>{c.description}</p>
                <div className="catalog-actions">
                  {game ? (
                    <button className="btn" onClick={() => navigate({ name: 'library', gameId: game.id })}>В библиотеке</button>
                  ) : working ? (
                    <div className="inline-progress">
                      <div className="bar"><div style={{ width: `${Math.round(inst.progress * 100)}%` }} /></div>
                      <span>{inst.phase === 'resolving' ? 'Ищем версию…' : inst.phase === 'extracting' ? 'Распаковка…' : `${Math.round(inst.progress * 100)}% · ${formatBytes(inst.speed)}/с`}</span>
                    </div>
                  ) : (
                    <button className="btn primary" onClick={() => api.installFromCatalog(c.id)}>Установить</button>
                  )}
                  {inst?.phase === 'error' && !working && <span className="err small-text">{inst.error}</span>}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
