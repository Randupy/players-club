import { useApp } from '../store';
import { api } from '../api';
import type { Page } from '../types';
import { AVATAR_COLORS } from '../util';
import { IconBack, IconClose, IconDownload, IconForward, IconMax, IconMin } from './Icons';
import DownloadsPanel from './DownloadsPanel';

const TABS: { name: Page['name']; label: string }[] = [
  { name: 'home', label: 'Главная' },
  { name: 'library', label: 'Библиотека' },
  { name: 'discover', label: 'Каталог' },
  { name: 'profile', label: 'Профиль' },
  { name: 'settings', label: 'Настройки' }
];

export default function TopBar() {
  const { page, navigate, back, forward, canBack, canForward, state, downloadsOpen, setDownloadsOpen } = useApp();
  const active = state.downloads.filter((d) => d.status === 'downloading' || d.status === 'metadata').length;
  const catalogActive = Object.values(state.catalogInstalls).filter((c) => c.phase === 'downloading' || c.phase === 'extracting' || c.phase === 'resolving').length;
  const busy = active + catalogActive;
  const color = AVATAR_COLORS[state.profile.color % AVATAR_COLORS.length];

  return (
    <header className="topbar">
      <div className="nav-arrows">
        <button className="icon-btn" onClick={back} disabled={!canBack} aria-label="Назад"><IconBack /></button>
        <button className="icon-btn" onClick={forward} disabled={!canForward} aria-label="Вперёд"><IconForward /></button>
      </div>
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.name} className={'tab' + (page.name === t.name ? ' active' : '')} onClick={() => navigate({ name: t.name } as Page)}>
            {t.label}
          </button>
        ))}
      </nav>
      <div className="drag" />
      <div className="topbar-right">
        <div className="dl-wrap">
          <button className={'icon-btn' + (downloadsOpen ? ' on' : '')} onClick={() => setDownloadsOpen(!downloadsOpen)} aria-label="Загрузки">
            <IconDownload />
            {busy > 0 && <span className="badge">{busy}</span>}
          </button>
          {downloadsOpen && <DownloadsPanel />}
        </div>
        <button className="profile-chip" onClick={() => navigate({ name: 'profile' })}>
          <span className="avatar" style={{ background: color }}>{state.profile.name.charAt(0).toUpperCase()}</span>
          <span className="who">
            <b>{state.profile.name}</b>
            <i><span className="dot" />В сети</i>
          </span>
        </button>
        <div className="win-btns">
          <button onClick={() => api.minimize()} aria-label="Свернуть"><IconMin /></button>
          <button onClick={() => api.maximize()} aria-label="Развернуть"><IconMax /></button>
          <button className="close" onClick={() => api.close()} aria-label="Закрыть"><IconClose /></button>
        </div>
      </div>
    </header>
  );
}
