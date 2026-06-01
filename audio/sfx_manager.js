/**
 * sfx_manager.js
 * Web Audio API – one-shot sound effect manager.
 *
 * API (window.SFX):
 *   SFX.init()                    – create / resume AudioContext
 *   SFX.preload(keys)             – fetch + decode buffers, returns Promise
 *   SFX.play(key, opts?)          – play sound, returns AudioBufferSourceNode | null
 *   SFX.stop(key)                 – stop all active instances of key
 *   SFX.setMasterVolume(v)        – 0..1
 *   SFX.isLoaded(key)             – boolean
 *
 * opts: { volume=1, pitch=1, loop=false, pan=0 }
 *
 * Rules:
 *   - Load failures → silent 1-frame buffer (never blocks gameplay)
 *   - Same key within THROTTLE_MS → ignored (防爆音)
 *   - Exposes _ctx so bgm_manager.js can share the AudioContext
 */
(function (global) {
  'use strict';

  const THROTTLE_MS = 50;

  /** @type {AudioContext|null} */
  let ctx = null;
  /** @type {GainNode|null} */
  let masterGain = null;

  /** key → AudioBuffer (never null after preload; silent buf on error) */
  const buffers = Object.create(null);

  /** key → AudioBufferSourceNode[] (currently playing) */
  const activeSources = Object.create(null);

  /** key → DOMHighResTimeStamp of last play call */
  const lastPlayTime = Object.create(null);

  /** key → Promise<AudioBuffer> (in-flight fetches, deduplication) */
  const loadingPromises = Object.create(null);

  // ─── helpers ──────────────────────────────────────────────────────────────

  function ensureContext() {
    if (!ctx) {
      ctx = new (global.AudioContext || global.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 1;
      masterGain.connect(ctx.destination);
    }
    // Resume if browser suspended it (autoplay policy)
    if (ctx.state === 'suspended') ctx.resume();
  }

  /** 1-frame silence – used as placeholder when load fails */
  function silentBuffer() {
    return ctx.createBuffer(1, 1, ctx.sampleRate);
  }

  /** Fetch, decode, and cache a single URL; returns AudioBuffer */
  async function fetchBuffer(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.arrayBuffer();
    // decodeAudioData is callback-based in older engines; promisify safely
    return new Promise((resolve, reject) => {
      ctx.decodeAudioData(raw, resolve, reject);
    });
  }

  // ─── public API ───────────────────────────────────────────────────────────

  const SFX = {

    /** Create / resume AudioContext. Safe to call multiple times. */
    init() {
      ensureContext();
    },

    /**
     * Preload an array of manifest keys.
     * @param {string[]} keys
     * @returns {Promise<void>}
     */
    async preload(keys) {
      ensureContext();
      const manifest = global.SFX_MANIFEST || {};

      const tasks = keys.map(async (key) => {
        // Already cached
        if (buffers[key]) return;

        // Already in-flight
        if (loadingPromises[key]) {
          await loadingPromises[key];
          return;
        }

        const url = manifest[key];
        if (!url) {
          console.warn(`[SFX] preload: no URL for key "${key}"`);
          buffers[key] = silentBuffer();
          return;
        }

        const p = fetchBuffer(url)
          .then((buf) => {
            buffers[key] = buf;
          })
          .catch((err) => {
            console.warn(`[SFX] preload failed for "${key}" (${url}):`, err.message);
            buffers[key] = silentBuffer();
          })
          .finally(() => {
            delete loadingPromises[key];
          });

        loadingPromises[key] = p;
        await p;
      });

      await Promise.all(tasks);
    },

    /**
     * Play a sound.
     * @param {string}  key
     * @param {object} [opts]
     * @param {number} [opts.volume=1]   0..1
     * @param {number} [opts.pitch=1]    playback rate
     * @param {boolean}[opts.loop=false]
     * @param {number} [opts.pan=0]      -1..1 (stereo pan)
     * @returns {AudioBufferSourceNode|null}
     */
    play(key, opts = {}) {
      ensureContext();

      // Throttle: ignore if same key played too recently
      const now = performance.now();
      if (lastPlayTime[key] !== undefined && now - lastPlayTime[key] < THROTTLE_MS) {
        return null;
      }
      lastPlayTime[key] = now;

      const buf = buffers[key];
      if (!buf) {
        console.warn(`[SFX] play: "${key}" not loaded – call preload() first`);
        return null;
      }

      const { volume = 1, pitch = 1, loop = false, pan = 0 } = opts;

      // Build mini graph: source → gainNode → [pannerNode →] masterGain
      const gainNode = ctx.createGain();
      gainNode.gain.value = Math.max(0, Math.min(2, volume));

      let lastNode = gainNode;

      if (pan !== 0 && ctx.createStereoPanner) {
        const panner = ctx.createStereoPanner();
        panner.pan.value = Math.max(-1, Math.min(1, pan));
        gainNode.connect(panner);
        panner.connect(masterGain);
        lastNode = panner;
      } else {
        gainNode.connect(masterGain);
      }

      const source = ctx.createBufferSource();
      source.buffer = buf;
      source.playbackRate.value = Math.max(0.1, pitch);
      source.loop = loop;
      source.connect(gainNode);
      source.start();

      // Track active sources
      if (!activeSources[key]) activeSources[key] = [];
      activeSources[key].push(source);

      source.onended = () => {
        const arr = activeSources[key];
        if (arr) {
          const idx = arr.indexOf(source);
          if (idx !== -1) arr.splice(idx, 1);
        }
        gainNode.disconnect();
        lastNode.disconnect();
      };

      return source;
    },

    /**
     * Stop all active instances of a key immediately.
     * @param {string} key
     */
    stop(key) {
      const arr = activeSources[key];
      if (!arr) return;
      arr.slice().forEach((src) => {
        try { src.stop(0); } catch (_) {}
      });
      activeSources[key] = [];
    },

    /**
     * Set master SFX volume.
     * @param {number} v  0..1
     */
    setMasterVolume(v) {
      ensureContext();
      const clamp = Math.max(0, Math.min(1, v));
      masterGain.gain.setTargetAtTime(clamp, ctx.currentTime, 0.02);
    },

    /**
     * Check if a key's buffer is loaded and ready.
     * @param {string} key
     * @returns {boolean}
     */
    isLoaded(key) {
      return Object.prototype.hasOwnProperty.call(buffers, key);
    },

    // Expose internals for BGM manager to share the same AudioContext
    get _ctx() { return ctx; },
    get _masterGain() { return masterGain; },
  };

  global.SFX = SFX;

}(window));
