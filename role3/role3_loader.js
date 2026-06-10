
window.ROLE3_IMG = {};
window._role3Loaded = false;
window.ROLE3_SWORDS_IMG = null;     // swords.png

function loadRole3Frames(onReady){
  const swImg = new Image();
  swImg.onload = () => { ROLE3_SWORDS_IMG = swImg; console.log('[role3] swords.png loaded', swImg.width, 'x', swImg.height); };
  swImg.onerror = () => { console.warn('[role3] swords.png load error'); };
  swImg.src = 'role3_swords.png';

  if(typeof ROLE3_FRAME_COUNT === 'undefined'){
    console.error('[role3] ROLE3_FRAME_COUNT not defined');
    if(onReady) onReady();
    return;
  }
  const keys = Object.keys(ROLE3_FRAME_COUNT);
  let total = 0;
  for(const k of keys) total += ROLE3_FRAME_COUNT[k];
  let loaded = 0;
  console.log('[role3] loading frames...');

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

function role3Frame(key, phase01){
  const arr = ROLE3_IMG[key];
  if(!arr || arr.length === 0) return null;
  const fi = Math.max(0, Math.min(arr.length-1, Math.floor(phase01 * arr.length)));
  return arr[fi];
}
window.role3Frame = role3Frame;
window.loadRole3Frames = loadRole3Frames;
