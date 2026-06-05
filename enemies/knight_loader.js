// knight_loader.js — 骑士精灵帧加载器
// 帧来源: game/knight_frames/{walk|atk1|atk2|atk3}/000.png ...
// 访问:  window.KNIGHT_IMG.walk / atk1 / atk2 / atk3

window.KNIGHT_IMG = {};
window._knightLoaded = false;

const KNIGHT_FRAME_COUNT = { walk:40, atk1:40, atk2:40, atk3:39 };

// 不做 crop，直接用全帧（1300×1000），保证任何动作都不被截断
// 绘制时缩小到 DRAW_H 高度对应的比例
window.KNIGHT_CROP = null; // null = 使用全帧

function loadKnightFrames(onReady){
  const keys = Object.keys(KNIGHT_FRAME_COUNT);
  let total = 0;
  for(const k of keys) total += KNIGHT_FRAME_COUNT[k];
  let loaded = 0;
  if(typeof window._LP!=='undefined') window._LP.reg('knight','骑士动作帧',total);

  for(const key of keys){
    KNIGHT_IMG[key] = [];
    const cnt = KNIGHT_FRAME_COUNT[key];
    for(let i = 0; i < cnt; i++){
      const img = new Image();
      const idx = String(i).padStart(3, '0');
      img.onload = ()=>{
        loaded++;
        if(typeof window._LP!=='undefined') window._LP.tick('knight',loaded,total);
        if(loaded === total){
          window._knightLoaded = true;
          console.log('[knight] all frames loaded');
          if(typeof window._LP!=='undefined') window._LP.done('knight');
          onReady && onReady();
        }
      };
      img.onerror = ()=>{
        loaded++;
        console.warn('[knight] fail:', key, i);
        if(typeof window._LP!=='undefined') window._LP.tick('knight',loaded,total);
        if(loaded === total){ window._knightLoaded = true; onReady && onReady(); }
      };
      img.src = `knight_frames/${key}/${idx}.png`;
      KNIGHT_IMG[key][i] = img;
    }
  }
}

window.loadKnightFrames = loadKnightFrames;
