(function (global) {
  'use strict';

  const { LEVELS } = global.CubixLevels;
  const Storage = global.CubixStorage;
  const Audio = global.CubixAudio;

  let saveState = Storage.load();
  let currentLevelIndex = Math.min(saveState.unlockedLevel - 1, LEVELS.length - 1);

  const canvas = document.getElementById('game-canvas');
  const levelBadgeEl = document.getElementById('hud-level-badge');
  const levelNameEl = document.getElementById('hud-level-name');
  const movesEl = document.getElementById('hud-moves');
  const parEl = document.getElementById('hud-par');
  const bestEl = document.getElementById('hud-best');
  const hintEl = document.getElementById('hud-hint');

  const btnUndo = document.getElementById('btn-undo');
  const btnRestart = document.getElementById('btn-restart');
  const btnLevels = document.getElementById('btn-levels');
  const btnSound = document.getElementById('btn-sound');
  const btnSave = document.getElementById('btn-save');

  const levelsDialog = document.getElementById('dialog-levels');
  const levelsGrid = document.getElementById('levels-grid');
  const winDialog = document.getElementById('dialog-win');
  const winStarsEl = document.getElementById('win-stars');
  const winStatsEl = document.getElementById('win-stats');
  const btnNextLevel = document.getElementById('btn-next-level');
  const btnReplayLevel = document.getElementById('btn-replay-level');

  const saveDialog = document.getElementById('dialog-save');
  const exportInput = document.getElementById('save-export-text');
  const importInput = document.getElementById('save-import-text');
  const saveFeedback = document.getElementById('save-feedback');
  const btnCopySave = document.getElementById('btn-copy-save');
  const btnImportSave = document.getElementById('btn-import-save');
  const btnResetSave = document.getElementById('btn-reset-save');

  const renderer = new global.CubixRenderer3D(canvas);
  const game = new global.CubixGame(renderer, {
    onStateChange: updateHUD,
    onWin: handleWin,
  });

  function renderStars(count) {
    return '★'.repeat(count) + '☆'.repeat(3 - count);
  }

  function updateSoundButton() {
    const on = saveState.settings.soundEnabled;
    Audio.setEnabled(on);
    btnSound.textContent = on ? '🔊 Suara: ON' : '🔇 Suara: OFF';
    btnSound.setAttribute('aria-pressed', String(on));
  }

  function updateHUD(hud) {
    levelBadgeEl.textContent = `LEVEL ${hud.levelId}/${LEVELS.length}`;
    levelNameEl.textContent = hud.levelName;
    movesEl.textContent = String(hud.moves);
    parEl.textContent = String(hud.par);
    hintEl.textContent = hud.hint;
    btnUndo.disabled = !hud.canUndo;

    const record = saveState.levels[String(hud.levelId)];
    bestEl.textContent = record && record.bestMoves ? String(record.bestMoves) : '—';
  }

  function startLevel(index) {
    currentLevelIndex = Math.max(0, Math.min(LEVELS.length - 1, index));
    game.loadLevel(LEVELS[currentLevelIndex]);
  }

  function handleWin(hud) {
    const result = Storage.recordWin(hud.levelId, hud.moves, hud.par, LEVELS.length);
    saveState = result.state;
    updateHUD(hud);

    winStarsEl.textContent = renderStars(result.stars);
    winStatsEl.textContent = `Selesai dalam ${hud.moves} langkah (Par: ${hud.par})`;
    btnNextLevel.hidden = currentLevelIndex >= LEVELS.length - 1;
    winDialog.showModal();
  }

  function populateLevelsModal() {
    levelsGrid.innerHTML = '';
    for (let i = 0; i < LEVELS.length; i++) {
      const lvl = LEVELS[i];
      const unlocked = lvl.id <= saveState.unlockedLevel;
      const record = saveState.levels[String(lvl.id)];
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'level-card' + (unlocked ? '' : ' locked') + (i === currentLevelIndex ? ' active' : '');
      card.disabled = !unlocked;

      const starsText = record && record.completed ? renderStars(record.stars) : unlocked ? '☆☆☆' : '🔒';
      const bestText = record && record.bestMoves ? `Best: ${record.bestMoves}` : `Par: ${lvl.par}`;

      card.innerHTML = `
        <span class="level-num">${lvl.id}</span>
        <span class="level-title">${lvl.name}</span>
        <span class="level-stars">${starsText}</span>
        <span class="level-meta">${bestText}</span>
      `;
      card.addEventListener('click', () => {
        levelsDialog.close();
        startLevel(i);
      });
      levelsGrid.appendChild(card);
    }
  }

  // Light dismiss for native <dialog>
  [levelsDialog, winDialog, saveDialog].forEach((dlg) => {
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) dlg.close();
    });
  });

  document.querySelectorAll('[data-close-dialog]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const dlg = btn.closest('dialog');
      if (dlg) dlg.close();
    });
  });

  // UI Button Bindings
  btnUndo.addEventListener('click', () => game.undo());
  btnRestart.addEventListener('click', () => game.restart());

  btnLevels.addEventListener('click', () => {
    populateLevelsModal();
    levelsDialog.showModal();
  });

  btnSound.addEventListener('click', () => {
    saveState = Storage.setSound(!saveState.settings.soundEnabled);
    updateSoundButton();
  });

  btnNextLevel.addEventListener('click', () => {
    winDialog.close();
    startLevel(currentLevelIndex + 1);
  });

  btnReplayLevel.addEventListener('click', () => {
    winDialog.close();
    game.restart();
  });

  btnSave.addEventListener('click', () => {
    exportInput.value = Storage.exportSave();
    importInput.value = '';
    saveFeedback.textContent = '';
    saveDialog.showModal();
  });

  btnCopySave.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(exportInput.value);
      saveFeedback.textContent = 'Kode save berhasil disalin ke clipboard!';
      saveFeedback.className = 'save-feedback ok';
    } catch {
      exportInput.select();
      saveFeedback.textContent = 'Silakan tekan Ctrl/Cmd+C untuk menyalin.';
      saveFeedback.className = 'save-feedback';
    }
  });

  btnImportSave.addEventListener('click', () => {
    const res = Storage.importSave(importInput.value);
    if (res.ok) {
      saveState = res.state;
      updateSoundButton();
      startLevel(Math.min(saveState.unlockedLevel - 1, LEVELS.length - 1));
      saveFeedback.textContent = 'Progres berhasil dipulihkan!';
      saveFeedback.className = 'save-feedback ok';
    } else {
      saveFeedback.textContent = res.error;
      saveFeedback.className = 'save-feedback err';
    }
  });

  btnResetSave.addEventListener('click', () => {
    if (global.confirm('Yakin ingin menghapus semua progres dan rekor bintang?')) {
      saveState = Storage.reset();
      updateSoundButton();
      startLevel(0);
      exportInput.value = Storage.exportSave();
      saveFeedback.textContent = 'Semua progres telah direset.';
      saveFeedback.className = 'save-feedback ok';
    }
  });

  // On-screen D-pad
  document.querySelectorAll('[data-dir]').forEach((btn) => {
    btn.addEventListener('click', () => {
      game.queueMove(btn.getAttribute('data-dir'));
    });
  });

  // Keyboard Controls
  const KEY_TO_DIR = {
    ArrowUp: 'UP',
    KeyW: 'UP',
    ArrowDown: 'DOWN',
    KeyS: 'DOWN',
    ArrowLeft: 'LEFT',
    KeyA: 'LEFT',
    ArrowRight: 'RIGHT',
    KeyD: 'RIGHT',
  };

  window.addEventListener('keydown', (e) => {
    if (levelsDialog.open || winDialog.open || saveDialog.open) return;

    const dir = KEY_TO_DIR[e.code];
    if (dir) {
      e.preventDefault();
      game.queueMove(dir);
    } else if (e.code === 'KeyZ' || e.code === 'Backspace') {
      e.preventDefault();
      game.undo();
    } else if (e.code === 'KeyR') {
      e.preventDefault();
      game.restart();
    }
  });

  // Touch Swipe Controls on Canvas
  let touchStart = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') {
      touchStart = { x: e.clientX, y: e.clientY };
    }
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!touchStart) return;
    const dx = e.clientX - touchStart.x;
    const dy = e.clientY - touchStart.y;
    touchStart = null;
    if (Math.hypot(dx, dy) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      game.queueMove(dx > 0 ? 'RIGHT' : 'LEFT');
    } else {
      game.queueMove(dy > 0 ? 'DOWN' : 'UP');
    }
  });

  window.addEventListener('resize', () => renderer.resize());

  // Main Animation Loop
  let lastTime = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    game.update(dt);
    requestAnimationFrame(loop);
  }

  updateSoundButton();
  startLevel(currentLevelIndex);
  requestAnimationFrame(loop);
})(window);
