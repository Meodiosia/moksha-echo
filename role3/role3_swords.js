
window.role3Swords = [];

function _makeSword(opts){
  opts = opts || {};
  return {
    x: opts.x || 0, y: opts.y || 0,
    vx: 0, vy: 0,
    angle: 0, spinSpd: 0,
    state: opts.state || 'orbit',
    orbitPhase: opts.orbitPhase || 0,
    orbitR: opts.orbitR || 38,
    orbitH: opts.orbitH || -38,
    age: 0,
    life: opts.life || 99,
    dmg: opts.dmg || 18,
    hitDone: false,
    trail: [],
    shootSpd: opts.shootSpd || 240,
    shootAngle: opts.shootAngle || 0,
    returnTo: opts.returnTo || null,
    hoverY: opts.hoverY || 0,
    hoverT: opts.hoverT || 0.5,
    dropTarget: opts.dropTarget || null,
    dropSpd: opts.dropSpd || 0,
  };
}

window.role3SwordsAPI = {
  addOrbit(opts){
    opts = opts || {};
    const s = _makeSword({
      state: 'orbit',
      orbitPhase: opts.phase || 0,
      orbitR: opts.r || 38,
      orbitH: opts.h || -38,
      dmg: opts.dmg || 12,
    });
    role3Swords.push(s);
    return s;
  },
  shoot(fromX, fromY, angle, opts){
    opts = opts || {};
    const s = _makeSword({
      x: fromX, y: fromY,
      state: 'shoot',
      shootAngle: angle,
      shootSpd: opts.spd || 380,
      dmg: opts.dmg || 24,
      life: opts.life || 1.2,
      returnTo: opts.returnTo || null,
    });
    s.angle = angle;
    s.spinSpd = 16;
    role3Swords.push(s);
    return s;
  },
  drop(targetX, targetY, opts){
    opts = opts || {};
    const hoverH = opts.hoverH || 110;
    const s = _makeSword({
      x: targetX, y: targetY - hoverH,
      state: 'hover',
      hoverY: targetY - hoverH,
      hoverT: opts.hoverT || 0.5,
      dropTarget: { x: targetX, y: targetY },
      dropSpd: opts.dropSpd || 0,
      dmg: opts.dmg || 22,
      life: 2.0,
    });
    s.angle = Math.PI / 2;
    s.spinSpd = 4;
    s._temp = true;       // drop
    role3Swords.push(s);
    return s;
  },
  charge(opts){
    opts = opts || {};
    const s = _makeSword({
      state: 'charge',
      orbitPhase: opts.phase || 0,
      dmg: opts.dmg || 0,
    });
    role3Swords.push(s);
    return s;
  },
  clearNonOrbit(){
    window.role3Swords = role3Swords.filter(s => s.state === 'orbit');
  },
  getOrbits(){
    return role3Swords.filter(s => s.state === 'orbit');
  },
  count(){ return role3Swords.length; }
};

function _r3HitTry(x, y, range, dmg, sword){
  const map = sword ? (sword._hitMap = sword._hitMap || {}) : null;
  let hit = false;
  const tag = sword && sword._comboTag;

  if(typeof boss !== 'undefined' && boss && boss.state !== 'dead'){
    const R = (typeof BOSS_HIT_R !== 'undefined') ? BOSS_HIT_R : 30;
    if(Math.hypot(boss.x - x, boss.y - y) < R + range + 12){
      if(!map || !map.boss){
        if(map) map.boss = true;
        if(typeof hitBoss === 'function') hitBoss(dmg, x - boss.x, y - boss.y);
        if(tag === 1 && window.role3 && typeof window.role3.onJHit === 'function'){
          window.role3.onJHit();
        }
        if(window.Events) window.Events.emit('sword:hit_boss', dmg);
        if(sword && (window.RelicManager && window.RelicManager._flags.piercing || sword._pierce)){
          sword._hitMap = {};
          if(sword.life - sword.age < 0.3) sword.life = sword.age + 0.4;
        }
        if(sword && !sword._bounced && window.RelicManager && window.RelicManager._flags.bounce){
          const maxBounce = window.RelicManager._flags.bounce;
          sword._bounceCount = (sword._bounceCount || 0);
          if(sword._bounceCount < maxBounce){
            sword._bounceCount++;
            sword._bounced = (sword._bounceCount >= maxBounce);
            sword.shootAngle += Math.PI * (0.7 + Math.random() * 0.6);
            sword._hitMap = {};
            var bounceLife = window.RelicManager._flags.bounceLife || 0.5;
            sword.life = sword.age + bounceLife;
          }
        }
        if(sword && window.RelicManager && window.RelicManager._flags.returning){
          sword.returnTo = (typeof player !== 'undefined') ? player : sword.returnTo;
          if(sword.life - sword.age > 0.1) sword.life = sword.age + 0.05;
        }
        if(dmg >= 25 && sword){
          const kF = Math.min(1.0, dmg / 60);
          boss.vx = (sword.kx || (x - boss.x) * 4) * kF;
          boss.vy = (sword.ky || (y - boss.y) * 4) * kF;
        }
        hit = true;
      }
    }
  }
  if(typeof boss !== 'undefined' && boss && boss.isLucia && typeof luciaTryHitClone === 'function'){
    const key = 'clone';
    if(!map || !map[key]){
      if(luciaTryHitClone(x, y, range, dmg, 1, 0)){
        if(map) map[key] = true;
        hit = true;
      }
    }
  }
  if(typeof enemies !== 'undefined'){
    for(let i=0; i<enemies.length; i++){
      const e = enemies[i];
      if(!e || e.state === 'dead') continue;
      const ek = 'e' + i;
      if(map && map[ek]) continue;
      const r2 = (typeof P_R !== 'undefined' ? P_R : 14) + range + 12;
      if(Math.hypot(e.x - x, e.y - y) < r2){
        if(map) map[ek] = true;
        // 穿透：清 hitMap，延长 life
        if(sword && (window.RelicManager && window.RelicManager._flags.piercing || sword._pierce)){
          // 穿透：只清当前敌人 key，保留弹射计数
          if(sword._hitMap) delete sword._hitMap[ek];
          if(sword.life - sword.age < 0.2) sword.life = sword.age + 0.3;
        }
        // 弹射：改变方向，延长 life（可叠加：bounce=2 弹射2次）
        if(sword && window.RelicManager && window.RelicManager._flags.bounce){
          const maxBounce = window.RelicManager._flags.bounce;
          sword._bounceCount = (sword._bounceCount || 0);
          if(sword._bounceCount < maxBounce){
            sword._bounceCount++;
            sword.shootAngle += Math.PI * (0.6 + Math.random() * 0.8);
            sword._hitMap = {};
            const bLife = window.RelicManager._flags.bounceLife || 0.5;
            sword.life = sword.age + bLife;
          }
        }
        // 返回：命中后立即飞回（_flags.returning 叠加：返回速度更快）
        if(sword && window.RelicManager && window.RelicManager._flags.returning){
          const speedBonus = window.RelicManager._flags.returning * 0.3; // 每层+30%返回速度
          sword._returnSpeedMul = 1 + speedBonus;
          sword.returnTo = (typeof player !== 'undefined') ? player : sword.returnTo;
          if(sword.life - sword.age > 0.1) sword.life = sword.age + 0.05;
        }
        const kF = Math.min(1.5, dmg / 25);
        const kx = sword ? (sword.kx || (e.x - x) * 6) * kF * 0.6 : (e.x - x) * 4 * kF;
        const ky = sword ? (sword.ky || (e.y - y) * 6) * kF * 0.6 : (e.y - y) * 4 * kF;
        if(typeof e.takeDamage === 'function'){
          e.takeDamage(dmg, kx, ky);
        } else {
          if(typeof e.hp !== 'undefined') e.hp -= dmg;
          e.hurtTimer = 0.25;
          e.vx = kx; e.vy = ky;
        }
        if(typeof combo !== 'undefined') {
          combo++;
          comboTimer = (typeof COMBO_RESET !== 'undefined') ? COMBO_RESET : 2.0;
          comboPeak = Math.max(comboPeak || 0, combo);
        }
        if(typeof dmgNums !== 'undefined' && typeof DMGNUM_MAX !== 'undefined' && dmgNums.length < DMGNUM_MAX){
          dmgNums.push({x:e.x,y:e.y-30,val:dmg,age:0,life:0.8,vy:-40});
        }
        if(typeof addParticle === 'function'){
          for(let k=0; k<4; k++){
            addParticle(e.x, e.y - 16, {n:1, c: k%2?'#FFFFFF':'#AAEEFF',
              spd:120+Math.random()*60, r:1.5, life:0.25,
              spread:0.5, angle: Math.atan2(e.y-y, e.x-x) + (Math.random()-0.5)*1.0,
              gravity: 30});
          }
        }
        if(typeof camShake === 'function'){
          camShake(0.04 + Math.min(0.12, dmg * 0.002), 2 + Math.floor(dmg * 0.1));
        }
        if(dmg >= 25 && typeof triggerHitStop === 'function'){
          triggerHitStop(0.03);
        }
        hit = true;
      }
    }
  }
  if(hit && tag && window.role3 && typeof window.role3.onSkillHit === 'function'){
    window.role3.onSkillHit(tag);
  }
  return hit;
}

function updateRole3Swords(dt, player){
  if(!role3Swords.length) return;
  const list = role3Swords;
  for(let i=list.length-1; i>=0; i--){
    const s = list[i];
    s.age += dt;
    if(s.state === 'orbit'){
      s.orbitPhase += dt * 2.2;
      // 移除 _targetPhase 残留（已改为直接赋值）
      if(s._targetPhase !== undefined) delete s._targetPhase;
      const px = player ? player.x : 0;
      const py = player ? player.y : 0;
      let curR = s.orbitR || 40;
      if(s._bounceR){
        s._bounceT -= dt;
        const bp = Math.max(0, s._bounceT / 0.55);
        curR = s.orbitR + (s._bounceR - s.orbitR) * bp;
        if(s._bounceT <= 0) delete s._bounceR;
      }
      const tx = px + Math.cos(s.orbitPhase) * curR;
      const ty = py + s.orbitH + Math.sin(s.orbitPhase) * 14;
      s.x += (tx - s.x) * Math.min(1, dt * 8);
      s.y += (ty - s.y) * Math.min(1, dt * 8);
      s.angle = s.orbitPhase + Math.PI / 2;
      s.spinSpd = 0;
    }
    else if(s.state === 'shoot'){
      var _spd = s.shootSpd;
      if(window.RelicManager && window.RelicManager._flags.speedMul){
        _spd *= window.RelicManager._flags.speedMul;
      }
      if(window.RelicManager && window.RelicManager._flags.tracking){
        const _trackLayers = window.RelicManager._flags.tracking; // 叠加层数
        const _turnSpd = 3.5 + _trackLayers * 1.5; // 每层+1.5转向速度
        // 追踪最近目标（敌人优先，其次boss）
        var _tx = null, _ty = null, _minD = Infinity;
        if(typeof enemies !== 'undefined'){
          for(let _ei=0; _ei<enemies.length; _ei++){
            const _ee = enemies[_ei];
            if(!_ee || _ee.state==='dead') continue;
            const _d = Math.hypot(_ee.x-s.x, _ee.y-s.y);
            if(_d < _minD){ _minD=_d; _tx=_ee.x; _ty=_ee.y; }
          }
        }
        if(_tx===null && typeof boss!=='undefined' && boss && boss.state!=='dead'){
          _tx=boss.x; _ty=boss.y;
        }
        if(_tx !== null){
          var _ta = Math.atan2(_ty - s.y, _tx - s.x);
          var _da = _ta - s.shootAngle;
          while(_da > Math.PI) _da -= Math.PI*2;
          while(_da < -Math.PI) _da += Math.PI*2;
          s.shootAngle += Math.min(Math.abs(_da), _turnSpd * dt) * Math.sign(_da);
        }
      }
      var _t = (s.life > 0) ? Math.min(1, s.age / s.life) : 0;
      var _eased = 1 - _t * _t;  // 1
      var _velMul = 0.8 + _eased * 1.0;  // 1.8x
      s.x += Math.cos(s.shootAngle) * _spd * _velMul * dt;
      s.y += Math.sin(s.shootAngle) * _spd * _velMul * dt;
      s.angle = s.shootAngle;
      s.spinSpd = 18;
      s.trail.push({x: s.x, y: s.y});
      if(s.trail.length > 5) s.trail.shift();
      if(!s._hitTimer) s._hitTimer = 0;
      s._hitTimer -= dt;
      if(s._hitTimer <= 0){
        s._hitTimer = 0.05;
        _r3HitTry(s.x, s.y, 26, s.dmg, s);
      }
    }
    else if(s.state === 'return'){
      if(!s.returnTo){ s.state = 'dead'; continue; }
      const tx = s.returnTo.x;
      const ty = s.returnTo.y - 38;
      const dx = tx - s.x, dy = ty - s.y;
      const d = Math.hypot(dx, dy);
      if(d < 14){
        s.state = 'orbit';
        s.orbitPhase = Math.atan2(s.y - s.returnTo.y, s.x - s.returnTo.x);
        s.trail = [];
        s._hitMap = {};
        s._bounceR = (s.orbitR || 40) + 12;
        s._bounceT = 0.55;
        continue;
      }
      const sp = 460 * (s._returnSpeedMul || 1);
      s.x += dx / d * sp * dt;
      s.y += dy / d * sp * dt;
      s.angle = Math.atan2(dy, dx);
      s.spinSpd = 14;
      s.trail.push({x: s.x, y: s.y});
      if(s.trail.length > 6) s.trail.shift();
      if(!s._hitTimer) s._hitTimer = 0;
      s._hitTimer -= dt;
      if(s._hitTimer <= 0){
        s._hitTimer = 0.08;
        _r3HitTry(s.x, s.y, 22, Math.floor(s.dmg * 0.6), s);
      }
    }
    else if(s.state === 'charge'){
      const px = player ? player.x : s.x;
      const py = player ? player.y : s.y;
      const facing = player ? player.facing : 1;
      const cx = px + facing * 28;
      const cy = py - 28;
      s.orbitPhase += dt * (6 + s.age * 8);
      const r = 18 + Math.sin(s.age * 8) * 2;
      const tx = cx + Math.cos(s.orbitPhase) * r;
      const ty = cy + Math.sin(s.orbitPhase) * r * 0.5;
      s.x += (tx - s.x) * Math.min(1, dt * 16);
      s.y += (ty - s.y) * Math.min(1, dt * 16);
      s.angle = s.orbitPhase + Math.PI / 2;
      s.spinSpd = 14;
    }
    else if(s.state === 'hover'){
      s.hoverT -= dt;
      s.y = s.hoverY + Math.sin(s.age * 4) * 1.5;
      s.angle = Math.PI / 2;    //
      s.spinSpd = 0;
      if(s.hoverT <= 0){ s.state = 'drop'; s.age = 0; }
    }
    else if(s.state === 'drop'){
      s.dropSpd += 2400 * dt;     // 1200
      s.y += s.dropSpd * dt;
      s.angle = Math.PI / 2;     //
      s.spinSpd = 0;
      s.trail.push({x: s.x, y: s.y});
      if(s.trail.length > 5) s.trail.shift();
      if(s.dropTarget && s.y >= s.dropTarget.y){
        s.y = s.dropTarget.y;
        const hit = _r3HitTry(s.x, s.y, 40, s.dmg);
        if(hit && window.role3 && typeof window.role3.onSkillHit === 'function'){
          window.role3.onSkillHit(4);
        }
        if(typeof _addFxShape === 'function'){
          _addFxShape('crackline', s.x, s.y, {
            count: 5, len: 50, color: 'rgba(220,240,255,1)', life: 0.5
          });
        }
        if(typeof shockwaves !== 'undefined'){
          shockwaves.push({x: s.x, y: s.y, r: 2, maxR: 60, life: 0.35, age: 0, c: '#FFFFFF'});
          shockwaves.push({x: s.x, y: s.y, r: 4, maxR: 38, life: 0.22, age: 0, c: '#AAEEFF'});
        }
        if(typeof addParticle === 'function'){
          for(let k=0; k<6; k++){
            addParticle(s.x, s.y, {n:1, c: k%2?'#FFFFFF':'#AAEEFF',
              spd:120+Math.random()*80, r:1.6, life:0.4,
              spread:0.8, angle:Math.random()*Math.PI*2, gravity:70});
          }
          for(let k=0; k<3; k++){
            addParticle(s.x, s.y - 4, {n:1, c:'#FFFFFF',
              spd:80+Math.random()*30, r:1.3, life:0.3,
              spread:0.4, angle:-Math.PI/2, gravity:100});
          }
        }
        if(typeof camShake === 'function') camShake(0.16, 6);
        if(typeof triggerHitStop === 'function') triggerHitStop(0.04);
        s.state = 'dead';
      }
    }
    if(s.state === 'shoot' && s.age >= s.life){
      if(s._temp){
        s.state = 'dead';
      } else if(s.returnTo){
        s.state = 'return';
        s.age = 0;
        s.life = 1.5;
        s._hitMap = {};
        s._hitTimer = 0;
      } else {
        s.returnTo = player;
        s.state = 'return';
        s.age = 0;
        s.life = 1.5;
        s._hitMap = {};
      }
    }
    if(s.state === 'return' && s.age >= s.life){
      if(s._temp){
        s.state = 'dead';
      } else if(s.returnTo){
        // 回旋刃：回到玩家后往身后再射一次
        if(window.RelicManager && window.RelicManager._flags.returning && !s._returnBounced){
          s._returnBounced = true;
          s.state = 'shoot';
          s.age = 0;
          s.life = 0.9;
          // 往玩家背后方向射出
          const _facing = (s.returnTo && s.returnTo.facing) || 1;
          s.shootAngle = Math.PI - Math.atan2(0, _facing); // 反向
          s.x = s.returnTo.x;
          s.y = s.returnTo.y - 36;
          s._hitMap = {};
          s._hitTimer = 0;
        } else {
          s._returnBounced = false;
          s.state = 'orbit';
          s.x = s.returnTo.x + Math.cos(s.orbitPhase || 0) * (s.orbitR || 40);
          s.y = s.returnTo.y + (s.orbitH || -36);
          s.trail = [];
          s._hitMap = {};
        }
      } else {
        s.state = 'dead';
      }
    }
    if(s.state === 'dead') list.splice(i, 1);
  }
}
window.updateRole3Swords = updateRole3Swords;
window._r3HitTry = _r3HitTry;

// --- 自适应间距：把所有 orbit 剑 phase 均匀分布（直接赋值，同速旋转永久保持间距）---
function _rebalanceOrbitPhases(){
  const orbits = role3Swords.filter(s => s.state === 'orbit');
  const n = orbits.length;
  if(n <= 1) return;
  const step = (Math.PI * 2) / n;
  // 以第一把剑的当前 phase 为基准，其他剑均匀分布
  const base = orbits[0].orbitPhase;
  for(let i = 0; i < n; i++){
    orbits[i].orbitPhase = base + i * step;
  }
}
window._rebalanceOrbitPhases = _rebalanceOrbitPhases;

// --- 判断 orbit 剑是否处于"后弧"（应被玩家遮挡）---
// 用实际世界 Y：剑 y < 轨道中心 Y = 处于上弧 = 背后
function _isSwordBehindPlayer(s, player){
  if(s.state !== 'orbit') return false;
  if(!player) return false;
  const orbitCenterY = player.y + (s.orbitH || -38);
  return s.y < orbitCenterY;
}
window._isSwordBehindPlayer = _isSwordBehindPlayer;

// --- 计算 orbit 剑的深度 alpha（平滑过渡，不突兀）---
// depth 从 -ORBIT_DEPTH(后) 到 +ORBIT_DEPTH(前)，映射到 alpha 0.3~1.0
const _ORBIT_DEPTH = 14;  // 对应 sin(phase)*14
function _getSwordAlpha(s, player){
  if(s.state !== 'orbit' || !player) return 1.0;
  const orbitCenterY = player.y + (s.orbitH || -38);
  const depth = s.y - orbitCenterY;  // -14(后) ~ +14(前)
  const t = Math.max(0, Math.min(1, (depth / _ORBIT_DEPTH + 1) * 0.5));  // 0~1
  return 0.05 + t * 0.95;  // 0.05(全后，近透明) ~ 1.0(全前)，平滑线性过渡
}

// --- 内部：单把剑的绘制 ---
function _drawOneSword(ctx, s, img, heavy, isBehind){
  if(s._defHidden) return;
  const sx = s.x - ox();
  const sy = (s.y - oy()) * ISO_Y_SCALE;
  // 平滑 alpha：基于实际 depth 位置连续插值（避免突变）
  const pl = (typeof player !== 'undefined') ? player : null;
  const alpha = _getSwordAlpha(s, pl);

  if(s.trail.length > 1){
    ctx.save();
    ctx.globalAlpha = alpha;
    if(heavy){
      ctx.strokeStyle = 'rgba(170,238,255,0.40)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const t0 = s.trail[0];
      ctx.moveTo(t0.x - ox(), (t0.y - oy()) * ISO_Y_SCALE);
      for(let i=1; i<s.trail.length; i++){
        const t = s.trail[i];
        ctx.lineTo(t.x - ox(), (t.y - oy()) * ISO_Y_SCALE);
      }
      ctx.stroke();
    } else {
      ctx.globalCompositeOperation = 'lighter';
      for(let i=1; i<s.trail.length; i++){
        const t0 = s.trail[i-1], t1 = s.trail[i];
        const k = i / s.trail.length;
        ctx.globalAlpha = alpha * k * 0.55;
        ctx.strokeStyle = '#AAEEFF';
        ctx.lineWidth = 2 + k * 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(t0.x - ox(), (t0.y - oy()) * ISO_Y_SCALE);
        ctx.lineTo(t1.x - ox(), (t1.y - oy()) * ISO_Y_SCALE);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  const visAng = s.angle + (s.spinSpd ? s.age * s.spinSpd : 0);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(sx, sy);
  ctx.rotate(visAng - Math.PI/2);
  if(img && img.complete && img.naturalWidth > 0){
    const SL = 28;
    const SW = SL * (img.width / img.height);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(img, -SW/2, -SL/2, SW, SL);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha * 0.55;
    ctx.drawImage(img, -SW/2, -SL/2, SW, SL);
  } else {
    ctx.fillStyle = 'rgba(220,240,255,0.95)';
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(3.5, -2.8);
    ctx.lineTo(2.8, 12.6);
    ctx.lineTo(-2.8, 12.6);
    ctx.lineTo(-3.5, -2.8);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// --- 后层：处于后弧的 orbit 剑（被玩家遮挡）---
function drawRole3SwordsBack(ctx){
  if(!role3Swords.length) return;
  if(typeof ox === 'undefined' || typeof oy === 'undefined' ||
     typeof ISO_Y_SCALE === 'undefined') return;
  const img = window.ROLE3_SWORDS_IMG;
  const mobile = typeof window !== 'undefined' && window.IS_MOBILE;
  const heavy = mobile || role3Swords.length >= 5;
  const pl = (typeof player !== 'undefined') ? player : null;
  ctx.save();
  for(const s of role3Swords){
    if(!_isSwordBehindPlayer(s, pl)) continue;
    _drawOneSword(ctx, s, img, heavy, true);
  }
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

// --- 前层：前弧 orbit 剑 + 所有非 orbit 飞剑（遮盖玩家）---
function drawRole3SwordsFront(ctx){
  if(!role3Swords.length) return;
  if(typeof ox === 'undefined' || typeof oy === 'undefined' ||
     typeof ISO_Y_SCALE === 'undefined') return;
  const img = window.ROLE3_SWORDS_IMG;
  const mobile = typeof window !== 'undefined' && window.IS_MOBILE;
  const heavy = mobile || role3Swords.length >= 5;
  const pl = (typeof player !== 'undefined') ? player : null;
  ctx.save();
  for(const s of role3Swords){
    if(_isSwordBehindPlayer(s, pl)) continue;
    _drawOneSword(ctx, s, img, heavy, false);
  }
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

// 兼容旧调用：一次性画全部（不分层时使用）
function drawRole3Swords(ctx){
  if(!role3Swords.length) return;
  if(typeof ox === 'undefined' || typeof oy === 'undefined' ||
     typeof ISO_Y_SCALE === 'undefined') return;
  const img = window.ROLE3_SWORDS_IMG;
  const mobile = typeof window !== 'undefined' && window.IS_MOBILE;
  const heavy = mobile || role3Swords.length >= 5;
  const pl = (typeof player !== 'undefined') ? player : null;
  ctx.save();
  for(const s of role3Swords){
    const behind = _isSwordBehindPlayer(s, pl);
    _drawOneSword(ctx, s, img, heavy, behind);
  }
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}
window.drawRole3Swords = drawRole3Swords;
window.drawRole3SwordsBack = drawRole3SwordsBack;
window.drawRole3SwordsFront = drawRole3SwordsFront;
