// ── map_atlas.js ──────────────────────────────────────────────
// 关卡系统 v3：独立 sprite 文件 + 预生成 ground_mask
//
// 资源依赖：
//   back.png          熔岩岩壁背景（最深层）
//   ground_clean.png  关卡地面（白底已抠为透明）
//   ground_mask.js    可行走区域 mask（GROUND_MASK 字符串）
//   stones/stone_NNN.png  98 个独立装饰 sprite
//
// HTML 加载顺序（demo-3c.html）：
//   <script src="ground_mask.js"></script>
//   <script src="map_atlas.js"></script>
// ──────────────────────────────────────────────────────────────

const NEW_MAP_W = 72;
const NEW_MAP_H = 48;

// ── PROP 定义：每个 prop 关联一个 stone_NNN.png ────────────────
// id 从 _preview.png 标号读取
// tw/th  = 碰撞 tile 大小
// dw/dh  = 渲染像素大小（在 ISO 视角下的视觉尺寸）
// anchorY= 锚点（1=底部对齐 tile 底）
// solid  = 是否阻挡
// fire   = 是否火源（动态闪烁）
// ground = 贴地装饰（先画，不参与 Y-sort）
const PROP_DEFS = {
  // 石柱（编号 2-11，挑选 5 个不同款）
  pillarA:     { id:2,  tw:1, th:1, dw:30, dh:64, anchorY:1, solid:true,  minDist:3 },
  pillarB:     { id:3,  tw:1, th:1, dw:30, dh:64, anchorY:1, solid:true,  minDist:3 },
  pillarChain: { id:11, tw:1, th:1, dw:32, dh:64, anchorY:1, solid:true,  minDist:4 },
  pillarLion:  { id:8,  tw:1, th:1, dw:36, dh:64, anchorY:1, solid:true,  minDist:5 },
  pillarTorch: { id:10, tw:1, th:1, dw:36, dh:66, anchorY:1, solid:true,  minDist:5, fire:true },

  // 方尖碑/尖石碑
  spireSkull:  { id:21, tw:1, th:1, dw:36, dh:80, anchorY:1, solid:true,  minDist:6 },
  obeliskHigh: { id:12, tw:1, th:1, dw:32, dh:78, anchorY:1, solid:true,  minDist:5 },
  obeliskA:    { id:26, tw:1, th:2, dw:38, dh:88, anchorY:1, solid:true,  minDist:6 },
  obeliskB:    { id:30, tw:1, th:2, dw:38, dh:88, anchorY:1, solid:true,  minDist:6 },

  // 雕像
  statueRobedA:{ id:27, tw:1, th:1, dw:36, dh:78, anchorY:1, solid:true,  minDist:8 },
  statueRobedB:{ id:28, tw:1, th:1, dw:36, dh:78, anchorY:1, solid:true,  minDist:8 },
  statueRobedC:{ id:29, tw:1, th:1, dw:36, dh:78, anchorY:1, solid:true,  minDist:8 },

  // 铁栅栏
  fenceShort:  { id:23, tw:2, th:1, dw:75, dh:55, anchorY:1, solid:true,  minDist:7 },
  fenceLong:   { id:24, tw:3, th:1, dw:108,dh:60, anchorY:1, solid:true,  minDist:9 },
  gateBig:     { id:25, tw:3, th:1, dw:115,dh:75, anchorY:1, solid:true,  minDist:10 },

  // 拱门
  archGate:    { id:89, tw:3, th:2, dw:115,dh:120,anchorY:1, solid:true,  minDist:12 },

  // 岩石/平台
  rockPile:    { id:13, tw:1, th:1, dw:34, dh:55, anchorY:1, solid:true,  minDist:4 },
  rockTall:    { id:14, tw:1, th:1, dw:36, dh:65, anchorY:1, solid:true,  minDist:4 },
  rockHollow:  { id:15, tw:2, th:1, dw:55, dh:60, anchorY:1, solid:true,  minDist:5 },
  rockPlat:    { id:31, tw:2, th:2, dw:75, dh:60, anchorY:1, solid:true,  minDist:7 },
  rockPlatBig: { id:34, tw:3, th:2, dw:90, dh:65, anchorY:1, solid:true,  minDist:8 },

  // 祭坛/装饰
  altarPurple: { id:47, tw:1, th:1, dw:48, dh:50, anchorY:1, solid:true,  minDist:6, fire:true, fireColor:'purple' },
  altarFire:   { id:48, tw:1, th:1, dw:42, dh:55, anchorY:1, solid:true,  minDist:6, fire:true, fireColor:'purple' },
  candelabra:  { id:38, tw:1, th:1, dw:24, dh:50, anchorY:1, solid:false, minDist:2, fire:true },
  candleSingleA:{id:52, tw:1, th:1, dw:14, dh:30, anchorY:1, solid:false, minDist:2, fire:true },
  candleSingleB:{id:53, tw:1, th:1, dw:14, dh:30, anchorY:1, solid:false, minDist:2, fire:true },
  hangChain:   { id:22, tw:1, th:1, dw:22, dh:55, anchorY:1, solid:false, minDist:4 },

  // 树/水晶
  deadTree1:   { id:39, tw:1, th:1, dw:50, dh:65, anchorY:1, solid:true,  minDist:5 },
  deadTree2:   { id:40, tw:1, th:1, dw:50, dh:65, anchorY:1, solid:true,  minDist:5 },
  swordStuck:  { id:41, tw:1, th:1, dw:18, dh:55, anchorY:1, solid:false, minDist:3 },
  crystalBlue: { id:42, tw:1, th:1, dw:24, dh:38, anchorY:1, solid:false, minDist:3 },
  crystalCluster:{id:49,tw:1, th:1, dw:36, dh:50, anchorY:1, solid:true,  minDist:4 },
  crystalSmall:{ id:50, tw:1, th:1, dw:20, dh:32, anchorY:1, solid:false, minDist:2 },
  crystalPurple:{id:66, tw:1, th:1, dw:36, dh:42, anchorY:1, solid:true,  minDist:4 },

  // 墓碑
  tomb1:       { id:59, tw:1, th:1, dw:30, dh:50, anchorY:1, solid:true,  minDist:3 },
  tomb2:       { id:60, tw:1, th:1, dw:30, dh:50, anchorY:1, solid:true,  minDist:3 },
  tomb3:       { id:61, tw:1, th:1, dw:30, dh:50, anchorY:1, solid:true,  minDist:3 },
  tomb4:       { id:62, tw:1, th:1, dw:30, dh:50, anchorY:1, solid:true,  minDist:3 },
  tombSpike:   { id:63, tw:1, th:1, dw:28, dh:55, anchorY:1, solid:true,  minDist:4 },
  graveCross:  { id:70, tw:1, th:1, dw:36, dh:50, anchorY:1, solid:true,  minDist:4 },
  graveCross2: { id:87, tw:1, th:1, dw:30, dh:46, anchorY:1, solid:true,  minDist:4 },
  cross44:     { id:44, tw:1, th:1, dw:22, dh:44, anchorY:1, solid:false, minDist:3 },

  // 罐/瓶/坛（小装饰）
  urnTall:     { id:43, tw:1, th:1, dw:18, dh:32, anchorY:1, solid:false, minDist:2 },
  urnA:        { id:79, tw:1, th:1, dw:24, dh:32, anchorY:1, solid:false, minDist:2 },
  urnB:        { id:83, tw:1, th:1, dw:22, dh:30, anchorY:1, solid:false, minDist:2 },
  urnC:        { id:84, tw:1, th:1, dw:22, dh:28, anchorY:1, solid:false, minDist:2 },
  vasePair:    { id:74, tw:1, th:1, dw:30, dh:24, anchorY:1, solid:false, minDist:3 },

  // 宝箱
  chestS1:     { id:67, tw:1, th:1, dw:28, dh:30, anchorY:1, solid:false, minDist:3 },
  chestS2:     { id:68, tw:1, th:1, dw:28, dh:30, anchorY:1, solid:false, minDist:3 },
  chestL:      { id:69, tw:1, th:1, dw:42, dh:36, anchorY:1, solid:false, minDist:5 },
  chestM:      { id:78, tw:1, th:1, dw:34, dh:30, anchorY:1, solid:false, minDist:4 },
  chestHuge:   { id:88, tw:2, th:1, dw:55, dh:42, anchorY:1, solid:true,  minDist:6 },

  // 地纹（贴地，non-solid）
  floorBridge: { id:95, tw:3, th:1, dw:90, dh:55, anchorY:0.5, solid:false, ground:true },
  floorSeal1:  { id:96, tw:3, th:2, dw:100,dh:60, anchorY:0.5, solid:false, ground:true },
  floorSeal2:  { id:97, tw:3, th:2, dw:100,dh:60, anchorY:0.5, solid:false, ground:true },
};

// ── 关卡布局（手锚定）─────────────────────────────────────────
// 玩家出生 (36, 38)，Boss出生 (36, 10)
// 设计为对称的Boss竞技场
const ANCHOR_PROPS = [
  // 中心地纹
  { type:'floorSeal2', tx:34, ty:23 },

  // Boss身后大拱门
  { type:'archGate',   tx:34, ty:6  },

  // Boss两侧火焰祭坛（紫焰）
  { type:'altarPurple',tx:28, ty:11 },
  { type:'altarPurple',tx:42, ty:11 },

  // 北侧方尖碑对称
  { type:'obeliskA',   tx:24, ty:8  },
  { type:'obeliskB',   tx:46, ty:8  },

  // 北侧带火盆柱
  { type:'pillarTorch',tx:20, ty:10 },
  { type:'pillarTorch',tx:50, ty:10 },

  // 中部死神雕像左右对称
  { type:'statueRobedA',tx:14, ty:20 },
  { type:'statueRobedC',tx:55, ty:20 },

  // 中部带链石柱
  { type:'pillarChain',tx:18, ty:24 },
  { type:'pillarChain',tx:52, ty:24 },

  // 中部铁栅栏
  { type:'fenceLong',  tx:11, ty:14 },
  { type:'fenceLong',  tx:55, ty:14 },

  // 中央两侧吊灯
  { type:'candelabra', tx:30, ty:17 },
  { type:'candelabra', tx:40, ty:17 },

  // 南侧（玩家入口）尖石碑对称
  { type:'spireSkull', tx:22, ty:36 },
  { type:'spireSkull', tx:48, ty:36 },

  // 南侧紫焰祭坛
  { type:'altarFire',  tx:28, ty:39 },
  { type:'altarFire',  tx:42, ty:39 },

  // 四角pillarLion守卫
  { type:'pillarLion', tx:8,  ty:8  },
  { type:'pillarLion', tx:62, ty:8  },
  { type:'pillarLion', tx:8,  ty:38 },
  { type:'pillarLion', tx:62, ty:38 },

  // 四角pillarA装饰
  { type:'pillarA',    tx:5,  ty:14 },
  { type:'pillarB',    tx:65, ty:14 },
  { type:'pillarA',    tx:5,  ty:32 },
  { type:'pillarB',    tx:65, ty:32 },

  // 南北墓碑群
  { type:'tomb1',      tx:11, ty:42 },
  { type:'tomb2',      tx:13, ty:43 },
  { type:'tomb3',      tx:58, ty:42 },
  { type:'tomb4',      tx:60, ty:43 },

  // 守墓十字架
  { type:'graveCross', tx:9,  ty:42 },
  { type:'graveCross2',tx:62, ty:43 },
];

// ── 模块状态 ──────────────────────────────────────────────────
let _backImg   = null;
let _groundImg = null;
let _atlasReady = false;
const _stoneCache = {}; // id → Image
let _stonesPending = 0;

function _rng(seed) {
  const h = Math.sin(seed * 127.1 + 3.14) * 43758.5453;
  return h - Math.floor(h);
}

// ── 加载所有需要的 stone 文件 ──────────────────────────────────
function _gatherUsedStoneIds() {
  const ids = new Set();
  for(const k in PROP_DEFS) ids.add(PROP_DEFS[k].id);
  return [...ids];
}

function _loadStone(id, onDone) {
  if(_stoneCache[id]) { onDone(_stoneCache[id]); return; }
  const img = new Image();
  img.onload  = () => { _stoneCache[id] = img; onDone(img); };
  img.onerror = () => { console.warn('[map] stone_'+id+' load failed'); onDone(null); };
  img.src = 'stones/stone_' + String(id).padStart(3, '0') + '.png';
}

// ── 加载入口：back + ground + 所有stones ───────────────────────
function loadAtlas(onReady) {
  const ids = _gatherUsedStoneIds();
  let pending = 2 + ids.length; // back + ground + N stones
  const done = () => {
    if(--pending <= 0) {
      _atlasReady = true;
      console.log('[map] all assets ready: back=%s ground=%s stones=%d',
        _backImg && _backImg.naturalWidth ? 'ok' : 'fail',
        _groundImg && _groundImg.naturalWidth ? 'ok' : 'fail',
        Object.keys(_stoneCache).length);
      onReady && onReady();
    }
  };

  _backImg = new Image();
  _backImg.onload  = () => { console.log('[map] back.png loaded', _backImg.naturalWidth+'x'+_backImg.naturalHeight); done(); };
  _backImg.onerror = () => { console.error('[map] back.png 加载失败'); done(); };
  _backImg.src = 'back.png';

  _groundImg = new Image();
  _groundImg.onload = () => { console.log('[map] ground loaded'); done(); };
  _groundImg.onerror = () => { console.error('[map] ground 加载失败'); done(); };
  _groundImg.src = window._activeGroundUrl || 'ground_clean.png';

  for(const id of ids) _loadStone(id, () => done());
}

// 切换关卡：替换 ground 图 + mask + 重建 map canvas
window.switchLevel = function(opts){
  opts = opts || {};
  if(opts.mask)     window._activeGroundMask = opts.mask;
  if(opts.maskW)    window._activeGroundMaskW = opts.maskW;
  if(opts.maskH)    window._activeGroundMaskH = opts.maskH;
  if(opts.groundUrl) window._activeGroundUrl = opts.groundUrl;
  _atlasReady = false;
  _groundImg = new Image();
  _groundImg.onload = () => {
    _atlasReady = true;
    console.log('[map] switched to', opts.groundUrl);
    if(opts.onReady) opts.onReady();
  };
  _groundImg.onerror = () => {
    console.error('[map] switch failed:', opts.groundUrl);
    _atlasReady = true;
    if(opts.onReady) opts.onReady();
  };
  _groundImg.src = opts.groundUrl || 'ground_clean.png';
};

// 内部读取当前生效 mask 字符串
function _mask()  { return window._activeGroundMask  || (typeof GROUND_MASK   !== 'undefined' ? GROUND_MASK   : ''); }
function _maskW() { return window._activeGroundMaskW || (typeof GROUND_MASK_W !== 'undefined' ? GROUND_MASK_W : 72); }
function _maskH() { return window._activeGroundMaskH || (typeof GROUND_MASK_H !== 'undefined' ? GROUND_MASK_H : 48); }

// ── 碰撞：用预生成的 GROUND_MASK ──────────────────────────────
function applyGroundCollision(map, MW, MH) {
  const M = _mask(); const MWm = _maskW(); const MHm = _maskH();
  if(!M) {
    for(let y=0;y<MH;y++) for(let x=0;x<MW;x++)
      map[y][x] = (x<2||y<2||x>=MW-2||y>=MH-2) ? 1 : 0;
    return;
  }
  for(let y=0; y<MH; y++) for(let x=0; x<MW; x++) {
    if(y >= MHm || x >= MWm) { map[y][x]=1; continue; }
    const ch = M.charAt(y * MWm + x);
    map[y][x] = (ch === '1') ? 0 : 1;
  }
}

// 检查某 tile 是否可走（用 mask）
function _isWalkable(tx, ty) {
  const M = _mask(); const MWm = _maskW(); const MHm = _maskH();
  if(!M) return true;
  if(tx<0 || ty<0 || tx>=MWm || ty>=MHm) return false;
  return M.charAt(ty * MWm + tx) === '1';
}

// ── 散布：在可走地块上摆放装饰 ────────────────────────────────
function generateLevelProps(playerSpawn, bossSpawn) {
  const T = 24;
  const MW = NEW_MAP_W, MH = NEW_MAP_H;
  const props = [];

  const occupied = new Set();
  const mark = (tx, ty, tw, th) => {
    for(let dy=-1; dy<=th; dy++) for(let dx=-1; dx<=tw; dx++)
      occupied.add(`${tx+dx},${ty+dy}`);
  };
  const isOcc = (tx, ty, tw, th) => {
    for(let dy=0; dy<th; dy++) for(let dx=0; dx<tw; dx++)
      if(occupied.has(`${tx+dx},${ty+dy}`)) return true;
    return false;
  };

  // 锚定：必须在可走地块上才能放
  for(const p of ANCHOR_PROPS) {
    const def = PROP_DEFS[p.type];
    if(!def) continue;
    let ok = true;
    for(let dy=0; dy<def.th && ok; dy++)
      for(let dx=0; dx<def.tw && ok; dx++)
        if(!_isWalkable(p.tx+dx, p.ty+dy)) ok = false;
    if(!ok) continue; // 锚点落到虚空，跳过
    if(isOcc(p.tx, p.ty, def.tw, def.th)) continue;
    props.push(p);
    mark(p.tx, p.ty, def.tw, def.th);
  }

  const pTx = Math.floor(playerSpawn.x / T);
  const pTy = Math.floor(playerSpawn.y / T);
  const bTx = Math.floor(bossSpawn.x / T);
  const bTy = Math.floor(bossSpawn.y / T);

  // 散布列表
  const fillTypes = [
    'pillarA','pillarB','pillarChain',
    'rockPile','rockTall','rockHollow',
    'tomb1','tomb2','tomb3','tomb4',
    'crystalBlue','crystalCluster','crystalSmall','crystalPurple',
    'deadTree1','deadTree2',
    'urnTall','urnA','urnB','urnC','vasePair',
    'chestS1','chestS2','chestL','chestM',
    'candleSingleA','candleSingleB',
    'swordStuck','hangChain','cross44',
    'tombSpike',
  ];

  let seed = 333;
  for(let i=0; i<fillTypes.length*2; i++) {
    const type = fillTypes[i % fillTypes.length];
    const def = PROP_DEFS[type];
    if(!def) continue;

    let placed = false;
    for(let attempt=0; attempt<60 && !placed; attempt++) {
      seed++;
      const tx = 2 + Math.floor(_rng(seed*7)   * (MW - 4 - def.tw));
      const ty = 2 + Math.floor(_rng(seed*7+1) * (MH - 4 - def.th));

      // 中心战场保留空地
      if(tx>=22 && tx<=50 && ty>=14 && ty<=32) continue;

      // 出生点保护
      if(Math.abs(tx-pTx)<5 && Math.abs(ty-pTy)<5) continue;
      if(Math.abs(tx-bTx)<6 && Math.abs(ty-bTy)<6) continue;

      // 必须在可走地块
      let ok = true;
      for(let dy=0; dy<def.th && ok; dy++)
        for(let dx=0; dx<def.tw && ok; dx++)
          if(!_isWalkable(tx+dx, ty+dy)) ok = false;
      if(!ok) continue;

      if(isOcc(tx, ty, def.tw, def.th)) continue;

      const minD = def.minDist || 3;
      const tooClose = props.some(p => p.type===type &&
        Math.abs(p.tx-tx)<minD && Math.abs(p.ty-ty)<minD);
      if(tooClose) continue;

      props.push({ type, tx, ty });
      mark(tx, ty, def.tw, def.th);
      placed = true;
    }
  }
  return props;
}

// ── 绘制底层：back（铺满）→ ground_clean（透明区漏出back）─────
function drawBaseGround(mc, MW, MH) {
  const T = 24;
  const W = MW * T, H = MH * T;

  // 1. 兜底深红熔岩
  const lavaGrad = mc.createRadialGradient(W*0.5, H*0.5, 0, W*0.5, H*0.5, Math.max(W,H)*0.7);
  lavaGrad.addColorStop(0,   '#3a0808');
  lavaGrad.addColorStop(0.5, '#1a0303');
  lavaGrad.addColorStop(1,   '#080202');
  mc.fillStyle = lavaGrad;
  mc.fillRect(0, 0, W, H);

  // 2. back.png（熔岩岩壁）铺满
  if(_backImg && _backImg.naturalWidth>0) {
    mc.imageSmoothingEnabled = true;
    mc.drawImage(_backImg, 0, 0, W, H);
  }

  // 3. ground_clean.png（关卡平台，透明区露出back）
  if(_groundImg && _groundImg.naturalWidth>0) {
    mc.imageSmoothingEnabled = true;
    mc.drawImage(_groundImg, 0, 0, W, H);
  }

  mc.imageSmoothingEnabled = false;
}

// ── 写入 props 碰撞（独立mapProps，与地形map解耦）─────────────
// 这样 dash/charge 可仅穿透 props 而不穿地形
function applyPropsToMap(mapProps, levelProps) {
  for(const p of levelProps) {
    const def = PROP_DEFS[p.type];
    if(!def || !def.solid) continue;
    for(let dy=0; dy<def.th; dy++)
      for(let dx=0; dx<def.tw; dx++) {
        const mx = p.tx + dx, my = p.ty + dy;
        if(my>=0 && my<mapProps.length && mx>=0 && mx<(mapProps[0]||[]).length)
          mapProps[my][mx] = 1;
      }
  }
}

// ── 烘焙 props 到 mapCanvas ──────────────────────────────────
function drawPropsToCanvas(mc, levelProps) {
  if(!_atlasReady) return;
  const T = 24;

  mc.imageSmoothingEnabled = false;

  // 贴地装饰先画
  for(const p of levelProps) {
    const def = PROP_DEFS[p.type];
    if(!def || !def.ground) continue;
    const img = _stoneCache[def.id];
    if(!img) continue;
    const px = p.tx * T + (def.tw * T - def.dw) / 2;
    const py = p.ty * T + (def.th * T - def.dh) / 2;
    mc.drawImage(img, Math.floor(px), Math.floor(py), def.dw, def.dh);
  }

  // 立体装饰 Y-sort
  const sorted = levelProps.filter(p => {
    const d = PROP_DEFS[p.type]; return d && !d.ground;
  }).sort((a,b) => {
    const da = PROP_DEFS[a.type], db = PROP_DEFS[b.type];
    return (a.ty + (da?da.th:1)) - (b.ty + (db?db.th:1));
  });

  for(const p of sorted) {
    const def = PROP_DEFS[p.type];
    if(!def) continue;
    const img = _stoneCache[def.id];
    if(!img) continue;

    const anchorY = (def.anchorY!==undefined) ? def.anchorY : 1;
    const px = p.tx * T + (def.tw * T - def.dw) / 2;
    const py = p.ty * T + def.th * T - def.dh * anchorY;

    // 投影
    if(def.solid && def.dh >= 40) {
      mc.fillStyle = 'rgba(0,0,0,0.5)';
      mc.beginPath();
      mc.ellipse(px + def.dw/2, py + def.dh - 3, def.dw*0.42, def.dh*0.06, 0, 0, Math.PI*2);
      mc.fill();
    }

    mc.drawImage(img, Math.floor(px), Math.floor(py), def.dw, def.dh);

    // 火源底部静态光晕
    if(def.fire) {
      const cx = px + def.dw/2;
      const cy = py + def.dh*0.55;
      const isPurple = def.fireColor === 'purple';
      const c1 = isPurple ? 'rgba(180,80,220,0.18)' : 'rgba(255,140,40,0.18)';
      const c2 = isPurple ? 'rgba(120,30,200,0)'    : 'rgba(255,80,0,0)';
      const g = mc.createRadialGradient(cx, cy, 0, cx, cy, def.dw*1.4);
      g.addColorStop(0, c1);
      g.addColorStop(1, c2);
      mc.fillStyle = g;
      mc.fillRect(cx - def.dw*1.4, cy - def.dw*1.4, def.dw*2.8, def.dw*2.8);
    }
  }
}

// ── 动态火光（每帧叠加）──────────────────────────────────────
function drawLiveFire(ctx, levelProps, ox, oy, ISO_Y_SCALE, t) {
  const T = 24;
  for(const p of levelProps) {
    const def = PROP_DEFS[p.type];
    if(!def || !def.fire) continue;

    const wx = p.tx * T + (def.tw * T) / 2;
    const wy = p.ty * T + def.th * T - def.dh * 0.78;
    const sx = wx - ox;
    const sy = (wy - oy) * ISO_Y_SCALE;

    const flicker = 0.85 + Math.sin(t*8 + p.tx*2.3 + p.ty*1.7) * 0.15;
    let baseR;
    if(p.type==='altarFire' || p.type==='altarPurple') baseR = 30;
    else if(p.type==='pillarTorch') baseR = 22;
    else if(p.type==='candelabra') baseR = 16;
    else baseR = 10;
    const r = baseR * flicker;

    const isPurple = def.fireColor === 'purple';
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 2.5);
    if(isPurple) {
      g.addColorStop(0,   `rgba(200,120,255,${(0.30*flicker).toFixed(3)})`);
      g.addColorStop(0.4, `rgba(140,40,220,${(0.16*flicker).toFixed(3)})`);
      g.addColorStop(1,   'rgba(80,0,180,0)');
    } else {
      g.addColorStop(0,   `rgba(255,180,60,${(0.30*flicker).toFixed(3)})`);
      g.addColorStop(0.4, `rgba(255,90,0,${(0.16*flicker).toFixed(3)})`);
      g.addColorStop(1,   'rgba(200,30,0,0)');
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sx, sy, r * 2.5, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
}

// ── 调试：M键 → 显示所有 stone sprite 网格 + 编号 ──────────────
function debugDrawAtlasRegions(ctx, x, y, scale) {
  if(!_atlasReady) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  const cols = 12, cell = 60;
  const ids = Object.keys(_stoneCache).map(Number).sort((a,b)=>a-b);
  const rows = Math.ceil(ids.length / cols);
  ctx.fillRect(0, 0, cols*cell+10, rows*cell+10);
  ctx.font = '10px monospace';
  for(let i=0; i<ids.length; i++) {
    const id = ids[i];
    const r = Math.floor(i/cols), c = i%cols;
    const cx = 5 + c*cell, cy = 5 + r*cell;
    const img = _stoneCache[id];
    if(img) {
      const ratio = Math.min(cell/img.width, cell/img.height);
      const dw = img.width*ratio*0.85, dh = img.height*ratio*0.85;
      ctx.drawImage(img, cx + (cell-dw)/2, cy + (cell-dh)/2, dw, dh);
    }
    ctx.fillStyle = 'rgba(0,255,255,0.9)';
    ctx.fillText('#'+id, cx+2, cy+10);
  }
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════
// 地狱氛围层（在 ISO 变换外、UI 之前调用）
// ═══════════════════════════════════════════════════════════════

// ── 1. 熔岩呼吸光斑（mask 中"非可走"区作为 lava 区域，输出红色脉动光）
let _lavaGlowPoints = null;
function _ensureLavaPoints() {
  if(_lavaGlowPoints) return;
  _lavaGlowPoints = [];
  const M = _mask(); const MWm = _maskW(); const MHm = _maskH();
  if(!M) return;
  const T = 24;
  for(let y=1; y<MHm-1; y++) {
    for(let x=1; x<MWm-1; x++) {
      const i = y * MWm + x;
      if(M.charAt(i) === '1') continue;
      let hasWalkNeighbor = false;
      for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const ni = (y+dy)*MWm + (x+dx);
        if(M.charAt(ni) === '1') { hasWalkNeighbor = true; break; }
      }
      if(!hasWalkNeighbor) continue;
      if((x*7 + y*13) % 9 !== 0) continue;
      _lavaGlowPoints.push({
        wx: x * T + T/2,
        wy: y * T + T/2,
        phase: ((x * 31 + y * 17) % 100) / 100 * Math.PI * 2,
        baseR: 30 + ((x * 11 + y * 23) % 20),
      });
    }
  }
}

function drawLavaPulse(ctx, ox, oy, ISO_Y_SCALE, t, CW, CH) {
  _ensureLavaPoints();
  if(!_lavaGlowPoints || !_lavaGlowPoints.length) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for(const p of _lavaGlowPoints) {
    const sx = p.wx - ox;
    const sy = (p.wy - oy) * ISO_Y_SCALE;
    if(sx<-80||sx>CW+80||sy<-80||sy>CH+80) continue;
    const pulse = 0.5 + 0.5 * Math.sin(t*1.5 + p.phase);
    const r = p.baseR * (0.7 + pulse * 0.4);
    const a = 0.10 + pulse * 0.15;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    g.addColorStop(0,   `rgba(255,80,20,${a.toFixed(3)})`);
    g.addColorStop(0.5, `rgba(200,30,0,${(a*0.5).toFixed(3)})`);
    g.addColorStop(1,   'rgba(120,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

// ── 2. 火源地面光池（每个 fire prop 在地面投射暖色光圈）
function drawFireFloorPools(ctx, levelProps, ox, oy, ISO_Y_SCALE, t, CW, CH) {
  const T = 24;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for(const p of levelProps) {
    const def = PROP_DEFS[p.type];
    if(!def || !def.fire) continue;
    const wx = p.tx * T + (def.tw * T) / 2;
    const wy = p.ty * T + def.th * T - 6;
    const sx = wx - ox;
    const sy = (wy - oy) * ISO_Y_SCALE;
    if(sx<-100||sx>CW+100||sy<-50||sy>CH+50) continue;
    const flicker = 0.85 + Math.sin(t*7 + p.tx*3.1) * 0.15;
    let baseR;
    if(p.type==='altarFire' || p.type==='altarPurple') baseR = 60;
    else if(p.type==='pillarTorch') baseR = 50;
    else baseR = 36;
    const r = baseR * flicker;
    const isPurple = def.fireColor === 'purple';
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy*1.0, r);
    if(isPurple) {
      g.addColorStop(0,   `rgba(180,80,255,${(0.22*flicker).toFixed(3)})`);
      g.addColorStop(0.5, `rgba(120,40,200,${(0.10*flicker).toFixed(3)})`);
      g.addColorStop(1,   'rgba(80,0,180,0)');
    } else {
      g.addColorStop(0,   `rgba(255,180,80,${(0.25*flicker).toFixed(3)})`);
      g.addColorStop(0.5, `rgba(255,100,30,${(0.10*flicker).toFixed(3)})`);
      g.addColorStop(1,   'rgba(200,40,0,0)');
    }
    ctx.fillStyle = g;
    // 椭圆光池（贴地）
    ctx.beginPath();
    ctx.ellipse(sx, sy, r, r*0.55, 0, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.restore();
}

// ── 3. 飘升余烬（世界坐标，跟随地图，不随相机走）
//   尺寸缩到原 1/4，更细密
const _worldEmbers = [];
function _initWorldEmbers() {
  if(_worldEmbers.length > 0) return;
  const T = 24;
  const W = NEW_MAP_W * T, H = NEW_MAP_H * T;
  for(let i=0; i<60; i++) {
    _worldEmbers.push({
      wx: Math.random() * W,
      wy: Math.random() * H,
      vx: (Math.random()-0.5) * 4,
      vy: -8 - Math.random() * 14,
      r: 0.2 + Math.random() * 0.4,    // 原 0.8~2.4 → 1/4
      hue: Math.random() < 0.7 ? 28 : 12,
      phase: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random() * 1.5,
      life: 1.0,
      maxLife: 4 + Math.random() * 6,
    });
  }
}
function drawScreenEmbers(ctx, CW, CH, dt, t, ox, oy, ISO_Y_SCALE) {
  _initWorldEmbers();
  const T = 24;
  const W = NEW_MAP_W * T, H = NEW_MAP_H * T;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for(const e of _worldEmbers) {
    e.wx += e.vx * dt + Math.sin(t*1.4 + e.phase) * 0.1;
    e.wy += e.vy * dt;
    e.life += dt;
    if(e.wy < 0 || e.life > e.maxLife) {
      e.wx = Math.random() * W;
      e.wy = H - Math.random() * 50;
      e.life = 0;
    }
    // 世界 → 屏幕（含 ISO 压缩）
    const sx = e.wx - ox;
    const sy = (e.wy - oy) * ISO_Y_SCALE;
    if(sx<-10||sx>CW+10||sy<-10||sy>CH+10) continue;

    const lifeT = e.life / e.maxLife;
    const fadeIn  = Math.min(1, lifeT * 8);
    const fadeOut = Math.min(1, (1 - lifeT) * 3);
    const flicker = 0.6 + 0.4 * Math.sin(t*e.speed*8 + e.phase);
    const a = fadeIn * fadeOut * flicker * 0.85;
    const r = e.r;
    // glow
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r*4);
    g.addColorStop(0,   `hsla(${e.hue},100%,70%,${(a*0.9).toFixed(3)})`);
    g.addColorStop(0.4, `hsla(${e.hue},100%,55%,${(a*0.4).toFixed(3)})`);
    g.addColorStop(1,   `hsla(${e.hue},100%,40%,0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(sx, sy, r*4, 0, Math.PI*2); ctx.fill();
    // core (半像素也画 1px)
    ctx.fillStyle = `hsla(${e.hue+15},100%,90%,${a.toFixed(3)})`;
    ctx.fillRect(Math.floor(sx), Math.floor(sy), 1, 1);
  }
  ctx.restore();
}

// ── 4. 暖色色调叠层（统一画面色温）
function drawColorGrade(ctx, CW, CH, t) {
  const breath = 0.92 + 0.08 * Math.sin(t * 0.7);
  ctx.save();
  // 全屏暖色相乘（轻微橙红，不要过强）
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = `rgba(255,225,200,${(0.55*breath).toFixed(3)})`;
  ctx.fillRect(0, 0, CW, CH);
  ctx.restore();

  // 顶部暗红光晕（screen模式增亮）
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const topGrad = ctx.createLinearGradient(0, 0, 0, CH * 0.4);
  topGrad.addColorStop(0,   `rgba(120,30,10,${(0.20*breath).toFixed(3)})`);
  topGrad.addColorStop(1,   'rgba(50,10,0,0)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, CW, CH * 0.4);

  // 底部暖光晕
  const botGrad = ctx.createLinearGradient(0, CH*0.7, 0, CH);
  botGrad.addColorStop(0, 'rgba(200,60,10,0)');
  botGrad.addColorStop(1, `rgba(255,100,30,${(0.12*breath).toFixed(3)})`);
  ctx.fillStyle = botGrad;
  ctx.fillRect(0, CH*0.7, CW, CH*0.3);
  ctx.restore();
}

// ── 5. 偶发远雷闪（极低概率全屏闪一下）
let _lightningCD = 6;
let _lightningFlash = 0;
function drawDistantFlash(ctx, CW, CH, dt) {
  _lightningCD -= dt;
  if(_lightningCD <= 0) {
    _lightningCD = 8 + Math.random() * 14;
    _lightningFlash = 0.35;
  }
  if(_lightningFlash > 0) {
    _lightningFlash -= dt * 2.5;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = `rgba(255,140,80,${Math.max(0,_lightningFlash).toFixed(3)})`;
    ctx.fillRect(0, 0, CW, CH);
    ctx.restore();
  }
}

// ── 总入口：地狱氛围（每帧调用）─────────────────────────────
function drawHellAtmosphere(ctx, CW, CH, levelProps, ox, oy, ISO_Y_SCALE, t, dt) {
  drawLavaPulse(ctx, ox, oy, ISO_Y_SCALE, t, CW, CH);
  drawFireFloorPools(ctx, levelProps, ox, oy, ISO_Y_SCALE, t, CW, CH);
  drawScreenEmbers(ctx, CW, CH, dt, t, ox, oy, ISO_Y_SCALE);
  drawDistantFlash(ctx, CW, CH, dt);
  drawColorGrade(ctx, CW, CH, t);
}
