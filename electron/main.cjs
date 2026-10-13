const { app, BrowserWindow, ipcMain, dialog, shell, protocol, net, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { createStore } = require('./store.cjs');
const { createTorrentManager } = require('./torrents.cjs');
const { createTracker } = require('./tracker.cjs');
const { classify } = require('./exe-detect.cjs');
const { scanAll } = require('./importers.cjs');
const catalogLib = require('./catalog.cjs');

protocol.registerSchemesAsPrivileged([{ scheme: 'pcmedia', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

let win = null;
let store, torrents, tracker;
let coversDir;
let catalogCache = [];
const catalogInstalls = {}; // entryId -> { phase, progress, speed, error }
let updaterState = { status: 'idle' };
let autoUpdater = null;

const isDev = !app.isPackaged && process.env.PC_DEV === '1';

function emit(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send('pc:' + channel, payload);
}

const uid = () => 'g_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const getGame = (id) => store.get().games.find((g) => g.id === id);
const pushGames = () => emit('games', store.get().games);

function safeName(s) {
  return String(s).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim().slice(0, 80) || 'game';
}

function isInside(child, parent) {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

async function saveIcon(game) {
  const exe = game.launch && game.launch.type === 'exe' ? game.launch.exePath : null;
  if (!exe) return;
  try {
    const img = await app.getFileIcon(exe, { size: 'large' });
    if (img.isEmpty()) return;
    const file = `icon_${game.id}.png`;
    fs.writeFileSync(path.join(coversDir, file), img.toPNG());
    game.iconFile = file;
  } catch (_) {}
}

function newGame(partial) {
  return {
    id: uid(),
    name: 'Игра',
    category: 'Мои игры',
    source: 'manual',
    status: 'ready', // ready | downloading | needs-setup | needs-exe | installing
    installDir: null,
    launch: null,
    setupPath: null,
    coverFile: null,
    iconFile: null,
    playTimeSec: 0,
    lastPlayed: null,
    addedAt: Date.now(),
    favorite: false,
    notes: '',
    tags: [],
    ...partial
  };
}

// Что делать, когда торрент докачался
async function finalizeDownload(rec) {
  const game = rec.gameId ? getGame(rec.gameId) : null;
  if (!game) return;
  let dir = rec.rootDir;
  const settings = store.get().settings;

  if (rec.singleFile) {
    const f = rec.singleFile;
    if (/\.zip$/i.test(f)) {
      game.status = 'installing';
      pushGames();
      const target = path.join(settings.gamesDir, safeName(game.name));
      try {
        await catalogLib.unzip(f, target);
        dir = target;
      } catch (e) {
        game.status = 'needs-exe';
        game.notes = 'Не удалось распаковать архив: ' + e.message;
        store.save();
        return pushGames();
      }
    } else if (/\.exe$/i.test(f)) {
      if (/setup|install/i.test(path.basename(f))) {
        game.status = 'needs-setup';
        game.setupPath = f;
        game.installDir = path.dirname(f);
      } else {
        game.status = 'ready';
        game.launch = { type: 'exe', exePath: f };
        game.installDir = path.dirname(f);
        await saveIcon(game);
      }
      store.save();
      return pushGames();
    } else {
      game.status = 'needs-exe';
      game.installDir = path.dirname(f);
      store.save();
      return pushGames();
    }
  }

  if (!dir) {
    game.status = 'needs-exe';
    store.save();
    return pushGames();
  }
  game.installDir = dir;
  const res = classify(dir, game.name);
  if (res.kind === 'game') {
    game.status = 'ready';
    game.launch = { type: 'exe', exePath: res.exe };
    game.setupPath = res.setup;
    await saveIcon(game);
  } else if (res.kind === 'setup') {
    game.status = 'needs-setup';
    game.setupPath = res.setup;
  } else {
    game.status = 'needs-exe';
  }
  store.save();
  pushGames();
}

async function installFromCatalog(entryId) {
  const entry = catalogCache.find((e) => e.id === entryId);
  if (!entry) throw new Error('Игра не найдена в каталоге');
  if (store.get().games.some((g) => g.catalogId === entryId)) return;
  const st = (patch) => {
    catalogInstalls[entryId] = { ...(catalogInstalls[entryId] || {}), ...patch };
    emit('catalogInstalls', catalogInstalls);
  };
  const settings = store.get().settings;
  try {
    st({ phase: 'resolving', progress: 0, speed: 0, error: null });
    const rel = await catalogLib.resolveRelease(entry);
    const file = path.join(settings.downloadDir, rel.asset.name);
    st({ phase: 'downloading' });
    await catalogLib.downloadFile(rel.asset.browser_download_url, file, ({ got, total, speed }) => {
      st({ progress: total ? got / total : 0, speed });
    });
    const game = newGame({
      name: entry.name,
      category: entry.category || 'Каталог',
      source: 'catalog',
      catalogId: entry.id,
      tags: entry.tags || [],
      version: rel.tag,
      notes: (rel.notes || entry.description || '').slice(0, 4000),
      homepage: entry.homepage || null
    });
    if (/\.zip$/i.test(file)) {
      st({ phase: 'extracting' });
      const target = path.join(settings.gamesDir, safeName(entry.name));
      await catalogLib.unzip(file, target);
      try {
        fs.rmSync(file, { force: true });
      } catch (_) {}
      game.installDir = target;
      const res = classify(target, entry.name);
      if (res.kind === 'game') {
        game.launch = { type: 'exe', exePath: res.exe };
        await saveIcon(game);
      } else game.status = 'needs-exe';
    } else {
      game.status = 'needs-setup';
      game.setupPath = file;
      game.installDir = path.dirname(file);
    }
    store.get().games.push(game);
    store.save();
    pushGames();
    st({ phase: 'done', progress: 1 });
  } catch (e) {
    st({ phase: 'error', error: String(e.message || e) });
  }
}

function setupUpdater() {
  if (!app.isPackaged) return;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch (e) {
    return;
  }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  const set = (s) => {
    updaterState = s;
    emit('updater', s);
  };
  autoUpdater.on('checking-for-update', () => set({ status: 'checking' }));
  autoUpdater.on('update-available', (i) => set({ status: 'downloading', version: i.version, percent: 0 }));
  autoUpdater.on('update-not-available', () => set({ status: 'latest' }));
  autoUpdater.on('download-progress', (p) => set({ status: 'downloading', version: updaterState.version, percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (i) => set({ status: 'ready', version: i.version }));
  autoUpdater.on('error', (e) => set({ status: 'error', error: String(e && e.message ? e.message : e) }));
  const check = () => {
    if (store.get().settings.autoUpdate) autoUpdater.checkForUpdates().catch(() => {});
  };
  setTimeout(check, 8000);
  setInterval(check, 4 * 60 * 60 * 1000);
}

function fullState() {
  const s = store.get();
  return {
    profile: s.profile,
    settings: s.settings,
    games: s.games,
    sessions: s.sessions,
    downloads: torrents.snapshot(),
    running: tracker.list(),
    catalogInstalls,
    updater: updaterState,
    version: app.getVersion(),
    maximized: !!(win && win.isMaximized())
  };
}

function registerIpc() {
  const h = (name, fn) => ipcMain.handle('pc:' + name, async (_e, ...args) => fn(...args));

  h('state', () => fullState());

  // Окно
  h('win:minimize', () => win.minimize());
  h('win:maximize', () => (win.isMaximized() ? win.unmaximize() : win.maximize()));
  h('win:close', () => win.close());
  h('openExternal', (url) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
  });

  // Профиль и настройки
  h('profile:update', (patch) => {
    const p = store.get().profile;
    if (typeof patch.name === 'string') p.name = patch.name.trim().slice(0, 24) || 'Player';
    if (typeof patch.color === 'number') p.color = patch.color;
    store.save();
    emit('profile', p);
  });
  h('settings:update', (patch) => {
    Object.assign(store.get().settings, patch);
    store.save();
    torrents.applySettings();
    emit('settings', store.get().settings);
  });
  h('pickDir', async (current) => {
    const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'], defaultPath: current });
    return r.canceled ? null : r.filePaths[0];
  });

  // Игры
  h('game:play', async (id) => {
    const g = getGame(id);
    if (!g) return { ok: false, error: 'Игра не найдена' };
    if (g.status !== 'ready') return { ok: false, error: 'Игра ещё не готова к запуску' };
    return tracker.play(g);
  });
  h('game:update', (id, patch) => {
    const g = getGame(id);
    if (!g) return;
    for (const k of ['name', 'category', 'favorite', 'notes']) if (k in patch) g[k] = patch[k];
    store.save();
    pushGames();
  });
  h('game:openFolder', (id) => {
    const g = getGame(id);
    if (g && g.installDir) shell.openPath(g.installDir);
  });
  h('game:runSetup', async (id) => {
    const g = getGame(id);
    if (!g || !g.setupPath) return;
    g.status = 'installing';
    store.save();
    pushGames();
    await shell.openPath(g.setupPath); // системный запуск, Windows сам спросит права администратора
  });
  h('game:pickExe', async (id) => {
    const g = getGame(id);
    if (!g) return;
    const r = await dialog.showOpenDialog(win, {
      title: 'Выберите файл запуска игры',
      properties: ['openFile'],
      filters: [{ name: 'Программы', extensions: ['exe', 'lnk', 'bat'] }],
      defaultPath: g.installDir || undefined
    });
    if (r.canceled) return;
    g.launch = { type: 'exe', exePath: r.filePaths[0] };
    if (!g.installDir || g.status === 'installing' || g.status === 'needs-setup') g.installDir = path.dirname(r.filePaths[0]);
    g.status = 'ready';
    await saveIcon(g);
    store.save();
    pushGames();
  });
  h('game:pickCover', async (id) => {
    const g = getGame(id);
    if (!g) return;
    const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Изображения', extensions: ['png', 'jpg', 'jpeg', 'webp'] }] });
    if (r.canceled) return;
    const ext = path.extname(r.filePaths[0]).toLowerCase();
    const file = `cover_${g.id}_${Date.now()}${ext}`;
    fs.copyFileSync(r.filePaths[0], path.join(coversDir, file));
    g.coverFile = file;
    store.save();
    pushGames();
  });
  h('game:remove', async (id, deleteFiles) => {
    const g = getGame(id);
    if (!g) return;
    const s = store.get();
    const dl = s.downloads.find((d) => d.gameId === id);
    if (dl) await torrents.remove(dl.id, !!deleteFiles);
    if (deleteFiles && g.installDir && ['torrent', 'catalog'].includes(g.source)) {
      const managed = [s.settings.gamesDir, s.settings.downloadDir];
      if (managed.some((m) => isInside(g.installDir, m))) {
        try {
          fs.rmSync(g.installDir, { recursive: true, force: true });
        } catch (_) {}
      }
    }
    s.games = s.games.filter((x) => x.id !== id);
    store.save();
    pushGames();
  });
  h('game:addManual', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: 'Выберите .exe игры',
      properties: ['openFile'],
      filters: [{ name: 'Программы', extensions: ['exe'] }]
    });
    if (r.canceled) return null;
    const exe = r.filePaths[0];
    const g = newGame({
      name: path.basename(exe, '.exe'),
      source: 'manual',
      installDir: path.dirname(exe),
      launch: { type: 'exe', exePath: exe }
    });
    await saveIcon(g);
    store.get().games.push(g);
    store.save();
    pushGames();
    return g.id;
  });

  // Загрузки (magnet / .torrent, который пользователь добавил сам)
  async function addTorrentGame(source, name) {
    const g = newGame({ name: name || 'Новая игра', source: 'torrent', status: 'downloading', category: 'Загрузки' });
    store.get().games.push(g);
    try {
      const rec = await torrents.add(source, { name, gameId: g.id });
      g.downloadId = rec.id;
      g.name = rec.name;
    } catch (e) {
      store.get().games = store.get().games.filter((x) => x.id !== g.id);
      store.save();
      pushGames();
      throw e;
    }
    store.save();
    pushGames();
    return g.id;
  }
  h('download:addMagnet', async (uri) => {
    try {
      return { ok: true, id: await addTorrentGame({ type: 'magnet', uri }) };
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
  });
  h('download:addFile', async () => {
    const r = await dialog.showOpenDialog(win, { title: 'Выберите .torrent файл', properties: ['openFile'], filters: [{ name: 'Torrent', extensions: ['torrent'] }] });
    if (r.canceled) return null;
    try {
      return { ok: true, id: await addTorrentGame({ type: 'file', path: r.filePaths[0] }) };
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
  });
  h('download:pause', (id) => torrents.pause(id));
  h('download:resume', (id) => torrents.resume(id));
  h('download:cancel', async (id) => {
    const d = store.get().downloads.find((x) => x.id === id);
    if (!d) return;
    const g = d.gameId ? getGame(d.gameId) : null;
    await torrents.remove(id, true);
    if (g && g.status === 'downloading') {
      store.get().games = store.get().games.filter((x) => x.id !== g.id);
      store.save();
      pushGames();
    }
  });

  // Каталог
  h('catalog:list', async () => {
    catalogCache = await catalogLib.loadCatalog(store.get().settings);
    return catalogCache;
  });
  h('catalog:install', (id) => {
    installFromCatalog(id);
  });

  // Импорт из Steam / Epic / GOG
  h('import:scan', async () => {
    const found = await scanAll();
    const have = new Set(store.get().games.map((g) => g.externalKey).filter(Boolean));
    return found.map((f) => ({ ...f, already: have.has(f.key) }));
  });
  h('import:add', async (items) => {
    for (const it of items) {
      if (store.get().games.some((g) => g.externalKey === it.key)) continue;
      const g = newGame({
        name: it.name,
        source: it.source,
        externalKey: it.key,
        installDir: it.installDir,
        launch: it.launch,
        category: it.source === 'steam' ? 'Steam' : it.source === 'epic' ? 'Epic Games' : 'GOG'
      });
      if (it.coverSrc) {
        try {
          const file = `cover_${g.id}.jpg`;
          fs.copyFileSync(it.coverSrc, path.join(coversDir, file));
          g.coverFile = file;
        } catch (_) {}
      }
      if (!g.coverFile) await saveIcon(g);
      store.get().games.push(g);
    }
    store.save();
    pushGames();
  });

  // Обновления самого лаунчера
  h('updater:check', () => {
    if (!autoUpdater) {
      updaterState = { status: 'dev' };
      emit('updater', updaterState);
      return;
    }
    autoUpdater.checkForUpdates().catch(() => {});
  });
  h('updater:install', () => autoUpdater && autoUpdater.quitAndInstall());
}

function createWindow() {
  win = new BrowserWindow({
    width: 1220,
    height: 780,
    minWidth: 980,
    minHeight: 620,
    frame: false,
    backgroundColor: '#1b1828',
    title: 'Players Club',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.once('ready-to-show', () => win.show());
  win.on('maximize', () => emit('maximized', true));
  win.on('unmaximize', () => emit('maximized', false));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  if (isDev) win.loadURL('http://localhost:5173');
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.whenReady().then(async () => {
  store = createStore();
  coversDir = path.join(app.getPath('userData'), 'covers');
  fs.mkdirSync(coversDir, { recursive: true });
  for (const d of [store.get().settings.downloadDir, store.get().settings.gamesDir]) {
    try {
      fs.mkdirSync(d, { recursive: true });
    } catch (_) {}
  }

  protocol.handle('pcmedia', (req) => {
    const file = path.basename(decodeURIComponent(new URL(req.url).pathname));
    return net.fetch(pathToFileURL(path.join(coversDir, file)).toString());
  });

  torrents = createTorrentManager({
    store,
    emit,
    onDone: finalizeDownload,
    onMeta: (rec) => {
      const g = rec.gameId ? getGame(rec.gameId) : null;
      if (g && (g.name === 'Новая игра' || g.name === rec.name || g.autoName)) {
        g.name = rec.name;
        g.autoName = true;
        pushGames();
      }
    }
  });
  tracker = createTracker({ store, emit, getGame });
  registerIpc();
  createWindow();
  setupUpdater();

  // Загрузки, прерванные закрытием лаунчера, продолжаются автоматически
  await torrents.init();
  // Игры, у которых загрузка уже закончилась, пока лаунчер был закрыт
  for (const g of store.get().games) {
    if (g.status !== 'downloading') continue;
    const d = store.get().downloads.find((x) => x.gameId === g.id);
    if (d && d.status === 'done') finalizeDownload(d);
  }
});

app.on('before-quit', () => {
  if (store) store.flush();
});
app.on('window-all-closed', async () => {
  if (torrents) await torrents.shutdown();
  if (store) store.flush();
  app.quit();
});
