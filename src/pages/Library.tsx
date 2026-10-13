import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../store';
import { api } from '../api';
import type { Game } from '../types';
import { GameIcon } from '../components/GameCover';
import { IconChevron, IconPause, IconPlay, IconPlus, IconSearch, IconStar, IconX } from '../components/Icons';
import { formatBytes, formatDate, formatDuration, formatEta, formatRelative, mediaUrl, posterGradient } from '../util';

const SOURCES: Record<Game['source'], string> = {
  manual: 'Добавлена вручную',
  torrent: 'Скачана по торрент-ссылке',
  catalog: 'Из каталога Players Club',
  steam: 'Импортирована из Steam',
  epic: 'Импортирована из Epic Games',
  gog: 'Импортирована из GOG'
};

function GamePage({ game }: { game: Game }) {
  const { state, openModal, toast } = useApp();
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const running = state.running.includes(game.id);
  const dl = state.downloads.find((d) => d.id === game.downloadId);
  const sessions = state.sessions.filter((s) => s.gameId === game.id).slice(-6).reverse();
  const cover = mediaUrl(game.coverFile);

  useEffect(() => {
    const close = (e: MouseEvent) => menuRef.current && !menuRef.current.contains(e.target as Node) && setMenu(false);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, []);
  useEffect(() => setMenu(false), [game.id]);

  const primary = (() => {
    switch (game.status) {
      case 'ready':
        return { label: running ? 'В игре' : 'Играть', disabled: running, cls: 'play', run: async () => { const r = await api.play(game.id); if (!r.ok) toast(r.error || 'Не удалось запустить игру'); } };
      case 'needs-setup':
        return { label: 'Установить', disabled: false, cls: 'warn', run: () => api.runSetup(game.id) };
      case 'installing':
      case 'needs-exe':
        return { label: 'Выбрать файл запуска', disabled: false, cls: 'warn', run: () => api.pickExe(game.id) };
      default:
        return { label: 'Скачивается…', disabled: true, cls: 'play', run: () => {} };
    }
  })();

  const remove = () => {
    const managed = game.source === 'torrent' || game.source === 'catalog';
    openModal({
      type: 'confirm',
      title: `Удалить «${game.name}»?`,
      text: managed ? 'Можно убрать игру только из библиотеки или удалить и файлы с диска.' : 'Игра исчезнет из библиотеки. Файлы на диске не затрагиваются.',
      okLabel: managed ? 'Удалить с диска' : 'Убрать из библиотеки',
      danger: true,
      onOk: () => api.removeGame(game.id, managed),
      extra: managed ? { label: 'Только из библиотеки', onOk: () => api.removeGame(game.id, false) } : undefined
    });
  };

  const item = (label: string, fn: () => void, show = true) =>
    show ? <button key={label} role="menuitem" onClick={() => { setMenu(false); fn(); }}>{label}</button> : null;

  return (
    <div className="game-page scroll">
      <div className="banner">
        <div className="banner-bg" style={cover ? { backgroundImage: `url(${cover})` } : { background: posterGradient(game.name) }} />
        <div className="banner-fade" />
        <div className="banner-row">
          <GameIcon game={game} size={78} />
          <div className="banner-title">
            <h1>{game.name}</h1>
            <span>{game.category}</span>
          </div>
          <div className="play-group" ref={menuRef}>
            <button className={'btn big ' + primary.cls} disabled={primary.disabled} onClick={primary.run}>{primary.label}</button>
            <button className={'btn big caret ' + primary.cls} onClick={() => setMenu(!menu)} aria-label="Ещё" aria-haspopup="menu" aria-expanded={menu}><IconChevron /></button>
            {menu && (
              <div className="menu" role="menu">
                {item('Запустить установщик', () => api.runSetup(game.id), !!game.setupPath)}
                {item('Выбрать файл запуска', () => api.pickExe(game.id), game.launch?.type !== 'uri')}
                {item('Открыть папку игры', () => api.openFolder(game.id), !!game.installDir)}
                {item(game.favorite ? 'Убрать из избранного' : 'В избранное', () => api.updateGame(game.id, { favorite: !game.favorite }))}
                {item('Переименовать', () => openModal({ type: 'prompt', title: 'Название игры', value: game.name, okLabel: 'Сохранить', onOk: (v) => api.updateGame(game.id, { name: v }) }))}
                {item('Изменить категорию', () => openModal({ type: 'prompt', title: 'Категория', value: game.category, placeholder: 'Например, Шутеры', okLabel: 'Сохранить', onOk: (v) => api.updateGame(game.id, { category: v }) }))}
                {item('Сменить обложку', () => api.pickCover(game.id))}
                <div className="menu-sep" />
                {item('Удалить', remove)}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="cards">
        <div className="col">
          {dl && dl.status !== 'done' && (
            <section className="glass">
              <h3>Загрузка</h3>
              <div className="bar big"><div style={{ width: `${Math.round(dl.progress * 100)}%` }} /></div>
              <p className="dl-line">
                {dl.status === 'error' ? <span className="err">{dl.error}</span> : dl.status === 'metadata' ? 'Подключаемся к раздаче…' : dl.status === 'paused' ? `Пауза · ${Math.round(dl.progress * 100)}%` : `${Math.round(dl.progress * 100)}% · ${formatBytes(dl.live?.downloadSpeed || 0)}/с · осталось ${formatEta(dl.live?.timeRemaining)}`}
              </p>
              <p className="muted small-text">{formatBytes(dl.downloaded)} из {formatBytes(dl.length)}{dl.live ? ` · пиры: ${dl.live.numPeers}` : ''}</p>
              <div className="row">
                {dl.status === 'paused' ? (
                  <button className="btn small" onClick={() => api.resumeDownload(dl.id)}><IconPlay /> Продолжить</button>
                ) : dl.status !== 'error' ? (
                  <button className="btn small" onClick={() => api.pauseDownload(dl.id)}><IconPause /> Пауза</button>
                ) : null}
                <button className="btn small danger-soft" onClick={() => openModal({ type: 'confirm', title: 'Отменить загрузку?', text: 'Скачанные файлы будут удалены, игра исчезнет из библиотеки.', okLabel: 'Отменить загрузку', danger: true, onOk: () => api.cancelDownload(dl.id) })}><IconX /> Отменить</button>
              </div>
            </section>
          )}

          {game.status === 'needs-setup' && (
            <section className="glass hint">
              <h3>Игра скачана</h3>
              <p>Запустите установщик. Когда установка закончится, нажмите «Выбрать файл запуска» и укажите .exe установленной игры. Дальше лаунчер всё запомнит.</p>
            </section>
          )}
          {game.status === 'installing' && (
            <section className="glass hint">
              <h3>Идёт установка</h3>
              <p>Когда установщик закончит работу, нажмите «Выбрать файл запуска» и укажите .exe игры.</p>
            </section>
          )}
          {game.status === 'needs-exe' && (
            <section className="glass hint">
              <h3>Не нашли файл запуска</h3>
              <p>Укажите .exe игры вручную, и она появится в списке готовых к запуску.</p>
            </section>
          )}

          <section className="glass">
            <h3>Об игре</h3>
            {game.notes && <p className="about">{game.notes}</p>}
            <div className="meta-list">
              <span>{SOURCES[game.source]}</span>
              {game.version && <span>Версия {game.version}</span>}
              {game.installDir && <span className="path" title={game.installDir}>{game.installDir}</span>}
            </div>
            {game.homepage && <button className="link" onClick={() => api.openExternal(game.homepage!)}>Сайт игры</button>}
          </section>
        </div>

        <div className="col">
          <section className="glass stats">
            <div>
              <span className="stat-label">Последний запуск</span>
              <b>{game.lastPlayed ? formatDate(game.lastPlayed) : '—'}</b>
            </div>
            <div>
              <span className="stat-label">Время в игре</span>
              <b>{game.playTimeSec ? formatDuration(game.playTimeSec) : '—'}</b>
            </div>
          </section>
          <section className="glass">
            <h3>Последние сессии</h3>
            {sessions.length === 0 ? (
              <p className="muted small-text">Сессий пока нет. Время начнёт считаться после первого запуска из лаунчера.</p>
            ) : (
              <ul className="sessions">
                {sessions.map((s) => (
                  <li key={s.start}>
                    <span>{formatRelative(s.start)}</span>
                    <b>{formatDuration(s.seconds)}</b>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default function Library({ gameId }: { gameId?: string }) {
  const { state, openModal, navigate } = useApp();
  const [q, setQ] = useState('');
  const [closed, setClosed] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const m = new Map<string, Game[]>();
    for (const g of state.games) {
      if (q && !g.name.toLowerCase().includes(q.toLowerCase())) continue;
      if (!m.has(g.category)) m.set(g.category, []);
      m.get(g.category)!.push(g);
    }
    for (const list of m.values()) list.sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name, 'ru'));
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ru'));
  }, [state.games, q]);

  const lastPlayed = [...state.games].filter((g) => g.lastPlayed).sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0))[0];
  const selected = state.games.find((g) => g.id === gameId) || lastPlayed || groups[0]?.[1][0] || state.games[0];

  return (
    <div className="library">
      <aside className="sidebar">
        <div className="side-search">
          <IconSearch />
          <input placeholder="Поиск" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="side-scroll scroll">
          {groups.map(([cat, list]) => {
            const shut = closed.has(cat);
            return (
              <div key={cat}>
                <button className="side-group" onClick={() => { const n = new Set(closed); shut ? n.delete(cat) : n.add(cat); setClosed(n); }} aria-expanded={!shut}>
                  <span className={'caret-s' + (shut ? ' shut' : '')}><IconChevron /></span>
                  {cat}
                </button>
                {!shut && list.map((g) => (
                  <button key={g.id} className={'side-item' + (selected?.id === g.id ? ' active' : '')} onClick={() => navigate({ name: 'library', gameId: g.id })}>
                    <GameIcon game={g} size={18} />
                    <span className="grow">{g.name}</span>
                    {g.favorite && <span className="fav"><IconStar filled /></span>}
                    {state.running.includes(g.id) && <span className="run-dot" title="В игре" />}
                    {g.status !== 'ready' && <span className="status-dot" title="Требует внимания" />}
                  </button>
                ))}
              </div>
            );
          })}
          {groups.length === 0 && <p className="muted pad small-text">Ничего не найдено</p>}
        </div>
        <button className="side-add" onClick={() => openModal({ type: 'add' })}><IconPlus /> Добавить игру</button>
      </aside>
      <section className="library-main">
        {selected ? <GamePage key={selected.id} game={selected} /> : <p className="muted empty">В библиотеке пока нет игр. Нажмите «Добавить игру».</p>}
      </section>
    </div>
  );
}
