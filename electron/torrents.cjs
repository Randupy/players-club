// Загрузка по magnet-ссылкам и .torrent файлам (WebTorrent). Ссылки вводит пользователь.
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function createTorrentManager({ store, emit, onDone, onMeta }) {
  let client = null;
  const handles = new Map(); // id -> torrent
  const live = new Map(); // id -> stats
  let ticker = null;

  const records = () => store.get().downloads;
  const find = (id) => records().find((r) => r.id === id);
  const limitBytes = () => {
    const mb = Number(store.get().settings.speedLimitMB) || 0;
    return mb > 0 ? Math.round(mb * 1000 * 1000) : -1;
  };

  async function getClient() {
    if (client) return client;
    const { default: WebTorrent } = await import('webtorrent');
    client = new WebTorrent({ downloadLimit: limitBytes() });
    client.on('error', (e) => console.error('webtorrent client error', e));
    return client;
  }

  function snapshot() {
    return records().map((r) => ({ ...r, live: live.get(r.id) || null }));
  }
  function push() {
    emit('downloads', snapshot());
  }

  async function startTorrent(rec) {
    const c = await getClient();
    fs.mkdirSync(rec.savePath, { recursive: true });
    let input;
    try {
      input = rec.source.type === 'magnet' ? rec.source.uri : fs.readFileSync(rec.source.path);
    } catch (e) {
      rec.status = 'error';
      rec.error = 'Не удалось прочитать .torrent файл';
      store.save();
      return push();
    }
    rec.status = 'metadata';
    rec.error = null;
    const t = c.add(input, { path: rec.savePath });
    handles.set(rec.id, t);

    const captureInfo = () => {
      rec.name = t.name || rec.name;
      rec.length = t.length;
      if (t.files && t.files.length) {
        rec.rootDir = t.files.length > 1 ? path.join(rec.savePath, t.name) : rec.savePath;
        rec.singleFile = t.files.length === 1 ? path.join(rec.savePath, t.files[0].path) : null;
      }
      store.save();
      if (onMeta) onMeta(rec);
    };
    t.on('metadata', () => {
      captureInfo();
      rec.status = 'downloading';
      push();
    });
    t.on('ready', () => {
      captureInfo();
      rec.status = 'downloading';
      push();
    });
    t.on('done', async () => {
      rec.status = 'done';
      rec.progress = 1;
      rec.downloaded = rec.length;
      live.delete(rec.id);
      handles.delete(rec.id);
      try {
        await c.remove(t); // файлы остаются на диске, раздачу не продолжаем
      } catch (_) {}
      store.save();
      push();
      try {
        await onDone(rec);
      } catch (e) {
        console.error('onDone failed', e);
      }
    });
    t.on('error', (err) => {
      rec.status = 'error';
      rec.error = String(err && err.message ? err.message : err);
      handles.delete(rec.id);
      live.delete(rec.id);
      store.save();
      push();
    });
    push();
  }

  function tick() {
    let any = false;
    for (const [id, t] of handles) {
      const rec = find(id);
      if (!rec) continue;
      any = true;
      rec.progress = t.progress || 0;
      rec.downloaded = t.downloaded || 0;
      live.set(id, {
        downloadSpeed: t.downloadSpeed || 0,
        uploadSpeed: t.uploadSpeed || 0,
        numPeers: t.numPeers || 0,
        timeRemaining: Number.isFinite(t.timeRemaining) ? t.timeRemaining : null
      });
    }
    if (any) push();
  }

  async function init() {
    for (const rec of records()) {
      if (rec.status === 'downloading' || rec.status === 'metadata') {
        startTorrent(rec).catch((e) => console.error(e));
      }
    }
    ticker = setInterval(tick, 1000);
  }

  async function add(source, { name, gameId } = {}) {
    const s = store.get();
    const id = 'dl_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    let displayName = name;
    let src;
    if (source.type === 'magnet') {
      if (!/^magnet:\?/i.test(source.uri)) throw new Error('Это не magnet-ссылка');
      const dn = source.uri.match(/[?&]dn=([^&]+)/i);
      if (!displayName && dn) displayName = decodeURIComponent(dn[1].replace(/\+/g, ' '));
      src = { type: 'magnet', uri: source.uri.trim() };
    } else {
      const dir = path.join(app.getPath('userData'), 'torrents');
      fs.mkdirSync(dir, { recursive: true });
      const copy = path.join(dir, id + '.torrent');
      fs.copyFileSync(source.path, copy);
      if (!displayName) displayName = path.basename(source.path, '.torrent');
      src = { type: 'file', path: copy };
    }
    const rec = {
      id,
      name: displayName || 'Новая загрузка',
      source: src,
      savePath: s.settings.downloadDir,
      status: 'metadata',
      progress: 0,
      downloaded: 0,
      length: 0,
      createdAt: Date.now(),
      gameId: gameId || null,
      error: null
    };
    s.downloads.push(rec);
    store.save();
    startTorrent(rec).catch((e) => {
      rec.status = 'error';
      rec.error = String(e.message || e);
      push();
    });
    return rec;
  }

  async function pause(id) {
    const rec = find(id);
    const t = handles.get(id);
    if (!rec || rec.status === 'done') return;
    if (t) {
      handles.delete(id);
      try {
        await client.remove(t);
      } catch (_) {}
    }
    live.delete(id);
    rec.status = 'paused';
    store.save();
    push();
  }

  async function resume(id) {
    const rec = find(id);
    if (!rec || rec.status === 'done' || handles.has(id)) return;
    await startTorrent(rec);
    store.save();
  }

  async function remove(id, deleteFiles) {
    const rec = find(id);
    if (!rec) return;
    const t = handles.get(id);
    if (t) {
      handles.delete(id);
      try {
        await client.remove(t, { destroyStore: !!deleteFiles });
      } catch (_) {}
    }
    live.delete(id);
    if (deleteFiles) {
      const dl = store.get().settings.downloadDir;
      try {
        if (rec.rootDir && rec.rootDir !== rec.savePath && rec.rootDir.startsWith(rec.savePath)) fs.rmSync(rec.rootDir, { recursive: true, force: true });
        else if (rec.singleFile && rec.singleFile.startsWith(rec.savePath) && rec.savePath !== rec.singleFile) fs.rmSync(rec.singleFile, { force: true });
      } catch (_) {}
      void dl;
    }
    if (rec.source.type === 'file') {
      try {
        fs.rmSync(rec.source.path, { force: true });
      } catch (_) {}
    }
    store.get().downloads = records().filter((r) => r.id !== id);
    store.save();
    push();
  }

  function applySettings() {
    if (client) client.throttleDownload(limitBytes());
  }

  async function shutdown() {
    clearInterval(ticker);
    if (client) {
      try {
        client.destroy();
      } catch (_) {}
    }
  }

  return { init, add, pause, resume, remove, applySettings, snapshot, shutdown };
}

module.exports = { createTorrentManager };
