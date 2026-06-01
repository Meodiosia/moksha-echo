// ── ember/render.js ───────────────────────────────────────────
// 余烬主宰 · 主体绘制（v2 朦胧像素风）
// 设计：弃多边形描边 → 用径向渐变 blob 叠加
//      所有边缘 alpha 自然渐隐 → 无硬边
//      使用 ember.disp.* 抽帧采样值 → 12fps 像素感
//      整体缩 0.72×，体型紧凑
// ──────────────────────────────────────────────────────────────

const EMBER_SCALE = 0.72;

// ── 主入口 ──
function drawEmber(){
  if(!ember) return;
  const c = ctx;
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
  try { _emberDrawAll(c); }
  catch(err){ console.error('[ember inner draw]', err); }
  c.restore();
}

function _emberDrawAll(c){
  // 用 disp.x/y（抽帧后）防止位置抖动
  const ex = (ember.disp && ember.disp.x !== undefined) ? ember.disp.x : ember.x;
  const ey = (ember.disp && ember.disp.y !== undefined) ? ember.disp.y : ember.y;
  const sx = Math.round(ex - ox());
  const sy = Math.round((ey - oy()) * ISO_Y_SCALE);
  const ph = EMBER_PHASES[ember.phase];

  let alpha = 1;
  if(ember.state==='dead'){
    alpha = Math.max(0, 1 - ember.deadAge/1.4);
    if(alpha <= 0) return;
  }

  // 屏幕变暗（ult）
  if(ember.screenDimT > 0 && ember.state !== 'dead'){
    c.save();
    c.fillStyle = `rgba(15,5,10,${0.5*ember.screenDimT/0.5})`;
    c.fillRect(0, 0, CW, CH);
    c.restore();
  }

  // 地面热浪
  _emberDrawGroundHaze(c, sx, sy, ph);
  // 阴影
  _emberDrawShadow(c, sx, sy);
  // 背景余烬
  _emberDrawEmbers(c, sx, sy, ph);
  // 残影
  if(ember.afterimages.length > 0) _emberDrawAfterimages(c);

  // 用 disp 抽帧值取代实时
  const d = ember.disp || {};
  const bobT = d.bobT ?? ember.bobT;
  const breathT = d.breathT ?? ember.breathT;
  const bob = Math.sin(bobT*1.7) * 4 + Math.sin(bobT*3.3) * 1.6;
  const breath = 1 + Math.sin(breathT * ph.breath) * 0.04;
  const spinAng = d.bodySpinAngle || 0;
  const leanX = d.leanX || 0;

  c.save();
  c.globalAlpha = alpha;
  c.translate(sx + leanX, sy);
  if(spinAng) c.rotate(spinAng);
  c.translate(0, bob);
  c.scale(EMBER_SCALE * breath, EMBER_SCALE * breath);

  const hurtFlash = Math.max(0, ember.hurtTimer/0.22);

  // 火焰羽翼（在身体最后面）
  _emberDrawWings(c, ph);
  // 披风（在身后）
  _emberDrawCape(c, ph);
  // 腿部暗示
  _emberDrawLegs(c, ph);
  // 下半身 blob 团
  _emberDrawLowerBody(c, ph);
  // 主体躯干 blob
  _emberDrawTorso(c, ph, hurtFlash);
  // 副手
  _emberDrawArm(c, /*sub*/false, (d.subHand||ember.subHandTgt), ph);
  // 胸口熔核（在裂纹之前）
  _emberDrawChestCore(c, ph);
  // 头 + 眼
  _emberDrawHead(c, ph, hurtFlash, d.headTurn||0, d.eyeGlow||0.6);
  // 头顶火焰冠（替代皇冠碎片）
  _emberDrawFlameCrown(c, ph);
  // 主手 + 剑
  _emberDrawArm(c, /*main*/true, (d.mainHand||ember.mainHandTgt), ph);
  // 剑光残像
  if(ember.bladeTrail.length > 0) _emberDrawBladeTrail(c, ph);

  c.restore();

  // 远程实体
  if(typeof _emberDrawRanged === 'function') _emberDrawRanged(c);

  // 攻击 telegraph（fx.js）
  if(ember.state === 'attack'){
    const mv = EMBER_MOVES[ember.attackKey];
    const t = ember.atkPhaseT / mv.dur;
    if(mv.telegraph && t < mv.telegraph && typeof _emberDrawTelegraph === 'function'){
      _emberDrawTelegraph(c, sx, sy, mv, t/mv.telegraph);
    }
  }
}

// ── 工具：朦胧 blob（黑色 → 透明）──
function _blobDark(c, x, y, rx, ry, alpha){
  const grd = c.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
  grd.addColorStop(0,   `rgba(4,2,4,${alpha})`);
  grd.addColorStop(0.6, `rgba(12,4,8,${alpha*0.75})`);
  grd.addColorStop(1,   'rgba(20,8,12,0)');
  c.fillStyle = grd;
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, 6.283);
  c.fill();
}

// 暖色 blob（用 lighter 叠）
function _blobGlow(c, x, y, r, hue, alpha){
  const grd = c.createRadialGradient(x, y, 0, x, y, r);
  // hue: 0=黄白 1=橙 2=红
  let mid;
  if(hue===0)      mid = 'rgba(255,240,170';
  else if(hue===1) mid = 'rgba(255,140,40';
  else             mid = 'rgba(255,60,20';
  grd.addColorStop(0,   `rgba(255,255,220,${alpha})`);
  grd.addColorStop(0.35,`${mid},${alpha*0.85})`);
  grd.addColorStop(1,   'rgba(255,40,10,0)');
  c.fillStyle = grd;
  c.beginPath();
  c.arc(x, y, r, 0, 6.283);
  c.fill();
}

// ── 地面热浪（无边界，纯渐变）──
function _emberDrawGroundHaze(c, sx, sy, ph){
  c.save();
  c.globalCompositeOperation = 'lighter';
  const R = 130 * ph.auraScale;
  const grd = c.createRadialGradient(sx, sy+2, 6, sx, sy+2, R);
  grd.addColorStop(0,   `rgba(255,130,40,${0.55*ph.rageGlow})`);
  grd.addColorStop(0.35,`rgba(255,80,20,${0.30*ph.rageGlow})`);
  grd.addColorStop(0.7, `rgba(180,40,10,${0.12*ph.rageGlow})`);
  grd.addColorStop(1,   'rgba(120,20,5,0)');
  c.fillStyle = grd;
  c.beginPath();
  c.ellipse(sx, sy+2, R, R*0.34, 0, 0, 6.283);
  c.fill();
  // 内核
  const grd2 = c.createRadialGradient(sx, sy, 0, sx, sy, 38*ph.auraScale);
  grd2.addColorStop(0, `rgba(255,220,150,${0.7*ph.rageGlow})`);
  grd2.addColorStop(1, 'rgba(255,100,40,0)');
  c.fillStyle = grd2;
  c.beginPath();
  c.ellipse(sx, sy, 38*ph.auraScale, 10*ph.auraScale, 0, 0, 6.283);
  c.fill();
  c.globalCompositeOperation = 'source-over';
  c.restore();
}

// 阴影（柔软）
function _emberDrawShadow(c, sx, sy){
  c.save();
  const grd = c.createRadialGradient(sx, sy+2, 0, sx, sy+2, 30);
  grd.addColorStop(0,   'rgba(0,0,0,0.55)');
  grd.addColorStop(0.6, 'rgba(0,0,0,0.25)');
  grd.addColorStop(1,   'rgba(0,0,0,0)');
  c.fillStyle = grd;
  c.beginPath();
  c.ellipse(sx, sy+2, 30, 9, 0, 0, 6.283);
  c.fill();
  c.restore();
}

// ── 躯干：3-4 个暗 blob 叠加 + 内核熔光 ──
function _emberDrawTorso(c, ph, hurtFlash){
  c.save();
  // 阴影主体（大暗 blob，加深 alpha 强化剪影）
  _blobDark(c, 0, -36, 20, 32, 0.95);
  // 肩部（两侧小 blob）
  _blobDark(c, -16, -52, 10, 7, 0.88);
  _blobDark(c,  16, -52, 10, 7, 0.88);
  // 颈/胸交界
  _blobDark(c, 0, -50, 11, 7, 0.92);
  // 腹部（下方稍小）
  _blobDark(c, 0, -8, 16, 11, 0.85);

  // 受击红闪（叠在身体上）
  if(hurtFlash > 0){
    c.globalCompositeOperation = 'lighter';
    _blobGlow(c, 0, -32, 30, 2, hurtFlash*0.4);
    c.globalCompositeOperation = 'source-over';
  }

  c.restore();
}

// 下半身（披风外的核心黑团 + 火纹流光）
function _emberDrawLowerBody(c, ph){
  c.save();
  // 主下身大 blob
  _blobDark(c, 0, 14, 22, 18, 0.78);
  _blobDark(c, 0, 28, 26, 14, 0.55);
  // 内部火纹（散点 lighter 暖色）
  c.globalCompositeOperation = 'lighter';
  for(let i=0;i<5;i++){
    const x = -14 + i*7 + Math.sin(ember.bobT*1.5 + i*1.3)*2;
    const y = 18 + Math.sin(ember.bobT*2 + i)*5;
    _blobGlow(c, x, y, 7, 1, 0.35*ph.rageGlow);
  }
  c.globalCompositeOperation = 'source-over';
  c.restore();
}

// 胸口熔核（柔软呼吸光）
function _emberDrawChestCore(c, ph){
  c.save();
  c.globalCompositeOperation = 'lighter';
  const breath = 1 + Math.sin(ember.breathT*ph.breath)*0.18;
  const r = 16 * breath;
  // 外晕
  _blobGlow(c, 0, -32, r*1.6, 1, 0.85*ph.rageGlow);
  // 核心
  _blobGlow(c, 0, -32, r*0.5, 0, ph.rageGlow);
  c.globalCompositeOperation = 'source-over';
  c.restore();
}

// ── 头部：单个柔软 blob + 眼 + 角（模糊） ──
function _emberDrawHead(c, ph, hurtFlash, headTurn, eyeGlow){
  c.save();
  const turn = (headTurn||0) * 0.12;
  c.translate(0, -68);
  c.rotate(turn);
  // 头主体 blob（深色椭圆，边缘渐隐）
  _blobDark(c, 0, 0, 13, 16, 0.92);
  // 下颌（细长 blob 在底部）
  _blobDark(c, 0, 8, 9, 6, 0.6);
  // 角：两侧弯曲的 blob 串
  _emberDrawHorn(c, -10, -10, -1, ph);
  _emberDrawHorn(c,  10, -10,  1, ph);
  // 眼睛（柔光双点）
  _emberDrawEyes(c, ph, eyeGlow);
  // 受击红闪
  if(hurtFlash > 0){
    c.globalCompositeOperation = 'lighter';
    _blobGlow(c, 0, 0, 20, 2, hurtFlash*0.5);
    c.globalCompositeOperation = 'source-over';
  }
  c.restore();
}

// 角：3 个小 blob 串成弧
function _emberDrawHorn(c, x, y, dir, ph){
  c.save();
  for(let i=0;i<4;i++){
    const t = i/3;
    const cx = x + dir*t*10;
    const cy = y - t*16 - t*t*4;
    const sz = 4 - t*1.5;
    _blobDark(c, cx, cy, sz, sz, 0.85 - t*0.2);
  }
  // 角根熔光
  c.globalCompositeOperation = 'lighter';
  _blobGlow(c, x + dir*2, y - 2, 5, 1, 0.5*ph.rageGlow);
  c.globalCompositeOperation = 'source-over';
  c.restore();
}

// 眼睛（柔光双点，含微抖动闪烁）
function _emberDrawEyes(c, ph, intensity){
  c.save();
  c.globalCompositeOperation = 'lighter';
  for(let s=-1;s<=1;s+=2){
    // 微抖闪烁（每帧一点点偏移）
    const jx = (Math.random()-0.5)*0.6;
    const jy = (Math.random()-0.5)*0.6;
    const ex = s*4 + jx, ey = -4 + jy;
    // 大柔晕
    _blobGlow(c, ex, ey, 6, 0, intensity*0.9);
    // 极小硬核（仅这里有 ~1px 实点）
    c.fillStyle = `rgba(255,255,240,${intensity})`;
    c.beginPath();
    c.arc(ex, ey, 0.8, 0, 6.283);
    c.fill();
  }
  c.globalCompositeOperation = 'source-over';
  c.restore();
}

// ── 双臂：IK 链上 3 个 blob ──
function _emberDrawArm(c, isMain, hand, ph){
  const facing = ember.facing;
  const shX = isMain ? facing*15 : -facing*14;
  const shY = -50;
  const tx = hand.x * facing;
  const ty = hand.y;
  const L1 = 18, L2 = 22;
  let dxv = tx - shX, dyv = ty - shY;
  let d = Math.hypot(dxv, dyv);
  const maxD = L1 + L2 - 0.5;
  if(d > maxD){ const k = maxD/d; dxv*=k; dyv*=k; d = maxD; }
  const a1 = Math.atan2(dyv, dxv);
  const cosA = (L1*L1 + d*d - L2*L2) / (2*L1*Math.max(1, d));
  const a2 = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const elbowAng = a1 + a2;
  const elX = shX + Math.cos(elbowAng) * L1;
  const elY = shY + Math.sin(elbowAng) * L1;
  const wrX = shX + dxv;
  const wrY = shY + dyv;

  c.save();
  // 上臂 3 个 blob
  for(let i=0;i<3;i++){
    const t = (i+1)/4;
    _blobDark(c, shX + (elX-shX)*t, shY + (elY-shY)*t, 4.5, 4.5, 0.82);
  }
  // 前臂 3 个 blob
  for(let i=0;i<3;i++){
    const t = (i+1)/4;
    _blobDark(c, elX + (wrX-elX)*t, elY + (wrY-elY)*t, 4, 4, 0.78);
  }
  // 肩 blob
  _blobDark(c, shX, shY, 6, 5, 0.85);
  // 肘
  _blobDark(c, elX, elY, 4.5, 4.5, 0.85);
  // 手
  _blobDark(c, wrX, wrY, 4, 4, 0.78);

  const wristAng = Math.atan2(wrY - elY, wrX - elX);
  if(isMain){
    _emberDrawBlade(c, wrX, wrY, wristAng, ph);
  } else {
    // 副手凝火球（柔光，无硬边）
    c.globalCompositeOperation = 'lighter';
    const r = 7 + Math.sin(ember.bobT*4)*1.5;
    _blobGlow(c, wrX, wrY, r*1.5, 1, ph.rageGlow*0.85);
    _blobGlow(c, wrX, wrY, r*0.6, 0, ph.rageGlow*0.9);
    c.globalCompositeOperation = 'source-over';
  }
  c.restore();
}

// 余烬刃：朦胧光带（无明确轮廓）
function _emberDrawBlade(c, x, y, ang, ph){
  const len = 52;
  c.save();
  c.translate(x, y);
  c.rotate(ang);
  c.globalCompositeOperation = 'lighter';
  // 沿刃方向多个 blob 渐弱
  const N = 7;
  for(let i=0;i<N;i++){
    const t = i/(N-1);
    const cx = 6 + t*(len-6);
    const r = (5 - t*3) * (1 + Math.sin(ember.bobT*6+i)*0.1);
    const a = (1 - t*0.5) * ph.rageGlow;
    _blobGlow(c, cx, 0, r*1.5, t<0.4?0:1, a*0.55);
  }
  // 刃尖大光球
  _blobGlow(c, len, 0, 12, 0, ph.rageGlow*0.85);
  c.globalCompositeOperation = 'source-over';
  c.restore();
}

// 剑光残像：每点一个柔光 blob + 相邻连扇
function _emberDrawBladeTrail(c, ph){
  if(ember.bladeTrail.length < 2) return;
  c.save();
  c.globalCompositeOperation = 'lighter';
  const facing = ember.facing;
  const shX = 15*facing, shY = -50;
  for(let i=0;i<ember.bladeTrail.length;i++){
    const a = ember.bladeTrail[i];
    const k = 1 - a.age/a.life;
    if(k < 0.05) continue;
    const ax = a.x*facing, ay = a.y;
    // 每点柔光 blob
    _blobGlow(c, ax, ay, 8*k, 1, 0.45*k*ph.rageGlow);
    // 与上一点连扇
    if(i>0){
      const b = ember.bladeTrail[i-1];
      const kb = 1 - b.age/b.life;
      if(kb < 0.05) continue;
      const bx = b.x*facing, by = b.y;
      // 中点 blob 把扇填满（避免硬连线）
      const mx = (ax+bx)*0.5, my = (ay+by)*0.5;
      _blobGlow(c, mx, my, 7*k, 1, 0.32*k*ph.rageGlow);
    }
  }
  c.globalCompositeOperation = 'source-over';
  c.restore();
}

// 残影
function _emberDrawAfterimages(c){
  c.save();
  c.globalCompositeOperation = 'lighter';
  for(const af of ember.afterimages){
    const k = 1 - af.age/af.life;
    const sx = af.x - ox();
    const sy = (af.y - oy()) * ISO_Y_SCALE;
    // 双层柔光剪影
    _blobGlow(c, sx, sy-26, 18, 1, 0.35*k);
    _blobGlow(c, sx, sy-40, 14, 0, 0.25*k);
  }
  c.globalCompositeOperation = 'source-over';
  c.restore();
}

// 披风：用 verlet 段画串小 blob 而非多边形
function _emberDrawCape(c, ph){
  c.save();
  for(let r=0;r<ember.cape.length;r++){
    const ribbon = ember.cape[r];
    // 黑色身骨
    for(let i=0;i<ribbon.length;i++){
      const s = ribbon[i];
      const w = 5 - i*0.4;
      _blobDark(c, s.x, s.y, w, w*1.1, 0.72 - i*0.06);
    }
    // 内部火纹（lighter，小 blob）
    c.globalCompositeOperation = 'lighter';
    for(let i=1;i<ribbon.length;i++){
      const s = ribbon[i];
      const t = i/ribbon.length;
      const pulse = 0.6 + 0.4*Math.sin(ember.bobT*3 + i*0.7);
      _blobGlow(c, s.x, s.y, 3*pulse, 1, 0.3*ph.rageGlow*t);
    }
    c.globalCompositeOperation = 'source-over';
  }
  c.restore();
}

// 皇冠：5-7 个小柔光点，sin 脉动轨道
function _emberDrawCrown(c, ph, shardAngle, converge){
  const N = 7;
  const sizes = [5, 4, 5, 3.5, 5, 3.5, 4.5];
  const baseR = (28 - converge*18) * (1 + Math.sin(ember.bobT*0.7)*0.06);
  const tilt = 0.4;
  c.save();
  c.translate(0, -90);
  for(let i=0;i<N;i++){
    // 非匀速：每个碎片有独立相位偏移
    const off = i/N*6.283;
    const ang = shardAngle * (i%2===0?1:-0.7) + off + Math.sin(ember.bobT*1.2+i)*0.15;
    const x = Math.cos(ang) * baseR;
    const y = Math.sin(ang) * baseR * tilt;
    const depth = Math.sin(ang);
    const sz = sizes[i] * (0.8 + depth*0.2);
    const alpha = (0.65 + depth*0.25);
    // 暗心 + 火光
    c.globalCompositeOperation = 'source-over';
    _blobDark(c, x, y, sz*1.2, sz*1.2, alpha);
    c.globalCompositeOperation = 'lighter';
    const glow = 0.55 + 0.45*Math.sin(ember.bobT*2.4 + i*1.1);
    _blobGlow(c, x, y, sz*2, 1, glow*0.65*ph.rageGlow);
    _blobGlow(c, x, y, sz*0.6, 0, glow*0.9*ph.rageGlow);
    c.globalCompositeOperation = 'source-over';
  }
  c.restore();
}

// 背景余烬粒子（持续散发）— 改更柔
function _emberDrawEmbers(c, sx, sy, ph){
  c.save();
  c.globalCompositeOperation = 'lighter';
  for(const s of ember.embers){
    const dx = s.x - ember.x;
    const dy = s.y - ember.y;
    const px = sx + dx * EMBER_SCALE;
    const py = sy + dy * ISO_Y_SCALE * EMBER_SCALE;
    const k = 1 - s.life/s.maxLife;
    const flick = 0.7 + 0.3*Math.sin(s.flick);
    const r = s.r * (0.5 + k*0.7) * flick * 1.8;
    // 全部用渐变 blob，无硬点
    const grd = c.createRadialGradient(px, py, 0, px, py, r*2.5);
    grd.addColorStop(0,   `hsla(${s.hue},100%,${55+k*25}%,${k*0.85*ph.rageGlow})`);
    grd.addColorStop(0.5, `hsla(${s.hue},100%,40%,${k*0.35*ph.rageGlow})`);
    grd.addColorStop(1,   'rgba(255,40,10,0)');
    c.fillStyle = grd;
    c.beginPath();
    c.arc(px, py, r*2.5, 0, 6.283);
    c.fill();
  }
  c.globalCompositeOperation = 'source-over';
  c.restore();
}

// ── 火焰羽翼（主视觉，参考凤凰/火魔形象）──
// 2 翼 × 9 羽，每羽 = 一根弯曲火焰舌头
function _emberDrawWings(c, ph){
  c.save();
  c.globalCompositeOperation = 'lighter';
  const N = 9;
  // 翼整体扇动
  const flap = Math.sin(ember.bobT*0.9) * 0.08 + Math.sin(ember.bobT*2.3)*0.04;
  for(let side=-1;side<=1;side+=2){
    // 锚定肩部附近
    const ax = side*14;
    const ay = -50;
    for(let i=0;i<N;i++){
      const t = i/(N-1);                  // 0=下，1=上
      // 张开角：底羽向后下、顶羽向上后
      const baseAng = side > 0 ? 0 : Math.PI;  // 外侧水平
      const spread = Math.PI * 0.95;             // 总展开 ~170°
      // 羽毛沿翼弧分布：t=0 下后，t=1 上后
      const localAng = (t - 0.5) * spread - Math.PI*0.15;  // 偏上
      const ang = baseAng + side * localAng - flap*Math.cos((t-0.5)*Math.PI);
      // 长度：中段最长（菱形分布）
      const len = 28 + 38 * Math.sin(t*Math.PI);
      // 宽度
      const w = 5 + 6 * Math.sin(t*Math.PI);
      // 每羽独立闪烁
      const flickPhase = ember.bobT*3 + i*1.7 + side*2.4;
      const flick = 0.75 + 0.25*Math.sin(flickPhase);
      _emberDrawFlameFeather(c, ax, ay, ang, len*flick, w*flick, ph, i, side);
    }
    // 翼根聚光（强化）
    const grd = c.createRadialGradient(ax, ay, 0, ax, ay, 22);
    grd.addColorStop(0, `rgba(255,200,80,${0.8*ph.rageGlow})`);
    grd.addColorStop(0.5, `rgba(255,100,30,${0.5*ph.rageGlow})`);
    grd.addColorStop(1, 'rgba(255,40,10,0)');
    c.fillStyle = grd;
    c.beginPath(); c.arc(ax, ay, 22, 0, 6.283); c.fill();
  }
  c.globalCompositeOperation = 'source-over';
  c.restore();
}

// 单根火焰羽：沿方向用多个泪滴 blob 串接
function _emberDrawFlameFeather(c, ax, ay, ang, length, width, ph, idx, side){
  c.save();
  c.translate(ax, ay);
  c.rotate(ang);
  // 沿羽身画 N 个递减椭圆（外焰 + 内焰）
  const SEG = 7;
  for(let i=0;i<SEG;i++){
    const t = i/(SEG-1);
    const x = t * length;
    // 泪滴形状：中段宽 → 尖端收
    const wForm = width * Math.sin(Math.pow(t, 0.7) * Math.PI);
    if(wForm < 0.4) continue;
    // 微抖位置
    const jy = Math.sin(ember.bobT*6 + idx + i*0.6) * (1 + t*2);
    // 外焰（橙红，大半径）
    const gOut = c.createRadialGradient(x, jy, 0, x, jy, wForm*2.6);
    gOut.addColorStop(0,   `rgba(255,180,60,${0.62*ph.rageGlow*(1-t*0.35)})`);
    gOut.addColorStop(0.4, `rgba(255,80,20,${0.42*ph.rageGlow*(1-t*0.4)})`);
    gOut.addColorStop(1,   'rgba(200,30,10,0)');
    c.fillStyle = gOut;
    c.beginPath();
    c.ellipse(x, jy, wForm*2.6, wForm*1.8, 0, 0, 6.283);
    c.fill();
    // 内焰（黄白热心，仅前 50%）
    if(t < 0.55){
      const gIn = c.createRadialGradient(x, jy, 0, x, jy, wForm*0.9);
      gIn.addColorStop(0, `rgba(255,250,200,${0.85*ph.rageGlow*(1-t*0.6)})`);
      gIn.addColorStop(1, 'rgba(255,80,20,0)');
      c.fillStyle = gIn;
      c.beginPath();
      c.ellipse(x, jy, wForm*0.9, wForm*0.65, 0, 0, 6.283);
      c.fill();
    }
  }
  // 羽尖飞散粒子
  if(Math.random() < 0.35){
    const tipX = length;
    const tipY = (Math.random()-0.5)*4;
    const r = 2 + Math.random()*2;
    const g = c.createRadialGradient(tipX, tipY, 0, tipX, tipY, r*2);
    g.addColorStop(0, `rgba(255,200,80,${0.85*ph.rageGlow})`);
    g.addColorStop(1, 'rgba(255,40,10,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(tipX, tipY, r*2, 0, 6.283);
    c.fill();
  }
  c.restore();
}

// 腿部暗示（简短双腿 blob）
function _emberDrawLegs(c, ph){
  c.save();
  // 两条短腿（黑色 blob 串）
  for(let side=-1;side<=1;side+=2){
    const x = side*7;
    for(let i=0;i<3;i++){
      const t = i/2;
      _blobDark(c, x + Math.sin(ember.bobT*1.5 + side)*1, 30 + t*16, 5 - t*0.5, 5 - t*0.5, 0.72 - t*0.18);
    }
    // 脚（横扁 blob）
    _blobDark(c, x, 46, 7, 3, 0.65);
  }
  // 内部火光（沿腿）
  c.globalCompositeOperation = 'lighter';
  for(let side=-1;side<=1;side+=2){
    const x = side*7;
    for(let i=0;i<3;i++){
      const t = i/2;
      const pulse = 0.6 + 0.4*Math.sin(ember.bobT*2 + i + side);
      _blobGlow(c, x, 32 + t*14, 3.5, 1, 0.4*pulse*ph.rageGlow);
    }
  }
  c.globalCompositeOperation = 'source-over';
  c.restore();
}

// 头顶火焰冠（替代碎片皇冠）— 几道上扬的小火舌
function _emberDrawFlameCrown(c, ph){
  c.save();
  c.translate(0, -78);
  c.globalCompositeOperation = 'lighter';
  const N = 6;
  for(let i=0;i<N;i++){
    const t = i/(N-1);
    const x = (t - 0.5) * 22;
    // 中央最长，向两侧递减
    const len = 8 + 16 * Math.sin(t*Math.PI);
    const flick = 0.7 + 0.3*Math.sin(ember.bobT*5 + i*2.1);
    const angle = -Math.PI/2 + (t-0.5)*0.6;   // 向上发散
    const ang = angle + Math.sin(ember.bobT*3 + i)*0.15;
    _emberDrawFlameFeather(c, x, 0, ang, len*flick, 3.5*flick, ph, i+99, 0);
  }
  c.globalCompositeOperation = 'source-over';
  c.restore();
}

