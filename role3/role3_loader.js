// ── role3_loader.js ───────────────────────────────────────────
// 加载 role3 所有动画帧到 ROLE3_IMG[key][i]
// 配置：role3_src.js 提供 ROLE3_FRAME_COUNT
// 入口：loadRole3Frames(onReady)
// ──────────────────────────────────────────────────────────────

window.ROLE3_IMG = {};
window._role3Loaded = false;
window.ROLE3_SWORDS_IMG = null;     // swords.png（巨剑素材）

function loadRole3Frames(onReady){
  // 先单独加载 swords.png
  const swImg = new Image();
  swImg.onload = () => { ROLE3_SWORDS_IMG = swImg; console.log('[role3] swords.png loaded', swImg.width, 'x', swImg.height); };
  swImg.onerror = () => { console.warn('[role3] swords.png 加载失败'); };
  swImg.src = 'role3_swords.png';

  if(typeof ROLE3_FRAME_COUNT === 'undefined'){
    console.error('[role3] ROLE3_FRAME_COUNT 未定义，先加载 role3_src.js');
    if(onReady) onReady();
    return;
  }
  const keys = Object.keys(ROLE3_FRAME_COUNT);
  let total = 0;
  for(const k of keys) total += ROLE3_FRAME_COUNT[k];
  let loaded = 0;
  console.log('[role3] 加载', keys.length, '动画 /', total, '帧');

  for(const key of keys){
    ROLE3_IMG[key] = [];
    const cnt = ROLE3_FRAME_COUNT[key];
    for(let i=0; i<cnt; i++){
      const img = new Image();
      const idx = String(i).padStart(3, '0');
      const _key = key, _i = i;
      img.onload  = () => {
        loaded++;
        if(loaded === total){
          window._role3Loaded = true;
          console.log('[role3] all frames loaded');
          onReady && onReady();
        }
      };
      img.onerror = () => {
        loaded++;
        console.warn('[role3] fail load', _key, _i);
        if(loaded === total){
          window._role3Loaded = true;
          onReady && onReady();
        }
      };
      img.src = `role3_frames/${key}/${idx}.png`;
      ROLE3_IMG[key][i] = img;
    }
  }
}

// 取某 anim 在 phase01 (0~1) 的对应帧
function role3Frame(key, phase01){
  const arr = ROLE3_IMG[key];
  if(!arr || arr.length === 0) return null;
  const fi = Math.max(0, Math.min(arr.length-1, Math.floor(phase01 * arr.length)));
  return arr[fi];
}
window.role3Frame = role3Frame;
window.loadRole3Frames = loadRole3Frames;
