export type GameStatus = 'ready' | 'downloading' | 'needs-setup' | 'needs-exe' | 'installing';

export interface Game {
  id: string;
  name: string;
  category: string;
  source: 'manual' | 'torrent' | 'catalog' | 'steam' | 'epic' | 'gog';
  status: GameStatus;
  installDir: string | null;
  launch: { type: 'exe'; exePath: string } | { type: 'uri'; uri: string } | null;
  setupPath: string | null;
  coverFile: string | null;
  iconFile: string | null;
  playTimeSec: number;
  lastPlayed: number | null;
  addedAt: number;
  favorite: boolean;
  notes: string;
  tags: string[];
  downloadId?: string;
  catalogId?: string;
  version?: string;
  homepage?: string | null;
}

export interface Download {
  id: string;
  name: string;
  status: 'metadata' | 'downloading' | 'paused' | 'done' | 'error';
  progress: number;
  downloaded: number;
  length: number;
  gameId: string | null;
  error: string | null;
  live: { downloadSpeed: number; uploadSpeed: number; numPeers: number; timeRemaining: number | null } | null;
}

export interface Session {
  gameId: string;
  start: number;
  seconds: number;
}

export interface Profile {
  name: string;
  color: number;
  createdAt: number;
}

export interface Settings {
  downloadDir: string;
  gamesDir: string;
  speedLimitMB: number;
  autoUpdate: boolean;
  catalogUrl: string;
}

export interface CatalogEntry {
  id: string;
  name: string;
  category: string;
  tags: string[];
  description: string;
  repo: string;
  license?: string;
  homepage?: string;
}

export interface CatalogInstall {
  phase: 'resolving' | 'downloading' | 'extracting' | 'done' | 'error';
  progress: number;
  speed: number;
  error: string | null;
}

export interface UpdaterState {
  status: 'idle' | 'dev' | 'checking' | 'downloading' | 'ready' | 'latest' | 'error';
  version?: string;
  percent?: number;
  error?: string;
}

export interface ImportCandidate {
  key: string;
  name: string;
  source: 'steam' | 'epic' | 'gog';
  installDir: string;
  launch: Game['launch'];
  coverSrc: string | null;
  already: boolean;
}

export interface AppState {
  profile: Profile;
  settings: Settings;
  games: Game[];
  sessions: Session[];
  downloads: Download[];
  running: string[];
  catalogInstalls: Record<string, CatalogInstall>;
  updater: UpdaterState;
  version: string;
  maximized: boolean;
}

export type Page = { name: 'home' } | { name: 'library'; gameId?: string } | { name: 'discover' } | { name: 'profile' } | { name: 'settings' };
