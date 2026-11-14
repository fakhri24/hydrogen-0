(function (global) {
  'use strict';

  const STORAGE_KEY = 'cubix3d_save_v1';
  const CURRENT_VERSION = 1;

  function createDefaultState() {
    return {
      version: CURRENT_VERSION,
      unlockedLevel: 1,
      levels: {},
      settings: {
        soundEnabled: true,
      },
    };
  }

  function sanitizeState(raw) {
    const base = createDefaultState();
    if (!raw || typeof raw !== 'object') return base;

    const unlocked = Number.isInteger(raw.unlockedLevel) && raw.unlockedLevel >= 1
      ? raw.unlockedLevel
      : 1;

    const levels = {};
    if (raw.levels && typeof raw.levels === 'object') {
      for (const [id, entry] of Object.entries(raw.levels)) {
        if (entry && typeof entry === 'object') {
          levels[id] = {
            completed: Boolean(entry.completed),
            bestMoves: Number.isInteger(entry.bestMoves) && entry.bestMoves > 0 ? entry.bestMoves : null,
            stars: Number.isInteger(entry.stars) ? Math.min(3, Math.max(0, entry.stars)) : 0,
          };
        }
      }
    }

    const soundEnabled = raw.settings && typeof raw.settings.soundEnabled === 'boolean'
      ? raw.settings.soundEnabled
      : true;

    return {
      version: CURRENT_VERSION,
      unlockedLevel: unlocked,
      levels,
      settings: { soundEnabled },
    };
  }

  function load() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return createDefaultState();
      return sanitizeState(JSON.parse(raw));
    } catch {
      return createDefaultState();
    }
  }

  function save(state) {
    try {
      const sanitized = sanitizeState(state);
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
      return true;
    } catch {
      return false;
    }
  }

  function calculateStars(moves, par) {
    if (moves <= par) return 3;
    if (moves <= par + 4) return 2;
    return 1;
  }

  function recordWin(levelId, moves, par, totalLevels) {
    const state = load();
    const key = String(levelId);
    const prev = state.levels[key];
    const stars = calculateStars(moves, par);

    state.levels[key] = {
      completed: true,
      bestMoves: prev && prev.bestMoves ? Math.min(prev.bestMoves, moves) : moves,
      stars: prev ? Math.max(prev.stars, stars) : stars,
    };

    if (levelId >= state.unlockedLevel && levelId < totalLevels) {
      state.unlockedLevel = levelId + 1;
    }

    save(state);
    return { state, stars };
  }

  function setSound(enabled) {
    const state = load();
    state.settings.soundEnabled = Boolean(enabled);
    save(state);
    return state;
  }

  function exportSave() {
    const state = load();
    const json = JSON.stringify(state);
    return global.btoa(unescape(encodeURIComponent(json)));
  }

  function importSave(encoded) {
    try {
      const json = decodeURIComponent(escape(global.atob(encoded.trim())));
      const parsed = JSON.parse(json);
      if (!parsed || typeof parsed !== 'object' || typeof parsed.version !== 'number') {
        return { ok: false, error: 'Format kode save tidak valid.' };
      }
      const clean = sanitizeState(parsed);
      save(clean);
      return { ok: true, state: clean };
    } catch {
      return { ok: false, error: 'Gagal membaca kode save. Pastikan salinan lengkap.' };
    }
  }

  function reset() {
    const fresh = createDefaultState();
    save(fresh);
    return fresh;
  }

  global.CubixStorage = {
    load,
    save,
    calculateStars,
    recordWin,
    setSound,
    exportSave,
    importSave,
    reset,
  };
})(window);
