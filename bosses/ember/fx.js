// ── ember/fx.js (v2) ──────────────────────────────────────────
// 余烬主宰 · 特效绘制 — 全部弃硬边界，改径向热浪雾团 + 余烬粒子警示
// ──────────────────────────────────────────────────────────────

// 通用：朦胧 telegraph 热浪（无外环描边）
function _emberHazeRing(c, sx, sy, R, color, alpha){
  c.save();
  c.globalCompositeOperation = 'lighter';
  // 多层渐变叠加产生厚度感
  for(let i=0;i<3;i++){
    const s = 1 - i*0.25;
    const grd = c.createRadialGradient(sx, sy, R*0.2*s, sx, sy, R*s);
    grd.addColorStop(0,   `${color},0)`);
    grd.addColorStop(0.5, `${color},${alpha*0.18})`);
    grd.addColorStop(0.85,`${color},${alpha*0.35})`);
    grd.addColorStop(1,   `${color},0)`);
    c.fillStyle = grd;
    c.beginPath();
    c.ellipse(sx, sy, R*s, R*s*ISO_Y_SCALE, 0, 0, 6.283);
    c.fill();
  }
  c.globalCompositeOperation = 'source-over';
  c.restore();
}

// 警示余烬：沿圆周散布微粒（替代圆环描边）
function _emberHazeWarning(c, sx, sy, R, color, k){
  c.save();
  c.globalCompositeOperation = 'lighter';
  const N = 14;
  for(let i=0;i<N;i++){
    const a = i/N*6.283 + Math.sin(ember.bobT*3 + i)*0.1;
    const rr = R * (0.85 + Math.sin(ember.bobT*5 + i*1.3)*0.08);
    const x = sx + Math.cos(a)*rr;
    const y = sy + Math.sin(a)*rr*ISO_Y_SCALE;
    const flick = 0.5 + 0.5*Math.sin(ember.bobT*6 + i*2);
    const r = 4 + flick*2;
    const grd = c.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0,   `${color},${0.7*k*flick})`);
    grd.addColorStop(0.5, `${color},${0.3*k*flick})`);
    grd.addColorStop(1,   `${color},0)`);
    c.fillStyle = grd;
    c.beginPath();
    c.arc(x, y, r, 0, 6.283);
    c.fill();
  }
  c.globalCompositeOperation = 'source-over';
  c.restore();
}

// telegraph 主入口
function _emberDrawTelegraph(c, sx, sy, mv, k){
  const big = mv.telegraphColor === 'red_big';
  const whiteish = mv.telegraphColor === 'white';
  const color = whiteish ? 'rgba(220,220,220' : 'rgba(255,80,30';
  const R = mv.range * (big?1.15:1.0);
  // 用 ease-in-out 让脉动节奏不匀速
  const pulse = 0.35 + 0.55*Math.pow(Math.sin(k*Math.PI), 1.6);
  _emberHazeRing(c, sx, sy, R*k, color, pulse * (big?1.4:1));
  _emberHazeWarning(c, sx, sy, R*k*0.92, color, pulse * (big?1.2:1));
  if(big){
    // 大招中心追加热核
    c.save();
    c.globalCompositeOperation = 'lighter';
    const cg = c.createRadialGradient(sx, sy, 0, sx, sy, R*k*0.45);
    cg.addColorStop(0, `rgba(255,240,180,${pulse*0.65})`);
    cg.addColorStop(0.6,`rgba(255,80,20,${pulse*0.35})`);
    cg.addColorStop(1, 'rgba(255,40,10,0)');
    c.fillStyle = cg;
    c.beginPath();
    c.ellipse(sx, sy, R*k*0.45, R*k*0.45*ISO_Y_SCALE, 0, 0, 6.283);
    c.fill();
    c.restore();
  }
}

// ── 远程实体绘制 ──
function _emberDrawRanged(c){
  for(const p of ember.pillars) _emberDrawPillar(c, p);
  for(const b of ember.rainBalls) _emberDrawRainBall(c, b);
  if(ember.rift) _emberDrawRift(c, ember.rift);
}

// 熔岩柱：朦胧光柱 + 警示余烬
function _emberDrawPillar(c, p){
  const sx = p.x - ox();
  const sy = (p.y - oy()) * ISO_Y_SCALE;
  c.save();
  if(!p.fired){
    const k = Math.min(1, p.t / p.delay);
    // 地面朦胧 telegraph（替代圆环）
    _emberHazeRing(c, sx, sy, 40*k+8, 'rgba(255,60,20', k);
    _emberHazeWarning(c, sx, sy, 36*k, 'rgba(255,140,50', k*0.8);
    // 顶上漂浮预兆余烬（从地面飞起预示喷发）
    c.globalCompositeOperation = 'lighter';
    for(let i=0;i<6;i++){
      const px = sx + Math.sin(p.t*4 + i)*16;
      const py = sy - (p.t/p.delay)*30 - i*4;
      const r = 5 - i*0.5;
      const grd = c.createRadialGradient(px, py, 0, px, py, r);
      grd.addColorStop(0, `rgba(255,200,100,${0.6*k})`);
      grd.addColorStop(1, 'rgba(255,40,10,0)');
      c.fillStyle = grd;
      c.beginPath(); c.arc(px, py, r, 0, 6.283); c.fill();
    }
    c.globalCompositeOperation = 'source-over';
  } else if(p.t < p.delay + p.dur){
    const age = p.t - p.delay;
    // ease-out 上升
    const eased = 1 - Math.pow(1 - Math.min(1, age/0.4), 3);
    const fade = Math.max(0, 1 - Math.max(0, (age - p.dur*0.5)/(p.dur*0.5)));
    const h = 110 * eased * (0.5 + fade*0.5);

    c.globalCompositeOperation = 'lighter';
    // 喷柱：纵向多个 blob 串接
    const N = 8;
    for(let i=0;i<N;i++){
      const t = i/(N-1);
      const yy = sy - h * t;
      const xx = sx + Math.sin(age*7 + i*0.9)*4*t;
      const r = (12 - i*0.7) * (1 + Math.sin(age*8+i)*0.1) * fade;
      // 外橙
      const gOuter = c.createRadialGradient(xx, yy, 0, xx, yy, r*2);
      gOuter.addColorStop(0,   `rgba(255,160,60,${0.8*fade})`);
      gOuter.addColorStop(0.5, `rgba(255,80,20,${0.45*fade})`);
      gOuter.addColorStop(1,   'rgba(255,40,10,0)');
      c.fillStyle = gOuter;
      c.beginPath(); c.arc(xx, yy, r*2, 0, 6.283); c.fill();
      // 内白
      if(i < 4){
        const gInner = c.createRadialGradient(xx, yy, 0, xx, yy, r*0.7);
        gInner.addColorStop(0, `rgba(255,255,220,${0.85*fade})`);
        gInner.addColorStop(1, 'rgba(255,80,20,0)');
        c.fillStyle = gInner;
        c.beginPath(); c.arc(xx, yy, r*0.7, 0, 6.283); c.fill();
      }
    }
    // 顶端散出余烬
    for(let i=0;i<4;i++){
      const px = sx + Math.cos(i*1.6 + age*4)*8;
      const py = sy - h - i*6;
      const r = 4*fade;
      const grd = c.createRadialGradient(px, py, 0, px, py, r);
      grd.addColorStop(0, `rgba(255,180,80,${0.8*fade})`);
      grd.addColorStop(1, 'rgba(255,40,10,0)');
      c.fillStyle = grd;
      c.beginPath(); c.arc(px, py, r, 0, 6.283); c.fill();
    }
    // 底部基座柔光
    const baseGrd = c.createRadialGradient(sx, sy, 0, sx, sy, 32);
    baseGrd.addColorStop(0, `rgba(255,220,150,${0.7*fade})`);
    baseGrd.addColorStop(1, 'rgba(255,40,10,0)');
    c.fillStyle = baseGrd;
    c.beginPath(); c.ellipse(sx, sy, 32, 9, 0, 0, 6.283); c.fill();
    c.globalCompositeOperation = 'source-over';

    // 焦痕
    c.fillStyle = `rgba(20,8,4,${0.4*fade})`;
    c.beginPath(); c.ellipse(sx, sy+2, 26, 7, 0, 0, 6.283); c.fill();
  }
  c.restore();
}

// 烬雨陨石：朦胧光球 + 软拖尾
function _emberDrawRainBall(c, b){
  const tx = b.tx - ox();
  const ty = (b.ty - oy()) * ISO_Y_SCALE;
  c.save();
  if(!b.fired){
    if(b.t < b.delay){
      // 地面朦胧 telegraph（替代圆描边）
      const k = b.t / b.delay;
      _emberHazeRing(c, tx, ty, 32*k+6, 'rgba(255,80,30', k);
      _emberHazeWarning(c, tx, ty, 28*k, 'rgba(255,150,50', k*0.7);
    } else {
      // 下落
      const fk = (b.t - b.delay) / b.dropTime;
      // ease-in（重力加速）
      const easedFk = fk * fk;
      const dropH = 180;
      const fy = ty - (1-easedFk) * dropH;

      c.globalCompositeOperation = 'lighter';
      // 长尾柔光 blob 串
      const TN = 8;
      for(let i=0;i<TN;i++){
        const t = i/(TN-1);
        const yy = fy - (1-t) * 40 * (0.4 + easedFk*0.6);
        const xx = tx + Math.sin(b.t*8 + i*0.5)*2 * (1-t);
        const r = (8 - t*5) * easedFk + 2;
        const a = (1-t)*easedFk;
        const grd = c.createRadialGradient(xx, yy, 0, xx, yy, r*2);
        grd.addColorStop(0,   `rgba(255,200,100,${0.7*a})`);
        grd.addColorStop(0.5, `rgba(255,80,20,${0.35*a})`);
        grd.addColorStop(1,   'rgba(255,40,10,0)');
        c.fillStyle = grd;
        c.beginPath(); c.arc(xx, yy, r*2, 0, 6.283); c.fill();
      }
      // 陨石头部柔光球（无硬边）
      const headR = 10 + Math.sin(b.t*15)*1.5;
      _blobGlow(c, tx, fy, headR*1.8, 0, 0.95);
      _blobGlow(c, tx, fy, headR*0.6, 0, 1.0);
      c.globalCompositeOperation = 'source-over';
    }
  }
  c.restore();
}

// 地裂：朦胧裂带 + 沿线散粒 + 上射软光
function _emberDrawRift(c, r){
  const x0 = r.x0 - ox(), y0 = (r.y0 - oy())*ISO_Y_SCALE;
  const x1 = r.x1 - ox(), y1 = (r.y1 - oy())*ISO_Y_SCALE;
  c.save();
  if(!r.fired){
    const k = r.t / r.delay;
    // 沿线分布警示余烬（替代虚线）
    c.globalCompositeOperation = 'lighter';
    const N = 16;
    for(let i=0;i<N;i++){
      const t = i/(N-1);
      const cx = x0 + (x1-x0)*t;
      const cy = y0 + (y1-y0)*t;
      const flick = 0.4 + 0.6*Math.sin(r.t*8 + i*0.8);
      const rr = 5 * k * flick;
      const grd = c.createRadialGradient(cx, cy, 0, cx, cy, rr*1.5);
      grd.addColorStop(0,   `rgba(255,80,30,${0.7*k*flick})`);
      grd.addColorStop(0.5, `rgba(255,120,50,${0.3*k*flick})`);
      grd.addColorStop(1,   'rgba(255,40,10,0)');
      c.fillStyle = grd;
      c.beginPath(); c.arc(cx, cy, rr*1.5, 0, 6.283); c.fill();
    }
    // 末端预警柔光
    _blobGlow(c, x1, y1, 10*k, 1, k*0.7);
    c.globalCompositeOperation = 'source-over';
  } else {
    const age = r.t - r.delay;
    const k = Math.max(0, 1 - age / r.life);
    // ease-out 展开
    const eased = 1 - Math.pow(1 - Math.min(1, age/0.15), 3);

    c.globalCompositeOperation = 'lighter';
    // 沿线柔光 blob 串
    const N = 22;
    const dx = x1-x0, dy = y1-y0;
    const len = Math.hypot(dx, dy)||1;
    const nx = -dy/len, ny = dx/len;
    for(let i=0;i<N;i++){
      const t = i/(N-1);
      const cx = x0 + dx*t;
      const cy = y0 + dy*t;
      const z = (r.zigzag[i] || 0) * 0.4 * eased;
      const cx2 = cx + nx*z;
      const cy2 = cy + ny*z;
      const r0 = (12 - Math.abs(t-0.5)*8) * eased;
      // 外橙
      const grd = c.createRadialGradient(cx2, cy2, 0, cx2, cy2, r0*1.6);
      grd.addColorStop(0,   `rgba(255,180,80,${0.85*k})`);
      grd.addColorStop(0.5, `rgba(255,80,20,${0.45*k})`);
      grd.addColorStop(1,   'rgba(255,40,10,0)');
      c.fillStyle = grd;
      c.beginPath(); c.arc(cx2, cy2, r0*1.6, 0, 6.283); c.fill();
      // 内白核
      const gI = c.createRadialGradient(cx2, cy2, 0, cx2, cy2, r0*0.5);
      gI.addColorStop(0, `rgba(255,255,220,${0.85*k})`);
      gI.addColorStop(1, 'rgba(255,80,20,0)');
      c.fillStyle = gI;
      c.beginPath(); c.arc(cx2, cy2, r0*0.5, 0, 6.283); c.fill();
    }
    // 上射光（沿线少量软柱）
    for(let i=2;i<N-2;i+=4){
      const t = i/(N-1);
      const cx = x0 + dx*t, cy = y0 + dy*t;
      const beamH = 60 * k;
      for(let j=0;j<4;j++){
        const jt = j/3;
        const yy = cy - beamH*jt;
        const r = (5 - j*1) * k;
        const grd = c.createRadialGradient(cx, yy, 0, cx, yy, r*1.6);
        grd.addColorStop(0, `rgba(255,220,150,${k*(1-jt)*0.65})`);
        grd.addColorStop(1, 'rgba(255,40,10,0)');
        c.fillStyle = grd;
        c.beginPath(); c.arc(cx, yy, r*1.6, 0, 6.283); c.fill();
      }
    }
    c.globalCompositeOperation = 'source-over';
  }
  c.restore();
}

// ── HUD ──
function drawEmberHUD(){
  if(!ember) return;
  const c = ctx;
  const ph = EMBER_PHASES[ember.phase];
  const W = 480, H = 16;
  const x = (CW - W)/2, y = 16;

  c.save();
  c.fillStyle = 'rgba(0,0,0,0.7)';
  c.fillRect(x-3, y-3, W+6, H+6);
  c.fillStyle = '#1a0808';
  c.fillRect(x, y, W, H);

  const pct = Math.max(0, ember.hp/ember.maxHp);
  const grd = c.createLinearGradient(x, y, x+W, y);
  grd.addColorStop(0, '#FFE060');
  grd.addColorStop(0.4, '#FF8020');
  grd.addColorStop(0.7, '#FF4010');
  grd.addColorStop(1, '#800808');
  c.fillStyle = grd;
  c.fillRect(x, y, W*pct, H);

  c.fillStyle = 'rgba(255,255,255,0.18)';
  c.fillRect(x, y, W*pct, H/3);

  c.strokeStyle = 'rgba(0,0,0,0.7)';
  c.lineWidth = 1.5;
  for(const fr of [0.3, 0.6]){
    c.beginPath();
    c.moveTo(x+W*fr, y); c.lineTo(x+W*fr, y+H);
    c.stroke();
  }

  c.strokeStyle = '#FF8030';
  c.lineWidth = 1.5;
  c.strokeRect(x, y, W, H);

  c.font = 'bold 13px Consolas, monospace';
  c.textAlign = 'center';
  c.fillStyle = 'rgba(0,0,0,0.8)';
  c.fillText(`余烬主宰 · ${ph.name}   ${ember.hp|0} / ${ember.maxHp}`, x+W/2+1, y+H+15);
  c.fillStyle = '#FFD080';
  c.fillText(`余烬主宰 · ${ph.name}   ${ember.hp|0} / ${ember.maxHp}`, x+W/2, y+H+14);

  if(ember.state === 'attack' && ember.attackKey){
    const NAMES = {
      atk_a:'燃斩', atk_spin:'旋焚', pillar:'熔岩柱',
      charge:'余烬冲刺', rain:'烬雨', rift:'裂界', ult:'终极·焚世'
    };
    const name = NAMES[ember.attackKey] || ember.attackKey;
    const mv = EMBER_MOVES[ember.attackKey];
    const t = ember.atkPhaseT / mv.dur;
    c.font = 'bold 11px Consolas, monospace';
    c.fillStyle = 'rgba(0,0,0,0.8)';
    c.fillText(`◆ ${name}`, x+W/2+1, y+H+32);
    c.fillStyle = mv.blockable ? '#FFC050' : '#FF4030';
    c.fillText(`◆ ${name}${mv.blockable?'':' (不可格挡)'}`, x+W/2, y+H+31);
    c.fillStyle = 'rgba(255,80,20,0.3)';
    c.fillRect(x+W/2-50, y+H+36, 100, 2);
    c.fillStyle = '#FFD060';
    c.fillRect(x+W/2-50, y+H+36, 100*t, 2);
  }

  c.textAlign = 'left';
  c.restore();
}
