// ── role3_swords.js ───────────────────────────────────────────
// 飞剑系统：常驻环绕 / 射出 / 返回 / 蓄力旋转 / 天落
// API：window.role3SwordsAPI
// 渲染：drawRole3Swords(ctx)
// ──────────────────────────────────────────────────────────────

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
    shootSpd: opts.shootSpd || 380,
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
    s._temp = true;       // drop 剑都是临时剑，不算入永久剑数
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
  // sword 的 _comboTag 可标记是哪招的剑（1/2/4），用于触发 combo
  const tag = sword && sword._comboTag;

  // boss（判定放大 12）
  if(typeof boss !== 'undefined' && boss && boss.state !== 'dead'){
    const R = (typeof BOSS_HIT_R !== 'undefined') ? BOSS_HIT_R : 30;
    if(Math.hypot(boss.x - x, boss.y - y) < R + range + 12){
      if(!map || !map.boss){
        if(map) map.boss = true;
        if(typeof hitBoss === 'function') hitBoss(dmg, x - boss.x, y - boss.y);
        // J 普攻飞剑命中 → 连携计数
        if(tag === 1 && window.role3 && typeof window.role3.onJHit === 'function'){
          window.role3.onJHit();
        }
        // 击退（boss 抗性高，伤害 30+ 才有明显击退）
        if(dmg >= 25 && sword){
          const kF = Math.min(1.0, dmg / 60);
          boss.vx = (sword.kx || (x - boss.x) * 4) * kF;
          boss.vy = (sword.ky || (y - boss.y) * 4) * kF;
        }
        hit = true;
      }
    }
  }
  // Lucia 分身
  if(typeof boss !== 'undefined' && boss && boss.isLucia && typeof luciaTryHitClone === 'function'){
    const key = 'clone';
    if(!map || !map[key]){
      if(luciaTryHitClone(x, y, range, dmg, 1, 0)){
        if(map) map[key] = true;
        hit = true;
      }
    }
  }
  // 小怪：手动遍历做穿透过滤（hitEnemiesInRange 不支持单怪 key）
  if(typeof enemies !== 'undefined'){
    for(let i=0; i<enemies.length; i++){
      const e = enemies[i];
      if(!e || e.state === 'dead') continue;
      const ek = 'e' + i;
      if(map && map[ek]) continue;
      // 命中范围放大（飞剑判定更宽容）
      const r2 = (typeof P_R !== 'undefined' ? P_R : 14) + range + 12;
      if(Math.hypot(e.x - x, e.y - y) < r2){
        if(map) map[ek] = true;
        if(typeof e.hp !== 'undefined') e.hp -= dmg;
        e.hurtTimer = 0.25;
        // 击退
        const kF = Math.min(1.5, dmg / 25);
        if(sword){
          e.vx = (sword.kx || (e.x - x) * 6) * kF * 0.6;
          e.vy = (sword.ky || (e.y - y) * 6) * kF * 0.6;
        } else {
          e.vx = (e.x - x) * 4 * kF;
          e.vy = (e.y - y) * 4 * kF;
        }
        if(typeof combo !== 'undefined') {
          combo++;
          comboTimer = (typeof COMBO_RESET !== 'undefined') ? COMBO_RESET : 2.0;
          comboPeak = Math.max(comboPeak || 0, combo);
        }
        if(typeof dmgNums !== 'undefined' && typeof DMGNUM_MAX !== 'undefined' && dmgNums.length < DMGNUM_MAX){
          dmgNums.push({x:e.x,y:e.y-30,val:dmg,age:0,life:0.8,vy:-40});
        }
        // 命中粒子：精简版（4 颗白火花 + 撞击点光斑）
        if(typeof addParticle === 'function'){
          for(let k=0; k<4; k++){
            addParticle(e.x, e.y - 16, {n:1, c: k%2?'#FFFFFF':'#AAEEFF',
              spd:120+Math.random()*60, r:1.5, life:0.25,
              spread:0.5, angle: Math.atan2(e.y-y, e.x-x) + (Math.random()-0.5)*1.0,
              gravity: 30});
          }
        }
        // 命中震屏 + hitstop（按伤害分级）
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
  // 触发 combo 回调（任一目标命中即触发）
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
      const px = player ? player.x : 0;
      const py = player ? player.y : 0;
      // 归位微弹：_bounceR 弹跳后慢慢收回正常 R
      let curR = s.orbitR || 40;
      if(s._bounceR){
        s._bounceT -= dt;
        const bp = Math.max(0, s._bounceT / 0.55);
        curR = s.orbitR + (s._bounceR - s.orbitR) * bp;
        if(s._bounceT <= 0) delete s._bounceR;
      }
      const tx = px + Math.cos(s.orbitPhase) * curR;
      const ty = py + s.orbitH + Math.sin(s.orbitPhase) * 6;
      s.x += (tx - s.x) * Math.min(1, dt * 8);
      s.y += (ty - s.y) * Math.min(1, dt * 8);
      s.angle = s.orbitPhase + Math.PI / 2;
      s.spinSpd = 0;
    }
    else if(s.state === 'shoot'){
      s.x += Math.cos(s.shootAngle) * s.shootSpd * dt;
      s.y += Math.sin(s.shootAngle) * s.shootSpd * dt;
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
      // 寿命到期由末尾统一处理
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
        // 归位微弹：orbitR 超量后弹回（0.55s 内归位）
        s._bounceR = (s.orbitR || 40) + 12;
        s._bounceT = 0.55;
        continue;
      }
      const sp = 460;
      s.x += dx / d * sp * dt;
      s.y += dy / d * sp * dt;
      s.angle = Math.atan2(dy, dx);
      s.spinSpd = 14;
      s.trail.push({x: s.x, y: s.y});
      if(s.trail.length > 6) s.trail.shift();
      // 返程也打伤害（穿透）
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
      // 微微下沉摆动（不旋转）
      s.y = s.hoverY + Math.sin(s.age * 4) * 1.5;
      s.angle = Math.PI / 2;    // 锁定朝下
      s.spinSpd = 0;
      if(s.hoverT <= 0){ s.state = 'drop'; s.age = 0; }
    }
    else if(s.state === 'drop'){
      // 加速下落（更猛）
      s.dropSpd += 2400 * dt;     // 1200 → 2400，重力翻倍
      s.y += s.dropSpd * dt;
      s.angle = Math.PI / 2;     // 锁定朝下，不旋转
      s.spinSpd = 0;
      s.trail.push({x: s.x, y: s.y});
      if(s.trail.length > 5) s.trail.shift();
      if(s.dropTarget && s.y >= s.dropTarget.y){
        s.y = s.dropTarget.y;
        const hit = _r3HitTry(s.x, s.y, 40, s.dmg);
        // drop 命中触发 combo (atk4 tag)
        if(hit && window.role3 && typeof window.role3.onSkillHit === 'function'){
          window.role3.onSkillHit(4);
        }
        if(typeof _addFxShape === 'function'){
          _addFxShape('crackline', s.x, s.y, {
            count: 5, len: 50, color: 'rgba(220,240,255,1)', life: 0.5
          });
        }
        if(typeof shockwaves !== 'undefined'){
          // 双层冲击波
          shockwaves.push({x: s.x, y: s.y, r: 2, maxR: 60, life: 0.35, age: 0, c: '#FFFFFF'});
          shockwaves.push({x: s.x, y: s.y, r: 4, maxR: 38, life: 0.22, age: 0, c: '#AAEEFF'});
        }
        if(typeof addParticle === 'function'){
          // 落地粒子（精简）
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
        // 每把剑都微震屏（增强力度感）
        if(typeof camShake === 'function') camShake(0.16, 6);
        if(typeof triggerHitStop === 'function') triggerHitStop(0.04);
        s.state = 'dead';
      }
    }
    // 寿命到期：临时剑直接 dead；永久剑确保回归玩家
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
        // 永久剑必须有归宿
        s.returnTo = player;
        s.state = 'return';
        s.age = 0;
        s.life = 1.5;
        s._hitMap = {};
      }
    }
    // return 超时：永久剑强制回到 orbit，临时剑 dead
    if(s.state === 'return' && s.age >= s.life){
      if(s._temp){
        s.state = 'dead';
      } else if(s.returnTo){
        // 强制 snap 回 orbit（避免飞剑卡半空）
        s.state = 'orbit';
        s.x = s.returnTo.x + Math.cos(s.orbitPhase || 0) * (s.orbitR || 40);
        s.y = s.returnTo.y + (s.orbitH || -36);
        s.trail = [];
        s._hitMap = {};
      } else {
        s.state = 'dead';
      }
    }
    // 仅 dead 才删除
    if(s.state === 'dead') list.splice(i, 1);
  }
}
window.updateRole3Swords = updateRole3Swords;
window._r3HitTry = _r3HitTry;

function drawRole3Swords(ctx){
  if(!role3Swords.length) return;
  if(typeof ox === 'undefined' || typeof oy === 'undefined' ||
     typeof ISO_Y_SCALE === 'undefined') return;
  const img = window.ROLE3_SWORDS_IMG;
  const mobile = typeof window !== 'undefined' && window.IS_MOBILE;
  // 性能：剑数多时降低视觉细节（不画 halo + trail 简化）
  // 手机端始终走 heavy 简化分支
  const heavy = mobile || role3Swords.length >= 5;
  for(const s of role3Swords){
    if(s._defHidden) continue;
    const sx = s.x - ox();
    const sy = (s.y - oy()) * ISO_Y_SCALE;
    // 拖尾
    if(s.trail.length > 1){
      ctx.save();
      if(heavy){
        // 简化：一次 stroke 整条 path（无 lighter）
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
          ctx.globalAlpha = k * 0.55;
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
    ctx.translate(sx, sy);
    ctx.rotate(visAng - Math.PI/2);
    // 飞剑贴图（无 halo 椭圆，base + 一次 lighter 强化轮廓）
    if(img && img.complete && img.naturalWidth > 0){
      const SL = 20;       // 稍微缩小
      const SW = SL * (img.width / img.height);
      // base（不透明）
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(img, -SW/2, -SL/2, SW, SL);
      // 一次 lighter 加强发光（剑形清晰）
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.55;
      ctx.drawImage(img, -SW/2, -SL/2, SW, SL);
    } else {
      ctx.fillStyle = 'rgba(220,240,255,0.95)';
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(2.5, -2);
      ctx.lineTo(2, 9);
      ctx.lineTo(-2, 9);
      ctx.lineTo(-2.5, -2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}
window.drawRole3Swords = drawRole3Swords;
