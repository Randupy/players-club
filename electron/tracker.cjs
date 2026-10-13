// Запуск игр и учёт времени в игре.
const { spawn, execFile } = require('child_process');
const { shell } = require('electron');
const path = require('path');

function psEscape(s) {
  return String(s).replace(/'/g, "''");
}

// Есть ли запущенный процесс, чей exe лежит внутри папки игры
function anyProcessUnder(dir) {
  return new Promise((resolve) => {
    if (!dir) return resolve(false);
    const cmd = `Get-Process | Where-Object { $_.Path -and $_.Path.StartsWith('${psEscape(dir)}', [StringComparison]::OrdinalIgnoreCase) } | Select-Object -First 1 -ExpandProperty Id`;
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', cmd], { windowsHide: true, timeout: 15000 }, (err, out) => {
      resolve(!err && /\d+/.test(out || ''));
    });
  });
}

function createTracker({ store, emit, getGame }) {
  const running = new Map(); // gameId -> { start }

  function broadcast() {
    emit('running', [...running.keys()]);
  }

  function finish(gameId) {
    const r = running.get(gameId);
    if (!r) return;
    running.delete(gameId);
    const seconds = Math.round((Date.now() - r.start) / 1000);
    const game = getGame(gameId);
    if (game && seconds >= 5) {
      game.playTimeSec = (game.playTimeSec || 0) + seconds;
      game.lastPlayed = r.start;
      store.get().sessions.push({ gameId, start: r.start, seconds });
      if (store.get().sessions.length > 5000) store.get().sessions.splice(0, 1000);
    }
    store.save();
    emit('games', store.get().games);
    emit('sessions', store.get().sessions);
    broadcast();
  }

  // Следим за процессами в папке игры, пока они есть (для лаунчеров и игр, запущенных через Steam/Epic)
  async function watchFolder(gameId, dir, waitForStart) {
    const started = Date.now();
    let seen = false;
    for (;;) {
      await new Promise((r) => setTimeout(r, 8000));
      if (!running.has(gameId)) return;
      const alive = await anyProcessUnder(dir);
      if (alive) seen = true;
      if (!alive && (seen || Date.now() - started > waitForStart)) return finish(gameId);
    }
  }

  function launchElevated(exe, cwd) {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-Command', `Start-Process -FilePath '${psEscape(exe)}' -WorkingDirectory '${psEscape(cwd)}' -Verb RunAs`],
      { windowsHide: true },
      () => {}
    );
  }

  async function play(game) {
    if (running.has(game.id)) return { ok: true };
    const launch = game.launch;
    if (!launch) return { ok: false, error: 'Для игры не выбран файл запуска' };

    if (launch.type === 'uri') {
      await shell.openExternal(launch.uri);
      running.set(game.id, { start: Date.now() });
      broadcast();
      watchFolder(game.id, game.installDir, 120000);
      return { ok: true };
    }

    const exe = launch.exePath;
    const cwd = path.dirname(exe);
    return new Promise((resolve) => {
      let child;
      try {
        child = spawn(exe, [], { cwd, detached: false, stdio: 'ignore', windowsHide: false });
      } catch (e) {
        return resolve({ ok: false, error: String(e.message || e) });
      }
      const start = Date.now();
      let settled = false;
      child.once('error', (err) => {
        if (settled) return;
        settled = true;
        // Игре нужны права администратора — запускаем через UAC
        if (err.code === 'EACCES' || /UNKNOWN|740/.test(String(err.code || err.errno || err.message))) {
          launchElevated(exe, cwd);
          running.set(game.id, { start });
          broadcast();
          watchFolder(game.id, game.installDir || cwd, 60000);
          resolve({ ok: true });
        } else {
          resolve({ ok: false, error: 'Не удалось запустить: ' + err.message });
        }
      });
      child.once('spawn', () => {
        if (settled) return;
        settled = true;
        running.set(game.id, { start });
        broadcast();
        resolve({ ok: true });
      });
      child.once('exit', async () => {
        // Если процесс закрылся быстро, это мог быть загрузчик: ждём, пока в папке игры остаются процессы
        if (Date.now() - start < 45000 && (await anyProcessUnder(game.installDir || cwd))) {
          watchFolder(game.id, game.installDir || cwd, 0);
        } else {
          finish(game.id);
        }
      });
    });
  }

  function stopTracking(gameId) {
    finish(gameId);
  }

  return { play, stopTracking, isRunning: (id) => running.has(id), list: () => [...running.keys()] };
}

module.exports = { createTracker };
