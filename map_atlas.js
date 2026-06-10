//
//
//   <script src="ground_mask.js"></script>
//   <script src="map_atlas.js"></script>

const NEW_MAP_W = 72;
const NEW_MAP_H = 48;

const PROP_DEFS = {
  pillarA:     { id:2,  tw:1, th:1, dw:30, dh:64, anchorY:1, solid:true,  minDist:3 },
  pillarB:     { id:3,  tw:1, th:1, dw:30, dh:64, anchorY:1, solid:true,  minDist:3 },
  pillarChain: { id:11, tw:1, th:1, dw:32, dh:64, anchorY:1, solid:true,  minDist:4 },
  pillarLion:  { id:8,  tw:1, th:1, dw:36, dh:64, anchorY:1, solid:true,  minDist:5 },
  pillarTorch: { id:10, tw:1, th:1, dw:36, dh:66, anchorY:1, solid:true,  minDist:5, fire:true },

  spireSkull:  { id:21, tw:1, th:1, dw:36, dh:80, anchorY:1, solid:true,  minDist:6 },
  obeliskHigh: { id:12, tw:1, th:1, dw:32, dh:78, anchorY:1, solid:true,  minDist:5 },
  obeliskA:    { id:26, tw:1, th:2, dw:38, dh:88, anchorY:1, solid:true,  minDist:6 },
  obeliskB:    { id:30, tw:1, th:2, dw:38, dh:88, anchorY:1, solid:true,  minDist:6 },

  statueRobedA:{ id:27, tw:1, th:1, dw:36, dh:78, anchorY:1, solid:true,  minDist:8 },
  statueRobedB:{ id:28, tw:1, th:1, dw:36, dh:78, anchorY:1, solid:true,  minDist:8 },
  statueRobedC:{ id:29, tw:1, th:1, dw:36, dh:78, anchorY:1, solid:true,  minDist:8 },

  fenceShort:  { id:23, tw:2, th:1, dw:75, dh:55, anchorY:1, solid:true,  minDist:7 },
  fenceLong:   { id:24, tw:3, th:1, dw:108,dh:60, anchorY:1, solid:true,  minDist:9 },
  gateBig:     { id:25, tw:3, th:1, dw:115,dh:75, anchorY:1, solid:true,  minDist:10 },

  archGate:    { id:89, tw:3, th:2, dw:115,dh:120,anchorY:1, solid:true,  minDist:12 },

  rockPile:    { id:13, tw:1, th:1, dw:34, dh:55, anchorY:1, solid:true,  minDist:4 },
  rockTall:    { id:14, tw:1, th:1, dw:36, dh:65, anchorY:1, solid:true,  minDist:4 },
  rockHollow:  { id:15, tw:2, th:1, dw:55, dh:60, anchorY:1, solid:true,  minDist:5 },
  rockPlat:    { id:31, tw:2, th:2, dw:75, dh:60, anchorY:1, solid:true,  minDist:7 },
  rockPlatBig: { id:34, tw:3, th:2, dw:90, dh:65, anchorY:1, solid:true,  minDist:8 },

  altarPurple: { id:47, tw:1, th:1, dw:48, dh:50, anchorY:1, solid:true,  minDist:6, fire:true, fireColor:'purple' },
  altarFire:   { id:48, tw:1, th:1, dw:42, dh:55, anchorY:1, solid:true,  minDist:6, fire:true, fireColor:'purple' },
  candelabra:  { id:38, tw:1, th:1, dw:24, dh:50, anchorY:1, solid:false, minDist:2, fire:true },
  candleSingleA:{id:52, tw:1, th:1, dw:14, dh:30, anchorY:1, solid:false, minDist:2, fire:true },
  candleSingleB:{id:53, tw:1, th:1, dw:14, dh:30, anchorY:1, solid:false, minDist:2, fire:true },
  hangChain:   { id:22, tw:1, th:1, dw:22, dh:55, anchorY:1, solid:false, minDist:4 },

  deadTree1:   { id:39, tw:1, th:1, dw:50, dh:65, anchorY:1, solid:true,  minDist:5 },
  deadTree2:   { id:40, tw:1, th:1, dw:50, dh:65, anchorY:1, solid:true,  minDist:5 },
  swordStuck:  { id:41, tw:1, th:1, dw:18, dh:55, anchorY:1, solid:false, minDist:3 },
  crystalBlue: { id:42, tw:1, th:1, dw:24, dh:38, anchorY:1, solid:false, minDist:3 },
  crystalCluster:{id:49,tw:1, th:1, dw:36, dh:50, anchorY:1, solid:true,  minDist:4 },
  crystalSmall:{ id:50, tw:1, th:1, dw:20, dh:32, anchorY:1, solid:false, minDist:2 },
  crystalPurple:{id:66, tw:1, th:1, dw:36, dh:42, anchorY:1, solid:true,  minDist:4 },

  tomb1:       { id:59, tw:1, th:1, dw:30, dh:50, anchorY:1, solid:true,  minDist:3 },
  tomb2:       { id:60, tw:1, th:1, dw:30, dh:50, anchorY:1, solid:true,  minDist:3 },
  tomb3:       { id:61, tw:1, th:1, dw:30, dh:50, anchorY:1, solid:true,  minDist:3 },
  tomb4:       { id:62, tw:1, th:1, dw:30, dh:50, anchorY:1, solid:true,  minDist:3 },
  tombSpike:   { id:63, tw:1, th:1, dw:28, dh:55, anchorY:1, solid:true,  minDist:4 },
  graveCross:  { id:70, tw:1, th:1, dw:36, dh:50, anchorY:1, solid:true,  minDist:4 },
  graveCross2: { id:87, tw:1, th:1, dw:30, dh:46, anchorY:1, solid:true,  minDist:4 },
  cross44:     { id:44, tw:1, th:1, dw:22, dh:44, anchorY:1, solid:false, minDist:3 },

  urnTall:     { id:43, tw:1, th:1, dw:18, dh:32, anchorY:1, solid:false, minDist:2 },
  urnA:        { id:79, tw:1, th:1, dw:24, dh:32, anchorY:1, solid:false, minDist:2 },
  urnB:        { id:83, tw:1, th:1, dw:22, dh:30, anchorY:1, solid:false, minDist:2 },
  urnC:        { id:84, tw:1, th:1, dw:22, dh:28, anchorY:1, solid:false, minDist:2 },
  vasePair:    { id:74, tw:1, th:1, dw:30, dh:24, anchorY:1, solid:false, minDist:3 },

  chestS1:     { id:67, tw:1, th:1, dw:28, dh:30, anchorY:1, solid:false, minDist:3 },
  chestS2:     { id:68, tw:1, th:1, dw:28, dh:30, anchorY:1, solid:false, minDist:3 },
  chestL:      { id:69, tw:1, th:1, dw:42, dh:36, anchorY:1, solid:false, minDist:5 },
  chestM:      { id:78, tw:1, th:1, dw:34, dh:30, anchorY:1, solid:false, minDist:4 },
  chestHuge:   { id:88, tw:2, th:1, dw:55, dh:42, anchorY:1, solid:true,  minDist:6 },

  floorBridge: { id:95, tw:3, th:1, dw:90, dh:55, anchorY:0.5, solid:false, ground:true },
  floorSeal1:  { id:96, tw:3, th:2, dw:100,dh:60, anchorY:0.5, solid:false, ground:true },
  floorSeal2:  { id:97, tw:3, th:2, dw:100,dh:60, anchorY:0.5, solid:false, ground:true },
};

const ANCHOR_PROPS = [
  { type:'floorSeal2', tx:34, ty:23 },

  { type:'archGate',   tx:34, ty:6  },

  { type:'altarPurple',tx:28, ty:11 },
  { type:'altarPurple',tx:42, ty:11 },

  { type:'obeliskA',   tx:24, ty:8  },
  { type:'obeliskB',   tx:46, ty:8  },

  { type:'pillarTorch',tx:20, ty:10 },
  { type:'pillarTorch',tx:50, ty:10 },

  { type:'statueRobedA',tx:14, ty:20 },
  { type:'statueRobedC',tx:55, ty:20 },

  { type:'pillarChain',tx:18, ty:24 },
  { type:'pillarChain',tx:52, ty:24 },

  { type:'fenceLong',  tx:11, ty:14 },
  { type:'fenceLong',  tx:55, ty:14 },

  { type:'candelabra', tx:30, ty:17 },
  { type:'candelabra', tx:40, ty:17 },

  { type:'spireSkull', tx:22, ty:36 },
  { type:'spireSkull', tx:48, ty:36 },

  { type:'altarFire',  tx:28, ty:39 },
  { type:'altarFire',  tx:42, ty:39 },

  { type:'pillarLion', tx:8,  ty:8  },
  { type:'pillarLion', tx:62, ty:8  },
  { type:'pillarLion', tx:8,  ty:38 },
  { type:'pillarLion', tx:62, ty:38 },

  { type:'pillarA',    tx:5,  ty:14 },
  { type:'pillarB',    tx:65, ty:14 },
  { type:'pillarA',    tx:5,  ty:32 },
  { type:'pillarB',    tx:65, ty:32 },

  { type:'tomb1',      tx:11, ty:42 },
  { type:'tomb2',      tx:13, ty:43 },
  { type:'tomb3',      tx:58, ty:42 },
  { type:'tomb4',      tx:60, ty:43 },

  { type:'graveCross', tx:9,  ty:42 },
  { type:'graveCross2',tx:62, ty:43 },
];

let _backImg   = null;
let _groundImg = null;
let _atlasReady = false;
const _stoneCache = {}; // id
let _stonesPending = 0;

function _rng(seed) {
  const h = Math.sin(seed * 127.1 + 3.14) * 43758.5453;
  return h - Math.floor(h);
}

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

function loadAtlas(onReady) {
  const ids = _gatherUsedStoneIds();
  const gUrl = window._activeGroundUrl;
  let pending = (gUrl ? 2 : 1) + ids.length; // back + (ground
  let _fired = false;
  const done = () => {
    if(--pending <= 0 && !_fired) {
      _fired = true;
      _atlasReady = true;
      console.log('[map] all assets ready: back=%s ground=%s stones=%d',
        _backImg && _backImg.naturalWidth ? 'ok' : 'fail',
        _groundImg && _groundImg.naturalWidth ? 'ok' : 'fail',
        Object.keys(_stoneCache).length);
      onReady && onReady();
    }
  };
  setTimeout(() => {
    if(!_fired){
      _fired = true;
      _atlasReady = true;
      console.warn('[map] loadAtlas timeout, forcing ready (pending='+pending+')');
      onReady && onReady();
    }
  }, 3000);

  _backImg = new Image();
  _backImg.onload  = () => { console.log('[map] back.png loaded', _backImg.naturalWidth+'x'+_backImg.naturalHeight); done(); };
  _backImg.onerror = () => { console.error('[map] back.png load error'); done(); };
  _backImg.src = 'back.png';

  _groundImg = null;
  if(gUrl){
    _groundImg = new Image();
    _groundImg.onload = () => { console.log('[map] ground loaded'); done(); };
    _groundImg.onerror = () => { console.warn('[map] ground load error'); done(); };
    _groundImg.src = gUrl;
  } else {
    console.log('[map] no groundImg, skipping');
    done();
  }

  for(const id of ids) _loadStone(id, () => done());
}

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

function _mask()  { return window._activeGroundMask  || (typeof GROUND_MASK   !== 'undefined' ? GROUND_MASK   : ''); }
function _maskW() { return window._activeGroundMaskW || (typeof GROUND_MASK_W !== 'undefined' ? GROUND_MASK_W : 72); }
function _maskH() { return window._activeGroundMaskH || (typeof GROUND_MASK_H !== 'undefined' ? GROUND_MASK_H : 48); }

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

function _isWalkable(tx, ty) {
  const M = _mask(); const MWm = _maskW(); const MHm = _maskH();
  if(!M) return true;
  if(tx<0 || ty<0 || tx>=MWm || ty>=MHm) return false;
  return M.charAt(ty * MWm + tx) === '1';
}

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

  for(const p of ANCHOR_PROPS) {
    const def = PROP_DEFS[p.type];
    if(!def) continue;
    let ok = true;
    for(let dy=0; dy<def.th && ok; dy++)
      for(let dx=0; dx<def.tw && ok; dx++)
        if(!_isWalkable(p.tx+dx, p.ty+dy)) ok = false;
    if(!ok) continue; //
    if(isOcc(p.tx, p.ty, def.tw, def.th)) continue;
    props.push(p);
    mark(p.tx, p.ty, def.tw, def.th);
  }

  const pTx = Math.floor(playerSpawn.x / T);
  const pTy = Math.floor(playerSpawn.y / T);
  const bTx = Math.floor(bossSpawn.x / T);
  const bTy = Math.floor(bossSpawn.y / T);

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

      if(tx>=22 && tx<=50 && ty>=14 && ty<=32) continue;

      if(Math.abs(tx-pTx)<5 && Math.abs(ty-pTy)<5) continue;
      if(Math.abs(tx-bTx)<6 && Math.abs(ty-bTy)<6) continue;

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

function drawBaseGround(mc, MW, MH) {
  const T = 24;
  const W = MW * T, H = MH * T;

  const gUrl = window._activeGroundUrl;
  const preset = window._activeLightPreset || (window._isLevel3 ? 'hell' : 'sky');

  mc.imageSmoothingEnabled = true;
  mc.imageSmoothingQuality = 'high';

  // 全 mapCanvas 用深色填底（外围 padding 区域不会有缝）
  mc.fillStyle = '#050208';
  mc.fillRect(0, 0, W, H);

  // padding 偏移（外围墙不画背景图）
  const padX = (window._mapPadX || 0) * T;
  const padY = (window._mapPadY || 0) * T;
  const rawW = (window._mapRawW || MW) * T;
  const rawH = (window._mapRawH || MH) * T;

  if(!gUrl){
    const grad = mc.createRadialGradient(W*0.5, H*0.5, 0, W*0.5, H*0.5, Math.max(W,H)*0.75);
    grad.addColorStop(0,   'rgba(0,0,0,0)');
    grad.addColorStop(1,   'rgba(0,0,0,0.25)');
    mc.fillStyle = grad;
    mc.fillRect(0, 0, W, H);
    return;
  }

  let c0, c1, c2;
  if     (preset==='hell')   { c0='#3a0808'; c1='#1a0303'; c2='#080202'; }
  else if(preset==='sky')    { c0='#a8d4f0'; c1='#6bb5e8'; c2='#3a7ab8'; }
  else if(preset==='forest') { c0='#0a2010'; c1='#061408'; c2='#030a04'; }
  else if(preset==='void')   { c0='#1a0830'; c1='#0e0420'; c2='#060210'; }
  else if(preset==='gold')   { c0='#2a1a00'; c1='#180e00'; c2='#0a0600'; }
  else if(preset==='ice')    { c0='#0a1828'; c1='#060e18'; c2='#02060e'; }
  else                       { c0='#0a0a10'; c1='#060608'; c2='#020204'; }

  // 渐变铺满整个 canvas（含 padding 区域），保持视觉连续
  const grad = mc.createRadialGradient(W*0.5, H*0.5, 0, W*0.5, H*0.5, Math.max(W,H)*0.75);
  grad.addColorStop(0,   c0);
  grad.addColorStop(0.5, c1);
  grad.addColorStop(1,   c2);
  mc.fillStyle = grad;
  mc.fillRect(0, 0, W, H);

  if(preset==='hell' && _backImg && _backImg.naturalWidth>0) {
    mc.drawImage(_backImg, padX, padY, rawW, rawH);
  }

  if(_groundImg && _groundImg.naturalWidth>0) {
    // 背景图只画在原始 mapData 区域，padding 区域露出深色底
    mc.drawImage(_groundImg, padX, padY, rawW, rawH);
  }
}

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

function drawPropsToCanvas(mc, levelProps) {
  if(!_atlasReady) return;
  const T = 24;

  mc.imageSmoothingEnabled = false;

  for(const p of levelProps) {
    const def = PROP_DEFS[p.type];
    if(!def || !def.ground) continue;
    const img = _stoneCache[def.id];
    if(!img) continue;
    const px = p.tx * T + (def.tw * T - def.dw) / 2;
    const py = p.ty * T + (def.th * T - def.dh) / 2;
    mc.drawImage(img, Math.floor(px), Math.floor(py), def.dw, def.dh);
  }

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

    if(def.solid && def.dh >= 40) {
      mc.fillStyle = 'rgba(0,0,0,0.5)';
      mc.beginPath();
      mc.ellipse(px + def.dw/2, py + def.dh - 3, def.dw*0.42, def.dh*0.06, 0, 0, Math.PI*2);
      mc.fill();
    }

    mc.drawImage(img, Math.floor(px), Math.floor(py), def.dw, def.dh);

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
  if(!isFinite(ox) || !isFinite(oy)) return; // 坐标 NaN 时跳过，防止 createRadialGradient 报错
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for(const p of _lavaGlowPoints) {
    const sx = p.wx - ox;
    const sy = (p.wy - oy) * ISO_Y_SCALE;
    if(sx<-80||sx>CW+80||sy<-80||sy>CH+80) continue;
    if(!isFinite(sx) || !isFinite(sy)) continue; // 跳过无效点
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
    ctx.beginPath();
    ctx.ellipse(sx, sy, r, r*0.55, 0, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.restore();
}

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
      r: 0.2 + Math.random() * 0.4,    //
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
    ctx.fillStyle = `hsla(${e.hue+15},100%,90%,${a.toFixed(3)})`;
    ctx.fillRect(Math.floor(sx), Math.floor(sy), 1, 1);
  }
  ctx.restore();
}

function drawColorGrade(ctx, CW, CH, t) {
  const breath = 0.92 + 0.08 * Math.sin(t * 0.7);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = `rgba(255,225,200,${(0.55*breath).toFixed(3)})`;
  ctx.fillRect(0, 0, CW, CH);
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const topGrad = ctx.createLinearGradient(0, 0, 0, CH * 0.4);
  topGrad.addColorStop(0,   `rgba(120,30,10,${(0.20*breath).toFixed(3)})`);
  topGrad.addColorStop(1,   'rgba(50,10,0,0)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, CW, CH * 0.4);

  const botGrad = ctx.createLinearGradient(0, CH*0.7, 0, CH);
  botGrad.addColorStop(0, 'rgba(200,60,10,0)');
  botGrad.addColorStop(1, `rgba(255,100,30,${(0.12*breath).toFixed(3)})`);
  ctx.fillStyle = botGrad;
  ctx.fillRect(0, CH*0.7, CW, CH*0.3);
  ctx.restore();
}

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

function drawHellAtmosphere(ctx, CW, CH, levelProps, ox, oy, ISO_Y_SCALE, t, dt) {
  drawLavaPulse(ctx, ox, oy, ISO_Y_SCALE, t, CW, CH);
  drawFireFloorPools(ctx, levelProps, ox, oy, ISO_Y_SCALE, t, CW, CH);
  drawScreenEmbers(ctx, CW, CH, dt, t, ox, oy, ISO_Y_SCALE);
  drawDistantFlash(ctx, CW, CH, dt);
  drawColorGrade(ctx, CW, CH, t);
}
