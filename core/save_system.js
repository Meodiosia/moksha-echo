// game/core/save_system.js
// LocalStorage-backed save with schema versioning + migrations.
(function (root) {
  'use strict';

  var KEY = 'demo3c_save_v2';   // key 升级避免读到旧格式
  var SCHEMA_VERSION = 2;

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
      },
      // ── V2 新增：Roguelite Meta 进度 ──────────────
      meta: {
        seals:          0,     // 渡劫印记（局间货币）
        totalRuns:      0,     // 总局数
        totalVictories: 0,     // 通关次数
        totalDeaths:    0,     // 死亡次数
        tribulation:    0,     // 渡劫层数（热度，每通关+1）
        bossKills: {
          lucia: 0             // 各 Boss 击杀次数
        },
        unlockedRelics: [],    // 已解锁法宝 id（V2.0 道统商店用）
        lifetimeStats: {       // 累计统计
          swordHits:    0,
          blocks:       0,
          dashHits:     0,
          combosTriggered: 0
        }
      }
    };
  }

  // --- migrations ------------------------------------------------------------
  var MIGRATIONS = {
    // v1 → v2：添加 meta 字段
    1: function (data) {
      data.meta = {
        seals: 0, totalRuns: 0, totalVictories: 0, totalDeaths: 0,
        tribulation: 0,
        bossKills: { lucia: 0 },
        unlockedRelics: [],
        lifetimeStats: { swordHits: 0, blocks: 0, dashHits: 0, combosTriggered: 0 }
      };
      return data;
    }
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
    _migrate: migrate, // exposed for tests

    // ── Meta 便捷 API ──────────────────────────
    // 读取 meta 字段（始终返回有效对象）
    getMeta: function(){
      var d = load();
      return d.meta || makeDefaults().meta;
    },

    // 局结束时写入：印记累加 + 统计更新
    recordRun: function(opts){
      // opts: { victory, sealsEarned, bossKilled, relicStats }
      opts = opts || {};
      var cur = load();
      var m = cur.meta;

      m.totalRuns      = (m.totalRuns || 0) + 1;
      m.seals          = (m.seals || 0) + (opts.sealsEarned || 0);

      if(opts.victory){
        m.totalVictories = (m.totalVictories || 0) + 1;
        m.tribulation    = (m.tribulation || 0) + 1;
        if(opts.bossKilled){
          m.bossKills = m.bossKills || {};
          m.bossKills[opts.bossKilled] = (m.bossKills[opts.bossKilled] || 0) + 1;
        }
      } else {
        m.totalDeaths  = (m.totalDeaths || 0) + 1;
        cur.progress.deathCount = (cur.progress.deathCount || 0) + 1;
      }

      // 累计战斗数据
      if(opts.relicStats){
        var ls = m.lifetimeStats = m.lifetimeStats || {};
        ls.swordHits       = (ls.swordHits       || 0) + (opts.relicStats.relicHits       || 0);
        ls.blocks          = (ls.blocks           || 0) + (opts.relicStats.blocksTriggered || 0);
        ls.dashHits        = (ls.dashHits         || 0) + (opts.relicStats.dashHits        || 0);
        ls.combosTriggered = (ls.combosTriggered  || 0) + (opts.relicStats.combosTrigered  || 0);
      }

      save(cur);
      console.log('[Save] 局结算写入 | 印记:', m.seals, '| 总局数:', m.totalRuns,
                  '| 通关:', m.totalVictories, '| 渡劫层:', m.tribulation);
      return m;
    },

    // 解锁新法宝（Meta进度用）
    unlockRelic: function(id){
      var cur = load();
      var arr = cur.meta.unlockedRelics = cur.meta.unlockedRelics || [];
      if(arr.indexOf(id) < 0){
        arr.push(id);
        save(cur);
        console.log('[Save] 解锁法宝:', id);
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
