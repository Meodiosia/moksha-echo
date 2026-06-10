// theed_loader.js — Theed boss frame loader
(function(){
  'use strict';

  const BASE = 'bosses/Theed/';
  const ANIMS = {
    idle: { prefix: 'idle/idle_', start: 1,  count: 144 },
    walk: { prefix: 'walk/walk_', start: 12, count: 43  }, // walk_0012~walk_0054
    def:  { prefix: 'def/def_',  start: 1,  count: 144 },
  };

  window.THEED_IMG = { idle: [], walk: [], def: [] };
  window._theedLoaded = false;

  function pad4(n){ return String(n).padStart(4,'0'); }

  window.loadTheedFrames = function(cb){
    if(window._theedLoaded){ cb && cb(); return; }
    let total = 0, done = 0;
    function tick(){ done++; if(done >= total){ window._theedLoaded = true; cb && cb(); } }

    for(const key in ANIMS){
      const a = ANIMS[key];
      for(let i = 0; i < a.count; i++){
        total++;
        const img = new Image();
        const n = a.start + i;
        img.src = BASE + a.prefix + pad4(n) + '.png';
        img.onload  = function(){ window.THEED_IMG[key].push(this); tick(); };
        img.onerror = function(){ tick(); };
      }
    }
    if(total === 0){ window._theedLoaded = true; cb && cb(); }
  };
})();
