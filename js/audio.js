(function (global) {
  'use strict';

  let ctx = null;
  let enabled = true;

  function ensureContext() {
    if (!enabled) return null;
    if (!ctx) {
      const AudioCtx = global.AudioContext || global.webkitAudioContext;
      if (!AudioCtx) return null;
      ctx = new AudioCtx();
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function playTone(freq, endFreq, duration, type = 'sine', gainPeak = 0.14, delay = 0) {
    const audio = ensureContext();
    if (!audio) return;

    const now = audio.currentTime + delay;
    const osc = audio.createOscillator();
    const gain = audio.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function setEnabled(val) {
    enabled = Boolean(val);
  }

  function isEnabled() {
    return enabled;
  }

  function playRoll(isStanding) {
    if (isStanding) {
      playTone(155, 85, 0.11, 'triangle', 0.16);
    } else {
      playTone(210, 120, 0.085, 'sine', 0.12);
    }
  }

  function playSwitch() {
    playTone(520, 780, 0.09, 'sine', 0.12);
    playTone(780, 1040, 0.09, 'triangle', 0.08, 0.05);
  }

  function playFall(isShatter) {
    if (isShatter) {
      playTone(640, 160, 0.22, 'sawtooth', 0.11);
    }
    playTone(260, 55, 0.38, 'triangle', 0.16, 0.04);
  }

  function playWin() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      playTone(freq, freq, 0.24, 'triangle', 0.13, i * 0.08);
    });
  }

  function playUndo() {
    playTone(340, 240, 0.08, 'sine', 0.09);
  }

  global.CubixAudio = {
    setEnabled,
    isEnabled,
    playRoll,
    playSwitch,
    playFall,
    playWin,
    playUndo,
  };
})(window);
