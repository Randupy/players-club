import type { AppState, CatalogEntry, ImportCandidate, Game } from './types';

declare global {
  interface Window {
    pc: {
      call: (name: string, ...args: unknown[]) => Promise<any>;
      on: (channel: string, cb: (payload: any) => void) => () => void;
    };
  }
}

const call = (name: string, ...args: unknown[]) => window.pc.call(name, ...args);

export const api = {
  state: (): Promise<AppState> => call('state'),
  on: (channel: string, cb: (p: any) => void) => window.pc.on(channel, cb),

  minimize: () => call('win:minimize'),
  maximize: () => call('win:maximize'),
  close: () => call('win:close'),
  openExternal: (url: string) => call('openExternal', url),

  updateProfile: (patch: { name?: string; color?: number }) => call('profile:update', patch),
  updateSettings: (patch: Record<string, unknown>) => call('settings:update', patch),
  pickDir: (current?: string): Promise<string | null> => call('pickDir', current),

  play: (id: string): Promise<{ ok: boolean; error?: string }> => call('game:play', id),
  updateGame: (id: string, patch: Partial<Pick<Game, 'name' | 'category' | 'favorite' | 'notes'>>) => call('game:update', id, patch),
  openFolder: (id: string) => call('game:openFolder', id),
  runSetup: (id: string) => call('game:runSetup', id),
  pickExe: (id: string) => call('game:pickExe', id),
  pickCover: (id: string) => call('game:pickCover', id),
  removeGame: (id: string, deleteFiles: boolean) => call('game:remove', id, deleteFiles),
  addManual: (): Promise<string | null> => call('game:addManual'),

  addMagnet: (uri: string): Promise<{ ok: boolean; id?: string; error?: string }> => call('download:addMagnet', uri),
  addTorrentFile: (): Promise<{ ok: boolean; id?: string; error?: string } | null> => call('download:addFile'),
  pauseDownload: (id: string) => call('download:pause', id),
  resumeDownload: (id: string) => call('download:resume', id),
  cancelDownload: (id: string) => call('download:cancel', id),

  catalog: (): Promise<CatalogEntry[]> => call('catalog:list'),
  installFromCatalog: (id: string) => call('catalog:install', id),

  scanImports: (): Promise<ImportCandidate[]> => call('import:scan'),
  addImports: (items: ImportCandidate[]) => call('import:add', items),

  checkUpdates: () => call('updater:check'),
  installUpdate: () => call('updater:install')
};
