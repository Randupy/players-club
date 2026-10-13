import { useApp } from '../store';
import { api } from '../api';
import { formatBytes, formatEta } from '../util';
import { IconPause, IconPlay, IconX } from './Icons';

export default function DownloadsPanel() {
  const { state, openModal, setDownloadsOpen, navigate } = useApp();
  const torrents = state.downloads.filter((d) => d.status !== 'done');
  const catalog = Object.entries(state.catalogInstalls).filter(([, c]) => c.phase !== 'done');

  return (
    <div className="panel downloads" role="dialog" aria-label="Загрузки">
      <div className="panel-title">Загрузки</div>
      {torrents.length === 0 && catalog.length === 0 && <p className="muted pad">Сейчас ничего не скачивается.</p>}

      {torrents.map((d) => {
        const game = state.games.find((g) => g.id === d.gameId);
        const paused = d.status === 'paused';
        return (
          <div className="dl-row" key={d.id}>
            <div className="dl-head">
              <button className="link" onClick={() => game && (setDownloadsOpen(false), navigate({ name: 'library', gameId: game.id }))}>{d.name}</button>
              <div className="dl-actions">
                {paused ? (
                  <button className="icon-btn small" onClick={() => api.resumeDownload(d.id)} aria-label="Продолжить"><IconPlay /></button>
                ) : d.status !== 'error' ? (
                  <button className="icon-btn small" onClick={() => api.pauseDownload(d.id)} aria-label="Пауза"><IconPause /></button>
                ) : null}
                <button
                  className="icon-btn small"
                  aria-label="Отменить"
                  onClick={() =>
                    openModal({
                      type: 'confirm',
                      title: 'Отменить загрузку?',
                      text: `«${d.name}» будет удалена из загрузок вместе с уже скачанными файлами.`,
                      okLabel: 'Отменить загрузку',
                      danger: true,
                      onOk: () => api.cancelDownload(d.id)
                    })
                  }
                ><IconX /></button>
              </div>
            </div>
            <div className="bar"><div style={{ width: `${Math.round(d.progress * 100)}%` }} /></div>
            <div className="dl-meta">
              {d.status === 'error' ? (
                <span className="err">{d.error}</span>
              ) : d.status === 'metadata' ? (
                <span>Подключаемся к раздаче…</span>
              ) : paused ? (
                <span>Пауза · {Math.round(d.progress * 100)}%</span>
              ) : (
                <span>
                  {Math.round(d.progress * 100)}% · {formatBytes(d.live?.downloadSpeed || 0)}/с · осталось {formatEta(d.live?.timeRemaining)} · пиры: {d.live?.numPeers ?? 0}
                </span>
              )}
            </div>
          </div>
        );
      })}

      {catalog.map(([id, c]) => (
        <div className="dl-row" key={id}>
          <div className="dl-head"><span>{id}</span></div>
          <div className="bar"><div style={{ width: `${Math.round(c.progress * 100)}%` }} /></div>
          <div className="dl-meta">
            {c.phase === 'error' ? <span className="err">{c.error}</span> : c.phase === 'extracting' ? 'Распаковываем…' : c.phase === 'resolving' ? 'Ищем последнюю версию…' : `${Math.round(c.progress * 100)}% · ${formatBytes(c.speed)}/с`}
          </div>
        </div>
      ))}
    </div>
  );
}
