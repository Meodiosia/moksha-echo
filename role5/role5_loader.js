// role5_loader.js
window.ROLE5_IMG = {};
window._role5Loaded = false;

const ROLE5_FRAME_COUNT = {
  idle:  31,
  walk:  45,
  run:   21,
  rush:  32,
  atk1:  21,
  atk2:  15,
  atk3:  26,
  atk4:  107,
  atk6:  51,
  atk7:  36,
  atk8:  81,
  atk9:  75,
  atk10: 61,
  def:   55,
  hurt:  33,
};

const ROLE5_PAD = { atk4: 3 };

function loadRole5Frames(onReady){
  const keys = Object.keys(ROLE5_FRAME_COUNT);
  let total = 0;
  for(const k of keys) total += ROLE5_FRAME_COUNT[k];
  let loaded = 0;
  console.log('[role5] loading', keys.length, 'anims /', total, 'frames');

  function done(){
    if(++loaded >= total){
      window._role5Loaded = true;
      console.log('[role5] all frames loaded');
      if(onReady) onReady();
    }
  }

  for(const key of keys){
    ROLE5_IMG[key] = [];
    const cnt = ROLE5_FRAME_COUNT[key];
    const pad = ROLE5_PAD[key] || 2;
    for(let i = 0; i < cnt; i++){
      const img = new Image();
      const idx = String(i).padStart(pad, '0');
      const _i = i, _key = key;
      img.onload  = function(){ ROLE5_IMG[_key][_i] = this; done(); };
      img.onerror = function(){ ROLE5_IMG[_key][_i] = null;  done(); };
      img.src = 'role5/' + key + '/' + key + '_' + idx + '.png';
    }
  }
}

window.loadRole5Frames = loadRole5Frames;
