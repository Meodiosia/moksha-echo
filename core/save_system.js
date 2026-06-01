// game/core/save_system.js
// LocalStorage-backed save with schema versioning + migrations.
(function (root) {
  'use strict';

  var KEY = 'demo3c_save_v1';
  var SCHEMA_VERSION = 1;

  // --- defaults --------------------------------------------------------------
  function makeDefaults() {
    return {
      _v: SCHEMA_VERSION,
      settings: {
        masterVolume: 1.0,
        sfxVolume: 1.0,
        bgmVolume: 0.6,
        showDamage: true,
        screenShake: true
      },
      progress: {
        unlockedLevels: [1],
        deathCount: 0,
        bestTime: Infinity
      },
      stats: {
        // free-form counters: e.g. 'parryCount', 'totalDmgDealt', etc.
      }
    };
  }

  // --- migrations ------------------------------------------------------------
  // Each entry migrates from version N to N+1. Add new fns as schema evolves.
  var MIGRATIONS = {
    // Example for future:
    // 1: function (data) { data.newField = 0; return data; },
  };

  function migrate(data) {
    if (!data || typeof data !== 'object') return makeDefaults();
    var v = (typeof data._v === 'number') ? data._v : 0;
    while (v < SCHEMA_VERSION) {
      var fn = MIGRATIONS[v];
      if (typeof fn === 'function') {
        try { data = fn(data) || data; }
        catch (e) { console.warn('[Save] migration', v, '->', v + 1, 'failed:', e); break; }
      }
      v++;
      data._v = v;
    }
    // Fill any missing top-level keys from defaults (forward-compat).
    return mergeDefaults(makeDefaults(), data);
  }

  // --- helpers ---------------------------------------------------------------
  function isPlainObject(o) {
    return o !== null && typeof o === 'object' && !Array.isArray(o);
  }

  // Recursive default-merge: keeps user values; adds missing keys from defaults.
  function mergeDefaults(def, user) {
    if (!isPlainObject(user)) return def;
    var out = {};
    var k;
    for (k in def) {
      if (isPlainObject(def[k])) out[k] = mergeDefaults(def[k], user[k]);
      else out[k] = (user[k] !== undefined) ? user[k] : def[k];
    }
    // Preserve extra user keys (e.g. stats counters).
    for (k in user) if (!(k in out)) out[k] = user[k];
    return out;
  }

  // Deep partial patch: merges partial into target.
  function deepPatch(target, partial) {
    if (!isPlainObject(partial)) return target;
    for (var k in partial) {
      if (isPlainObject(partial[k]) && isPlainObject(target[k])) {
        deepPatch(target[k], partial[k]);
      } else {
        target[k] = partial[k];
      }
    }
    return target;
  }

  // JSON cannot represent Infinity; encode/decode as sentinel.
  function encode(data) {
    return JSON.stringify(data, function (k, v) {
      if (v === Infinity) return '__INF__';
      if (v === -Infinity) return '__NINF__';
      if (typeof v === 'number' && isNaN(v)) return '__NAN__';
      return v;
    });
  }
  function decode(str) {
    return JSON.parse(str, function (k, v) {
      if (v === '__INF__') return Infinity;
      if (v === '__NINF__') return -Infinity;
      if (v === '__NAN__') return NaN;
      return v;
    });
  }

  function storage() {
    try { return root.localStorage; } catch (e) { return null; }
  }

  // --- public API ------------------------------------------------------------
  function load() {
    var s = storage();
    if (!s) return makeDefaults();
    var raw = null;
    try { raw = s.getItem(KEY); } catch (e) { return makeDefaults(); }
    if (!raw) return makeDefaults();
    var parsed;
    try { parsed = decode(raw); }
    catch (e) { console.warn('[Save] corrupt save, resetting:', e); return makeDefaults(); }
    return migrate(parsed);
  }

  function save(data) {
    var s = storage(); if (!s) return false;
    var payload = data ? deepPatch(makeDefaults(), data) : makeDefaults();
    payload._v = SCHEMA_VERSION;
    try { s.setItem(KEY, encode(payload)); return true; }
    catch (e) { console.warn('[Save] write failed:', e); return false; }
  }

  function patch(partial) {
    var cur = load();
    deepPatch(cur, partial || {});
    save(cur);
    return cur;
  }

  function clear() {
    var s = storage(); if (!s) return;
    try { s.removeItem(KEY); } catch (e) {}
  }

  root.Save = {
    KEY: KEY,
    SCHEMA_VERSION: SCHEMA_VERSION,
    get defaults() { return makeDefaults(); },
    load: load,
    save: save,
    patch: patch,
    clear: clear,
    _migrate: migrate // exposed for tests
  };
})(typeof window !== 'undefined' ? window : globalThis);
