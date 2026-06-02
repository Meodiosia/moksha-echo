// ground_map1_mask.js — map1.png (天空之城) 可行走区域 mask
// 1 = 可走（白色地台），0 = 不可走（海水/边缘）
// 72×48 tiles，可用 mask_editor.html 手动调整
// 注意：等距视角，地台实际形状需对照图片微调

const MAP1_MASK_W = 72;
const MAP1_MASK_H = 48;

(function(){
  const W = MAP1_MASK_W, H = MAP1_MASK_H;
  const grid = [];
  for(let y = 0; y < H; y++){
    grid.push(new Array(W).fill(0));
  }

  function fill(x0, y0, x1, y1){
    for(let y = Math.max(0,y0); y <= Math.min(H-1,y1); y++)
      for(let x = Math.max(0,x0); x <= Math.min(W-1,x1); x++)
        grid[y][x] = 1;
  }

  // ── 左下大平台（主战场）──
  fill(2,  26, 28, 42);

  // ── 左上小平台 ──
  fill(10, 10, 22, 20);

  // ── 左侧连接走道（左上→左下）──
  fill(12, 19, 18, 27);

  // ── 中央走道（横向连接）──
  fill(26, 20, 40, 28);

  // ── 右上大平台 ──
  fill(36, 8,  66, 24);

  // ── 右下延伸台 ──
  fill(44, 22, 62, 36);

  // ── 右下小台 ──
  fill(50, 34, 64, 42);

  // 转成字符串
  let s = '';
  for(let y = 0; y < H; y++)
    for(let x = 0; x < W; x++)
      s += grid[y][x];

  window.MAP1_MASK   = s;
  window.MAP1_MASK_W = W;
  window.MAP1_MASK_H = H;
})();
