// Импорт уже установленных игр из Steam, Epic Games и GOG (только чтение локальных файлов).
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch (_) {
    return false;
  }
}

function regQuery(key, value) {
  return new Promise((resolve) => {
    execFile('reg', ['query', key, '/v', value], { windowsHide: true }, (err, out) => {
      if (err) return resolve(null);
      const m = out.match(new RegExp(value + '\\s+REG_\\w+\\s+(.+)'));
      resolve(m ? m[1].trim() : null);
    });
  });
}

function unescapeVdf(s) {
  return s.replace(/\\\\/g, '\\');
}

async function steamRoot() {
  const fromReg = await regQuery('HKCU\\Software\\Valve\\Steam', 'SteamPath');
  const candidates = [fromReg && fromReg.replace(/\//g, '\\'), 'C:\\Program Files (x86)\\Steam', 'C:\\Program Files\\Steam'].filter(Boolean);
  return candidates.find((c) => exists(path.join(c, 'steamapps'))) || null;
}

function parseAcf(text) {
  const get = (k) => {
    const m = text.match(new RegExp('"' + k + '"\\s+"([^"]*)"', 'i'));
    return m ? m[1] : '';
  };
  return { appid: get('appid'), name: get('name'), installdir: get('installdir') };
}

function findSteamCover(root, appid) {
  const cache = path.join(root, 'appcache', 'librarycache');
  const flat = path.join(cache, `${appid}_library_600x900.jpg`);
  if (exists(flat)) return flat;
  const dir = path.join(cache, String(appid));
  if (!exists(dir)) return null;
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    let list = [];
    try {
      list = fs.readdirSync(d, { withFileTypes: true });
    } catch (_) {}
    for (const e of list) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.name === 'library_600x900.jpg') return full;
    }
  }
  return null;
}

async function scanSteam() {
  const root = await steamRoot();
  if (!root) return [];
  const libs = new Set([path.join(root, 'steamapps')]);
  try {
    const vdf = fs.readFileSync(path.join(root, 'steamapps', 'libraryfolders.vdf'), 'utf8');
    for (const m of vdf.matchAll(/"path"\s+"([^"]+)"/g)) libs.add(path.join(unescapeVdf(m[1]), 'steamapps'));
  } catch (_) {}
  const out = [];
  for (const lib of libs) {
    let files = [];
    try {
      files = fs.readdirSync(lib).filter((f) => /^appmanifest_\d+\.acf$/.test(f));
    } catch (_) {
      continue;
    }
    for (const f of files) {
      try {
        const a = parseAcf(fs.readFileSync(path.join(lib, f), 'utf8'));
        if (!a.appid || !a.name) continue;
        if (a.appid === '228980' || /^(Steamworks|Steam Linux Runtime|Proton|Steam Controller)/i.test(a.name)) continue;
        out.push({
          key: 'steam:' + a.appid,
          name: a.name,
          source: 'steam',
          installDir: path.join(lib, 'common', a.installdir),
          launch: { type: 'uri', uri: `steam://rungameid/${a.appid}` },
          coverSrc: findSteamCover(root, a.appid)
        });
      } catch (_) {}
    }
  }
  return out;
}

function scanEpic() {
  const dir = 'C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests';
  const out = [];
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.item'));
  } catch (_) {
    return out;
  }
  for (const f of files) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      if (!j.DisplayName || !j.LaunchExecutable || j.bIsIncompleteInstall) continue;
      const uri = `com.epicgames.launcher://apps/${encodeURIComponent(j.CatalogNamespace)}%3A${encodeURIComponent(j.CatalogItemId)}%3A${encodeURIComponent(j.AppName)}?action=launch&silent=true`;
      out.push({
        key: 'epic:' + j.AppName,
        name: j.DisplayName,
        source: 'epic',
        installDir: j.InstallLocation,
        launch: { type: 'uri', uri },
        coverSrc: null
      });
    } catch (_) {}
  }
  return out;
}

function scanGog() {
  const roots = ['C:\\GOG Games', 'C:\\Program Files (x86)\\GOG Galaxy\\Games', 'D:\\GOG Games'];
  const out = [];
  for (const root of roots) {
    let dirs = [];
    try {
      dirs = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory());
    } catch (_) {
      continue;
    }
    for (const d of dirs) {
      const gdir = path.join(root, d.name);
      try {
        const info = fs.readdirSync(gdir).find((f) => /^goggame-\d+\.info$/i.test(f));
        if (!info) continue;
        const j = JSON.parse(fs.readFileSync(path.join(gdir, info), 'utf8'));
        const task = (j.playTasks || []).find((t) => t.isPrimary) || (j.playTasks || []).find((t) => t.category === 'game');
        if (!task || !task.path) continue;
        out.push({
          key: 'gog:' + j.gameId,
          name: j.name || d.name,
          source: 'gog',
          installDir: gdir,
          launch: { type: 'exe', exePath: path.join(gdir, task.path) },
          coverSrc: null
        });
      } catch (_) {}
    }
  }
  return out;
}

async function scanAll() {
  const [steam, epic, gog] = await Promise.all([scanSteam(), Promise.resolve(scanEpic()), Promise.resolve(scanGog())]);
  return [...steam, ...epic, ...gog];
}

module.exports = { scanAll, parseAcf };
