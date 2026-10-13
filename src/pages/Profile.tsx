import { useMemo, useState } from 'react';
import { useApp } from '../store';
import { api } from '../api';
import { AVATAR_COLORS, formatDate, formatDuration, formatRelative } from '../util';
import { GameIcon } from '../components/GameCover';

const DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export default function Profile() {
  const { state, navigate } = useApp();
  const { profile, games, sessions } = state;
  const [name, setName] = useState(profile.name);

  const total = games.reduce((a, g) => a + g.playTimeSec, 0);
  const longest = sessions.reduce((a, s) => Math.max(a, s.seconds), 0);
  const top = useMemo(() => [...games].filter((g) => g.playTimeSec > 0).sort((a, b) => b.playTimeSec - a.playTimeSec).slice(0, 5), [games]);
  const week = useMemo(() => {
    const out: { label: string; sec: number; date: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const next = d.getTime() + 86400000;
      const sec = sessions.filter((s) => s.start >= d.getTime() && s.start < next).reduce((a, s) => a + s.seconds, 0);
      out.push({ label: DAYS[d.getDay()], sec, date: d.toLocaleDateString('ru-RU') });
    }
    return out;
  }, [sessions]);
  const maxDay = Math.max(1, ...week.map((w) => w.sec));
  const recent = [...sessions].reverse().slice(0, 8);
  const gameOf = (id: string) => games.find((g) => g.id === id);
  const color = AVATAR_COLORS[profile.color % AVATAR_COLORS.length];

  return (
    <div className="page scroll">
      <div className="profile-head glass">
        <div className="avatar xl" style={{ background: color }}>{profile.name.charAt(0).toUpperCase()}</div>
        <div className="grow">
          <input
            className="name-input"
            value={name}
            maxLength={24}
            aria-label="Имя игрока"
            onChange={(e) => setName(e.target.value)}
            onBlur={() => api.updateProfile({ name })}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
          <p className="muted">С нами с {formatDate(profile.createdAt)}</p>
          <div className="swatches" role="radiogroup" aria-label="Цвет аватара">
            {AVATAR_COLORS.map((c, i) => (
              <button key={c} role="radio" aria-checked={i === profile.color % AVATAR_COLORS.length} className={'swatch' + (i === profile.color % AVATAR_COLORS.length ? ' on' : '')} style={{ background: c }} onClick={() => api.updateProfile({ color: i })} aria-label={`Цвет ${i + 1}`} />
            ))}
          </div>
        </div>
      </div>

      <div className="stat-row">
        <div className="glass stat-tile"><span className="stat-label">Всего в играх</span><b>{total ? formatDuration(total) : '0 ч'}</b></div>
        <div className="glass stat-tile"><span className="stat-label">Игр в библиотеке</span><b>{games.length}</b></div>
        <div className="glass stat-tile"><span className="stat-label">Сессий</span><b>{sessions.length}</b></div>
        <div className="glass stat-tile"><span className="stat-label">Самая долгая</span><b>{longest ? formatDuration(longest) : '—'}</b></div>
      </div>

      <div className="cards">
        <section className="glass col-span">
          <h3>Последние 7 дней</h3>
          <div className="week">
            {week.map((w, i) => (
              <div key={i} className="week-col" title={`${w.date}: ${w.sec ? formatDuration(w.sec) : 'не играли'}`}>
                <div className="week-bar"><div style={{ height: `${(w.sec / maxDay) * 100}%` }} /></div>
                <span>{w.label}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="glass col-span">
          <h3>Больше всего времени</h3>
          {top.length === 0 ? (
            <p className="muted small-text">Запустите любую игру из лаунчера, и здесь появится статистика.</p>
          ) : (
            <ul className="top-list">
              {top.map((g) => (
                <li key={g.id}>
                  <button className="top-row" onClick={() => navigate({ name: 'library', gameId: g.id })}>
                    <GameIcon game={g} size={30} />
                    <span className="grow">{g.name}</span>
                    <div className="mini-bar"><div style={{ width: `${(g.playTimeSec / top[0].playTimeSec) * 100}%` }} /></div>
                    <b>{formatDuration(g.playTimeSec)}</b>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="glass">
        <h3>История</h3>
        {recent.length === 0 ? <p className="muted small-text">Пока пусто.</p> : (
          <ul className="sessions wide">
            {recent.map((s) => {
              const g = gameOf(s.gameId);
              return (
                <li key={s.start}>
                  <span className="grow">{g ? g.name : 'Удалённая игра'}</span>
                  <span className="muted">{formatRelative(s.start)}</span>
                  <b>{formatDuration(s.seconds)}</b>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
