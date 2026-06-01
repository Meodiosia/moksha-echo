// ── ember/core.js ─────────────────────────────────────────────
// 余烬主宰 · 核心：常量 / 状态 / 选招 / 受击 / 主循环
// 配套：render.js（外观）/ fx.js（特效与 HUD）
// 接口：spawnEmber / updateEmber / drawEmber / drawEmberHUD / emberTakeDamage
//       loadEmberFrames（no-op）
// ──────────────────────────────────────────────────────────────

function loadEmberFrames(onReady){ if(onReady) onReady(); }

// ── 阶段配置 ──
const EMBER_PHASES = {
  1: { name:'P1 觉醒', hpRange:[1.0,0.6],  speed:1.0,  auraScale:1.0,  rageGlow:0.6, breath:1.2 },
  2: { name:'P2 熔化', hpRange:[0.6,0.3],  speed:1.25, auraScale:1.35, rageGlow:1.0, breath:1.8 },
  3: { name:'P3 焚世', hpRange:[0.3,0.0],  speed:1.5,  auraScale:1.7,  rageGlow:1.6, breath:2.6 },
};

// ── 招式表 ──
const EMBER_MOVES = {
  atk_a:    { dur:0.95, hitWin:[0.35,0.55], range:74, dmg:14, move:42,  blockable:true, telegraph:0.10,
              swingArc: 2.1, bladeTrail:true },
  atk_spin: { dur:1.15, hitWin:[0.45,0.78], range:92, dmg:20, move:0, aoe:true, stationary:true,
              blockable:true, telegraph:0.30, telegraphColor:'white', bodySpin:true },
  pillar:   { dur:1.60, hitWin:[0.55,0.85], range:0,  dmg:22, move:0, stationary:true, blockable:true,
              ranged:'pillar', telegraph:0.35, telegraphColor:'red', poseRaise:true },
  charge:   { dur:1.00, hitWin:[0.40,0.75], range:80, dmg:26, move:260, blockable:true,
              telegraph:0.30, telegraphColor:'red', isCharge:true, afterimage:true },
  rain:     { dur:2.30, hitWin:[0.40,0.95], range:0,  dmg:18, move:0, stationary:true, blockable:true,
              ranged:'rain', telegraph:0.25, telegraphColor:'red', poseRaise:true },
  rift:     { dur:1.55, hitWin:[0.55,0.78], range:0,  dmg:24, move:0, stationary:true, blockable:true,
              ranged:'rift', telegraph:0.35, telegraphColor:'red' },
  ult:      { dur:2.90, hitWin:[0.60,0.82], range:185,dmg:55, move:0, aoe:true, stationary:true,
              blockable:false, telegraph:0.45, telegraphColor:'red_big', screenShake:true,
              poseRaise:true, screenDim:true },
};

const EMBER_PHASE_SKILLS = {
  1: ['atk_a','atk_spin','pillar','charge'],
  2: ['atk_a','atk_spin','pillar','charge','rain','rift'],
  3: ['atk_a','atk_spin','pillar','charge','rain','rift','ult'],
};

// ── 实例 ──
let ember = null;

function spawnEmber(x, y){
  ember = {
    isEmber: true,
    x, y, vx:0, vy:0,
    facing: -1,
    hp: 1300, maxHp: 1300,
    state: 'entrance',
    stateTimer: 1.5,
    animT: 0, bobT: Math.random()*6.28,
    phase: 1, pendingPhase: null,
    attackKey: null, atkPhaseT: 0, atkHitDone: false,
    atkCD: 1.8, hurtTimer: 0, deadAge: 0,
    facingFrozen: false,

    // 渲染态
    shardAngle: 0,            // 皇冠公转
    bodySpinAngle: 0,         // 旋焚时整体旋转
    headTurn: 0,              // 头部跟随玩家 -1..1
    breathT: 0,               // 呼吸缩放相位
    converge: 0,              // telegraph 收拢
    eyeGlow: 0.6,
    poseRaise: 0,             // 高举手势 0..1
    leanX: 0,

    // 双手 IK 目标（相对身体中心，未应用 facing）
    mainHandTgt: {x:24, y:-12},
    subHandTgt:  {x:-22, y:-12},
    mainHandPrev: {x:24, y:-12},
    bladeAngle: 0,

    // 剑光残像
    bladeTrail: [],           // {tip:{x,y}, root:{x,y}, age, life}

    // 残影（charge）
    afterimages: [],          // {x,y,age,life,facing,armSwing}

    // 余烬粒子
    embers: [],

    // 披风：2 条 ribbon, 各 5 段
    cape: _emberInitCape(),

    // 程序化资源
    cracks: _emberGenCracks(),

    // 远程实体
    pillars: [], rainBalls: [], rift: null,

    // 终极屏暗
    screenDimT: 0,

    // 选招
    _skillUsage: {}, _cycleIdx: 0,
  };
  for(let i=0;i<32;i++) ember.embers.push(_emberNewSpark(x, y-40));
  return ember;
}

// ── 披风骨段（verlet-ish）──
function _emberInitCape(){
  const ribbons = [];
  for(let r=0;r<2;r++){
    const segs = [];
    const off = (r===0?-9:9);
    for(let i=0;i<6;i++){
      segs.push({x: off, y: -15 + i*9, vx: 0, vy: 0, ox: off, oy: -15 + i*9});
    }
    ribbons.push(segs);
  }
  return ribbons;
}

// ── 裂纹生成：分形枝杈 ──
function _emberGenCracks(){
  const list = [];
  // 主干：从胸口熔核向外的辐射裂纹（10 条）
  for(let i=0;i<10;i++){
    const a = i/10*6.28 + Math.random()*0.25;
    const len = 14 + Math.random()*16;
    const main = _emberCrackBranch(0, -34, a, len, 4);
    list.push(main);
  }
  // 散点装饰裂纹（14 条短小）
  for(let i=0;i<14;i++){
    const sx = (Math.random()-0.5)*32;
    const sy = -55 + Math.random()*70;
    const a = Math.random()*6.28;
    const len = 5 + Math.random()*8;
    list.push(_emberCrackBranch(sx, sy, a, len, 2));
  }
  return list;
}

function _emberCrackBranch(sx, sy, ang, len, depth){
  // 折线 + 分叉
  const pts = [{x:sx, y:sy}];
  let cx = sx, cy = sy, a = ang;
  const segN = 3 + (Math.random()*3|0);
  for(let s=0;s<segN;s++){
    a += (Math.random()-0.5)*1.4;
    const stepLen = len/segN * (0.7 + Math.random()*0.6);
    cx += Math.cos(a)*stepLen;
    cy += Math.sin(a)*stepLen;
    pts.push({x:cx, y:cy});
  }
  const branches = [];
  if(depth > 1 && Math.random() < 0.6){
    const start = pts[Math.max(1, Math.floor(pts.length*0.4))];
    branches.push(_emberCrackBranch(start.x, start.y, a + (Math.random()<0.5?1:-1)*0.9, len*0.55, depth-1));
  }
  return {
    pts, branches,
    hot: Math.random()*6.28,
    w: 0.9 + Math.random()*1.3,
    cycleSpeed: 2 + Math.random()*2,
  };
}

function _emberNewSpark(x, y){
  return {
    x: x + (Math.random()-0.5)*38,
    y: y + (Math.random()-0.5)*42,
    vx: (Math.random()-0.5)*18,
    vy: -25 - Math.random()*28,
    life: 0, maxLife: 0.55 + Math.random()*0.7,
    r: 0.7 + Math.random()*1.7,
    hue: 16 + Math.random()*26,
    flick: Math.random()*6.28,
  };
}

// ── 阶段过渡 ──
function _emberCheckPhase(){
  if(!ember || ember.state==='dead' || ember.state==='entrance') return;
  const pct = ember.hp/ember.maxHp;
  let t = 1;
  if(pct < 0.3) t = 3;
  else if(pct < 0.6) t = 2;
  if(t > ember.phase && ember.pendingPhase === null){
    ember.pendingPhase = t;
    _emberPhaseBurst();
  }
}

function _emberPhaseBurst(){
  const cx = ember.x, cy = ember.y - 35;
  for(let i=0;i<90;i++){
    const a = i/90*6.283 + Math.random()*0.12;
    addParticle(cx, cy, {
      n:1, c: i%3===0?'#FFD060':(i%3===1?'#FF5020':'#FF8030'),
      spd: 210+Math.random()*160, r: 2.2+Math.random()*1.8,
      life: 0.75, spread:0.05, angle:a, gravity:18
    });
  }
  shockwaves.push({x:cx,y:cy,r:5,maxR:180,life:0.65,age:0,c:'#FF5020'});
  shockwaves.push({x:cx,y:cy,r:3,maxR:100,life:0.5, age:0,c:'#FFD080'});
  shockwaves.push({x:cx,y:cy,r:2,maxR:60, life:0.4, age:0,c:'#FFFFFF'});
  camShake(0.55, 14);
  triggerHitStop(0.15);
  triggerSlowMo(0.5, 0.35);
  ember.phase = ember.pendingPhase;
  ember.pendingPhase = null;
  ember.state = 'idle';
  ember.stateTimer = 0.6;
  ember.attackKey = null;
  ember.atkCD = 1.4;
}

// ── 选招 ──
function _emberPickAttack(pdist){
  const pool = EMBER_PHASE_SKILLS[ember.phase];
  const cand = [];
  for(const k of pool){
    const mv = EMBER_MOVES[k];
    if(!mv.ranged && !mv.isCharge && k!=='ult'){
      if(k==='atk_a' && pdist > 130) continue;
      if(k==='atk_spin' && pdist > 115) continue;
    }
    if(k==='ult' && ember.hp/ember.maxHp > 0.35) continue;
    if(k==='charge' && pdist < 110) continue;
    cand.push(k);
  }
  if(cand.length===0) cand.push('atk_a');
  cand.sort((a,b)=> (ember._skillUsage[a]||0) - (ember._skillUsage[b]||0));
  const pick = cand[Math.floor(Math.random()*Math.min(3,cand.length))];
  ember._skillUsage[pick] = ++ember._cycleIdx;
  return pick;
}

function _emberStartAttack(key){
  ember.attackKey = key;
  ember.atkPhaseT = 0;
  ember.atkHitDone = false;
  ember.state = 'attack';
  ember.stateTimer = EMBER_MOVES[key].dur;
  ember.facingFrozen = true;
  if(typeof player !== 'undefined') ember.facing = (player.x < ember.x ? -1 : 1);
  ember.bodySpinAngle = 0;
  const mv = EMBER_MOVES[key];
  if(mv.ranged === 'pillar') _emberQueuePillars();
  else if(mv.ranged === 'rain') _emberQueueRain();
  else if(mv.ranged === 'rift') _emberQueueRift();
  if(mv.screenDim) ember.screenDimT = 0;
}

// ── 远程实体调度 ──
function _emberQueuePillars(){
  if(typeof player === 'undefined') return;
  const px = player.x, py = player.y;
  ember.pillars = [
    {x:px,     y:py,    t:0, delay:0.50, dur:0.55, fired:false, dmg:EMBER_MOVES.pillar.dmg},
    {x:px+60,  y:py+10, t:0, delay:0.75, dur:0.55, fired:false, dmg:EMBER_MOVES.pillar.dmg},
    {x:px-60,  y:py-10, t:0, delay:1.00, dur:0.55, fired:false, dmg:EMBER_MOVES.pillar.dmg},
  ];
}

function _emberQueueRain(){
  if(typeof player === 'undefined') return;
  ember.rainBalls = [];
  const N = 7;
  for(let i=0;i<N;i++){
    const ang = Math.random()*6.28;
    const dist = 24 + Math.random()*100;
    const tx = player.x + Math.cos(ang)*dist;
    const ty = player.y + Math.sin(ang)*dist;
    ember.rainBalls.push({
      tx, ty, t:0, delay: 0.55 + i*0.16, dropTime:0.45, fired:false,
      dmg: EMBER_MOVES.rain.dmg, rot: Math.random()*6.28, rotSpd: 4+Math.random()*4,
    });
  }
}

function _emberQueueRift(){
  if(typeof player === 'undefined') return;
  const dx = player.x - ember.x, dy = player.y - ember.y;
  const L = Math.hypot(dx, dy) || 1;
  ember.rift = {
    x0: ember.x, y0: ember.y - 10,
    x1: ember.x + dx/L*340, y1: ember.y - 10 + dy/L*340,
    t: 0, delay: 0.6, life: 0.55, fired: false,
    dmg: EMBER_MOVES.rift.dmg,
    // 锯齿断裂随机点
    zigzag: _emberZigzag(20),
  };
}

function _emberZigzag(n){
  const arr = [];
  for(let i=0;i<n;i++) arr.push((Math.random()-0.5)*16);
  return arr;
}

// ── 主循环 ──
function updateEmber(dt){
  if(!ember) return;
  ember.animT += dt;
  ember.bobT += dt;
  ember.breathT += dt;
  // 非匀速旋转：以 sin 脉动调速
  const rotPulse = 0.35 + Math.abs(Math.sin(ember.bobT*0.55)) * 0.9;
  ember.shardAngle += dt * rotPulse * (1 + (ember.phase-1)*0.45);
  if(ember.hurtTimer > 0) ember.hurtTimer -= dt;
  if(ember.screenDimT > 0) ember.screenDimT -= dt;

  if(ember.state === 'dead'){
    ember.deadAge += dt;
    _emberTickDisplay(dt);
    return;
  }

  _emberCheckPhase();

  // 余烬池
  for(let i=ember.embers.length-1;i>=0;i--){
    const s = ember.embers[i];
    s.life += dt;
    s.x += s.vx*dt; s.y += s.vy*dt;
    s.vy += -10*dt;
    s.flick += dt*8;
    if(s.life >= s.maxLife) ember.embers[i] = _emberNewSpark(ember.x, ember.y-40);
  }

  // 头部跟随玩家
  if(typeof player !== 'undefined'){
    const dxh = player.x - ember.x;
    const tgt = Math.max(-1, Math.min(1, dxh/180));
    ember.headTurn += (tgt - ember.headTurn) * Math.min(1, dt*5);
  }

  // 披风动画
  _emberUpdateCape(dt);

  // 剑光寿命
  for(let i=ember.bladeTrail.length-1;i>=0;i--){
    const t = ember.bladeTrail[i];
    t.age += dt;
    if(t.age >= t.life) ember.bladeTrail.splice(i, 1);
  }
  // 残影
  for(let i=ember.afterimages.length-1;i>=0;i--){
    const a = ember.afterimages[i];
    a.age += dt;
    if(a.age >= a.life) ember.afterimages.splice(i, 1);
  }

  // 入场态
  if(ember.state === 'entrance'){
    ember.stateTimer -= dt;
    ember.eyeGlow = Math.min(1.3, ember.eyeGlow + dt*1.0);
    if(ember.stateTimer <= 0){ ember.state = 'idle'; ember.atkCD = 1.0; }
    return;
  }

  const ph = EMBER_PHASES[ember.phase];
  const spd = 38 * ph.speed;

  let dx = 0, dy = 0, pdist = 999;
  if(typeof player !== 'undefined'){
    dx = player.x - ember.x; dy = player.y - ember.y;
    pdist = Math.hypot(dx, dy);
    if(!ember.facingFrozen) ember.facing = (dx < 0 ? -1 : 1);
  }

  // 状态机
  if(ember.state === 'idle' || ember.state === 'walk'){
    ember.facingFrozen = false;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    let mvx=0, mvy=0;
    if(adx > 50) mvx = Math.sign(dx) * spd;
    else if(adx > 30) mvx = Math.sign(dx) * spd * 0.3;
    else mvx = -Math.sign(dx) * spd * 0.4;
    if(ady > 60) mvy = Math.sign(dy) * spd * 0.4;
    else if(ady > 30) mvy = Math.sign(dy) * spd * 0.2;
    ember.vx = mvx; ember.vy = mvy;
    _emberMove(dt);
    ember.state = (mvx===0 && mvy===0) ? 'idle' : 'walk';

    // 平滑姿态
    ember.poseRaise *= Math.pow(0.001, dt);
    ember.leanX += (0 - ember.leanX) * Math.min(1, dt*5);
    // 手归位（待机摆动）
    const swing = Math.sin(ember.bobT*1.6) * 3;
    const idleMain = {x: 24, y: -12 + swing};
    const idleSub  = {x: -22, y: -12 - swing};
    ember.mainHandTgt.x += (idleMain.x - ember.mainHandTgt.x) * Math.min(1, dt*4);
    ember.mainHandTgt.y += (idleMain.y - ember.mainHandTgt.y) * Math.min(1, dt*4);
    ember.subHandTgt.x  += (idleSub.x  - ember.subHandTgt.x ) * Math.min(1, dt*4);
    ember.subHandTgt.y  += (idleSub.y  - ember.subHandTgt.y ) * Math.min(1, dt*4);

    ember.atkCD -= dt;
    if(ember.atkCD <= 0) _emberStartAttack(_emberPickAttack(pdist));

    ember.eyeGlow += (0.55 - ember.eyeGlow) * Math.min(1, dt*4);
    ember.converge = 0;
    return;
  }

  if(ember.state === 'attack'){
    const mv = EMBER_MOVES[ember.attackKey];
    ember.atkPhaseT += dt;
    const t = Math.min(1, ember.atkPhaseT / mv.dur);
    const tg = mv.telegraph || 0;

    if(t < tg){
      // 预警阶段：碎片收拢，举手蓄力，眼瞳爆亮
      const k = t/tg;
      ember.converge = k;
      ember.eyeGlow = 0.7 + k * 0.9;
      ember.leanX += ((mv.poseRaise?-3:-2)*ember.facing - ember.leanX) * Math.min(1, dt*5);
      if(mv.poseRaise) ember.poseRaise += (1 - ember.poseRaise) * Math.min(1, dt*4);
      // 蓄力手位
      const chargeMain = mv.poseRaise ? {x: 8, y: -55} : {x: -10, y: -8};
      ember.mainHandTgt.x += (chargeMain.x - ember.mainHandTgt.x) * Math.min(1, dt*6);
      ember.mainHandTgt.y += (chargeMain.y - ember.mainHandTgt.y) * Math.min(1, dt*6);
      const chargeSub = mv.poseRaise ? {x: -8, y: -50} : {x: -28, y: 8};
      ember.subHandTgt.x += (chargeSub.x - ember.subHandTgt.x) * Math.min(1, dt*6);
      ember.subHandTgt.y += (chargeSub.y - ember.subHandTgt.y) * Math.min(1, dt*6);
    } else {
      const phase = (t - tg) / (1 - tg);
      ember.converge *= Math.pow(0.001, dt);
      ember.eyeGlow = 1.0 + Math.sin(phase*Math.PI)*0.4;

      // 旋焚：本体旋转
      if(mv.bodySpin){
        ember.bodySpinAngle += dt * 14;
      }

      // 主手挥砍 / 投掷动作
      if(mv.poseRaise){
        // 砸地（pillar/rain/ult）：手从高位下落
        const k = Math.sin(phase * Math.PI);
        const downMain = {x: 5, y: -50 + k*60};
        ember.mainHandTgt.x += (downMain.x - ember.mainHandTgt.x) * Math.min(1, dt*7);
        ember.mainHandTgt.y += (downMain.y - ember.mainHandTgt.y) * Math.min(1, dt*7);
        ember.poseRaise *= Math.pow(0.4, dt);
      } else {
        // 横挥砍：用 ease-out cubic 加速冲砍 + 收尾
        const arc = mv.swingArc || Math.PI;
        const facingSign = ember.facing;
        const startAng = -arc*0.5 * facingSign;
        const endAng   =  arc*0.5 * facingSign;
        const easeP = mv.bodySpin ? phase : _emberEaseOutCubic(phase);
        const ph = mv.bodySpin ? (easeP*6.28) : (startAng + (endAng-startAng)*easeP);
        const reach = 32;
        const tipX = Math.cos(ph) * reach;
        const tipY = -16 + Math.sin(ph) * reach * 0.6;
        ember.mainHandPrev.x = ember.mainHandTgt.x;
        ember.mainHandPrev.y = ember.mainHandTgt.y;
        ember.mainHandTgt.x += (tipX - ember.mainHandTgt.x) * Math.min(1, dt*12);
        ember.mainHandTgt.y += (tipY - ember.mainHandTgt.y) * Math.min(1, dt*12);
        ember.bladeAngle = ph;
      }

      // 剑光残像
      if(mv.bladeTrail && phase > 0.05 && phase < 0.85){
        _emberPushBladeTrail();
      }

      // 身位前冲
      if(!mv.stationary && phase < 0.7){
        const k = Math.sin(phase * Math.PI);
        const dirX = ember.facing;
        ember.vx = dirX * (mv.move * 2.0) * k;
        ember.vy = 0;
        _emberMove(dt, mv.isCharge);
        // 残影
        if(mv.afterimage && phase < 0.65 && Math.random() < dt*40){
          _emberPushAfterimage();
        }
      } else {
        ember.vx *= Math.pow(0.05, dt);
        ember.vy = 0;
      }

      if(mv.screenDim) ember.screenDimT = 0.5;

      // 近战 / AOE 命中
      if(!ember.atkHitDone && !mv.ranged
         && t >= mv.hitWin[0] && t <= mv.hitWin[1]){
        _emberApplyMelee(mv);
      }
    }

    // 远程实体更新
    _emberUpdateRanged(dt);

    if(ember.atkPhaseT >= mv.dur){
      ember.state = 'idle';
      ember.attackKey = null;
      ember.facingFrozen = false;
      ember.atkCD = 0.7 + Math.random()*0.5;
      ember.leanX = 0;
      ember.poseRaise = 0;
      ember.bodySpinAngle = 0;
    }
    return;
  }

  if(ember.state === 'hurt'){
    ember.stateTimer -= dt;
    ember.vx *= Math.pow(0.001, dt);
    ember.vy *= Math.pow(0.001, dt);
    _emberMove(dt);
    if(ember.stateTimer <= 0){ ember.state = 'idle'; ember.atkCD = 0.3; }
  }
  _emberTickDisplay(dt);
}

// ── 抽帧采样：把连续动画值量化到 ~12 FPS 显示 ──
// 让 render.js 用 ember.disp.* 而非实时值 → 像素动画质感
function _emberTickDisplay(dt){
  if(!ember.disp){
    ember.disp = {
      bobT: ember.bobT, breathT: ember.breathT,
      shardAngle: ember.shardAngle, bodySpinAngle: ember.bodySpinAngle,
      mainHand: {x: ember.mainHandTgt.x, y: ember.mainHandTgt.y},
      subHand:  {x: ember.subHandTgt.x,  y: ember.subHandTgt.y},
      leanX: ember.leanX, eyeGlow: ember.eyeGlow,
      converge: ember.converge, headTurn: ember.headTurn,
      poseRaise: ember.poseRaise,
      x: ember.x, y: ember.y,
    };
    ember._tickAcc = 0;
  }
  ember._tickAcc += dt;
  const TICK = 1/11;
  while(ember._tickAcc >= TICK){
    ember._tickAcc -= TICK;
    ember.disp.bobT = ember.bobT;
    ember.disp.breathT = ember.breathT;
    ember.disp.shardAngle = ember.shardAngle;
    ember.disp.bodySpinAngle = ember.bodySpinAngle;
    ember.disp.mainHand.x = ember.mainHandTgt.x;
    ember.disp.mainHand.y = ember.mainHandTgt.y;
    ember.disp.subHand.x = ember.subHandTgt.x;
    ember.disp.subHand.y = ember.subHandTgt.y;
    ember.disp.leanX = ember.leanX;
    ember.disp.eyeGlow = ember.eyeGlow;
    ember.disp.converge = ember.converge;
    ember.disp.headTurn = ember.headTurn;
    ember.disp.poseRaise = ember.poseRaise;
    ember.disp.x = ember.x;
    ember.disp.y = ember.y;
  }
}

// ── 缓动 ──
function _emberEaseOutCubic(t){ return 1 - Math.pow(1-t, 3); }
function _emberEaseInCubic(t){ return t*t*t; }
function _emberEaseInOut(t){ return t<0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2; }

// 披风物理：弹簧拉回 + 重力 + 阻尼 + 跟随主体
function _emberUpdateCape(dt){
  for(const ribbon of ember.cape){
    const sway = Math.sin(ember.bobT*1.3 + ribbon[0].ox*0.1) * 3.5;
    for(let i=0;i<ribbon.length;i++){
      const seg = ribbon[i];
      // 顶段锚定在身体（不动）
      if(i === 0){
        seg.x = seg.ox;
        seg.y = seg.oy;
        continue;
      }
      // 加速度：向静止位置 + 重力 + 摆动 + 速度阻尼
      const restY = ribbon[0].oy + i * 8.5;
      const restX = ribbon[0].ox * (1 - i*0.05) + sway*(i/ribbon.length);
      const ax = (restX - seg.x) * 18 - seg.vx*5;
      const ay = (restY - seg.y) * 18 - seg.vy*5 + 30;
      seg.vx += ax * dt;
      seg.vy += ay * dt;
      seg.x += seg.vx * dt;
      seg.y += seg.vy * dt;
    }
  }
}

function _emberPushBladeTrail(){
  ember.bladeTrail.push({
    x: ember.mainHandTgt.x, y: ember.mainHandTgt.y,
    age: 0, life: 0.26,
  });
  if(ember.bladeTrail.length > 22) ember.bladeTrail.shift();
}

function _emberPushAfterimage(){
  ember.afterimages.push({
    x: ember.x, y: ember.y,
    facing: ember.facing,
    armSwing: ember.mainHandTgt.x,
    age: 0, life: 0.30,
  });
  if(ember.afterimages.length > 5) ember.afterimages.shift();
}

function _emberMove(dt, passProps){
  const nx = ember.x + ember.vx*dt;
  const ny = ember.y + ember.vy*dt;
  if(typeof solidTerrain === 'function'){
    if(!solidTerrain(nx, ember.y)) ember.x = nx;
    if(!solidTerrain(ember.x, ny)) ember.y = ny;
  } else { ember.x = nx; ember.y = ny; }
  const margin = 30;
  if(ember.x < margin) ember.x = margin;
  if(ember.x > MAP_W*TILE - margin) ember.x = MAP_W*TILE - margin;
  if(ember.y < margin) ember.y = margin;
  if(ember.y > MAP_H*TILE - margin) ember.y = MAP_H*TILE - margin;
}

// ── 近战命中 + FX ──
function _emberApplyMelee(mv){
  if(typeof player === 'undefined') return;
  ember.atkHitDone = true;
  const dx = player.x - ember.x, dy = player.y - ember.y;
  const d = Math.hypot(dx, dy);
  if(mv.aoe){
    if(d > mv.range) return;
  } else {
    if(d > mv.range) return;
    if(ember.facing * dx < -14) return;
  }
  const hx = ember.x + dx*0.5, hy = ember.y + dy*0.5;
  if(mv.blockable && typeof defendBlock === 'function' && defendBlock(hx, hy)) return;
  const knock = mv.aoe ? 0.65 : 0.5;
  hurtPlayer(mv.dmg, dx, dy, knock, 0.3);
  if(mv.screenShake) camShake(0.6, 15);
  else camShake(0.24, 7);
  // FX
  shockwaves.push({x:hx, y:hy, r:8, maxR: mv.aoe?mv.range:65,
    life:0.4, age:0, c: mv.aoe?'#FFFFFF':'#FF8030'});
  if(mv.aoe){
    shockwaves.push({x:hx, y:hy, r:4, maxR: mv.range*0.6, life:0.3, age:0, c:'#FFD050'});
  }
  for(let i=0;i<18;i++){
    addParticle(hx, hy, {
      n:1, c: i%3===0?'#FFFFFF':(i%2?'#FFD060':'#FF4020'),
      spd: 150+Math.random()*120, r: 1.6+Math.random()*0.8, life:0.45,
      spread:0.5, angle: Math.random()*6.28, gravity:20
    });
  }
}

// ── 远程命中（核心逻辑，绘制在 fx.js）──
function _emberUpdateRanged(dt){
  for(const p of ember.pillars){
    p.t += dt;
    if(!p.fired && p.t >= p.delay){
      p.fired = true;
      if(typeof player !== 'undefined'){
        const d = Math.hypot(player.x-p.x, player.y-p.y);
        if(d <= 38){
          const blocked = (typeof defendBlock==='function') && defendBlock(p.x, p.y);
          if(!blocked) hurtPlayer(p.dmg, player.x-p.x, player.y-p.y, 0.55, 0.3);
        }
      }
      shockwaves.push({x:p.x,y:p.y,r:6,maxR:90,life:0.5,age:0,c:'#FF5020'});
      shockwaves.push({x:p.x,y:p.y,r:3,maxR:50,life:0.35,age:0,c:'#FFD080'});
      camShake(0.22, 7);
      for(let i=0;i<20;i++){
        addParticle(p.x, p.y, {
          n:1, c: i%3===0?'#FFFFFF':(i%2?'#FFC050':'#FF3010'),
          spd:140+Math.random()*100, r:1.8, life:0.55,
          spread:0.4, angle: -Math.PI/2 + (Math.random()-0.5)*1.6, gravity:60
        });
      }
    }
  }
  for(const b of ember.rainBalls){
    b.t += dt;
    b.rot += b.rotSpd * dt;
    if(!b.fired && b.t >= b.delay + b.dropTime){
      b.fired = true;
      if(typeof player !== 'undefined'){
        const d = Math.hypot(player.x-b.tx, player.y-b.ty);
        if(d <= 34){
          const blocked = (typeof defendBlock==='function') && defendBlock(b.tx, b.ty);
          if(!blocked) hurtPlayer(b.dmg, player.x-b.tx, player.y-b.ty, 0.5, 0.3);
        }
      }
      shockwaves.push({x:b.tx,y:b.ty,r:4,maxR:68,life:0.4,age:0,c:'#FF5020'});
      camShake(0.16, 5);
      for(let i=0;i<12;i++){
        addParticle(b.tx, b.ty, {
          n:1, c: i%2?'#FFD050':'#FF4020',
          spd:100+Math.random()*80, r:1.7, life:0.45,
          spread:0.5, angle: Math.random()*6.28, gravity:40
        });
      }
    }
  }
  if(ember.rift){
    const r = ember.rift;
    r.t += dt;
    if(!r.fired && r.t >= r.delay){
      r.fired = true;
      if(typeof player !== 'undefined'){
        const dx = r.x1-r.x0, dy = r.y1-r.y0;
        const L2 = dx*dx+dy*dy;
        let tk = ((player.x-r.x0)*dx + (player.y-r.y0)*dy) / L2;
        tk = Math.max(0, Math.min(1, tk));
        const cx = r.x0 + dx*tk, cy = r.y0 + dy*tk;
        const dist = Math.hypot(player.x-cx, player.y-cy);
        if(dist <= 30){
          const blocked = (typeof defendBlock==='function') && defendBlock(cx, cy);
          if(!blocked) hurtPlayer(r.dmg, player.x-cx, player.y-cy, 0.5, 0.3);
        }
      }
      camShake(0.36, 10);
      // 沿裂缝粒子
      for(let i=0;i<30;i++){
        const tk = i/29;
        const cx = r.x0 + (r.x1-r.x0)*tk;
        const cy = r.y0 + (r.y1-r.y0)*tk;
        addParticle(cx, cy, {
          n:1, c: i%2?'#FFD060':'#FF4020',
          spd:120+Math.random()*70, r:1.6, life:0.5,
          spread:0.4, angle: -Math.PI/2+(Math.random()-0.5)*1.2, gravity:30
        });
      }
    }
    if(r.fired && r.t > r.delay + r.life) ember.rift = null;
  }
}

// ── 受击 ──
function emberTakeDamage(dmg, kx, ky){
  if(!ember || ember.state==='dead' || ember.state==='entrance') return;
  ember.hp -= dmg;
  ember.hurtTimer = 0.22;
  for(let i=0;i<10;i++){
    addParticle(ember.x, ember.y-32, {
      n:1, c: i%2?'#FFD060':'#FF4020',
      spd:110+Math.random()*90, r:1.6, life:0.4,
      spread:0.6, angle: Math.random()*6.28, gravity:20
    });
  }
  if(dmg > ember.maxHp*0.08 && ember.state==='attack'
     && ember.atkPhaseT < EMBER_MOVES[ember.attackKey].dur*0.4){
    ember.state = 'hurt';
    ember.stateTimer = 0.32;
    ember.attackKey = null;
  }
  if(ember.hp <= 0){
    ember.hp = 0;
    ember.state = 'dead';
    ember.deadAge = 0;
    for(let i=0;i<110;i++){
      const a = i/110*6.283;
      addParticle(ember.x, ember.y-35, {
        n:1, c: i%3===0?'#FFFFFF':(i%3===1?'#FFD060':'#FF3010'),
        spd:240+Math.random()*200, r:2.5, life:1.0,
        spread:0.1, angle:a, gravity:22
      });
    }
    shockwaves.push({x:ember.x,y:ember.y-35,r:8,maxR:260,life:0.85,age:0,c:'#FF5020'});
    shockwaves.push({x:ember.x,y:ember.y-35,r:4,maxR:150,life:0.6,age:0,c:'#FFD080'});
    camShake(0.7, 17);
    triggerHitStop(0.2);
    triggerSlowMo(0.45, 0.3);
  }
}
