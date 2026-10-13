// Простое JSON-хранилище: профиль, настройки, игры, сессии, загрузки.
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

function defaults() {
  const base = path.join(app.getPath('home'), 'Games', 'Players Club');
  return {
    profile: { name: 'Player', color: 0, createdAt: Date.now() },
    settings: {
      downloadDir: path.join(base, 'Downloads'),
      gamesDir: path.join(base, 'Games'),
      speedLimitMB: 0, // МБ/с, 0 = без ограничения
      autoUpdate: true,
      catalogUrl: ''
    },
    games: [],
    sessions: [],
    downloads: []
  };
}

function createStore() {
  const file = path.join(app.getPath('userData'), 'players-club-data.json');
  let data = defaults();
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    const d = defaults();
    data = {
      ...d,
      ...raw,
      profile: { ...d.profile, ...(raw.profile || {}) },
      settings: { ...d.settings, ...(raw.settings || {}) }
    };
  } catch (_) {
    /* первый запуск */
  }

  let timer = null;
  function writeNow() {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const tmp = file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(data));
      fs.renameSync(tmp, file);
    } catch (e) {
      console.error('store write failed', e);
    }
  }
  function save() {
    clearTimeout(timer);
    timer = setTimeout(writeNow, 400);
  }
  return {
    get: () => data,
    save,
    flush: () => {
      clearTimeout(timer);
      writeNow();
    }
  };
}

module.exports = { createStore };
