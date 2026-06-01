// game/core/config.js
// Central tunable config. Read-only at runtime by convention; mutate via dev console only.
(function (root) {
  'use strict';

  var CONFIG = {
    player: {
      maxHp: 100,
      baseDmg: 18,
      dashCD: 0.85,
      dashDur: 0.13,
      cdHolyCharge: 2.5,
      cdTwinMoon: 4.0,
      cdSanctuary: 12.0,
      sanctuaryDuration: 0.7
    },
    lucia: {
      maxHp: 1500,
      p1Speed: 1.0,
      p2Speed: 1.25,
      p3Speed: 1.5,
      cloneChance: 0.45,
      ringRushCount: 5
    },
    combat: {
      perfectParryWindow: 0.18,
      hitStopShort: 0.06,
      hitStopLong: 0.12,
      slowMoFactor: 0.35
    },
    ui: {
      fontFamily: 'Consolas',
      primaryColor: '#FFD080'
    },
    audio: {
      masterVolume: 1.0,
      sfxVolume: 1.0,
      bgmVolume: 0.6
    }
  };

  // Optional deep-freeze helper to catch accidental writes during dev.
  // Leave unfrozen by default so designers can hot-tweak in console.
  CONFIG.__freeze = function () {
    var stack = [CONFIG];
    while (stack.length) {
      var o = stack.pop();
      Object.freeze(o);
      for (var k in o) {
        if (o.hasOwnProperty(k) && typeof o[k] === 'object' && o[k] !== null) {
          stack.push(o[k]);
        }
      }
    }
  };

  root.GAME_CONFIG = CONFIG;
})(typeof window !== 'undefined' ? window : globalThis);
