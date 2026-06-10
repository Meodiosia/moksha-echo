// theed_loader.js — Theed boss frame loader (v2: + atk01-08)
(function(){
  'use strict';

  const BASE = 'bosses/Theed/';
  const ANIMS = {
    idle:  { prefix: 'idle/idle_',   start: 1,  count: 144 },
    walk:  { prefix: 'walk/walk_',   start: 12, count: 43  },
    def:   { prefix: 'def/def_',     start: 1,  count: 144 },
    atk01: { prefix: 'atk01/atk01_', start: 1,  count: 48  },
    atk02: { prefix: 'atk02/atk02_', start: 1,  count: 53  },
    atk03: { prefix: 'atk03/atk03_', start: 1,  count: 42  },
    atk04: { prefix: 'atk04/atk04_', start: 1,  count: 41  },
    atk05: { prefix: 'atk05/atk05_', start: 1,  count: 82  },
    atk06: { prefix: 'atk06/atk06_', start: 1,  count: 64  },
    atk07: { prefix: 'atk07/atk07_', start: 1,  count: 144 },
    atk08: { prefix: 'atk08/atk08_', start: 1,  count: 96  },
  };

  window.THEED_IMG = {
    idle: [], walk: [], def: [],
    atk01: [], atk02: [], atk03: [],
    atk04: [], atk05: [], atk06: [], atk07: [], atk08: [],
  };
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
