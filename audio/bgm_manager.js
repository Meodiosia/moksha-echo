/**
 * bgm_manager.js
 * Web Audio API – background music manager with fade in/out and ducking.
 *
 * API (window.BGM):
 *   BGM.play(key, fadeMs?, loop?)  – load + play BGM, fade in
 *   BGM.stop(fadeMs?)              – fade out then stop
 *   BGM.duck(factor?, ms?)         – lower volume temporarily then restore
 *   BGM.setVolume(v)               – set base volume 0..1
 *
 * Shares AudioContext with SFX if SFX was initialised first.
 * Loads on demand (BGM tracks are large; not pre-buffered unless called).
 */
(function (global) {
  'use strict';

  const DEFAULT_FADE_MS = 800;
  const DEFAULT_DUCK_FACTOR = 0.2;
  const DEFAULT_DUCK_MS = 300;

  /** @type {AudioContext|null} */
  let ctx = null;
  /** @type {GainNode|null}  master BGM gain (also used for duck) */
  let bgmGain = null;
  /** @type {AudioBufferSourceNode|null} */
  let currentSource = null;
  /** @type {string|null} */
  let currentKey = null;
  /** 0..1 – logical "user volume" (duck multiplies on top of this) */
  let baseVolume = 1;
  /** Prevent concurrent stop/play races */
  let stopTimeoutId = null;
  /** True while duck is in effect */
  let isDucking = false;
  let duckRestoreTimeout = null;

  // ─── internal ─────────────────────────────────────────────────────────────

  function ensureContext() {
    // Prefer to share the SFX AudioContext (1 context = fewer resources)
    if (!ctx) {
      if (global.SFX && global.SFX._ctx) {
        ctx = global.SFX._ctx;
      } else {
        ctx = new (global.AudioContext || global.webkitAudioContext)();
      }
    }
    if (ctx.state === 'suspended') ctx.resume();

    if (!bgmGain) {
      bgmGain = ctx.createGain();
      bgmGain.gain.value = 0; // start silent; fade in on play
      bgmGain.connect(ctx.destination);
    }
  }

  /** Ramp gain from current value to `target` over `ms` milliseconds */
  function rampGain(targetValue, ms) {
    const now = ctx.currentTime;
    const duration = Math.max(0.001, ms / 1000);
    bgmGain.gain.cancelScheduledValues(now);
    bgmGain.gain.setValueAtTime(bgmGain.gain.value, now);
    bgmGain.gain.linearRampToValueAtTime(
      Math.max(0, Math.min(1, targetValue)),
      now + duration
    );
  }

  /**
   * Fetch and decode audio from manifest.
   * @param {string} key
   * @returns {Promise<AudioBuffer>}
   */
  async function loadBGMBuffer(key) {
    const manifest = global.SFX_MANIFEST || {};
    const url = manifest[key];
    if (!url) throw new Error(`No URL in SFX_MANIFEST for BGM key "${key}"`);

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const raw = await res.arrayBuffer();

    return new Promise((resolve, reject) => {
      ctx.decodeAudioData(raw, resolve, reject);
    });
  }

  function clearStopTimeout() {
    if (stopTimeoutId !== null) {
      clearTimeout(stopTimeoutId);
      stopTimeoutId = null;
    }
  }

  function hardStopCurrent() {
    if (currentSource) {
      try { currentSource.stop(0); } catch (_) {}
      currentSource.disconnect();
      currentSource = null;
    }
    currentKey = null;
  }

  // ─── public API ───────────────────────────────────────────────────────────

  const BGM = {

    /**
     * Play a BGM track. If another track is playing it fades out first.
     * @param {string}  key
     * @param {number} [fadeMs=800]  fade-in duration ms
     * @param {boolean}[loop=true]
     * @returns {Promise<void>}
     */
    async play(key, fadeMs = DEFAULT_FADE_MS, loop = true) {
      ensureContext();

      // Avoid redundant reload of the same track
      if (currentKey === key) {
        rampGain(isDucking ? baseVolume * DEFAULT_DUCK_FACTOR : baseVolume, fadeMs);
        return;
      }

      // Fade out current track, then start new one
      if (currentSource) {
        const oldSrc = currentSource;
        const fadeDuration = Math.max(50, fadeMs * 0.5);
        rampGain(0, fadeDuration);
        clearStopTimeout();
        stopTimeoutId = setTimeout(() => {
          try { oldSrc.stop(0); } catch (_) {}
          oldSrc.disconnect();
          stopTimeoutId = null;
        }, fadeDuration + 100);
        currentSource = null;
        currentKey = null;
      }

      let buffer;
      try {
        buffer = await loadBGMBuffer(key);
      } catch (err) {
        console.warn(`[BGM] Failed to load "${key}":`, err.message);
        return;
      }

      // Another play() call may have taken over while we were loading
      if (currentKey && currentKey !== key) return;

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = loop;
      source.connect(bgmGain);

      // Fade in
      const targetVol = isDucking ? baseVolume * DEFAULT_DUCK_FACTOR : baseVolume;
      bgmGain.gain.cancelScheduledValues(ctx.currentTime);
      bgmGain.gain.setValueAtTime(0, ctx.currentTime);
      rampGain(targetVol, fadeMs);

      source.start(0);
      currentSource = source;
      currentKey = key;

      source.onended = () => {
        if (currentSource === source) {
          currentSource = null;
          currentKey = null;
        }
      };
    },

    /**
     * Stop current BGM with a fade-out.
     * @param {number} [fadeMs=800]
     */
    stop(fadeMs = DEFAULT_FADE_MS) {
      if (!ctx || !currentSource) return;

      clearStopTimeout();
      rampGain(0, fadeMs);

      const src = currentSource;
      currentSource = null;
      currentKey = null;

      stopTimeoutId = setTimeout(() => {
        try { src.stop(0); } catch (_) {}
        src.disconnect();
        stopTimeoutId = null;
      }, fadeMs + 100);
    },

    /**
     * Duck (lower) BGM volume temporarily, then restore.
     * Call duck(1, 0) to restore immediately.
     * @param {number} [factor=0.2]  multiplier applied to baseVolume (0..1)
     * @param {number} [ms=300]      how long to stay ducked before restoring
     */
    duck(factor = DEFAULT_DUCK_FACTOR, ms = DEFAULT_DUCK_MS) {
      if (!ctx || !bgmGain) return;

      isDucking = true;
      if (duckRestoreTimeout !== null) {
        clearTimeout(duckRestoreTimeout);
        duckRestoreTimeout = null;
      }

      const duckVol = baseVolume * Math.max(0, Math.min(1, factor));
      rampGain(duckVol, 80);

      duckRestoreTimeout = setTimeout(() => {
        isDucking = false;
        rampGain(baseVolume, ms * 0.5 || 200);
        duckRestoreTimeout = null;
      }, ms);
    },

    /**
     * Set the BGM base volume (persists across tracks).
     * @param {number} v  0..1
     */
    setVolume(v) {
      ensureContext();
      baseVolume = Math.max(0, Math.min(1, v));
      if (!isDucking) {
        rampGain(baseVolume, 150);
      }
    },

    /** Currently playing key, or null */
    get currentKey() { return currentKey; },
  };

  global.BGM = BGM;

}(window));
