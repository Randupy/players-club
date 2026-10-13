import { useState } from 'react';
import { useApp } from '../store';
import { api } from '../api';

function Folder({ label, value, onPick }: { label: string; value: string; onPick: (p: string) => void }) {
  return (
    <div className="setting">
      <div className="grow">
        <b>{label}</b>
        <span className="path" title={value}>{value}</span>
      </div>
      <button className="btn small" onClick={async () => { const p = await api.pickDir(value); if (p) onPick(p); }}>Изменить</button>
    </div>
  );
}

export default function Settings() {
  const { state, openModal } = useApp();
  const { settings, updater, version } = state;
  const [speed, setSpeed] = useState(String(settings.speedLimitMB || ''));
  const [catalogUrl, setCatalogUrl] = useState(settings.catalogUrl);

  const updText = (() => {
    switch (updater.status) {
      case 'checking': return 'Проверяем…';
      case 'downloading': return `Загружается версия ${updater.version ?? ''} ${updater.percent ?? 0}%`;
      case 'ready': return `Версия ${updater.version} готова к установке`;
      case 'latest': return 'У вас последняя версия';
      case 'dev': return 'В режиме разработки обновления отключены';
      case 'error': return 'Не удалось проверить обновления';
      default: return '';
    }
  })();

  return (
    <div className="page scroll narrow">
      <h1>Настройки</h1>

      <section className="glass">
        <h3>Папки</h3>
        <Folder label="Загрузки" value={settings.downloadDir} onPick={(p) => api.updateSettings({ downloadDir: p })} />
        <Folder label="Установленные игры из каталога" value={settings.gamesDir} onPick={(p) => api.updateSettings({ gamesDir: p })} />
        <p className="muted small-text">Новые папки применяются к следующим загрузкам. Уже скачанные игры остаются на месте.</p>
      </section>

      <section className="glass">
        <h3>Скорость загрузки</h3>
        <div className="setting">
          <div className="grow">
            <b>Ограничение, МБ/с</b>
            <span className="muted small-text">Пусто или 0 — без ограничения</span>
          </div>
          <input
            className="input num"
            inputMode="decimal"
            value={speed}
            onChange={(e) => setSpeed(e.target.value.replace(',', '.').replace(/[^0-9.]/g, ''))}
            onBlur={() => api.updateSettings({ speedLimitMB: Number(speed) || 0 })}
            aria-label="Ограничение скорости, МБ/с"
          />
        </div>
      </section>

      <section className="glass">
        <h3>Обновления Players Club</h3>
        <div className="setting">
          <div className="grow">
            <b>Версия {version}</b>
            <span className="muted small-text">{updText}</span>
          </div>
          {updater.status === 'ready' ? (
            <button className="btn small primary" onClick={() => api.installUpdate()}>Перезапустить и обновить</button>
          ) : (
            <button className="btn small" onClick={() => api.checkUpdates()}>Проверить</button>
          )}
        </div>
        <label className="setting">
          <div className="grow">
            <b>Обновляться автоматически</b>
            <span className="muted small-text">Лаунчер проверяет обновления при запуске и раз в несколько часов</span>
          </div>
          <input type="checkbox" className="switch" checked={settings.autoUpdate} onChange={(e) => api.updateSettings({ autoUpdate: e.target.checked })} />
        </label>
      </section>

      <section className="glass">
        <h3>Каталог игр</h3>
        <div className="setting stack">
          <b>Свой каталог (необязательно)</b>
          <input className="input" placeholder="https://…/catalog.json" value={catalogUrl} onChange={(e) => setCatalogUrl(e.target.value)} onBlur={() => api.updateSettings({ catalogUrl: catalogUrl.trim() })} />
          <span className="muted small-text">Ссылка на JSON-список игр с GitHub Releases. Формат такой же, как у встроенного каталога.</span>
        </div>
      </section>

      <section className="glass">
        <h3>Библиотека</h3>
        <div className="setting">
          <div className="grow">
            <b>Импорт из Steam, Epic Games и GOG</b>
            <span className="muted small-text">Установленные игры появятся в общей библиотеке, время в них тоже считается</span>
          </div>
          <button className="btn small" onClick={() => openModal({ type: 'import' })}>Найти игры</button>
        </div>
      </section>
    </div>
  );
}
