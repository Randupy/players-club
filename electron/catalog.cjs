// Каталог бесплатных и свободно распространяемых игр (GitHub Releases).
// Встроенный список лежит в catalog.json, свой список можно подключить в настройках по ссылке.
const fs = require('fs');
const path = require('path');
const { app, net } = require('electron');
const extract = require('extract-zip');

const bundled = require('./catalog.json');

async function loadCatalog(settings) {
  let list = [...bundled];
  if (settings.catalogUrl) {
    try {
      const res = await net.fetch(settings.catalogUrl, { headers: { Accept: 'application/json' } });
      if (res.ok) {
        const remote = await res.json();
        if (Array.isArray(remote)) {
          const ids = new Set(remote.map((r) => r.id));
          list = [...list.filter((g) => !ids.has(g.id)), ...remote.filter((g) => g && g.id && g.name && g.repo)];
        }
      }
    } catch (e) {
      console.warn('remote catalog failed', e.message);
    }
  }
  return list;
}

async function resolveRelease(entry) {
  const res = await net.fetch(`https://api.github.com/repos/${entry.repo}/releases?per_page=15`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'PlayersClub' }
  });
  if (!res.ok) throw new Error(res.status === 403 ? 'GitHub временно ограничил запросы, попробуйте позже' : `GitHub ответил ${res.status}`);
  const releases = await res.json();
  const re = new RegExp(entry.assetPattern || 'win.*\\.zip$', 'i');
  for (const rel of releases) {
    if (rel.draft || (rel.prerelease && !entry.allowPrerelease)) continue;
    const asset = (rel.assets || []).find((a) => re.test(a.name));
    if (asset) return { tag: rel.tag_name, notes: rel.body || '', asset };
  }
  throw new Error('Не найден файл релиза для Windows. Проверьте assetPattern в каталоге.');
}

async function downloadFile(url, dest, onProgress, signal) {
  const res = await net.fetch(url, { headers: { 'User-Agent': 'PlayersClub' }, signal });
  if (!res.ok || !res.body) throw new Error(`Не удалось скачать файл (${res.status})`);
  const total = Number(res.headers.get('content-length')) || 0;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const out = fs.createWriteStream(dest);
  const reader = res.body.getReader();
  let got = 0;
  let last = 0;
  let lastBytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      await new Promise((resolve, reject) => out.write(Buffer.from(value), (e) => (e ? reject(e) : resolve())));
      got += value.length;
      const now = Date.now();
      if (now - last > 500) {
        onProgress({ got, total, speed: ((got - lastBytes) / Math.max(1, now - last)) * 1000 });
        last = now;
        lastBytes = got;
      }
    }
  } finally {
    await new Promise((r) => out.end(r));
  }
  onProgress({ got, total, speed: 0 });
}

async function unzip(zipPath, dir) {
  fs.mkdirSync(dir, { recursive: true });
  await extract(zipPath, { dir });
}

module.exports = { loadCatalog, resolveRelease, downloadFile, unzip };
