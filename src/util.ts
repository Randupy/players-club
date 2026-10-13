import type { Game } from './types';

export function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function posterGradient(name: string): string {
  const h = hashHue(name);
  return `linear-gradient(155deg, hsl(${h} 55% 42%) 0%, hsl(${(h + 48) % 360} 50% 26%) 55%, hsl(${(h + 100) % 360} 45% 16%) 100%)`;
}

export const mediaUrl = (file: string | null) => (file ? `pcmedia://media/${encodeURIComponent(file)}` : null);

export function formatDuration(sec: number): string {
  if (sec < 60) return `${Math.round(sec)} с`;
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} мин`;
  const h = sec / 3600;
  return h >= 100 ? `${Math.round(h)} ч` : `${h.toFixed(1).replace('.0', '')} ч`;
}

export function formatDate(ts: number | null): string {
  if (!ts) return 'Ещё не запускали';
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatRelative(ts: number | null): string {
  if (!ts) return 'Ещё не запускали';
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days <= 0) return 'Сегодня';
  if (days === 1) return 'Вчера';
  if (days < 7) return `${days} дн. назад`;
  return formatDate(ts);
}

export function formatBytes(n: number): string {
  if (!n) return '0 Б';
  const u = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i > 1 ? 1 : 0)} ${u[i]}`;
}

export function formatEta(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return '—';
  const s = sec / 1000;
  if (s < 60) return `${Math.ceil(s)} с`;
  if (s < 3600) return `${Math.ceil(s / 60)} мин`;
  return `${Math.floor(s / 3600)} ч ${Math.ceil((s % 3600) / 60)} мин`;
}

export const AVATAR_COLORS = ['#7c6cf0', '#2ba974', '#e0714f', '#3b9ae0', '#d452a6', '#c9a227'];

export function statusLabel(g: Game): string {
  switch (g.status) {
    case 'downloading': return 'Скачивается';
    case 'needs-setup': return 'Нужна установка';
    case 'installing': return 'Устанавливается';
    case 'needs-exe': return 'Выберите файл запуска';
    default: return 'Готова к запуску';
  }
}
