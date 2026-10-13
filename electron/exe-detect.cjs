// Поиск запускаемых файлов в папке с игрой.
const fs = require('fs');
const path = require('path');

const IGNORE_DIRS = new Set([
  '_redist', 'redist', 'redistributables', 'directx', 'dotnet', 'vcredist', '__macosx',
  'crashreporter', 'crashpad', '_commonredist', 'support', 'engine'
]);
const BAD_NAME = /(unins|uninstall|crash|report|helper|redist|vc_?redist|vcredist|dxsetup|dxwebsetup|dotnet|ndp|oalinst|physx|easyanticheat|eac_|battleye|updater|launcherhelper|notification|webhelper|7z|unitycrashhandler)/i;
const SETUP_NAME = /^(setup|install|installer|autorun)|(^|[ _-])(setup|installer)([ _.-]|$)/i;

function walk(dir, depth, out) {
  if (depth < 0) return;
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (IGNORE_DIRS.has(e.name.toLowerCase())) continue;
      walk(full, depth - 1, out);
    } else if (/\.exe$/i.test(e.name)) {
      let size = 0;
      try {
        size = fs.statSync(full).size;
      } catch (_) {}
      out.push({ path: full, name: e.name, size, depth: 4 - depth });
    }
  }
}

function findExecutables(dir, maxDepth = 4) {
  const out = [];
  walk(dir, maxDepth, out);
  return out;
}

// Возвращает { kind: 'game' | 'setup' | 'none', exe, setup, candidates }
function classify(dir, hintName) {
  const all = findExecutables(dir);
  const games = all.filter((f) => !BAD_NAME.test(f.name) && !SETUP_NAME.test(f.name));
  const setups = all.filter((f) => SETUP_NAME.test(f.name) && !/unins/i.test(f.name));
  const hint = (hintName || '').toLowerCase().replace(/[^a-z0-9а-я]/g, '');

  const score = (f) => {
    let s = Math.log10(f.size + 1) * 2 - f.depth * 1.5;
    const base = f.name.toLowerCase().replace(/\.exe$/, '').replace(/[^a-z0-9а-я]/g, '');
    if (hint && (hint.includes(base) || base.includes(hint))) s += 6;
    if (/64/.test(f.name)) s += 0.5;
    if (/launcher/i.test(f.name)) s -= 1;
    return s;
  };
  games.sort((a, b) => score(b) - score(a));
  setups.sort((a, b) => a.depth - b.depth || b.size - a.size);

  const setupFirst = setups.length && setups[0].depth === 0 && games.every((g) => g.depth > 1);
  if (games.length && !setupFirst) {
    return { kind: 'game', exe: games[0].path, setup: setups[0] ? setups[0].path : null, candidates: games.slice(0, 8).map((g) => g.path) };
  }
  if (setups.length) {
    return { kind: 'setup', exe: null, setup: setups[0].path, candidates: [] };
  }
  return { kind: 'none', exe: null, setup: null, candidates: [] };
}

module.exports = { findExecutables, classify };
