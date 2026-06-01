// ── lucia_boss.js ─────────────────────────────────────────────
// 多阶段强力 Boss：Lucilla
//
// 帧资源：bosses/lucia_frames/{key}/NNN.png
// 配置文件：bosses/lucia_src.js（LUCIA_FRAME_COUNT）
//
// 加载入口：loadLuciaFrames(onReady)
// 战斗入口：spawnLucia(x, y) → 返回 boss 对象（兼容 demo-3c.html 的 boss API）
// 每帧调用：updateLucia(dt) / drawLucia(ctx)
// 受击：lucia.takeDamage(dmg, dx, dy)
// ──────────────────────────────────────────────────────────────

// 全部帧的 Image 缓存：LUCIA_IMG[key] = [Image, Image, ...]
const LUCIA_IMG = {};
let _luciaLoaded = false;

// 异步加载所有帧
function loadLuciaFrames(onReady) {
  if(typeof LUCIA_FRAME_COUNT === 'undefined'){
    console.error('[lucia] LUCIA_FRAME_COUNT 未定义，请先加载 lucia_src.js');
    if(onReady) onReady();
    return;
  }
  const keys = Object.keys(LUCIA_FRAME_COUNT);
  let totalFrames = 0;
  for(const k of keys) totalFrames += LUCIA_FRAME_COUNT[k];
  let loaded = 0;
  console.log(`[lucia] 加载 ${keys.length} 个动画 / ${totalFrames} 帧 ...`);

  for(const key of keys){
    LUCIA_IMG[key] = [];
    const cnt = LUCIA_FRAME_COUNT[key];
    for(let i=0; i<cnt; i++){
      const img = new Image();
      const idx = String(i).padStart(3,'0');
      const _i = i;
      img.onload  = () => { loaded++; if(loaded === totalFrames){ _luciaLoaded = true; console.log('[lucia] all frames loaded'); onReady && onReady(); } };
      img.onerror = () => { loaded++; console.warn('[lucia] fail load', key, _i); if(loaded === totalFrames){ _luciaLoaded = true; onReady && onReady(); } };
      img.src = `bosses/lucia_frames/${key}/${idx}.png`;
      LUCIA_IMG[key][i] = img;
    }
  }
}

// ── 阶段配置 ───────────────────────────────────────────────────
const LUCIA_PHASES = {
  1: { name:'P1 试探',     hpRange:[1.0, 0.6], speed:1.0, ghostTrail:false, color:'rgba(220,220,220,0.4)' },
  2: { name:'P2 加速',     hpRange:[0.6, 0.3], speed:1.25, ghostTrail:true, color:'rgba(180,40,30,0.5)'   },
  3: { name:'P3 狂暴',     hpRange:[0.3, 0.0], speed:1.55, ghostTrail:true, color:'rgba(255,40,20,0.65)'  },
};

// ── 招式表 ────────────────────────────────────────────────────
// 每个 move:
//   anim     动画 key
//   ghost    ghost 动画 key（叠加播放）
//   dur      动画总时长（秒）
//   hitWin   攻击判定窗口（占 dur 的比例）
//   range    命中半径
//   dmg      伤害
//   move     攻击中身位偏移
//   fx       粒子FX函数名
//   blockable 是否可被格挡
//   特殊机制：
//     aoe       命中是 360° 圆形 AOE
//     ground    震地波（atk2a / atk4c）
//     telegraph 攻击预警光圈（红/白圈）
//     ranged    远程剑气（atk3）
//     stationary 不带身位前冲（站桩重击）
const LUCIA_MOVES = {
  // 轻击 a/b/c：标准三段近战
  atk_a: { anim:'atk_a', ghost:'atk_a_ghost', dur:0.95, hitWin:[0.30,0.55], range:62, dmg:12, move:30, fx:'fxLight', blockable:true },
  atk_b: { anim:'atk_b', ghost:'atk_b_ghost', dur:1.05, hitWin:[0.30,0.55], range:66, dmg:14, move:35, fx:'fxLight', blockable:true },
  atk_c: { anim:'atk_c', ghost:'atk_c_ghost', dur:1.40, hitWin:[0.45,0.65], range:72, dmg:18, move:50, fx:'fxHeavyWhite', blockable:true },

  // atk2a：高举重劈，命中点产生地裂震波
  atk2a: { anim:'atk2a', ghost:'atk2a_ghost', dur:1.30, hitWin:[0.55,0.72], range:80, dmg:22, move:50, fx:'fxGroundCrack', blockable:true, ground:true, telegraph:'red' },

  // atk2b：原地 360° 旋斩（不冲身位，环形AOE）
  atk2b: { anim:'atk2b', ghost:'atk2b_ghost', dur:1.05, hitWin:[0.35,0.60], range:78, dmg:24, move:0,  fx:'fxSpinSweep', blockable:true, aoe:true, stationary:true, telegraph:'white' },

  // atk3：远程三连剑气（扇形）— 用 atk3_ghost 作主帧（更血腥的光波）
  atk3:  { anim:'atk3_ghost',  ghost:'atk3',  dur:2.00, hitWin:[0.40,0.55], range:0,  dmg:18, move:0, fx:'fxRangedBlade', blockable:true, ranged:true, stationary:true, telegraph:'red' },

  // atk4：狂暴突进三段
  atk4:  { anim:'atk4',  ghost:null,           dur:2.50, hitWin:[0.30,0.50,0.60,0.80], multiHit:true, range:90, dmg:18, move:80, fx:'fxBerserkLunge', blockable:true, telegraph:'red' },

  // atk4b：反击斩，红色连击
  atk4b: { anim:'atk4b', ghost:null,           dur:1.55, hitWin:[0.30,0.65], range:92, dmg:24, move:55, fx:'fxBerserk', blockable:true, telegraph:'red' },

  // atk4c：站桩地裂大招，巨大 AOE
  atk4c: { anim:'atk4c', ghost:null,           dur:1.80, hitWin:[0.55,0.72], range:130, dmg:32, move:0,  fx:'fxEruption', blockable:false, aoe:true, ground:true, stationary:true, telegraph:'red_big' },

  // ult：终极一击，先红圈预警，命中范围超大
  ult:   { anim:'ult',   ghost:'ult_ghost',    dur:2.40, hitWin:[0.50,0.70], range:160, dmg:50, move:30, fx:'fxBloodStorm', blockable:false, screenShake:true, telegraph:'red_big' },

  // charge：远程冲刺攻击（用 atk2b_ghost 帧作为视觉，长距快速突进）
  charge:{ anim:'atk2b_ghost', ghost:null,     dur:0.95, hitWin:[0.35,0.70], range:74, dmg:28, move:280, fx:'fxBerserkLunge', blockable:true, telegraph:'red', isCharge:true },

  // pillar_fire：远程粒子火柱（玩家位置升起 3 根血色火柱）— P2/P3 新招
  pillar_fire:{ anim:'atk2a', ghost:'atk2a_ghost', dur:1.85, hitWin:[0.50,0.85], range:0, dmg:22, move:0,
                fx:'fxPillarCast', blockable:true, ranged:true, rangedType:'pillar',
                stationary:true, telegraph:'red' },

  // ring_rush：四方分身轮番冲锋（P3 大招）—— 站桩长动作，召唤 5 个分身环绕玩家依次冲刺
  ring_rush:{ anim:'ult', ghost:'ult_ghost', dur:3.50, hitWin:[0.30,0.85], range:0, dmg:0, move:0,
              fx:'fxRingSummon', blockable:false, ranged:true, rangedType:'ring_clones',
              stationary:true, telegraph:'red_big' },

  // blood_seek：3 颗血色追踪弹缓速锁定玩家，撞击 AOE 爆炸（P2/P3 远程压制）
  blood_seek:{ anim:'atk3_ghost', ghost:'atk3', dur:1.85, hitWin:[0.45,0.60], range:0, dmg:0, move:0,
               fx:'fxRangedBlade', blockable:true, ranged:true, rangedType:'blood_seek',
               stationary:true, telegraph:'red' },

  // blood_chain：锁定玩家位置，1.2s 后从地下伸出 4 条血锁束缚（站桩超长大招，玩家可冲刺挣脱）
  blood_chain:{ anim:'atk4c', ghost:null, dur:2.20, hitWin:[0.30,0.45], range:0, dmg:0, move:0,
                fx:'fxEruption', blockable:false, ranged:true, rangedType:'blood_chain',
                stationary:true, telegraph:'red_big' },

  // shadow_cross：召出 2 个血色分身在玩家两侧空中夹击投剑（远程 AOE 牵制）
  shadow_cross:{ anim:'atk3_ghost', ghost:'atk3', dur:2.10, hitWin:[0.45,0.60], range:0, dmg:0, move:0,
                 fx:'fxRangedBlade', blockable:true, ranged:true, rangedType:'shadow_cross',
                 stationary:true, telegraph:'red' },
};

// ── Boss 状态 & 工厂 ──────────────────────────────────────────
let lucia = null;

function spawnLucia(x, y){
  // 默认直接从第三阶段开始（hp < 30% 触发 P3）
  const startPhase = window.LUCIA_START_PHASE || 3;
  // 应用难度配置的 maxHp（默认 150000）
  const maxHp = (window.GAME_DIFFICULTY && window.GAME_DIFFICULTY.bossMaxHp) || 150000;
  const startHp = startPhase === 3 ? Math.floor(maxHp * 0.28)
                : startPhase === 2 ? Math.floor(maxHp * 0.62)
                : maxHp;
  lucia = {
    x, y, vx:0, vy:0,
    facing: -1,
    hp: startHp, maxHp: maxHp,
    state: 'fall',
    stateTimer: 1.6,
    animT: 0,
    phase: startPhase,
    pendingPhase: null,
    attackKey: null,
    atkPhaseT: 0,
    atkHitDone: [],         // multiHit 记录已触发次数
    atkCD: 2.0,
    cheerCD: 0,
    hurtTimer: 0,
    deadAge: 0,
    facingFrozen:false,
    // 飞行剑气（atk3）
    blades: [],
    // 火柱（pillar_fire）
    pillars: [],
    // P3 移动残影
    afterimages: [],
    _afterImgT: 0,
    // P3 分身
    clone: null,
    // P3 冲刺残影（charge skill 专用，原地保留 → 延迟 0.3s 重演冲刺）
    chargeGhost: null,
    // P3 大招 ring_rush 的四方分身
    ringClones: [],
    // 血色追踪弹（blood_seek）
    bloodSeeks: [],
    // 血色锁链（blood_chain）
    bloodChains: [],
    // 特效形状队列（多样化 FX：月牙/速度线/十字/螺旋/利刺/暗环）
    fxShapes: [],
    // P3 进入仪式 vignette 计时
    p3IntroT: 0,
    // 招式名飘字队列
    skillTexts: [],
    // 死亡序列血柱
    deathPillars: [],
    // 低血狂暴抖动量
    _tremorX: 0, _tremorY: 0,
    // 实例 ID：用于 setTimeout 回调判断是否已被重启替换
    _id: (window._luciaIdCounter = ((window._luciaIdCounter || 0) + 1)),
  };
  return lucia;
}

// ── 动画播放（按帧数计算 phase 0~1 → 帧索引）──
function _luciaFrame(key, phase01){
  const arr = LUCIA_IMG[key];
  if(!arr || arr.length===0) return null;
  const fi = Math.max(0, Math.min(arr.length-1, Math.floor(phase01 * arr.length)));
  return arr[fi];
}

// ── 升级 phase 检查 ──
function _checkPhaseTransition(){
  if(!lucia || lucia.state==='dead' || lucia.state==='cheer') return;
  const pct = lucia.hp / lucia.maxHp;
  let target = 1;
  if(pct < 0.3) target = 3;
  else if(pct < 0.6) target = 2;
  if(target > lucia.phase && lucia.pendingPhase === null){
    lucia.pendingPhase = target;
    lucia.state = 'cheer';
    lucia.stateTimer = (LUCIA_FRAME_COUNT.cheer/30) * 0.7;  // cheer 动画跑完
    lucia.animT = 0;
    // 进入阶段时大爆发
    _luciaSpawnPhaseBurst();
  }
}

function _luciaSpawnPhaseBurst(){
  // 红白色血液爆发圈 + 冲击波
  const cx = lucia.x, cy = lucia.y - 20;
  const isP3 = (lucia.pendingPhase === 3);
  const N = isP3 ? 110 : 60;
  for(let i=0;i<N;i++){
    const a = (i/N) * Math.PI * 2 + Math.random()*0.2;
    const sp = (isP3 ? 240 : 180) + Math.random()*150;
    addParticle(cx, cy, {
      n:1, c: i%3===0?'#FFFFFF':(i%3===1?'#CC2020':'#660000'),
      spd: sp, r: 2.5+Math.random()*1, life: 0.7+Math.random()*0.3,
      spread:0.05, angle:a, gravity: isP3 ? 20 : 30
    });
  }
  shockwaves.push({x:cx, y:cy, r:4, maxR: isP3?240:140, life:0.7, age:0, c:'#CC2020'});
  shockwaves.push({x:cx, y:cy, r:2, maxR: isP3?150:80,  life:0.5, age:0, c:'#FFFFFF'});
  if(isP3){
    // P3 加超大暗红冲击 + 屏幕全屏红 vignette
    shockwaves.push({x:cx, y:cy, r:8, maxR:340, life:0.9, age:0, c:'#660000'});
    lucia.p3IntroT = 5.0;       // 5 秒持续 vignette 脉动
    // 进 P3 的招式名飘字
    _luciaSpawnSkillText('· 焚 世 ·', '#FFD040');
  }
  camShake(isP3 ? 0.65 : 0.4, isP3 ? 18 : 12);
  triggerHitStop(isP3 ? 0.20 : 0.12);
  triggerSlowMo(isP3 ? 0.75 : 0.5, isP3 ? 0.22 : 0.35);
}

// ── 阶段技能全集（轮询遍历用）──
const LUCIA_PHASE_SKILLS = {
  1: ['atk_a','atk_b','atk_c','atk2a','atk2b','atk3','charge','charge'],
  2: ['atk_a','atk_b','atk_c','atk2a','atk2b','atk3','charge','charge','charge','atk2b','pillar_fire','blood_seek','shadow_cross'],
  3: ['atk_a','atk_b','atk_c','atk2a','atk2b','atk3','charge','charge','charge','charge','atk4','atk4b','atk4c','ult','pillar_fire','pillar_fire','ring_rush','blood_seek','blood_seek','shadow_cross','shadow_cross'],
};

// ── 选招（优先遍历所有未使用的技能）──
function _luciaPickAttack(pdist){
  const ph = lucia.phase;
  const all = LUCIA_PHASE_SKILLS[ph] || LUCIA_PHASE_SKILLS[1];
  const isP3 = ph >= 3;

  const fits = (k) => {
    const mv = LUCIA_MOVES[k];
    if(!mv) return false;
    // P3：强制逼近攻击，远程技能权重降低
    if(isP3){
      // ult 始终允许（boss 反击）
      if(k === 'ult') return lucia.hp/lucia.maxHp < 0.5;
      // 近战优先：dist < 120 时只选近战
      if(pdist < 120){
        const melee = ['atk_a','atk_b','atk_c','atk2a','atk2b','charge'];
        if(!melee.includes(k)) return Math.random() < 0.3;
      }
      return true;
    }
    // P1/P2 原有逻辑
    if((k==='atk_a'||k==='atk_b') && pdist > 130) return false;
    if(k==='ult' && lucia.hp/lucia.maxHp > 0.4) return false;
    return true;
  };

  if(!lucia._skillUsage) lucia._skillUsage = {};
  if(lucia._cycleIdx === undefined) lucia._cycleIdx = 0;

  let eligible = all.filter(fits);
  if(eligible.length === 0) eligible = all.slice();

  // P3：近战技能额外权重
  if(isP3 && pdist < 150){
    const meleeBoost = ['atk_a','atk_b','atk_c','atk2a','atk2b','charge'];
    const boosted = [];
    eligible.forEach(k => {
      boosted.push(k);
      if(meleeBoost.includes(k)) boosted.push(k);  // 近战技能出现两次 → 更高概率
    });
    eligible = boosted;
  }

  eligible.sort((a,b) => (lucia._skillUsage[a]||-9999) - (lucia._skillUsage[b]||-9999));
  const top = eligible.slice(0, Math.min(3, eligible.length));
  const pick = top[Math.floor(Math.random()*top.length)];
  lucia._skillUsage[pick] = lucia._cycleIdx++;
  return pick;
}

// ── 主 update ──
function updateLucia(dt){
  if(!lucia || !_luciaLoaded) return;
  // 全局递增计时（融合动画用）
  lucia._tickT = (lucia._tickT || 0) + dt;
  const phaseCfg = LUCIA_PHASES[lucia.phase];

  // 受击动画播完返回 idle
  if(lucia.hurtTimer > 0) lucia.hurtTimer -= dt;

  // 死亡
  if(lucia.state==='dead'){
    lucia.deadAge += dt;
    lucia.animT += dt;
    return;
  }

  // 入场 fall
  if(lucia.state==='fall'){
    lucia.stateTimer -= dt;
    lucia.animT += dt;
    if(lucia.stateTimer <= 0){
      lucia.state = 'idle';
      lucia.animT = 0;
      // 入场冲击
      _luciaSpawnPhaseBurst();
    }
    return;
  }

  // 阶段过渡 cheer
  if(lucia.state==='cheer'){
    lucia.stateTimer -= dt;
    lucia.animT += dt;
    if(lucia.stateTimer <= 0){
      lucia.phase = lucia.pendingPhase;
      lucia.pendingPhase = null;
      lucia.state = 'idle';
      lucia.animT = 0;
      // 进入新阶段还有暴击 hp 回血或加速？这里只重置CD
      lucia.atkCD = 1.0;
    }
    return;
  }

  // 受击
  if(lucia.state==='hurt'){
    lucia.stateTimer -= dt;
    lucia.animT += dt;
    // 击退衰减
    lucia.x += lucia.vx * dt;
    lucia.y += lucia.vy * dt;
    lucia.vx *= Math.pow(0.001, dt);
    lucia.vy *= Math.pow(0.001, dt);
    if(lucia.stateTimer <= 0){
      lucia.state = 'idle';
      lucia.animT = 0;
      _checkPhaseTransition();
    }
    _luciaUpdateBlades(dt);
    _luciaUpdatePillars(dt);
    _luciaUpdateClone(dt);
    _luciaUpdateChargeGhost(dt);
    _luciaUpdateRingClones(dt);
    _luciaUpdateBloodSeeks(dt);
    _luciaUpdateBloodChains(dt);
    // _luciaUpdateFxShapes 由主循环统一调用（避免双重更新）
    _luciaUpdateLowHpRage(dt);
    _luciaUpdateSkillTexts(dt);
    _luciaUpdateDeathPillars(dt);
    _luciaAgeAfterimages(dt);
    return;
  }

  // 入场态 entrance：先 atk4c 然后 cheer，最后进入战斗
  if(lucia.state==='entrance'){
    lucia.entranceT = (lucia.entranceT||0) + dt;
    if(lucia.entrancePhase === 'atk4c'){
      if(lucia.entranceT >= 1.0){
        lucia.entrancePhase = 'cheer';
        lucia.entranceT = 0;
        camShake(0.25, 8);
        const cx = lucia.x, cy = lucia.y - 24;
        for(let i=0;i<24;i++){
          const a = Math.random()*Math.PI*2;
          addParticle(cx, cy, {n:1, c:i%3===0?'#FFFFFF':'#990000', spd:140+Math.random()*100, r:2.2, life:0.6, spread:0.05, angle:a, gravity:30});
        }
        shockwaves.push({x:cx, y:cy, r:3, maxR:90, life:0.45, age:0, c:'#990000'});
      }
    } else if(lucia.entrancePhase === 'cheer'){
      if(lucia.entranceT >= 1.0){
        lucia.state = 'idle';
        lucia.entrancePhase = null;
        lucia.atkCD = 0.6;
      }
    }
    return;
  }

  _checkPhaseTransition();
  if(lucia.state==='cheer') return;

  // 朝向玩家
  const pdx = player.x - lucia.x, pdy = player.y - lucia.y;
  const pdist = Math.hypot(pdx, pdy);
  if(!lucia.facingFrozen) lucia.facing = pdx >= 0 ? 1 : -1;

  // 攻击中
  if(lucia.state==='attack'){
    const mv = LUCIA_MOVES[lucia.attackKey];
    lucia.atkPhaseT += dt / mv.dur;
    lucia.animT += dt;

    // ── 入招过渡（前 15% 把残余移动速度衰减到 0）──
    if(lucia.atkPhaseT < 0.15){
      const decay = Math.pow(0.001, dt);
      lucia.vx *= decay;
      lucia.vy *= decay;
      // 仍受地形阻挡
      if(typeof moveAxis === 'function')
        moveAxis(lucia, lucia.vx*dt, lucia.vy*dt, 12, true);
    }

    // ── 起手预警（telegraph）──
    if(mv.telegraph && !lucia._telegraphed && lucia.atkPhaseT >= 0.05 && lucia.atkPhaseT < 0.25){
      lucia._telegraphed = true;
      _luciaTelegraphFX(mv);
    }

    // ── 垫步：近战且距离玩家远时，前摇阶段额外加速冲近（防空放）──
    if(!mv.stationary && !mv.ranged && !mv.isCharge && mv.range > 0){
      const hitStart = (mv.hitWin && mv.hitWin[0]) || 0.4;
      // 仅在 telegraph 之后、命中之前的窗口做垫步
      if(lucia.atkPhaseT > 0.18 && lucia.atkPhaseT < hitStart){
        const desired = mv.range * 0.78;        // 想接近到 78% range
        if(pdist > desired){
          const closingSpd = 320 * dt;          // 快速垫步
          const dirx = pdx >= 0 ? 1 : -1;
          const diry = pdist > 1 ? pdy / pdist : 0;
          // 受地形阻挡（用 moveAxis）
          if(typeof moveAxis === 'function'){
            moveAxis(lucia, dirx * closingSpd, diry * closingSpd * 0.5, 12, true);
          } else {
            lucia.x += dirx * closingSpd;
            lucia.y += diry * closingSpd * 0.5;
          }
          // 垫步白色粒子拖尾
          if(Math.random() < dt*30){
            addParticle(lucia.x - dirx*10, lucia.y - 18,
              {n:1, c: Math.random()<0.5?'#FFFFFF':'#CC2020',
               spd:30, r:1.6, life:0.28, spread:Math.PI*2});
          }
        }
      }
      // 收招阶段：朝玩家反方向后撤一点（避免重合）
      if(lucia.atkPhaseT > 0.82 && lucia.atkPhaseT < 0.98){
        if(pdist < mv.range * 0.7){
          const retreatSpd = 180 * dt;
          const dirx = pdx >= 0 ? -1 : 1;       // 反方向
          const diry = pdist > 1 ? -pdy / pdist : 0;
          if(typeof moveAxis === 'function'){
            moveAxis(lucia, dirx * retreatSpd, diry * retreatSpd * 0.4, 12, true);
          } else {
            lucia.x += dirx * retreatSpd;
            lucia.y += diry * retreatSpd * 0.4;
          }
        }
      }
    }

    // ── 身位前冲（stationary 不冲；charge 仅 X 轴高速突进）──
    if(!mv.stationary && mv.move > 0 && lucia.atkPhaseT > 0.15 && lucia.atkPhaseT < 0.7){
      const stepFactor = Math.sin((lucia.atkPhaseT-0.15)/0.55 * Math.PI);
      const ms = mv.move * stepFactor * dt * 1.6;
      if(mv.isCharge){
        const dirx = pdx >= 0 ? 1 : -1;
        lucia.x += dirx * ms;
        // 拖尾血色粒子
        if(Math.random() < dt*40){
          addParticle(lucia.x - dirx*(8+Math.random()*16),
                      lucia.y - 20 + (Math.random()-0.5)*30,
            {n:2, c:Math.random()<0.5?'#FFFFFF':'#AA0000',
             spd:30+Math.random()*40, r:2.2, life:0.45, spread:Math.PI*2, gravity:0});
        }
      } else {
        const dirx = pdist>1 ? pdx/pdist : lucia.facing;
        const diry = pdist>1 ? pdy/pdist : 0;
        lucia.x += dirx * ms;
        lucia.y += diry * ms;
      }
    }

    // ── 命中判定 ──
    if(mv.ranged){
      if(lucia.atkPhaseT >= mv.hitWin[0] && lucia.atkPhaseT < mv.hitWin[1] && !lucia._bladeShot){
        lucia._bladeShot = true;
        if(mv.rangedType === 'pillar') _luciaSpawnPillars();
        else if(mv.rangedType === 'ring_clones') _luciaSpawnRingClones();
        else if(mv.rangedType === 'blood_seek') _luciaSpawnBloodSeek();
        else if(mv.rangedType === 'blood_chain') _luciaSpawnBloodChain();
        else if(mv.rangedType === 'shadow_cross') _luciaSpawnShadowCross();
        else _luciaShootBlade();
        if(LUCIA_FX[mv.fx]) LUCIA_FX[mv.fx](lucia);
      }
    } else if(mv.multiHit){
      const winList = mv.hitWin;
      for(let i=0; i<winList.length; i+=2){
        const s = winList[i], e = winList[i+1];
        if(lucia.atkPhaseT >= s && lucia.atkPhaseT < e && !lucia.atkHitDone[i]){
          lucia.atkHitDone[i] = true;
          if(mv.aoe) _luciaTryHitAOE(mv); else _luciaTryHit(mv);
          if(LUCIA_FX[mv.fx]) LUCIA_FX[mv.fx](lucia);
        }
      }
    } else {
      if(lucia.atkPhaseT >= mv.hitWin[0] && lucia.atkPhaseT < mv.hitWin[1] && !lucia.atkHitDone[0]){
        lucia.atkHitDone[0] = true;
        if(mv.aoe) _luciaTryHitAOE(mv); else _luciaTryHit(mv);
        if(mv.ground) _luciaGroundCrack(mv);
        if(LUCIA_FX[mv.fx]) LUCIA_FX[mv.fx](lucia);
      }
    }

    if(lucia.atkPhaseT >= 1){
      lucia.state = 'idle';
      lucia.atkPhaseT = 0;
      lucia.animT = 0;
      // P3 出招间隔更短
      lucia.atkCD = lucia.phase >= 3
        ? (0.4 + Math.random()*0.35)
        : (0.8 + Math.random()*0.6);
      lucia.atkHitDone = [];
      lucia._bladeShot = false;
      lucia._telegraphed = false;
      lucia.facingFrozen = false;
      // 出招后保留小尾速（自然过渡到 idle/walk）
      lucia.vx *= 0.3;
      lucia.vy *= 0.3;
    }
    _luciaUpdateBlades(dt);
    _luciaUpdatePillars(dt);
    _luciaUpdateClone(dt);
    _luciaUpdateChargeGhost(dt);
    _luciaUpdateRingClones(dt);
    _luciaUpdateBloodSeeks(dt);
    _luciaUpdateBloodChains(dt);
    // _luciaUpdateFxShapes 由主循环统一调用（避免双重更新）
    _luciaUpdateLowHpRage(dt);
    _luciaUpdateSkillTexts(dt);
    _luciaUpdateDeathPillars(dt);
    _luciaSampleAfterimage(dt);
    _luciaAgeAfterimages(dt);
    return;
  }

  // ── Lucia 格挡系统（主动检测，不依赖受击触发）──
  // idle / walk
  lucia.animT += dt;
  lucia.atkCD -= dt;
  if(lucia._parryCooldown > 0) lucia._parryCooldown -= dt;
  if(lucia._parryFlash > 0) lucia._parryFlash -= dt;

  // 每隔 0.5s 检测一次格挡
  if(!lucia._parryCheckT) lucia._parryCheckT = 0;
  lucia._parryCheckT -= dt;
  if(lucia._parryCheckT <= 0){
    lucia._parryCheckT = 0.5 + Math.random() * 0.3;
    const parryChance = lucia.phase >= 3 ? 0.55 : lucia.phase === 2 ? 0.35 : 0.15;
    const canParry = (lucia.state === 'idle' || lucia.state === 'walk')
                     && (lucia._parryCooldown||0) <= 0;
    const playerAttacking = player && (player.state === 'attack' || player.state === 'sprint');
    const inRange = player && Math.hypot(lucia.x-player.x, lucia.y-player.y) < 180;
    if(canParry && Math.random() < parryChance && playerAttacking && inRange){
      _luciaDoParry();
    }
  }

  const mvSpd = 36 * phaseCfg.speed;
  // P3 阶段：更激进近战策略（甜区更近，接近更快）
  const isP3 = lucia.phase >= 3;
  const sweetXMin = isP3 ? 40  : 55;
  const sweetXMax = isP3 ? 75  : 100;
  const sweetYMax = isP3 ? 20  : 28;
  const tooFarDist = isP3 ? 100 : 130;

  let targetVx = 0, targetVy = 0;
  const xMag = Math.abs(pdx);
  const yMag = Math.abs(pdy);

  // BOSS_AI 关闭：boss 站桩，不移动也不出招（不影响特效/血量更新等）
  const bossAIOff = (typeof window !== 'undefined' && window.BOSS_AI === false);
  if(bossAIOff){
    targetVx = 0; targetVy = 0;
    lucia.vx *= Math.pow(0.001, dt);
    lucia.vy *= Math.pow(0.001, dt);
    if(Math.abs(lucia.vx) < 4) lucia.vx = 0;
    if(Math.abs(lucia.vy) < 4) lucia.vy = 0;
    if(lucia.vx === 0 && lucia.vy === 0) lucia.state = 'idle';
    if(typeof moveAxis === 'function') moveAxis(lucia, lucia.vx*dt, lucia.vy*dt, 12, true);
    else { lucia.x += lucia.vx*dt; lucia.y += lucia.vy*dt; }
    // 跳过决策 + 攻击触发，但更新各特效系统
    _luciaUpdateBlades(dt);
    _luciaUpdatePillars(dt);
    _luciaUpdateClone(dt);
    _luciaUpdateChargeGhost(dt);
    _luciaUpdateRingClones(dt);
    _luciaUpdateBloodSeeks(dt);
    _luciaUpdateBloodChains(dt);
    _luciaUpdateLowHpRage(dt);
    _luciaUpdateSkillTexts(dt);
    _luciaUpdateDeathPillars(dt);
    return;
  }

  if(lucia._poseState === undefined) lucia._poseState = 'observe';
  if(lucia._poseTimer === undefined) lucia._poseTimer = 0;
  lucia._poseTimer += dt;

  const inSweet = (xMag >= sweetXMin && xMag <= sweetXMax && yMag < sweetYMax);
  const tooFar  = (xMag > tooFarDist || yMag > 80);
  const tooCloseAlign = (xMag < 36 && yMag < 50);
  const tooCloseRetreat = (xMag < 50);

  const minPoseTime = isP3 ? 0.25 : 0.40;  // P3 切换更快
  if(pdist > 1 && lucia._poseTimer >= minPoseTime){
    let nextPose = lucia._poseState;
    if(tooCloseAlign)     nextPose = 'orbit';
    else if(tooFar)       nextPose = 'approach';
    else if(tooCloseRetreat) nextPose = 'retreat';
    else if(inSweet)      nextPose = 'observe';
    else if(yMag > 50)    nextPose = 'realign';
    else                  nextPose = 'approach';

    if(nextPose !== lucia._poseState){
      lucia._poseState = nextPose;
      lucia._poseTimer = 0;
      if(nextPose === 'orbit'){
        lucia._sideStepDir = (Math.random() < 0.5 ? 1 : -1);
        lucia._sideStepT   = isP3 ? 0.8 + Math.random()*0.4 : 1.2 + Math.random()*0.6;
      }
    }
  }

  switch(lucia._poseState){
    case 'observe':
      targetVx = 0; targetVy = 0;
      // P3 不等太久，observe 超过 0.6s 强制 approach
      if(isP3 && lucia._poseTimer > 0.6){
        lucia._poseState = 'approach'; lucia._poseTimer = 0;
      }
      break;
    case 'approach':
      // P3 接近速度 +30%
      const spMul = isP3 ? 1.35 : 1.0;
      targetVx = (pdx >= 0 ? 1 : -1) * mvSpd * spMul;
      if(yMag > 50) targetVy = (pdy >= 0 ? 1 : -1) * mvSpd * 0.40;
      else if(yMag > 25) targetVy = (pdy >= 0 ? 1 : -1) * mvSpd * 0.18;
      break;
    case 'retreat':
      targetVx = (pdx >= 0 ? -1 : 1) * mvSpd * 0.55;
      if(yMag < 12) targetVy = (pdy >= 0 ? -1 : 1) * mvSpd * 0.30;
      break;
    case 'realign':
      targetVy = (pdy >= 0 ? 1 : -1) * mvSpd * 0.30;
      break;
    case 'orbit':
      targetVx = (lucia._sideStepDir || 1) * mvSpd * 0.85;
      if(yMag < 22) targetVy = (pdy >= 0 ? -1 : 1) * mvSpd * 0.35;
      lucia._sideStepT -= dt;
      if(lucia._sideStepT <= 0){
        lucia._poseState = 'observe'; lucia._poseTimer = 0;
      }
      break;
  }

  if(targetVx !== 0 || targetVy !== 0) lucia.state = 'walk';

  // Y 轴对齐：和玩家保持相同高度，否则容易打空
  const yDiffL = player.y - lucia.y;
  if(Math.abs(yDiffL) > 18){
    targetVy = Math.sign(yDiffL) * mvSpd * 0.9;
    lucia.state = 'walk';
  }

  // 速度平滑
  const smoothK = (targetVx === 0 && targetVy === 0) ? 9 : 5;
  lucia.vx += (targetVx - lucia.vx) * Math.min(1, smoothK*dt);
  lucia.vy += (targetVy - lucia.vy) * Math.min(1, smoothK*dt);
  if(targetVx === 0 && Math.abs(lucia.vx) < 8) lucia.vx = 0;
  if(targetVy === 0 && Math.abs(lucia.vy) < 8) lucia.vy = 0;

  // 中心引力：偏离战斗中心 > 180px 开始拉回
  {
    const HOME_X = 36*24, HOME_Y = 24*24, HOME_R = 180;
    const hDx = HOME_X - lucia.x, hDy = HOME_Y - lucia.y;
    const hDist = Math.hypot(hDx, hDy);
    if(hDist > HOME_R * 0.4){
      const ht = Math.min(1, (hDist - HOME_R*0.4) / (HOME_R*0.6));
      const hw = ht * 1.95 * mvSpd;  // 0.65 → 1.95（×3）
      lucia.vx += (hDx / hDist) * hw * dt * 8;
      lucia.vy += (hDy / hDist) * hw * dt * 8;
    }
  }

  if(lucia.vx === 0 && lucia.vy === 0 && targetVx === 0 && targetVy === 0){
    lucia.state = 'idle';
  }

  // 移动（穿装饰，但受地形阻挡）
  if(typeof moveAxis === 'function')
    moveAxis(lucia, lucia.vx*dt, lucia.vy*dt, 12, true);
  else {
    lucia.x += lucia.vx*dt; lucia.y += lucia.vy*dt;
  }

  // 触发攻击（BOSS_AI 关闭时不主动出招）
  if(lucia.atkCD <= 0 && (typeof window === 'undefined' || window.BOSS_AI !== false)){
    const key = _luciaPickAttack(pdist);
    lucia.attackKey = key;
    lucia.state = 'attack';
    lucia.atkPhaseT = 0;
    lucia.animT = 0;
    lucia.atkHitDone = [];
    lucia._bladeShot = false;
    lucia.facingFrozen = true;
    // P3 分身逻辑：冲刺 → chargeGhost（原地延迟重演）；其他 → 普通分身（贴身同步）
    if(key === 'charge'){
      _luciaTrySpawnChargeGhost();
    } else {
      _luciaTrySpawnClone();
    }
  }

  _luciaUpdateBlades(dt);
  _luciaUpdatePillars(dt);
  _luciaUpdateClone(dt);
  _luciaUpdateChargeGhost(dt);
  _luciaUpdateRingClones(dt);
  _luciaUpdateBloodSeeks(dt);
  _luciaUpdateBloodChains(dt);
  // _luciaUpdateFxShapes 由主循环统一调用（避免双重更新）
  _luciaUpdateLowHpRage(dt);
  _luciaUpdateSkillTexts(dt);
  _luciaUpdateDeathPillars(dt);
  _luciaSampleAfterimage(dt);
  _luciaAgeAfterimages(dt);
}

// ── 命中检测（普通近战）──
function _luciaTryHit(mv){
  const hx = lucia.x + lucia.facing * 16;
  const hy = lucia.y - 20;
  const dx = player.x - hx, dy = player.y - hy;
  if(Math.hypot(dx, dy) < mv.range){
    if(mv.blockable && typeof defendBlock === 'function' && defendBlock(hx, hy)) return;
    if(playerHurtTimer > 0) return;
    hurtPlayer(mv.dmg, dx, dy, 0.45, 0.25);
    if(mv.screenShake) camShake(0.4, 12);
    else camShake(0.18, 6);
  }
}

// ── 命中检测（360° AOE：以 boss 为圆心）──
function _luciaTryHitAOE(mv){
  const hx = lucia.x;
  const hy = lucia.y - 16;
  const dx = player.x - hx, dy = player.y - hy;
  if(Math.hypot(dx, dy) < mv.range){
    if(mv.blockable && typeof defendBlock === 'function' && defendBlock(hx, hy)) return;
    if(playerHurtTimer > 0) return;
    hurtPlayer(mv.dmg, dx, dy, 0.5, 0.3);
    camShake(0.30, 10);
  }
}

// ── 地裂震波（atk2a / atk4c）──
function _luciaGroundCrack(mv){
  const cx = lucia.x + lucia.facing * (mv.aoe ? 0 : 30);
  const cy = lucia.y - 8;
  // 多层环形冲击波
  shockwaves.push({x:cx, y:cy, r:6,  maxR: mv.range + 30, life:0.55, age:0, c:'#990000'});
  shockwaves.push({x:cx, y:cy, r:4,  maxR: mv.range + 10, life:0.42, age:0, c:'#FF3030'});
  shockwaves.push({x:cx, y:cy, r:2,  maxR: mv.range * 0.7, life:0.32, age:0, c:'#FFFFFF'});
  // 地表碎块
  for(let i=0;i<28;i++){
    const a = Math.random() * Math.PI * 2;
    const sp = 100 + Math.random()*180;
    addParticle(cx, cy + 4, {
      n:1, c: i%4===0 ? '#FFFFFF' : (i%2===0 ? '#990000' : '#552020'),
      spd: sp, r: 2 + Math.random()*1.2, life: 0.6+Math.random()*0.3,
      spread: 0.05, angle: a, gravity: 80
    });
  }
  triggerHitStop(0.06);
  camShake(0.35, 11);
}

// ── 起手预警（telegraph）──
function _luciaTelegraphFX(mv){
  const tx = lucia.x;
  const ty = lucia.y - 20;
  const fx = lucia.facing || 1;
  const isBig = (mv.telegraph === 'red_big');
  const isWhite = (mv.telegraph === 'white');

  // 招式名飘字
  const name = LUCIA_SKILL_NAMES[lucia.attackKey];
  if(name){
    _luciaSpawnSkillText(name, isBig ? '#FF4040' : (isWhite ? '#FFFFFF' : '#FF8030'));
  }

  if(isBig){
    // 大招：双层冲击波 + 上空巨大反向月牙下压 + 内圈反向月 + 红雾向心
    if(typeof shockwaves !== 'undefined'){
      shockwaves.push({x:tx, y:ty, r: mv.range*0.3, maxR: mv.range*1.1, life:0.7, age:0, c:'#FF2020'});
      shockwaves.push({x:tx, y:ty, r: mv.range*0.15,maxR: mv.range*0.8, life:0.55,age:0, c:'#FFFFFF'});
    }
    if(typeof _addFxShape === 'function'){
      _addFxShape('crescent', tx, ty - 50, {
        r: mv.range * 0.85, startAng: -Math.PI*0.7, sweep: Math.PI*1.4,
        thickness: 7, palette: 'red', life: 0.7, spinSpd: 6
      });
      _addFxShape('crescent', tx, ty + 4, {
        r: mv.range * 0.4, startAng: 0, sweep: Math.PI*1.95,
        thickness: 4, palette: 'red', life: 0.6, spinSpd: -10
      });
    }
    if(typeof addParticle === 'function'){
      for(let i=0;i<22;i++){
        const a = (i/22)*Math.PI*2;
        const r = mv.range * (0.55 + Math.random()*0.30);
        addParticle(tx + Math.cos(a)*r, ty + Math.sin(a)*r*0.55,
          {n:1, c: i%3===0?'#FFFFFF':(i%3===1?'#FF6060':'#660000'),
           spd: 50+Math.random()*30, r: 2.0, life: 0.55,
           spread: 0.08, angle: a + Math.PI, gravity: 0});
      }
    }
    if(typeof camShake === 'function') camShake(0.18, 7);
  } else if(isWhite){
    // 旋斩：双层反向月牙 + 散射血粒（改血红色调）
    if(typeof shockwaves !== 'undefined'){
      shockwaves.push({x:tx, y:ty, r:4, maxR: mv.range*0.95, life:0.45, age:0, c:'#CC2020'});
    }
    if(typeof _addFxShape === 'function'){
      _addFxShape('crescent', tx, ty, {
        r: mv.range * 1.0, startAng: 0, sweep: Math.PI*1.95,
        thickness: 5, palette: 'red', life: 0.5, spinSpd: 10
      });
      _addFxShape('crescent', tx, ty, {
        r: mv.range * 0.65, startAng: Math.PI, sweep: Math.PI*1.95,
        thickness: 4, palette: 'red', life: 0.45, spinSpd: -14
      });
    }
    if(typeof addParticle === 'function'){
      for(let i=0;i<16;i++){
        const a = Math.random()*Math.PI*2;
        const r = mv.range * (0.3 + Math.random()*0.6);
        addParticle(tx + Math.cos(a)*r, ty + Math.sin(a)*r*0.5,
          {n:1, c: Math.random()<0.5?'#FF6060':'#660000',
           spd: 60+Math.random()*30, r: 1.8, life: 0.45,
           spread: 0.5, angle: a, gravity: 0});
      }
    }
    if(typeof camShake === 'function') camShake(0.06, 3);
  } else {
    // 普通红色起手：朝向预警弯月 + 脚下脉冲圈
    const dirX = fx;
    if(typeof shockwaves !== 'undefined'){
      shockwaves.push({x: tx + dirX * 18, y: ty, r: 3, maxR: mv.range * 0.85, life: 0.30, age: 0, c: '#CC2020'});
    }
    if(typeof _addFxShape === 'function'){
      // 朝向弯月（预告挥砍弧线）
      _addFxShape('crescent', tx + dirX * mv.range * 0.45, ty - 4, {
        r: mv.range * 0.55,
        startAng: dirX > 0 ? -Math.PI*0.55 : Math.PI*0.45,
        sweep: Math.PI*0.95,
        thickness: 5, palette: 'red', life: 0.32, spinSpd: 10 * dirX
      });
      // 脚下小月起势
      _addFxShape('crescent', tx, ty + 8, {
        r: 22, startAng: 0, sweep: Math.PI*1.95,
        thickness: 3, palette: 'red', life: 0.28, spinSpd: -16
      });
    }
    if(typeof addParticle === 'function'){
      for(let i=0; i<8; i++){
        addParticle(tx + dirX * 18, ty - 4, {n:1,
          c: i%2 ? '#FF6060' : '#660000',
          spd: 80 + Math.random()*40, r: 1.5, life: 0.3,
          spread: 0.25, angle: dirX > 0 ? 0 : Math.PI, gravity: 20});
      }
    }
    if(typeof camShake === 'function') camShake(0.04, 2);
  }
}

// ── 飞行剑气（atk3 远程） ──
function _luciaShootBlade(){
  const dirX = lucia.facing;
  const dirY = 0;
  // 3 个剑气，间隔 5 度
  for(let i=-1; i<=1; i++){
    const a = i * 0.12;
    const ca = Math.cos(a), sa = Math.sin(a);
    const vx = (dirX*ca - dirY*sa) * 280;
    const vy = (dirX*sa + dirY*ca) * 280;
    lucia.blades.push({
      x: lucia.x + lucia.facing*20,
      y: lucia.y - 20,
      vx, vy,
      age: 0, life: 1.4,
      r: 14,
      dmg: 16,
    });
  }
  // 出剑气视觉
  for(let i=0; i<14; i++){
    const a = Math.atan2(0, dirX) + (Math.random()-0.5)*0.4;
    addParticle(lucia.x + lucia.facing*16, lucia.y-20,
      {n:1, c: i%2?'#FFFFFF':'#CC2020', spd:140+Math.random()*80, r:2, life:0.5, spread:0.1, angle:a});
  }
}

function _luciaUpdateBlades(dt){
  if(!lucia.blades || !lucia.blades.length) return;
  let pi=0;
  for(let i=0; i<lucia.blades.length; i++){
    const b = lucia.blades[i];
    b.age += dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    // 拖尾
    if(Math.random() < dt*30){
      addParticle(b.x, b.y, {n:1, c:Math.random()<0.5?'#FFFFFF':'#FF3030', spd:20, r:2, life:0.3, spread:Math.PI*2});
    }
    // 命中
    const dx = player.x - b.x, dy = player.y - b.y;
    if(Math.hypot(dx,dy) < b.r + (typeof P_R!=='undefined'?P_R:5)){
      if(typeof defendBlock==='function' && defendBlock(b.x,b.y)){
        // 格挡：剑气消失，反弹粒子
        addParticle(b.x,b.y,{n:18,c:'#FFFFFF',spd:160,r:2,life:0.4,spread:Math.PI*2});
        continue;
      }
      if(playerHurtTimer<=0){
        hurtPlayer(b.dmg, b.vx, b.vy, 0.45, 0.25);
        addParticle(b.x,b.y,{n:14,c:'#CC2020',spd:130,r:2.5,life:0.45,spread:Math.PI*2});
        addParticle(b.x,b.y,{n:8, c:'#FFFFFF',spd:90, r:1.5,life:0.3, spread:Math.PI*2});
      }
      continue;
    }
    if(b.age < b.life) lucia.blades[pi++] = b;
  }
  lucia.blades.length = pi;
}

// ── Lucia 主动格挡 ──
function _luciaDoParry(){
  if(!lucia) return;
  lucia._parryCooldown = 2.8;
  lucia._parryFlash    = 0.50;
  // 身体后退
  const awX = lucia.x - player.x, awY = lucia.y - player.y;
  const awL = Math.hypot(awX, awY) || 1;
  lucia.vx = awX/awL * 220;
  lucia.vy = awY/awL * 100;
  // 格挡特效
  if(typeof _addFxShape === 'function'){
    _addFxShape('crescent', lucia.x, lucia.y - 48, {
      r: 42, startAng: 0, sweep: Math.PI*1.95,
      thickness: 5, palette: 'red', life: 0.35, spinSpd: -14
    });
  }
  if(typeof shockwaves !== 'undefined'){
    shockwaves.push({x: lucia.x, y: lucia.y-48, r:4, maxR:60, life:0.3, age:0, c:'#FF4040'});
  }
  if(typeof addParticle === 'function'){
    for(let i=0;i<12;i++){
      addParticle(lucia.x, lucia.y-48, {n:1, c:i%2?'#FFFFFF':'#FF3030',
        spd:120+Math.random()*60, r:1.8, life:0.4, spread:Math.PI*2, gravity:30});
    }
  }
  if(typeof camShake === 'function') camShake(0.22, 8);
  if(typeof triggerHitStop === 'function') triggerHitStop(0.10);
  // 0.4s 后立刻反击
  const _hurtLuciaId = lucia ? lucia._id : -1;
  setTimeout(() => {
    if(!lucia || lucia._id !== _hurtLuciaId || lucia.state === 'dead') return;
    if((lucia.state === 'idle' || lucia.state === 'walk') && lucia.atkCD > 0.3){
      lucia.atkCD = 0.1;  // 立即出招
    }
  }, 400);
}


function luciaTakeDamage(dmg, kx, ky){
  if(!lucia || lucia.state==='dead') return;
  if(lucia.state==='entrance') return;
  if(window.BOSS_INVINCIBLE){
    lucia.hurtTimer = Math.max(lucia.hurtTimer || 0, 0.10);
    return;
  }

  // ── Lucia 格挡系统 ──
  // P2+ 阶段有概率格挡（P3 概率更高）
  // 格挡冷却期间不触发（不能无限格挡）
  if(!lucia._parryCooldown) lucia._parryCooldown = 0;
  lucia._parryCooldown = Math.max(0, lucia._parryCooldown - 0);  // 在 update 递减

  const parryChance = lucia.phase >= 3 ? 0.45 : lucia.phase === 2 ? 0.25 : 0.10;
  const canParry = lucia.state === 'idle' || lucia.state === 'walk'
                   || (lucia.state === 'telegraph' && lucia.atkPhaseT > 0.3);

  if(canParry && (lucia._parryCooldown||0) <= 0 && Math.random() < parryChance){
    _luciaDoParry();
    dmg = Math.floor(dmg * 0.15);
  }

  lucia.hp -= dmg;
  if(lucia.hp <= 0){
    lucia.hp = 0;
    lucia.state = 'dead';
    lucia.animT = 0;
    lucia.deadAge = 0;
    _luciaSpawnDeathFX();
    return;
  }
  // 受击：超大伤害(>maxHp 8%)才打断动画
  if(dmg > lucia.maxHp * 0.08 && lucia.state!=='attack' && lucia.state!=='cheer'){
    lucia.state = 'hurt';
    lucia.stateTimer = 0.35;
    lucia.animT = 0;
    lucia.hurtTimer = 0.35;
    const len = Math.hypot(kx, ky) || 1;
    lucia.vx = -kx/len * 80;
    lucia.vy = -ky/len * 80;
  } else {
    lucia.hurtTimer = 0.20;  // 闪红
  }
  // 受击血粒子（强化：白闪 + 双层 burst）
  for(let i=0;i<14;i++){
    addParticle(lucia.x+(Math.random()-0.5)*10, lucia.y-30+Math.random()*20,
      {n:1, c:Math.random()<0.65?'#CC2020':'#FFFFFF',
       spd:80+Math.random()*80, r:2, life:0.5,
       spread:Math.PI*2, gravity:80});
  }
  // 命中点白光小爆（即时反馈）
  shockwaves.push({x:lucia.x, y:lucia.y-30, r:2, maxR:32, life:0.22, age:0, c:'#FFFFFF'});
  // 大伤害额外屏震
  if(dmg > lucia.maxHp * 0.05){
    if(typeof camShake === 'function') camShake(0.18, 6);
  }
}

function _luciaSpawnDeathFX(){
  const cx = lucia.x, cy = lucia.y - 20;
  // 多层震波（4 圈）
  shockwaves.push({x:cx, y:cy, r:8, maxR:320, life:1.1, age:0, c:'#660000'});
  shockwaves.push({x:cx, y:cy, r:5, maxR:240, life:0.95,age:0, c:'#CC2020'});
  shockwaves.push({x:cx, y:cy, r:3, maxR:160, life:0.7, age:0, c:'#FFFFFF'});
  shockwaves.push({x:cx, y:cy, r:2, maxR:100, life:0.5, age:0, c:'#FFFFFF'});
  // 巨量血粒爆开（160）
  for(let i=0;i<160;i++){
    const a = Math.random()*Math.PI*2;
    addParticle(cx, cy, {
      n:1, c: i%4===0?'#FFFFFF':(i%4===1?'#CC2020':'#660000'),
      spd:100+Math.random()*250, r:2.5+Math.random()*1.5,
      life:1.0+Math.random()*0.8, spread:0.1, angle:a, gravity:60
    });
  }
  // 升腾血雾（向上）
  for(let i=0;i<40;i++){
    addParticle(cx + (Math.random()-0.5)*50, cy + (Math.random()-0.5)*30, {
      n:1, c:'#440000', spd:60+Math.random()*40, r:3.5,
      life:1.2, spread:0.6, angle:-Math.PI*0.5, gravity:-90
    });
  }
  // 12 道血柱（径向 + 错峰）
  if(!lucia.deathPillars) lucia.deathPillars = [];
  for(let i=0;i<12;i++){
    const a = i/12*Math.PI*2 + Math.random()*0.12;
    const r = 55 + Math.random()*45;
    lucia.deathPillars.push({
      x: cx + Math.cos(a)*r,
      y: cy + Math.sin(a)*r * 0.6,
      delay: 0.10 + i*0.10,
      t: 0, fired: false,
      dur: 0.8,
    });
  }
  camShake(0.85, 22);
  triggerHitStop(0.40);
  triggerSlowMo(1.6, 0.18);   // 1.6s × 0.18× 慢放
  // 终结词
  _luciaSpawnSkillText('· 终 焉 ·', '#FFFFFF');
}

// ═══════════════════════════════════════════════════════════════
// 红白色血液粒子 FX 库（按攻击类型设计）
// ═══════════════════════════════════════════════════════════════
const LUCIA_FX = {
  // 轻攻击：白色为主，少量血点
  fxLight(b){
    const cx = b.x + b.facing*22, cy = b.y - 22;
    for(let i=0;i<14;i++){
      const a = Math.atan2(player.y-cy, player.x-cx) + (Math.random()-0.5)*0.6;
      addParticle(cx, cy, {n:1, c:i%4===0?'#CC2020':'#FFFFFF', spd:120+Math.random()*60, r:1.8+Math.random(), life:0.35, spread:0.1, angle:a, gravity:40});
    }
    shockwaves.push({x:cx, y:cy, r:2, maxR:24, life:0.18, age:0, c:'#FFFFFF'});
    camShake(0.10, 4);
  },

  // 重攻击：白色十字斜砍痕（替代蘑菇环）
  fxHeavyWhite(b){
    const cx = b.x + b.facing*24, cy = b.y - 22;
    _addFxShape('slashgash', cx, cy, {
      angle: -0.6 * b.facing,    // 斜角
      len: 78, thickness: 12,
      color: 'rgba(255,255,255,1)', life: 0.32
    });
    _addFxShape('slashgash', cx, cy, {
      angle: 0.6 * b.facing,
      len: 60, thickness: 8,
      color: 'rgba(255,180,180,1)', life: 0.28
    });
    for(let i=0;i<14;i++){
      const a = (i/14)*Math.PI*0.6 + (b.facing>0?-Math.PI*0.3:Math.PI*0.7);
      addParticle(cx, cy, {n:1, c:i%3===0?'#FFFFFF':'#DD3030', spd:170+Math.random()*70, r:2+Math.random(), life:0.5, spread:0.05, angle:a, gravity:60});
    }
    camShake(0.18, 6);
  },

  // 重红血攻击：尖锐血刺辐射（替代圆环）
  fxHeavyRed(b){
    const cx = b.x + b.facing*26, cy = b.y - 22;
    _addFxShape('spike', cx, cy, {
      count: 6, len: 38, thickness: 7,
      color: 'rgba(187,16,16,1)', life: 0.4,
      rot: b.facing > 0 ? 0 : Math.PI
    });
    for(let i=0;i<18;i++){
      const a = (i/18)*Math.PI*1.2 + (b.facing>0?-Math.PI*0.6:Math.PI*0.4);
      addParticle(cx, cy, {n:1, c:i%5===0?'#FFFFFF':'#BB1010', spd:200+Math.random()*80, r:2.5, life:0.6, spread:0.05, angle:a, gravity:80});
    }
    camShake(0.22, 7);
  },

  // 血液爆发：放射状尖刺爆裂
  fxBloodBurst(b){
    const cx = b.x + b.facing*22, cy = b.y - 22;
    _addFxShape('spike', cx, cy, {
      count: 10, len: 42, thickness: 6,
      color: 'rgba(204,32,32,1)', life: 0.45
    });
    for(let i=0;i<24;i++){
      const a = (i/24)*Math.PI*2;
      addParticle(cx, cy, {n:1, c:i%3===0?'#FFFFFF':'#990000', spd:180+Math.random()*70, r:2.5, life:0.55, spread:0.04, angle:a, gravity:40});
    }
    camShake(0.25, 8);
  },

  // 远程剑气施法瞬间：纵向血色弧光
  fxRangedBlade(b){
    const cx = b.x + b.facing*22, cy = b.y - 22;
    _addFxShape('crescent', cx, cy, {
      r: 36, startAng: b.facing>0 ? -Math.PI*0.25 : Math.PI*0.75,
      sweep: Math.PI*0.5, thickness: 10,
      color: 'rgba(255,40,40,1)', life: 0.35
    });
    for(let i=0;i<12;i++){
      const a = (i/12)*Math.PI*0.4 + (b.facing>0?-Math.PI*0.2:Math.PI*0.8);
      addParticle(cx, cy, {n:1, c:'#CC2020', spd:80+Math.random()*40, r:2, life:0.3, spread:0.05, angle:a, gravity:0});
    }
    camShake(0.12, 4);
  },

  // 地面裂痕：4 道射线方向的地表裂纹（替代爆血环）
  fxGroundCrack(b){
    const cx = b.x + b.facing*22, cy = b.y - 16;
    _addFxShape('crackline', cx, cy, {
      count: 4, len: 65, color: 'rgba(204,16,16,1)', life: 0.55
    });
    // 落地小爆血
    for(let i=0;i<18;i++){
      const a = Math.PI + (i/18-0.5)*Math.PI*0.9;
      addParticle(cx, cy, {n:1, c:i%3===0?'#FFFFFF':'#BB1010', spd:140+Math.random()*100, r:2.5+Math.random(), life:0.6, spread:0.05, angle:a, gravity:90});
    }
    // 上升血雾
    for(let i=0;i<8;i++){
      addParticle(cx + (Math.random()-0.5)*30, cy - 10,
        {n:1, c:'#660000', spd:70, r:3, life:0.7, spread:Math.PI*2, gravity:-40});
    }
    camShake(0.30, 9);
  },

  // 旋斩：4 道白色月牙弧形射出（替代圆环）
  fxSpinSweep(b){
    const cx = b.x, cy = b.y - 22;
    for(let i=0;i<4;i++){
      _addFxShape('crescent', cx, cy, {
        r: 58, startAng: i/4*Math.PI*2,
        sweep: Math.PI*0.55, thickness: 14,
        palette: 'red',
        color: 'rgba(220,40,40,1)', life: 0.5,
        spinSpd: 6
      });
    }
    for(let i=0;i<18;i++){
      const a = (i/18)*Math.PI*2;
      addParticle(cx, cy, {n:1, c:i%3===0?'#FFFFFF':(i%2?'#CC2020':'#660000'), spd:120+Math.random()*60, r:1.8, life:0.4, spread:0.03, angle:a, gravity:30});
    }
    camShake(0.28, 9);
  },

  // 狂暴突进：深渊裂缝（一条长的层次裂痕，替代平行速度线）
  fxBerserkLunge(b){
    const cx = b.x + b.facing*28, cy = b.y - 22;
    _addFxShape('abyssrift', cx, cy, {
      facing: b.facing, len: 145, life: 0.50
    });
    for(let i=0;i<14;i++){
      addParticle(cx + (Math.random()-0.5)*20, cy + (Math.random()-0.5)*30,
        {n:1, c:i%3?'#FFFFFF':'#AA0000', spd:90+Math.random()*70,
         r:2, life:0.45, spread:0.1, angle:b.facing>0?0:Math.PI});
    }
    camShake(0.25, 8);
  },

  // 狂暴普通：螺旋撕裂（替代散爆）
  fxBerserk(b){
    const cx = b.x + b.facing*30, cy = b.y - 22;
    _addFxShape('spiral', cx, cy, {
      r: 70, turns: 2, color: 'rgba(170,0,0,1)', life: 0.55
    });
    for(let i=0;i<28;i++){
      const a = i/28 * Math.PI*4;
      const r = 8 + i*2.2;
      addParticle(cx + Math.cos(a)*r, cy + Math.sin(a)*r,
        {n:1, c:i%5===0?'#FFFFFF':'#990000', spd:50+Math.random()*60,
         r:2.2, life:0.6, spread:0.1, angle:a+Math.PI*0.5});
    }
    camShake(0.32, 10);
  },

  // 地面喷发 atk4c：斜十字撕裂 + 中心暗陷（替代多重圆环）
  // 地面喷发 atk4c：多阶段震撼爆裂
  // Stage 1 (0.0s)：暗心 + 锐利 X 切 + 大冲击波
  // Stage 2 (0.10s)：6 道 abyss 地裂辐射
  // Stage 3 (0.20-0.40s)：沿裂纹 6 个错峰火柱
  // Stage 4 (0.40s)：中央巨柱腾起
  fxEruption(b){
    const cx = b.x, cy = b.y - 16;

    // S1：中央暗心 + 大冲击
    _addFxShape('darkring', cx, cy, { r: 100, life: 0.85 });
    _addFxShape('xslash',   cx, cy, {
      len: 130, thickness: 14,
      color: 'rgba(204,0,0,1)', life: 0.50
    });
    shockwaves.push({x:cx, y:cy, r:6,  maxR:160, life:0.6, age:0, c:'#660000'});
    shockwaves.push({x:cx, y:cy, r:3,  maxR:90,  life:0.4, age:0, c:'#FFFFFF'});

    // S2：6 道地裂辐射（延迟 0.10s）
    _addFxShape('crackline', cx, cy, {
      count: 6, len: 105,
      color: 'rgba(204,16,16,1)',
      life: 0.95, delay: 0.10
    });

    // S3：沿 6 方向喷火柱（延迟错峰）
    for(let i=0;i<6;i++){
      const a = i/6 * Math.PI*2 + Math.random()*0.05;
      const r0 = 52 + Math.random()*15;
      const px = cx + Math.cos(a)*r0;
      const py = cy + Math.sin(a)*r0;
      _addFxShape('firepillar', px, py, {
        h: 65 + Math.random()*15,
        life: 0.65,
        delay: 0.20 + i*0.04,    // 0.20 → 0.40s 错峰
      });
      // 喷柱起手时基座爆血
      // → 通过粒子在喷发时刻添加，但 _addFxShape 不能延迟生粒子
      //   所以提前 spawn 粒子，给粒子自身延迟（用 spread/gravity）
    }

    // S4：中央巨柱（延迟 0.40s）
    _addFxShape('firepillar', cx, cy, {
      h: 120, big: true,
      life: 0.95, delay: 0.40
    });

    // 即时上升粒子簇（替代旧 8 方向血柱）
    for(let dir=0; dir<10; dir++){
      const a = (dir/10) * Math.PI * 2;
      for(let j=0;j<4;j++){
        const r0 = 28 + j*14 + Math.random()*8;
        const ex = cx + Math.cos(a)*r0;
        const ey = cy + Math.sin(a)*r0;
        addParticle(ex, ey, {
          n:1, c: j%3===0?'#FFFFFF':(j%2?'#FF6020':'#990000'),
          spd:140+Math.random()*80, r:2.4+Math.random()*0.6,
          life:0.85, spread:0.1, angle:-Math.PI*0.5, gravity:-90
        });
      }
    }
    // 升腾血雾（缓慢上飘）
    for(let i=0;i<16;i++){
      addParticle(cx + (Math.random()-0.5)*55, cy + (Math.random()-0.5)*15,
        {n:1, c: Math.random()<0.5?'#440000':'#220000',
         spd:50+Math.random()*30, r:3.5,
         life:1.0+Math.random()*0.4, spread:0.5, angle:-Math.PI*0.5, gravity:-65});
    }
    // 落下的残烬（红色余烬，从空中坠落）— 延迟体感
    for(let i=0;i<14;i++){
      const drop = cx + (Math.random()-0.5)*120;
      const high = cy - 40 - Math.random()*30;
      addParticle(drop, high,
        {n:1, c: Math.random()<0.5?'#FFD060':'#FF6020',
         spd:30+Math.random()*40, r:2,
         life:0.9, spread:0.3, angle:Math.PI*0.5, gravity:90});
    }

    camShake(0.55, 14);
    triggerHitStop(0.13);
    triggerSlowMo(0.32, 0.32);
  },

  // 血液风暴 ult：旋转涡流 + 暗心
  fxBloodStorm(b){
    const cx = b.x, cy = b.y - 24;
    _addFxShape('darkring', cx, cy, {
      r: 100, life: 0.75
    });
    // 螺旋粒子（切向速度）
    for(let layer=0; layer<3; layer++){
      for(let i=0;i<24;i++){
        const a = i/24*Math.PI*2 + layer*0.5;
        const r0 = 30 + layer*28;
        const ex = cx + Math.cos(a)*r0;
        const ey = cy + Math.sin(a)*r0;
        const tA = a + Math.PI*0.5;     // 切向（沿圆周）
        addParticle(ex, ey, {n:1, c:layer%2?'#990000':'#FFFFFF',
          spd:220+Math.random()*80, r:2.2+Math.random()*0.8, life:0.85,
          spread:0.04, angle:tA, gravity:20});
      }
    }
    // 中心爆血点
    _addFxShape('spike', cx, cy, {
      count: 12, len: 50, thickness: 5,
      color: 'rgba(187,16,16,1)', life: 0.45
    });
    camShake(0.55, 14);
    triggerHitStop(0.10);
  },
};

// ═══════════════════════════════════════════════════════════════
// 多样化 FX 形状系统：月牙/速度线/十字/螺旋/利刺/裂痕/暗环
// 加入 lucia.fxShapes 队列，drawLucia 末端统一绘制
// ═══════════════════════════════════════════════════════════════

// 全局 FX 形状池（玩家技能也可推入）
window.fxShapesPool = window.fxShapesPool || [];

function _addFxShape(type, x, y, params){
  // 上限保护：手机端更严格
  const cap = (typeof window !== 'undefined' && window.IS_MOBILE) ? 14 : 35;
  if(fxShapesPool.length >= cap) fxShapesPool.shift();
  fxShapesPool.push(Object.assign({type, x, y, age:0, life:params.life||0.5}, params));
}

function _luciaUpdateFxShapes(dt){
  if(fxShapesPool.length === 0) return;
  for(let i=fxShapesPool.length-1; i>=0; i--){
    const s = fxShapesPool[i];
    s.age += dt;
    const total = s.life + (s.delay || 0);
    if(s.age >= total) fxShapesPool.splice(i, 1);
  }
}

function _luciaDrawFxShapes(c){
  if(fxShapesPool.length === 0) return;
  for(const s of fxShapesPool){
    const delay = s.delay || 0;
    const effAge = s.age - delay;
    if(effAge < 0) continue;
    const k = 1 - effAge / s.life;
    if(k <= 0) continue;
    const sx = s.x - ox();
    const sy = (s.y - oy()) * ISO_Y_SCALE;
    const orig = s.age;
    s.age = effAge;
    c.save();
    switch(s.type){
      case 'crescent':   _drawFxCrescent(c, sx, sy, s, k); break;
      case 'speedline':  _drawFxSpeedlines(c, sx, sy, s, k); break;
      case 'abyssrift':  _drawFxAbyssRift(c, sx, sy, s, k); break;
      case 'xslash':     _drawFxXSlash(c, sx, sy, s, k); break;
      case 'slashgash':  _drawFxSlashGash(c, sx, sy, s, k); break;
      case 'spike':      _drawFxSpikes(c, sx, sy, s, k); break;
      case 'crackline':  _drawFxCrackLines(c, sx, sy, s, k); break;
      case 'spiral':     _drawFxSpiral(c, sx, sy, s, k); break;
      case 'darkring':   _drawFxDarkRing(c, sx, sy, s, k); break;
      case 'shadowrip':  _drawFxShadowRip(c, sx, sy, s, k); break;
      case 'firepillar': _drawFxFirePillar(c, sx, sy, s, k); break;
      case 'giantSword': _drawFxGiantSword(c, sx, sy, s, k); break;
    }
    c.restore();
    s.age = orig;
  }
}

// 公开给玩家技能调用
window._addFxShape = _addFxShape;
window._luciaUpdateFxShapes = _luciaUpdateFxShapes;
window._luciaDrawFxShapes = _luciaDrawFxShapes;

// ── 月牙弧（弧形 sampled → abyss 路径）──
function _drawFxCrescent(c, sx, sy, s, k){
  const ang = (s.startAng||0) + (s.spinSpd||0) * s.age;
  c.translate(sx, sy);
  c.rotate(ang);
  const r = s.r * (0.6 + (1-k)*0.4);
  if(!s._pts || s._cachedR !== r){
    const STEPS = 20;
    const pts = [];
    for(let i=0;i<=STEPS;i++){
      const t = i/STEPS;
      const a = -s.sweep/2 + t * s.sweep;
      const jit = (Math.random()-0.5) * 2.2;
      pts.push({
        x: Math.cos(a)*(r+jit),
        y: Math.sin(a)*(r+jit)
      });
    }
    s._pts = pts;
    s._cachedR = r;
  }
  _strokeAbyssPath(c, s._pts, k, {
    widthMul: 0.85,
    palette: s.palette || 'white',   // 月牙默认白色
    sparks: true, burst: false
  });
}

// ── 速度线（横向多条平行短线）──
function _drawFxSpeedlines(c, sx, sy, s, k){
  c.translate(sx, sy);
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = k * 0.9;
  c.strokeStyle = s.color;
  c.lineCap = 'round';
  const N = s.count;
  const seedBase = s._seed || (s._seed = (Math.random()*1e6)|0);
  for(let i=0;i<N;i++){
    const seed = (seedBase + i*17) % 1000 / 1000;
    const yo = (i - N/2) * 5 + (seed-0.5)*4;
    const len = s.len * (0.7 + seed*0.3) * (1 + (1-k)*0.6);
    const startX = s.facing > 0 ? -len : len;
    c.lineWidth = 1.5 + seed*2.5;
    c.beginPath();
    c.moveTo(startX, yo);
    c.lineTo(0, yo + (seed-0.5)*3);
    c.stroke();
  }
  // 内层细白
  c.globalAlpha = k;
  c.strokeStyle = 'rgba(255,255,255,1)';
  for(let i=0;i<N;i++){
    const seed = (seedBase + i*17) % 1000 / 1000;
    const yo = (i - N/2) * 5 + (seed-0.5)*4;
    const len = s.len * 0.6 * (1 + (1-k)*0.6);
    const startX = s.facing > 0 ? -len : len;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(startX*0.6, yo);
    c.lineTo(0, yo);
    c.stroke();
  }
}

// ── 斜十字 X 形撕裂 ──
// ═══════════════════════════════════════════════════════════════
// 通用：沿任意点路径绘制"深渊裂缝"五层叠加
//   外晕 → 中红 → 暗黑裂体 → 渐变白炽 → 中段硬白 + 火星溅射
// 任意线条型 FX 都可用此函数 → 统一美学
// ═══════════════════════════════════════════════════════════════
function _strokeAbyssPath(c, pts, k, opts){
  if(!pts || pts.length < 2) return;
  opts = opts || {};
  const widthMul = opts.widthMul || 1;
  const palette  = opts.palette  || 'red';
  const sparks   = opts.sparks   !== false;
  const burst    = opts.burst    !== false;
  const alphaMul = opts.alphaMul || 1;

  let outerRGB, midRGB, innerCore, innerMid;
  if(palette === 'white'){
    outerRGB = 'rgba(180,220,255';
    midRGB   = 'rgba(120,160,220';
    innerCore = 'rgba(255,255,255';
    innerMid  = 'rgba(220,240,255';
  } else {
    outerRGB = 'rgba(200,40,30';
    midRGB   = 'rgba(160,20,20';
    innerCore = 'rgba(255,255,200';
    innerMid  = 'rgba(255,160,80';
  }

  // 端点切短：路径两端各让 12% 不画 → 视觉上"尖" + "粒子化"
  const N = pts.length;
  const startSkip = Math.max(1, Math.floor(N * 0.12));
  const endSkip   = Math.max(1, Math.floor(N * 0.12));
  const visStart = startSkip;
  const visEnd   = N - endSkip - 1;

  const pathStroke = () => {
    c.beginPath();
    c.moveTo(pts[visStart].x, pts[visStart].y);
    for(let i=visStart+1;i<=visEnd;i++) c.lineTo(pts[i].x, pts[i].y);
    c.stroke();
  };

  // 端点锐化：从被截断点起，沿切线方向衰减喷火星 → 视觉接续，无圆角
  c.lineCap = 'butt';        // 关键：扁平端点，无圆头
  c.lineJoin = 'round';

  // 沿路径起点终点方向建 gradient（更准确的"沿路径方向"）
  const sx = pts[visStart].x, sy = pts[visStart].y;
  const ex = pts[visEnd].x,   ey = pts[visEnd].y;
  const buildGrad = (rgb, alpha) => {
    const g = c.createLinearGradient(sx, sy, ex, ey);
    g.addColorStop(0,    `${rgb},0)`);
    g.addColorStop(0.18, `${rgb},${alpha*0.7})`);
    g.addColorStop(0.5,  `${rgb},${alpha})`);
    g.addColorStop(0.82, `${rgb},${alpha*0.7})`);
    g.addColorStop(1,    `${rgb},0)`);
    return g;
  };

  // 层1：外晕（gradient 锐化）
  c.globalCompositeOperation = 'lighter';
  c.strokeStyle = buildGrad(outerRGB, 0.55 * k * alphaMul);
  c.lineWidth = 22 * k * widthMul;
  pathStroke();

  // 层2：中色
  c.strokeStyle = buildGrad(midRGB, 0.85 * k * alphaMul);
  c.lineWidth = 12 * k * widthMul;
  pathStroke();

  // 层3：暗黑裂体（source-over，需端点 alpha 渐隐）
  c.globalCompositeOperation = 'source-over';
  c.strokeStyle = buildGrad('rgba(8,0,2', 0.95 * k * alphaMul);
  c.lineWidth = 6 * k * widthMul;
  pathStroke();

  // 层4：渐变内炎
  c.globalCompositeOperation = 'lighter';
  const glowGrd = c.createLinearGradient(sx, sy, ex, ey);
  glowGrd.addColorStop(0,    `${innerMid},0)`);
  glowGrd.addColorStop(0.25, `${innerMid},${0.85*k*alphaMul})`);
  glowGrd.addColorStop(0.5,  `${innerCore},${k*alphaMul})`);
  glowGrd.addColorStop(0.75, `${innerMid},${0.85*k*alphaMul})`);
  glowGrd.addColorStop(1,    `${innerMid},0)`);
  c.strokeStyle = glowGrd;
  c.lineWidth = 2.2 * k * widthMul;
  pathStroke();

  // 层5：中段 1/3 硬白炽细线
  c.globalAlpha = k * 0.85 * alphaMul;
  c.strokeStyle = 'rgba(255,255,240,1)';
  c.lineWidth = 1.0;
  const midStart = Math.floor(N * 0.36);
  const midEnd   = Math.floor(N * 0.64);
  c.beginPath();
  c.moveTo(pts[midStart].x, pts[midStart].y);
  for(let i=midStart+1;i<=midEnd;i++) c.lineTo(pts[i].x, pts[i].y);
  c.stroke();
  c.globalAlpha = 1;

  // 火星溅射（沿可见段随机 + 端点密集 → 粒子化感）
  if(sparks){
    // 沿主路径
    for(let i=visStart; i<=visEnd; i++){
      if(Math.random() > 0.30) continue;
      const p = pts[i];
      const r = 2 + Math.random()*2.2;
      const eg = c.createRadialGradient(p.x, p.y - 2, 0, p.x, p.y - 2, r);
      eg.addColorStop(0,   `rgba(255,220,150,${0.85*k*alphaMul})`);
      eg.addColorStop(0.5, `rgba(255,120,40,${0.4*k*alphaMul})`);
      eg.addColorStop(1,   'rgba(255,40,10,0)');
      c.fillStyle = eg;
      c.beginPath();
      c.arc(p.x, p.y - 2, r, 0, Math.PI*2);
      c.fill();
    }
    // 端点尖锐火星：从被截断的两端向外延伸的 4-5 颗递减粒子
    const drawTipSparks = (anchorIdx, tipDir) => {
      // tipDir: -1 起点方向, +1 终点方向
      const anchor = pts[anchorIdx];
      const next = (tipDir < 0) ? pts[Math.max(0, anchorIdx-1)]
                                : pts[Math.min(N-1, anchorIdx+1)];
      const dx = anchor.x - next.x, dy = anchor.y - next.y;
      const L = Math.hypot(dx, dy) || 1;
      const ux = dx/L, uy = dy/L;
      const sparkCount = 5;
      for(let s=0; s<sparkCount; s++){
        const dist = (s+1) * 4 + Math.random()*3;
        const offX = (Math.random()-0.5) * 2.5;
        const offY = (Math.random()-0.5) * 2.5;
        const px = anchor.x + ux*dist + offX;
        const py = anchor.y + uy*dist + offY;
        const r = (3.5 - s*0.6) * k;
        if(r <= 0) continue;
        const fade = (1 - s/sparkCount);
        const eg = c.createRadialGradient(px, py, 0, px, py, r);
        eg.addColorStop(0,   `rgba(255,240,180,${0.9*fade*k*alphaMul})`);
        eg.addColorStop(0.5, `rgba(255,140,40,${0.5*fade*k*alphaMul})`);
        eg.addColorStop(1,   'rgba(180,0,0,0)');
        c.fillStyle = eg;
        c.beginPath();
        c.arc(px, py, r, 0, Math.PI*2);
        c.fill();
      }
    };
    drawTipSparks(visStart, -1);
    drawTipSparks(visEnd,    1);
  }

  // 中央剧烈白爆点（命中瞬间衰减）
  if(burst && k > 0.7){
    const burstAlpha = (k - 0.7) / 0.3;
    const m = pts[Math.floor(N*0.5)];
    const bg = c.createRadialGradient(m.x, m.y, 0, m.x, m.y, 14);
    bg.addColorStop(0,   `rgba(255,255,230,${burstAlpha})`);
    bg.addColorStop(0.4, `rgba(255,160,40,${burstAlpha*0.7})`);
    bg.addColorStop(1,   'rgba(180,0,0,0)');
    c.fillStyle = bg;
    c.beginPath();
    c.arc(m.x, m.y, 14, 0, Math.PI*2);
    c.fill();
  }
}

// ── 深渊裂缝：调用通用 abyss path ──
function _drawFxAbyssRift(c, sx, sy, s, k){
  c.translate(sx, sy);
  if(!s._pts){
    const N = 16;
    const pts = [];
    const dir = s.facing > 0 ? 1 : -1;
    for(let i=0;i<=N;i++){
      const t = i/N;
      const x = (t - 0.5) * s.len * dir;
      const taper = 1 - Math.pow(Math.abs(t-0.5)*2, 1.3);
      const y = (Math.random()-0.5) * 10 * taper + Math.sin(t*8)*2;
      pts.push({x, y});
    }
    s._pts = pts;
  }
  _strokeAbyssPath(c, s._pts, k, {widthMul: 1.0, palette: s.palette || 'red'});
}

function _drawFxXSlash(c, sx, sy, s, k){
  c.translate(sx, sy);
  if(!s._pts1){
    const make = (angle) => {
      const N = 14;
      const pts = [];
      const ca = Math.cos(angle), sa = Math.sin(angle);
      const len = s.len;
      for(let i=0;i<=N;i++){
        const t = i/N;
        const px = (t - 0.5) * len;
        const taper = 1 - Math.pow(Math.abs(t-0.5)*2, 1.3);
        const py = (Math.random()-0.5) * 8 * taper;
        pts.push({x: px*ca - py*sa, y: px*sa + py*ca});
      }
      return pts;
    };
    s._pts1 = make(Math.PI*0.25);
    s._pts2 = make(-Math.PI*0.25);
  }
  _strokeAbyssPath(c, s._pts1, k, {widthMul:0.95, palette: s.palette || 'red', burst:false});
  _strokeAbyssPath(c, s._pts2, k, {widthMul:0.95, palette: s.palette || 'red', burst:true});
}

// ── 单条斜砍痕 → abyss 路径 ──
function _drawFxSlashGash(c, sx, sy, s, k){
  c.translate(sx, sy);
  c.rotate(s.angle || 0);
  if(!s._pts){
    const N = 13;
    const pts = [];
    for(let i=0;i<=N;i++){
      const t = i/N;
      const x = (t - 0.5) * s.len;
      const taper = 1 - Math.pow(Math.abs(t-0.5)*2, 1.3);
      const y = (Math.random()-0.5) * 6 * taper;
      pts.push({x, y});
    }
    s._pts = pts;
  }
  // 自动判断 palette：纯白用 white，否则 red
  let palette = s.palette || 'red';
  if(!s.palette && s.color && s.color.indexOf('255,255,255') >= 0) palette = 'white';
  _strokeAbyssPath(c, s._pts, k, {widthMul:0.75, palette});
}

// ── 利刺辐射（三角形 spike）──
// rgba color → 同色但 alpha=0
function _fadeRGBAtoZero(c){
  const m = c && c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if(m) return `rgba(${m[1]},${m[2]},${m[3]},0)`;
  return 'rgba(255,255,255,0)';
}

function _drawFxSpikes(c, sx, sy, s, k){
  c.translate(sx, sy);
  c.rotate(s.rot || 0);
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = k * 0.9;
  const N = s.count || 8;
  const len = s.len * (0.5 + (1-k)*0.5);
  for(let i=0;i<N;i++){
    const a = i/N * Math.PI*2;
    c.save();
    c.rotate(a);
    const grd = c.createLinearGradient(0, 0, len, 0);
    grd.addColorStop(0, s.color);
    grd.addColorStop(0.7, s.color);
    // 渐隐到透明，根据 color 推算 base（避免硬编码红）
    grd.addColorStop(1, _fadeRGBAtoZero(s.color));
    c.fillStyle = grd;
    c.beginPath();
    c.moveTo(0, -s.thickness/2);
    c.lineTo(len, 0);
    c.lineTo(0, s.thickness/2);
    c.closePath();
    c.fill();
    c.restore();
  }
  // 中心白点
  c.fillStyle = `rgba(255,255,255,${k*0.85})`;
  c.beginPath();
  c.arc(0, 0, 4*k, 0, Math.PI*2);
  c.fill();
}

// ── 地表裂纹（折线放射）──
function _drawFxCrackLines(c, sx, sy, s, k){
  c.translate(sx, sy);
  c.globalCompositeOperation = 'lighter';
  const N = s.count || 4;
  const len = s.len * (0.5 + (1-k)*0.5);
  if(!s._cracks){
    // 预生成折线
    s._cracks = [];
    for(let i=0;i<N;i++){
      const a = i/N * Math.PI*2;
      const segs = [{x:0, y:0}];
      let cx=0, cy=0, ang=a;
      const SEGN = 4;
      for(let j=0;j<SEGN;j++){
        ang += (Math.random()-0.5)*0.6;
        const stepLen = len/SEGN * (0.7 + Math.random()*0.6);
        cx += Math.cos(ang)*stepLen;
        cy += Math.sin(ang)*stepLen * ISO_Y_SCALE;   // 地面投影
        segs.push({x:cx, y:cy});
      }
      s._cracks.push(segs);
    }
  }
  // 用 abyss 风格画每条裂纹（地面投影）
  for(const seg of s._cracks){
    _strokeAbyssPath(c, seg, k, {widthMul: 0.55, palette: 'red', burst: false, sparks: true});
  }
}

// ── 螺旋撕裂 → abyss 风格 ──
function _drawFxSpiral(c, sx, sy, s, k){
  c.translate(sx, sy);
  if(!s._pts){
    const turns = s.turns || 2;
    const Rmax = s.r;
    const STEPS = 48;
    const pts = [];
    for(let i=0;i<=STEPS;i++){
      const t = i/STEPS;
      const ang = t * turns * Math.PI*2;
      const r = t * Rmax;
      const jit = (Math.random()-0.5)*3;
      pts.push({
        x: Math.cos(ang)*(r+jit),
        y: Math.sin(ang)*(r+jit) * ISO_Y_SCALE
      });
    }
    s._pts = pts;
  }
  _strokeAbyssPath(c, s._pts, k, {widthMul: 0.65, palette: 'red', burst: false});
}

// ── 暗环（背景暗化凹陷感）──
function _drawFxDarkRing(c, sx, sy, s, k){
  c.translate(sx, sy);
  c.globalAlpha = k * 0.85;
  c.globalCompositeOperation = 'multiply';
  const r = s.r * (0.55 + (1-k)*0.45);
  const grd = c.createRadialGradient(0, 0, 0, 0, 0, r);
  grd.addColorStop(0,   'rgba(15,0,5,0.85)');
  grd.addColorStop(0.55,'rgba(50,0,10,0.45)');
  grd.addColorStop(1,   'rgba(20,0,5,0)');
  c.fillStyle = grd;
  c.beginPath();
  c.ellipse(0, 0, r, r * ISO_Y_SCALE, 0, 0, Math.PI*2);
  c.fill();
}

// ── 神圣巨剑：从天而降 → 钉入地面 → 残留圣光 ──
// 使用 ROLE3_SWORDS_IMG (role3_swords.png) 作为剑身贴图
function _drawFxGiantSword(c, sx, sy, s, k){
  const t = 1 - k;
  const sizeMul = s.sizeMul || 1;
  const img = window.ROLE3_SWORDS_IMG;
  const swordLen = 75 * sizeMul;     // 基础 220 → 75（约 1/3）
  const swordW   = img ? swordLen * (img.width / img.height) : 18 * sizeMul;

  let phase, descendK, impactK, resK;
  if(t < 0.4){ phase = 'descend'; descendK = t / 0.4; }
  else if(t < 0.55){ phase = 'impact'; impactK = (t - 0.4) / 0.15; }
  else { phase = 'residue'; resK = (t - 0.55) / 0.45; }

  // 渲染剑（尖端在 0,0 朝下）
  // 巨剑根据阶段决定显示比例（impact/residue 时插地：只显示上半段）
  function renderSword(alpha, buried){
    c.save();
    c.globalAlpha = alpha;
    if(img && img.complete && img.naturalWidth > 0){
      // 剑身贴图（无 halo 椭圆）
      c.save();
      if(buried){
        c.beginPath();
        c.rect(-swordW, -swordLen, swordW*2, swordLen * 0.55);
        c.clip();
      }
      // base
      c.drawImage(img, -swordW/2, -swordLen, swordW, swordLen);
      // 一次 lighter 自身叠加发光（保持剑形）
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = alpha * 0.45;
      c.drawImage(img, -swordW/2, -swordLen, swordW, swordLen);
      c.restore();
    } else {
      c.fillStyle = `rgba(200,230,255,${0.85 * alpha})`;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(swordW*0.3, -swordLen*0.1);
      c.lineTo(swordW*0.2, -swordLen*0.95);
      c.lineTo(-swordW*0.2, -swordLen*0.95);
      c.lineTo(-swordW*0.3, -swordLen*0.1);
      c.closePath();
      c.fill();
    }
    c.restore();
  }

  // descend：从屏外坠落 + 残影
  if(phase === 'descend'){
    const startOffset = -380 * sizeMul;
    const yOff = startOffset + (0 - startOffset) * _easeIn3(descendK);
    c.save();
    c.translate(sx, sy + yOff);
    // 2 段残影（减少 draw call）
    for(let i=2; i>=1; i--){
      c.save();
      c.translate(0, -i * 30 * sizeMul);
      renderSword(0.20 + (2-i) * 0.08, false);
      c.restore();
    }
    renderSword(1.0, false);
    // 蓝光锥
    c.globalCompositeOperation = 'lighter';
    const cone = c.createLinearGradient(0, swordLen*0.05, 0, swordLen*0.9);
    cone.addColorStop(0, 'rgba(180,220,255,0.55)');
    cone.addColorStop(1, 'rgba(80,140,220,0)');
    c.fillStyle = cone;
    c.beginPath();
    c.moveTo(-swordW*0.3, swordLen*0.05);
    c.lineTo( swordW*0.3, swordLen*0.05);
    c.lineTo( 0,          swordLen*0.9);
    c.closePath();
    c.fill();
    c.restore();
    return;
  }

  // impact：地面爆炸 + 钉地
  if(phase === 'impact'){
    c.save();
    c.translate(sx, sy);

    // ── 1. 速度残影：3 段半透剑朝上（impactK<0.5）──
    if(impactK < 0.5){
      const fade = (0.5 - impactK) * 2;
      for(let i=1; i<=3; i++){
        c.save();
        c.translate(0, swordLen * 0.45 - i * 22 * sizeMul);
        c.globalAlpha = fade * (0.45 - i * 0.08);
        renderSword(1.0, false);
        c.restore();
      }
    }

    // ── 2. 主剑钉地（强抖动）──
    const shake = (1 - impactK) * 9 * (Math.random() - 0.5);
    const shakeY = (1 - impactK) * 3 * (Math.random() - 0.5);
    c.save();
    c.translate(shake, swordLen * 0.45 + shakeY);
    c.globalCompositeOperation = 'source-over';
    renderSword(1.0, true);
    c.restore();

    c.restore();

    // 命中
    if(!s._hitDone){
      s._hitDone = true;
      const range = 80 * sizeMul;
      const dmg = s.dmg || 80;
      if(typeof boss !== 'undefined' && boss && boss.state !== 'dead'){
        if(Math.hypot(boss.x - s.x, boss.y - s.y) < range + 30){
          if(typeof hitBoss === 'function') hitBoss(dmg, 0, 0);
        }
      }
      if(typeof hitEnemiesInRange === 'function'){
        hitEnemiesInRange(s.x, s.y, range);
      }
      if(typeof shockwaves !== 'undefined'){
        shockwaves.push({x: s.x, y: s.y, r: 4, maxR: 150 * sizeMul, life: 0.55, age: 0, c: '#FFFFFF'});
      }
      if(typeof addParticle === 'function'){
        for(let k2=0; k2<12; k2++){
          const a = k2 / 12 * Math.PI * 2;
          addParticle(s.x, s.y, {n:1, c: k2%2?'#FFFFFF':'#AAEEFF',
            spd: 240 + Math.random()*80, r: 1.8, life: 0.5,
            spread: 0.10, angle: a, gravity: 50});
        }
        for(let k2=0; k2<6; k2++){
          addParticle(s.x, s.y, {n:1, c:'#FFFFFF',
            spd: 140 + Math.random()*80, r: 1.4, life: 0.4,
            spread: 0.6, angle: Math.random()*Math.PI*2, gravity: 70});
        }
        for(let k2=0; k2<6; k2++){
          addParticle(s.x + (Math.random()-0.5)*20, s.y, {n:1, c:'#FFFFFF',
            spd: 80 + Math.random()*40, r: 1.3, life: 0.35,
            spread: 0.5, angle: -Math.PI/2 + (Math.random()-0.5)*0.5, gravity: 120});
        }
      }
      if(typeof camShake === 'function') camShake(0.55 * sizeMul, 18);
      if(typeof triggerHitStop === 'function') triggerHitStop(0.14);
    }
    return;
  }

  // residue：钉地余晖
  c.save();
  c.translate(sx, sy);
  c.translate(0, swordLen * 0.45);   // 与 impact 一致：插地
  renderSword((1 - resK) * 0.85, true);    // residue 阶段：钉地
  c.globalCompositeOperation = 'lighter';
  const r = 70 * sizeMul * (1 - resK);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, `rgba(255,255,255,${0.5 * (1-resK)})`);
  g.addColorStop(1, 'rgba(180,220,255,0)');
  c.fillStyle = g;
  c.beginPath();
  c.ellipse(0, 0, r, r * 0.35, 0, 0, Math.PI*2);
  c.fill();
  c.restore();
}

function _easeIn3(t){ return t * t * t; }

// 旧的程序化绘制保留为 fallback（不再使用，但留着以防）
function _renderGiantSwordBody(c, L, W, alpha){
  // deprecated: 已被 swords.png 贴图替代
  c.save();
  // ── 1. 外层光晕（lighter）──
  c.globalCompositeOperation = 'lighter';
  const haloGrd = c.createRadialGradient(0, -L*0.4, 0, 0, -L*0.4, L*0.9);
  haloGrd.addColorStop(0,   `rgba(255,255,255,${0.55 * alpha})`);
  haloGrd.addColorStop(0.3, `rgba(180,220,255,${0.35 * alpha})`);
  haloGrd.addColorStop(1,   'rgba(60,120,200,0)');
  c.fillStyle = haloGrd;
  c.beginPath();
  c.ellipse(0, -L*0.4, W*2.5, L*0.7, 0, 0, Math.PI*2);
  c.fill();

  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = alpha;

  // ── 2. 主刃身（菱形：尖端在 0,0，根部在 0,-L*0.8）──
  const bladeTop = -L*0.78;
  // 阴影底（暗银）
  c.fillStyle = '#3a4258';
  c.beginPath();
  c.moveTo(0, 0);                       // 尖
  c.lineTo( W*0.55, -L*0.10);
  c.lineTo( W*0.50, bladeTop);
  c.lineTo(-W*0.50, bladeTop);
  c.lineTo(-W*0.55, -L*0.10);
  c.closePath();
  c.fill();
  // 高光面（左半亮）
  const lit = c.createLinearGradient(-W*0.5, 0, W*0.5, 0);
  lit.addColorStop(0,    '#ffffff');
  lit.addColorStop(0.45, '#dfeaff');
  lit.addColorStop(0.55, '#a8c0e6');
  lit.addColorStop(1,    '#5a6c92');
  c.fillStyle = lit;
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo( W*0.48, -L*0.10);
  c.lineTo( W*0.43, bladeTop);
  c.lineTo(-W*0.43, bladeTop);
  c.lineTo(-W*0.48, -L*0.10);
  c.closePath();
  c.fill();

  // ── 3. 中线凹槽（深色细沟）──
  c.strokeStyle = 'rgba(20,28,50,0.7)';
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(0, -L*0.05);
  c.lineTo(0, bladeTop + 4);
  c.stroke();
  // 凹槽两侧高光线
  c.strokeStyle = `rgba(255,255,255,${0.8 * alpha})`;
  c.lineWidth = 0.6;
  c.beginPath();
  c.moveTo(-2, -L*0.05); c.lineTo(-2, bladeTop + 4);
  c.moveTo( 2, -L*0.05); c.lineTo( 2, bladeTop + 4);
  c.stroke();

  // ── 4. 刃身纹路：3 个对称符文菱形 ──
  c.fillStyle = `rgba(120,180,255,${0.55 * alpha})`;
  for(let i=0; i<3; i++){
    const yy = -L*0.20 - i * L*0.18;
    c.beginPath();
    c.moveTo(0, yy - 3);
    c.lineTo(W*0.18, yy);
    c.lineTo(0, yy + 3);
    c.lineTo(-W*0.18, yy);
    c.closePath();
    c.fill();
  }

  // ── 5. 护手翼形（横向展开 → 鸟翼造型）──
  const guardY = bladeTop;
  const guardW = W * 2.0;
  // 翼基础
  c.fillStyle = '#222a40';
  c.beginPath();
  c.moveTo(-W*0.55, guardY);
  c.lineTo(-guardW, guardY - W*0.15);
  c.lineTo(-guardW*0.9, guardY + W*0.15);
  c.lineTo(-W*0.55, guardY + W*0.12);
  c.closePath();
  c.fill();
  c.beginPath();
  c.moveTo( W*0.55, guardY);
  c.lineTo( guardW, guardY - W*0.15);
  c.lineTo( guardW*0.9, guardY + W*0.15);
  c.lineTo( W*0.55, guardY + W*0.12);
  c.closePath();
  c.fill();
  // 翼上金线 + 蓝宝石
  c.strokeStyle = '#d8b66a';
  c.lineWidth = 1.4;
  c.beginPath();
  c.moveTo(-W*0.55, guardY + 1); c.lineTo(-guardW*0.95, guardY - W*0.05);
  c.moveTo( W*0.55, guardY + 1); c.lineTo( guardW*0.95, guardY - W*0.05);
  c.stroke();
  // 护手中心宝石
  const gem = c.createRadialGradient(0, guardY, 0, 0, guardY, W*0.55);
  gem.addColorStop(0, '#ffffff');
  gem.addColorStop(0.4, '#88ccff');
  gem.addColorStop(1, '#1a4080');
  c.fillStyle = gem;
  c.beginPath();
  c.arc(0, guardY, W*0.45, 0, Math.PI*2);
  c.fill();
  c.strokeStyle = '#d8b66a';
  c.lineWidth = 1.2;
  c.beginPath();
  c.arc(0, guardY, W*0.45, 0, Math.PI*2);
  c.stroke();
  // 宝石高光
  c.fillStyle = `rgba(255,255,255,${0.85 * alpha})`;
  c.beginPath();
  c.arc(-W*0.13, guardY - W*0.13, W*0.08, 0, Math.PI*2);
  c.fill();

  // ── 6. 剑柄（缠绕样式）──
  const hiltLen = L * 0.18;
  const hiltY1 = guardY;
  const hiltY2 = guardY - hiltLen;
  c.fillStyle = '#3a2a18';
  c.fillRect(-W*0.12, hiltY2, W*0.24, hiltLen);
  // 缠绕（横向斜线）
  c.strokeStyle = '#6b4a26';
  c.lineWidth = 1;
  for(let i=0; i<6; i++){
    const yy = hiltY2 + (i + 0.5) / 6 * hiltLen;
    c.beginPath();
    c.moveTo(-W*0.13, yy - 1.5);
    c.lineTo( W*0.13, yy + 1.5);
    c.stroke();
  }
  c.strokeStyle = '#9a7240';
  for(let i=0; i<5; i++){
    const yy = hiltY2 + (i + 1) / 6 * hiltLen;
    c.beginPath();
    c.moveTo(-W*0.13, yy + 1.5);
    c.lineTo( W*0.13, yy - 1.5);
    c.stroke();
  }

  // ── 7. 圆球柄底（带十字光）──
  const pommelR = W * 0.35;
  const pommelGrd = c.createRadialGradient(-pommelR*0.3, hiltY2 - pommelR*0.3, 0,
                                            0, hiltY2, pommelR);
  pommelGrd.addColorStop(0, '#ffffff');
  pommelGrd.addColorStop(0.5, '#d8b66a');
  pommelGrd.addColorStop(1, '#5a3b1c');
  c.fillStyle = pommelGrd;
  c.beginPath();
  c.arc(0, hiltY2, pommelR, 0, Math.PI*2);
  c.fill();
  // 十字纹
  c.strokeStyle = '#3a2a18';
  c.lineWidth = 0.8;
  c.beginPath();
  c.moveTo(-pommelR*0.7, hiltY2); c.lineTo(pommelR*0.7, hiltY2);
  c.moveTo(0, hiltY2 - pommelR*0.7); c.lineTo(0, hiltY2 + pommelR*0.7);
  c.stroke();

  // ── 8. 尖端高光（lighter）──
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = alpha;
  const tipGlow = c.createRadialGradient(0, -2, 0, 0, -2, W*0.8);
  tipGlow.addColorStop(0, 'rgba(255,255,255,0.9)');
  tipGlow.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = tipGlow;
  c.beginPath();
  c.arc(0, -2, W*0.8, 0, Math.PI*2);
  c.fill();

  c.restore();
}

// ── 火柱（柱状向上喷发，泪滴形），用于 fxEruption 多阶段效果 ──
function _drawFxFirePillar(c, sx, sy, s, k){
  c.translate(sx, sy);
  c.globalCompositeOperation = 'lighter';
  const big  = !!s.big;
  const baseH = s.h || 70;
  const t = 1 - k;
  let visH = t < 0.3 ? baseH*(t/0.3) : baseH*(1-(t-0.3)/0.7*0.25);
  const w = big ? 17 : 11;

  // ── 外焰（贝塞尔泪滴）──
  c.globalAlpha = Math.min(1, k*1.4);
  const grd = c.createLinearGradient(0, 0, 0, -visH);
  grd.addColorStop(0,    `rgba(255,120,20,${k*0.9})`);
  grd.addColorStop(0.4,  `rgba(180,20,10,${k*0.65})`);
  grd.addColorStop(1,    'rgba(80,0,0,0)');
  c.fillStyle = grd;
  c.beginPath();
  c.moveTo(-w*0.7, 4);
  c.bezierCurveTo(-w*1.2, -visH*0.35, -w*0.5, -visH*0.65, 0, -visH);
  c.bezierCurveTo(w*0.5, -visH*0.65, w*1.2, -visH*0.35, w*0.7, 4);
  c.closePath(); c.fill();

  // ── 内核（贝塞尔窄焰，替换 ellipse）──
  const iw = w * 0.45;
  const innerGrd = c.createLinearGradient(0, 0, 0, -visH*0.8);
  innerGrd.addColorStop(0,   `rgba(255,240,180,${k*0.95})`);
  innerGrd.addColorStop(0.45,`rgba(255,140,30,${k*0.7})`);
  innerGrd.addColorStop(1,   'rgba(200,20,0,0)');
  c.fillStyle = innerGrd;
  c.beginPath();
  c.moveTo(-iw, 2);
  c.bezierCurveTo(-iw*1.2, -visH*0.3, -iw*0.3, -visH*0.65, 0, -visH*0.82);
  c.bezierCurveTo(iw*0.3, -visH*0.65, iw*1.2, -visH*0.3, iw, 2);
  c.closePath(); c.fill();

  // ── 顶端锯齿火舌（像素方块替代圆）──
  if(visH > 10){
    c.fillStyle = `rgba(255,220,100,${k*0.95})`;
    for(let i=-1; i<=1; i++){
      const px2 = i*(w*0.28), py2 = -visH + Math.abs(i)*visH*0.06;
      const ps  = w * (0.22 - Math.abs(i)*0.04);
      c.fillRect(px2-ps, py2-ps*1.4, ps*2, ps*2.8);
    }
    if(Math.random() < 0.45){
      addParticle(s.x, s.y - visH, {
        n:1, c: Math.random()<0.5?'#FFD060':'#FF6020',
        spd:28+Math.random()*28, r:1.5, life:0.4,
        spread:Math.PI*0.5, angle:-Math.PI*0.5, gravity:-25
      });
    }
  }

  // ── 基座：像素方块散射（替代 ellipse）──
  c.globalAlpha = k * 0.7;
  const steps = big ? 5 : 4;
  for(let i = 0; i < steps; i++){
    const a  = (i/steps)*Math.PI*2;
    const br = w * 1.8;
    const bpx = Math.cos(a)*br, bpy = Math.sin(a)*br*0.32;
    const bs  = 3 + Math.random()*2;
    c.fillStyle = i%2 ? `rgba(255,100,20,${k*0.55})` : `rgba(200,40,10,${k*0.4})`;
    c.fillRect(bpx-bs, bpy-bs*0.5, bs*2, bs);
  }
  // 中心热点（两个矩形叠）
  c.globalAlpha = k * 0.8;
  c.fillStyle = `rgba(255,200,100,${k*0.6})`;
  c.fillRect(-w*0.35, -3, w*0.7, 5);
  c.fillRect(-w*0.2, -6, w*0.4, 4);
}

// ── 阴影裂口 shadowrip ──
// 单条纵向锯齿裂口（abyss 风格 5 层但低透）+ 6-8 朵血雾飘云
// 整体 alphaMul 0.55，匹配分身的实体度
// mode='in' 云朝中心收 / mode='out' 云朝外散
function _drawFxShadowRip(c, sx, sy, s, k){
  c.translate(sx, sy);

  // 缓存路径与云块位置
  if(!s._pts){
    const N = 12;
    const pts = [];
    const len = s.len || 60;
    for(let i=0;i<=N;i++){
      const t = i/N;
      // 纵向（Y 轴）裂口，配合 ISO Y 压缩，写实感更弱
      const y = (t - 0.5) * len * 0.85;
      const taper = 1 - Math.pow(Math.abs(t-0.5)*2, 1.5);
      const x = (Math.random()-0.5) * 9 * taper + Math.sin(t*5)*1.6;
      pts.push({x, y});
    }
    s._pts = pts;
    // 6-8 朵血雾云的初始位置 / 半径 / 相位
    const cN = 7;
    s._clouds = [];
    for(let i=0;i<cN;i++){
      const a = Math.random() * Math.PI*2;
      const r0 = 14 + Math.random()*22;
      s._clouds.push({
        bx: Math.cos(a)*r0,
        by: Math.sin(a)*r0 * 0.7,
        rad: 11 + Math.random()*9,
        phase: Math.random()*Math.PI*2,
        seed: Math.random(),
      });
    }
  }

  const alphaMul = s.alphaMul || 0.55;     // 整体透明度
  const mode = s.mode || 'in';              // 'in' 收 / 'out' 散

  // 主裂口（abyss 5 层，alphaMul 降透）
  _strokeAbyssPath(c, s._pts, k, {
    widthMul: 0.55,
    palette: 'red',
    sparks: false,
    burst: false,
    alphaMul: alphaMul
  });

  // 周围血雾飘云
  c.save();
  c.globalCompositeOperation = 'lighter';
  for(const cl of s._clouds){
    // 'in' 模式：从外围向中心移动；'out' 模式：从中心向外
    const flow = (mode === 'in') ? (1 - s.age/s.life) : (s.age/s.life);
    const moveScale = (mode === 'in') ? 1.2 : 0.0;
    const scatterScale = (mode === 'out') ? (1 + (1-k)*0.6) : 1;
    const wobble = Math.sin(s.age*4 + cl.phase) * 2.5;
    const cx = cl.bx * (mode==='in' ? flow*moveScale + 1 : scatterScale) + wobble;
    const cy = cl.by * (mode==='in' ? flow*moveScale + 1 : scatterScale)
             - s.age * 8;     // 缓慢上飘
    const rad = cl.rad * (0.7 + (1-k)*0.3);
    const grd = c.createRadialGradient(cx, cy, 0, cx, cy, rad);
    grd.addColorStop(0,   `rgba(180,30,30,${0.42 * k * alphaMul})`);
    grd.addColorStop(0.45,`rgba(100,0,0,${0.25 * k * alphaMul})`);
    grd.addColorStop(1,   'rgba(40,0,0,0)');
    c.fillStyle = grd;
    c.beginPath();
    c.arc(cx, cy, rad, 0, Math.PI*2);
    c.fill();
  }
  c.restore();

  // 中央暗陷（极淡 multiply，无锐边）
  c.save();
  c.globalAlpha = k * 0.45 * alphaMul;
  c.globalCompositeOperation = 'multiply';
  const dr = (s.len || 60) * 0.4 * (0.7 + (1-k)*0.3);
  const dGrd = c.createRadialGradient(0, 0, 0, 0, 0, dr);
  dGrd.addColorStop(0,   'rgba(20,0,5,0.9)');
  dGrd.addColorStop(0.55,'rgba(50,0,10,0.5)');
  dGrd.addColorStop(1,   'rgba(20,0,5,0)');
  c.fillStyle = dGrd;
  c.beginPath();
  c.ellipse(0, 0, dr, dr * 0.7, 0, 0, Math.PI*2);
  c.fill();
  c.restore();
}

// ── 绘制 ──
function drawLucia(){
  if(!lucia || !_luciaLoaded) return;
  const sx = Math.floor(lucia.x - ox());
  const sy = Math.floor((lucia.y - oy()) * ISO_Y_SCALE);

  const phaseCfg = LUCIA_PHASES[lucia.phase];

  // 阶段3 时 hidle/hwalk 替代 idle/walk
  let animKey = 'idle';
  let animDur = LUCIA_FRAME_COUNT.idle / 24;   // 默认 24fps
  let animT01;
  if(lucia.state==='dead'){
    animKey = 'death';
    animDur = LUCIA_FRAME_COUNT.death / 24;
    animT01 = Math.min(1, lucia.animT / animDur);
  } else if(lucia.state==='entrance'){
    if(lucia.entrancePhase === 'atk4c'){
      animKey = 'atk4c';
      animT01 = Math.min(0.99, lucia.entranceT / 1.0);
    } else {
      animKey = 'cheer';
      animT01 = Math.min(0.99, lucia.entranceT / 1.0);
    }
  } else if(lucia.state==='fall'){
    animKey = 'fall';
    animDur = 1.6;
    animT01 = Math.min(0.99, lucia.animT / animDur);
  } else if(lucia.state==='cheer'){
    animKey = 'cheer';
    animDur = LUCIA_FRAME_COUNT.cheer / 30;
    animT01 = Math.min(0.99, lucia.animT / animDur);
  } else if(lucia.state==='hurt'){
    animKey = 'hurt';
    animDur = 0.35;
    animT01 = Math.min(0.99, lucia.animT / animDur);
  } else if(lucia.state==='attack'){
    const mv = LUCIA_MOVES[lucia.attackKey];
    animKey = mv.anim;
    animT01 = Math.min(0.99, lucia.atkPhaseT);
  } else if(lucia.state==='walk'){
    animKey = (lucia.phase===3 && LUCIA_FRAME_COUNT.hwalk) ? 'hwalk' : 'walk';
    animDur = LUCIA_FRAME_COUNT[animKey] / 18;
    animT01 = (lucia.animT % animDur) / animDur;
  } else { // idle
    animKey = (lucia.phase===3 && LUCIA_FRAME_COUNT.hidle) ? 'hidle' : 'idle';
    animDur = LUCIA_FRAME_COUNT[animKey] / 22;
    animT01 = (lucia.animT % animDur) / animDur;
  }

  const img = _luciaFrame(animKey, animT01);
  if(!img) return;

  // ── 动画交叉融合：动作切换时混合上一帧 → 这帧（消除硬切感）──
  if(!lucia._tickT) lucia._tickT = 0;
  if(lucia._lastAnimKey && animKey !== lucia._lastAnimKey){
    lucia._blend = {
      key: lucia._lastAnimKey,
      t01: (lucia._lastAnimT01 != null ? lucia._lastAnimT01 : 0),
      startT: lucia._tickT,
      dur: 0.18,
    };
  }
  lucia._lastAnimKey = animKey;
  lucia._lastAnimT01 = animT01;
  let blendK = 1;
  if(lucia._blend){
    blendK = Math.min(1, (lucia._tickT - lucia._blend.startT) / lucia._blend.dur);
    if(blendK >= 1) lucia._blend = null;
  }
  const fromImg = (lucia._blend && blendK < 1) ? _luciaFrame(lucia._blend.key, lucia._blend.t01) : null;

  // P3 移动残影（在本体之前画 → 显示在身后）
  _luciaDrawAfterimages(ctx);

  // 渲染尺寸（缩小 + 下移：让 Boss 视觉重心比玩家略低）
  const dh = (typeof BOSS_H!=='undefined'?BOSS_H:88) * 1.05;  // 1.4 → 1.05 缩小
  const dw = Math.round((img.width||1) / (img.height||1) * dh);
  const yOffset = 18;   // 整体下移像素，让脚底比玩家更靠下
  // atk3 跳起：sin 弧线（前 70% 升空 → 落地）
  let jumpY = 0;
  if(lucia.state === 'attack' && lucia.attackKey === 'atk3'){
    const t = lucia.atkPhaseT;
    if(t < 0.75){
      jumpY = -32 * Math.sin(t/0.75 * Math.PI);
    }
  }
  const dx = sx - dw/2;
  const dy = sy - dh + yOffset + jumpY;

  // 通用绘制函数（受 facing + tremor 控制）
  const drawSprite = (theImg, alpha) => {
    if(!theImg || alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    const tx = (lucia._tremorX || 0), ty = (lucia._tremorY || 0);
    if(lucia.facing < 0){
      ctx.translate(dx + dw + tx, dy + ty);
      ctx.scale(-1, 1);
      ctx.drawImage(theImg, 0, 0, dw, dh);
    } else {
      ctx.drawImage(theImg, dx + tx, dy + ty, dw, dh);
    }
    ctx.restore();
  };

  // 基础透明度（受击微淡）
  const baseAlpha = (lucia.hurtTimer > 0) ? 0.85 : 1.0;
  // 缓动 smoothstep
  const easedK = blendK*blendK*(3 - 2*blendK);
  if(fromImg){
    drawSprite(fromImg, (1 - easedK) * baseAlpha);
    drawSprite(img,     easedK * baseAlpha);
  } else {
    drawSprite(img, baseAlpha);
  }

  // ghost trail 叠加（阶段2/3 有）
  if(phaseCfg.ghostTrail){
    const ghostKey = animKey + '_ghost';
    const gimg = _luciaFrame(ghostKey, animT01);
    if(gimg){
      ctx.save();
      ctx.globalAlpha = 0.45 + 0.2 * Math.sin(lucia.animT*8);
      ctx.globalCompositeOperation = 'screen';
      const offX = lucia.facing * 6;
      if(lucia.facing < 0){
        ctx.translate(dx + dw - offX, dy);
        ctx.scale(-1, 1);
        ctx.drawImage(gimg, 0, 0, dw, dh);
      } else {
        ctx.drawImage(gimg, dx + offX, dy, dw, dh);
      }
      ctx.restore();
    }
  }

  // 受击红色叠层
  if(lucia.hurtTimer > 0){
    ctx.save();
    ctx.globalAlpha = (lucia.hurtTimer / 0.35) * 0.5;
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = '#FF4040';
    if(lucia.facing < 0){
      ctx.translate(dx + dw, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, dw, dh);
    } else {
      ctx.drawImage(img, dx, dy, dw, dh);
    }
    ctx.restore();
  }

  // P3 分身（在本体之后画 → 同层但红色调区分）
  _luciaDrawClone(ctx);
  // P3 冲刺分身
  _luciaDrawChargeGhost(ctx);
  // P3 大招四方分身
  _luciaDrawRingClones(ctx);
  // 血色追踪弹 + 血锁
  _luciaDrawBloodSeeks(ctx);
  _luciaDrawBloodChains(ctx);

  // 火柱（pillar_fire）— 在最上层确保可见
  _luciaDrawPillars(ctx);

  // 多样化 FX 形状（月牙/速度线/十字/利刺等）
  // _luciaDrawFxShapes 由主循环统一调用（玩家+Lucia 共享池）

  // 飞行剑气 → 锐利血剑
  for(const b of (lucia.blades||[])){
    const bsx = b.x - ox();
    const bsy = (b.y - oy()) * ISO_Y_SCALE;
    const ang = Math.atan2(b.vy, b.vx);
    const fade = Math.min(1, b.age*5) * Math.min(1, (b.life-b.age)*4);

    // 拖尾历史（柔光残影）
    if(!b._trail) b._trail = [];
    b._trail.push({x:bsx, y:bsy, ang:ang});
    if(b._trail.length > 7) b._trail.shift();

    // 拖尾血雾
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for(let i=0;i<b._trail.length-1;i++){
      const t = b._trail[i];
      const k = (i+1)/b._trail.length;
      const grd = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, 14*k);
      grd.addColorStop(0,   `rgba(255,40,40,${0.35*k*fade})`);
      grd.addColorStop(0.5, `rgba(160,0,0,${0.20*k*fade})`);
      grd.addColorStop(1,   'rgba(80,0,0,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 14*k, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.translate(bsx, bsy);
    ctx.rotate(ang);
    ctx.globalAlpha = fade;

    // 剑身长度
    const L = 44;
    const W = 5;

    // 黑色刃身阴影底（让血色更显鲜艳）
    ctx.fillStyle = 'rgba(20,0,0,0.7)';
    ctx.beginPath();
    ctx.moveTo(-L*0.5, 0);          // 剑柄根
    ctx.lineTo(-L*0.35, -W*0.6);
    ctx.lineTo( L*0.25, -W*0.9);
    ctx.lineTo( L*0.5, 0);           // 锐利尖端
    ctx.lineTo( L*0.25,  W*0.9);
    ctx.lineTo(-L*0.35,  W*0.6);
    ctx.closePath();
    ctx.fill();

    // 血红主刃（梯度 → 深红到鲜血红）
    const blade = ctx.createLinearGradient(-L*0.5, 0, L*0.5, 0);
    blade.addColorStop(0,   'rgba(60,0,0,0.95)');
    blade.addColorStop(0.4, 'rgba(180,10,10,1)');
    blade.addColorStop(0.85,'rgba(255,40,30,1)');
    blade.addColorStop(1,   'rgba(255,180,150,1)');
    ctx.fillStyle = blade;
    ctx.beginPath();
    ctx.moveTo(-L*0.42, 0);
    ctx.lineTo(-L*0.28, -W*0.45);
    ctx.lineTo( L*0.22, -W*0.7);
    ctx.lineTo( L*0.48, 0);
    ctx.lineTo( L*0.22,  W*0.7);
    ctx.lineTo(-L*0.28,  W*0.45);
    ctx.closePath();
    ctx.fill();

    // 刃中线高光（白炽细线）
    ctx.strokeStyle = 'rgba(255,220,200,0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-L*0.35, 0);
    ctx.lineTo( L*0.46, 0);
    ctx.stroke();

    // 剑柄（深色把柄）
    ctx.fillStyle = '#1a0808';
    ctx.fillRect(-L*0.5-2, -2, 5, 4);
    ctx.fillStyle = '#3a1818';
    ctx.fillRect(-L*0.45, -3, 2, 6);

    // 剑尖光晕
    ctx.globalCompositeOperation = 'lighter';
    const tipGrd = ctx.createRadialGradient(L*0.5, 0, 0, L*0.5, 0, 10);
    tipGrd.addColorStop(0, `rgba(255,220,200,${0.85*fade})`);
    tipGrd.addColorStop(0.5,`rgba(255,40,20,${0.5*fade})`);
    tipGrd.addColorStop(1, 'rgba(120,0,0,0)');
    ctx.fillStyle = tipGrd;
    ctx.beginPath();
    ctx.arc(L*0.5, 0, 10, 0, Math.PI*2);
    ctx.fill();

    ctx.restore();

    // 飞行中滴血粒子
    if(Math.random() < 0.35){
      addParticle(b.x, b.y, {n:1, c: Math.random()<0.5?'#660000':'#990000',
        spd:15+Math.random()*15, r:1.6, life:0.4, spread:Math.PI*2, gravity:80});
    }
  }

  // 格挡金色闪光 overlay
  if(lucia._parryFlash > 0){
    const ctx = window.ctx || (typeof gCtx !== 'undefined' ? gCtx : null);
    if(ctx){
      const flashK = lucia._parryFlash / 0.40;
      const sx2 = Math.floor(lucia.x - ox());
      const sy2 = Math.floor((lucia.y - oy()) * ISO_Y_SCALE);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = flashK * 0.5;
      ctx.fillStyle = '#FFD060';
      ctx.beginPath();
      ctx.arc(sx2, sy2 - 60, 55, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }
  }
}

// ── HUD（血条 + 阶段标识）──
function drawLuciaHUD(){
  if(!lucia || !_luciaLoaded) return;
  const phaseCfg = LUCIA_PHASES[lucia.phase];

  const margin = 30;
  const barW = CW - margin*2;
  const barH = 14;
  const x = margin, y = 18;
  // 背景
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(x-2, y-2, barW+4, barH+4);
  // 已扣血段（白色）
  ctx.fillStyle = '#3a1818';
  ctx.fillRect(x, y, barW, barH);
  // 当前血量
  const pct = Math.max(0, lucia.hp / lucia.maxHp);
  const grad = ctx.createLinearGradient(x, y, x, y+barH);
  grad.addColorStop(0, '#ff5050');
  grad.addColorStop(0.5, '#cc1010');
  grad.addColorStop(1, '#660000');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, barW * pct, barH);
  // 阶段分割线
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + barW * 0.6, y); ctx.lineTo(x + barW * 0.6, y + barH);
  ctx.moveTo(x + barW * 0.3, y); ctx.lineTo(x + barW * 0.3, y + barH);
  ctx.stroke();

  // 名称
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`LUCILLA   ·   ${phaseCfg.name}   ·   ${Math.ceil(lucia.hp)}/${lucia.maxHp}`, CW/2, y + barH + 16);
  ctx.textAlign = 'left';
}

// ── 工具：玩家攻击 Lucia 时调用 ──
//   外部 hitBoss 兼容：自动 dispatch 到 luciaTakeDamage
function _hookHitLucia(){
  // 提供给主程序的 hit 函数（保持 hitBoss(d, kx, ky) 接口）
  window.hitBossLucia = function(dmg, kx, ky){
    if(!lucia) return;
    luciaTakeDamage(dmg, kx, ky);
  };
}
_hookHitLucia();

// ═══════════════════════════════════════════════════════════════
// 扩展模块：火柱 / 残影 / 分身（P3）
// ═══════════════════════════════════════════════════════════════

// ── LUCIA_FX 追加：火柱施法瞬间视觉 ──
LUCIA_FX.fxPillarCast = function(b){
  const cx = b.x, cy = b.y - 30;
  // 周身环形血色粒子聚拢效果
  for(let i=0;i<22;i++){
    const a = i/22 * Math.PI*2;
    const r = 28;
    addParticle(cx + Math.cos(a)*r, cy + Math.sin(a)*r*0.6,
      {n:1, c: i%3===0?'#FFFFFF':'#CC2020', spd:60+Math.random()*40,
       r:2, life:0.35, spread:0.05, angle: a + Math.PI, gravity:0});
  }
  shockwaves.push({x:cx, y:cy, r:2, maxR:40, life:0.25, age:0, c:'#CC2020'});
  camShake(0.15, 5);
};

// ── LUCIA_FX 追加：环召唤大爆发 ──
LUCIA_FX.fxRingSummon = function(b){
  const cx = b.x, cy = b.y - 30;
  // 大范围血色环爆发 + 烟雾
  for(let i=0;i<70;i++){
    const a = i/70 * Math.PI*2;
    addParticle(cx + Math.cos(a)*32, cy + Math.sin(a)*32*0.6,
      {n:1, c: i%3===0?'#FFFFFF':(i%2?'#990000':'#CC2020'),
       spd:160+Math.random()*120, r:2.6, life:0.75, spread:0.04, angle:a, gravity:10});
  }
  shockwaves.push({x:cx, y:cy, r:5, maxR:160, life:0.65, age:0, c:'#CC2020'});
  shockwaves.push({x:cx, y:cy, r:3, maxR:100, life:0.55, age:0, c:'#FFFFFF'});
  shockwaves.push({x:cx, y:cy, r:2, maxR:60,  life:0.45, age:0, c:'#FFFFFF'});
  camShake(0.5, 14);
  triggerHitStop(0.10);
};

// ────────────────────────────────────────────────────────────────
// 工具：染色离屏缓冲（避免 multiply+fillRect 矩形溢色）
// ────────────────────────────────────────────────────────────────
let _luciaCloneBuf = null;
let _luciaAfterimgBuf = null;

function _luciaTintBuf(buf, dw, dh, img, facing, tintColor, tintAlpha, flashAlpha){
  if(dw <= 0 || dh <= 0) return;
  if(buf.width !== dw || buf.height !== dh){
    buf.width = dw; buf.height = dh;
  }
  const bc = buf.getContext('2d');
  bc.setTransform(1,0,0,1,0,0);
  bc.globalCompositeOperation = 'source-over';
  bc.globalAlpha = 1;
  bc.clearRect(0, 0, dw, dh);
  // 画精灵
  if(facing < 0){
    bc.save();
    bc.translate(dw, 0);
    bc.scale(-1, 1);
    bc.drawImage(img, 0, 0, dw, dh);
    bc.restore();
  } else {
    bc.drawImage(img, 0, 0, dw, dh);
  }
  // 红调：仅染不透明像素
  bc.globalCompositeOperation = 'source-atop';
  bc.globalAlpha = tintAlpha;
  bc.fillStyle = tintColor;
  bc.fillRect(0, 0, dw, dh);
  // 白闪（同样仅在精灵上）
  if(flashAlpha > 0){
    bc.globalAlpha = flashAlpha;
    bc.fillStyle = '#FFFFFF';
    bc.fillRect(0, 0, dw, dh);
  }
  bc.globalAlpha = 1;
  bc.globalCompositeOperation = 'source-over';
}

// ────────────────────────────────────────────────────────────────
// 1) 火柱（pillar_fire）
// ────────────────────────────────────────────────────────────────

function _luciaSpawnPillars(){
  if(!lucia.pillars) lucia.pillars = [];
  const px = player.x, py = player.y;
  // 3 根：玩家位 + 左右偏移；延迟分散
  lucia.pillars.push({x:px,     y:py,     t:0, delay:0.40, dur:0.6, fired:false, dmg:20});
  lucia.pillars.push({x:px+55,  y:py+12,  t:0, delay:0.65, dur:0.6, fired:false, dmg:20});
  lucia.pillars.push({x:px-55,  y:py-12,  t:0, delay:0.90, dur:0.6, fired:false, dmg:20});
}

function _luciaUpdatePillars(dt){
  if(!lucia.pillars || lucia.pillars.length === 0) return;
  for(let i=lucia.pillars.length-1; i>=0; i--){
    const p = lucia.pillars[i];
    p.t += dt;
    if(!p.fired && p.t >= p.delay){
      p.fired = true;
      // 命中
      const d = Math.hypot(player.x - p.x, player.y - p.y);
      if(d <= 36){
        const blocked = (typeof defendBlock==='function') && defendBlock(p.x, p.y);
        if(!blocked && playerHurtTimer <= 0){
          hurtPlayer(p.dmg, player.x - p.x, player.y - p.y, 0.5, 0.3);
        }
      }
      // 喷发粒子（向上）
      for(let k=0;k<22;k++){
        const a = -Math.PI/2 + (Math.random()-0.5)*1.4;
        addParticle(p.x, p.y, {
          n:1, c: k%3===0?'#FFFFFF':(k%2?'#FFC050':'#CC2020'),
          spd:140+Math.random()*120, r:2+Math.random(),
          life:0.55, spread:0.05, angle:a, gravity:80
        });
      }
      shockwaves.push({x:p.x, y:p.y, r:3, maxR:75, life:0.45, age:0, c:'#CC2020'});
      shockwaves.push({x:p.x, y:p.y, r:2, maxR:40, life:0.30, age:0, c:'#FFFFFF'});
      camShake(0.22, 7);
    }
    if(p.t > p.delay + p.dur + 0.1) lucia.pillars.splice(i, 1);
  }
}

function _luciaDrawPillars(c){
  if(!lucia.pillars || lucia.pillars.length === 0) return;
  for(const p of lucia.pillars){
    const sx = p.x - ox();
    const sy = (p.y - oy()) * ISO_Y_SCALE;
    c.save();
    if(!p.fired){
      // telegraph：渐变热浪（无硬边）
      const k = Math.min(1, p.t / p.delay);
      c.globalCompositeOperation = 'lighter';
      // 主热浪
      for(let layer=0; layer<3; layer++){
        const s = 1 - layer*0.25;
        const grd = c.createRadialGradient(sx, sy, 0, sx, sy, 40*s*k);
        grd.addColorStop(0,   `rgba(204,32,32,0)`);
        grd.addColorStop(0.6, `rgba(204,32,32,${0.15*k})`);
        grd.addColorStop(0.9, `rgba(255,80,30,${0.35*k})`);
        grd.addColorStop(1,   `rgba(204,32,32,0)`);
        c.fillStyle = grd;
        c.beginPath();
        c.ellipse(sx, sy, 40*s*k, 40*s*k*ISO_Y_SCALE, 0, 0, 6.283);
        c.fill();
      }
      // 警示余烬绕圈散布（替代硬边圆）
      for(let i=0;i<10;i++){
        const a = i/10*6.283 + p.t*2.5;
        const rr = 34 * (0.85 + Math.sin(p.t*7+i)*0.08);
        const xx = sx + Math.cos(a)*rr;
        const yy = sy + Math.sin(a)*rr*ISO_Y_SCALE;
        const flick = 0.5 + 0.5*Math.sin(p.t*9+i*1.7);
        const rad = 4 + flick*2;
        const g = c.createRadialGradient(xx, yy, 0, xx, yy, rad);
        g.addColorStop(0, `rgba(255,200,80,${0.7*k*flick})`);
        g.addColorStop(0.5, `rgba(204,32,32,${0.35*k*flick})`);
        g.addColorStop(1, 'rgba(204,32,32,0)');
        c.fillStyle = g;
        c.beginPath(); c.arc(xx, yy, rad, 0, 6.283); c.fill();
      }
      c.globalCompositeOperation = 'source-over';
    } else {
      const age = p.t - p.delay;
      const eased = 1 - Math.pow(1 - Math.min(1, age/0.25), 3);
      const fade = Math.max(0, 1 - Math.max(0, (age - p.dur*0.4)/(p.dur*0.6)));
      const h = 100 * eased * (0.5 + fade*0.5);

      c.globalCompositeOperation = 'lighter';
      // 喷柱：纵向 blob 串接
      const N = 8;
      for(let i=0;i<N;i++){
        const t = i/(N-1);
        const yy = sy - h * t;
        const xx = sx + Math.sin(age*7 + i*0.7)*5*t;
        const r = (12 - i*0.8) * (1 + Math.sin(age*9+i)*0.1) * fade;
        // 外层（暖红）
        const gO = c.createRadialGradient(xx, yy, 0, xx, yy, r*2);
        gO.addColorStop(0,   `rgba(255,140,60,${0.8*fade})`);
        gO.addColorStop(0.5, `rgba(204,32,32,${0.45*fade})`);
        gO.addColorStop(1,   'rgba(204,32,32,0)');
        c.fillStyle = gO;
        c.beginPath(); c.arc(xx, yy, r*2, 0, 6.283); c.fill();
        // 内核白炽（仅前段）
        if(i < 4){
          const gI = c.createRadialGradient(xx, yy, 0, xx, yy, r*0.7);
          gI.addColorStop(0, `rgba(255,255,255,${0.85*fade})`);
          gI.addColorStop(1, 'rgba(255,80,40,0)');
          c.fillStyle = gI;
          c.beginPath(); c.arc(xx, yy, r*0.7, 0, 6.283); c.fill();
        }
      }
      // 顶端散粒
      for(let i=0;i<4;i++){
        const px = sx + Math.cos(i*1.6 + age*4)*8;
        const py = sy - h - i*5;
        const r = 4*fade;
        const g = c.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, `rgba(255,200,80,${0.8*fade})`);
        g.addColorStop(1, 'rgba(255,40,10,0)');
        c.fillStyle = g;
        c.beginPath(); c.arc(px, py, r, 0, 6.283); c.fill();
      }
      // 底部基座
      const bg = c.createRadialGradient(sx, sy, 0, sx, sy, 32);
      bg.addColorStop(0, `rgba(255,200,150,${0.7*fade})`);
      bg.addColorStop(1, 'rgba(204,32,32,0)');
      c.fillStyle = bg;
      c.beginPath(); c.ellipse(sx, sy, 32, 9, 0, 0, 6.283); c.fill();
      c.globalCompositeOperation = 'source-over';
      // 焦痕
      c.fillStyle = `rgba(20,8,4,${0.4*fade})`;
      c.beginPath(); c.ellipse(sx, sy+2, 26, 7, 0, 0, 6.283); c.fill();
    }
    c.restore();
  }
}

// ────────────────────────────────────────────────────────────────
// 2) P3 移动残影
// ────────────────────────────────────────────────────────────────

function _luciaSampleAfterimage(dt){
  if(!lucia || lucia.phase !== 3) return;
  // 移动端跳过残影采样（节省大量 putImageData / drawImage）
  if(typeof window !== 'undefined' && window.IS_MOBILE) return;
  if(!lucia.afterimages) lucia.afterimages = [];
  lucia._afterImgT = (lucia._afterImgT || 0) + dt;

  // 触发条件：移动 OR 非站桩攻击
  let active = false;
  if(lucia.state === 'walk') active = true;
  else if(lucia.state === 'attack' && lucia.attackKey){
    const mv = LUCIA_MOVES[lucia.attackKey];
    if(mv && !mv.stationary) active = true;
  }
  if(!active) return;

  // 速度过低不触发
  if(Math.hypot(lucia.vx, lucia.vy) < 8 && lucia.state === 'walk') return;

  if(lucia._afterImgT >= 0.055){
    lucia._afterImgT = 0;
    // 计算当前 anim
    let animKey = 'hwalk';
    let animT01 = 0;
    if(lucia.state === 'attack'){
      animKey = LUCIA_MOVES[lucia.attackKey].anim;
      animT01 = lucia.atkPhaseT;
    } else {
      animKey = LUCIA_FRAME_COUNT.hwalk ? 'hwalk' : 'walk';
      const dur = LUCIA_FRAME_COUNT[animKey] / 18;
      animT01 = (lucia.animT % dur) / dur;
    }
    lucia.afterimages.push({
      x: lucia.x, y: lucia.y,
      facing: lucia.facing,
      animKey, animT01,
      age: 0, life: 0.42
    });
    if(lucia.afterimages.length > 8) lucia.afterimages.shift();
  }
}

function _luciaAgeAfterimages(dt){
  if(!lucia.afterimages) return;
  for(let i=lucia.afterimages.length-1; i>=0; i--){
    lucia.afterimages[i].age += dt;
    if(lucia.afterimages[i].age >= lucia.afterimages[i].life){
      lucia.afterimages.splice(i, 1);
    }
  }
}

function _luciaDrawAfterimages(c){
  if(!lucia.afterimages || lucia.afterimages.length === 0) return;
  if(!_luciaAfterimgBuf) _luciaAfterimgBuf = document.createElement('canvas');
  // 按时间从老到新画（老的在底）
  for(let i=0; i<lucia.afterimages.length; i++){
    const af = lucia.afterimages[i];
    const k = 1 - af.age / af.life;
    if(k < 0.05) continue;
    const sx = Math.floor(af.x - ox());
    const sy = Math.floor((af.y - oy()) * ISO_Y_SCALE);
    const img = _luciaFrame(af.animKey, af.animT01);
    if(!img) continue;
    const dh = (typeof BOSS_H!=='undefined'?BOSS_H:88) * 1.05;
    const dw = Math.round((img.width||1) / (img.height||1) * dh);
    const dx = sx - dw/2;
    const dy = sy - dh + 18;
    // 离屏：精灵 + 红调（source-atop，仅染不透明像素）
    _luciaTintBuf(_luciaAfterimgBuf, dw|0, dh|0, img, af.facing, '#aa1818', 0.55, 0);
    c.save();
    c.globalAlpha = 0.55 * k;
    c.globalCompositeOperation = 'screen';
    c.drawImage(_luciaAfterimgBuf, dx, dy);
    c.restore();
  }
}

// ────────────────────────────────────────────────────────────────
// 3) P3 分身（释放技能时概率召唤）
// ────────────────────────────────────────────────────────────────

const LUCIA_CLONE_CHANCE = 0.45;

function _luciaTrySpawnClone(){
  if(!lucia || lucia.phase !== 3) return;
  if(lucia.clone) return;
  if(lucia.attackKey === 'charge') return;
  if(lucia.attackKey === 'ring_rush') return;
  if(Math.random() >= LUCIA_CLONE_CHANCE) return;
  // 紧贴玩家身后（Lucia → player → clone 夹击位）
  const ang = Math.atan2(player.y - lucia.y, player.x - lucia.x);
  const r = 40 + Math.random()*10;     // 40-50px：melee range 62-80 → 必能命中
  let cx = player.x + Math.cos(ang)*r;
  let cy = player.y + Math.sin(ang)*r;
  cx = Math.max(60, Math.min(MAP_W*TILE - 60, cx));
  cy = Math.max(60, Math.min(MAP_H*TILE - 60, cy));
  lucia.clone = {
    x: cx, y: cy,
    facing: (player.x < cx ? -1 : 1),
    state: 'spawn',
    fade: 0,
    animT: 0,
    attackKey: lucia.attackKey,
    hurtTimer: 0,
    hp: 100, maxHp: 100,
    _hitDone: false,
    _cloneShot: false,
  };
  _luciaCloneSpawnFX(cx, cy);
}

function _luciaCloneSpawnFX(cx, cy){
  // 阴影裂口 — 单条纵向裂口 + 血雾向中心收（"in" 模式）
  _addFxShape('shadowrip', cx, cy - 28, {
    len: 56, life: 0.55, alphaMul: 0.55, mode: 'in'
  });
  // 少量向心聚拢的火星（轻量，不抢主体）
  for(let i=0;i<6;i++){
    const a = Math.random() * Math.PI*2;
    const r = 22 + Math.random()*8;
    addParticle(cx + Math.cos(a)*r, cy - 22 + Math.sin(a)*r*0.5,
      {n:1, c: i%3===0?'#FFFFFF':'#990000', spd:55+Math.random()*25,
       r:1.4, life:0.3, spread:0.05, angle: a + Math.PI, gravity:0});
  }
}

function _luciaCloneDespawnFX(cl){
  // 阴影裂口 — 血雾向外飘散（"out" 模式）
  _addFxShape('shadowrip', cl.x, cl.y - 28, {
    len: 60, life: 0.6, alphaMul: 0.55, mode: 'out'
  });
  // 少量飞散火星
  for(let i=0;i<8;i++){
    const a = i/8 * Math.PI*2;
    addParticle(cl.x, cl.y-22,
      {n:1, c: i%3===0?'#FFFFFF':'#CC2020', spd:75+Math.random()*40,
       r:1.5, life:0.36, spread:0.05, angle:a, gravity:25});
  }
}

function _luciaUpdateClone(dt){
  if(!lucia.clone) return;
  const cl = lucia.clone;
  cl.animT += dt;
  if(cl.hurtTimer > 0) cl.hurtTimer -= dt;

  if(cl.state === 'spawn'){
    cl.fade = Math.min(1, cl.fade + dt*5);   // ~0.2s 淡入
    if(cl.fade >= 1) cl.state = 'active';
  }

  if(cl.state === 'active'){
    // 与本体同步：动画进度 = 本体的 atkPhaseT
    if(lucia.state === 'attack' && cl.attackKey){
      const mv = LUCIA_MOVES[cl.attackKey];
      if(mv && mv.ranged && mv.hitWin){
        // 远程技能：分身从自己位置也发射一份（独立判定）
        if(!cl._cloneShot && lucia.atkPhaseT >= mv.hitWin[0] && lucia.atkPhaseT < mv.hitWin[1]){
          cl._cloneShot = true;
          if(mv.rangedType === 'pillar') _luciaCloneSpawnPillars(cl);
          else if(mv.rangedType === 'ring_clones') { /* 不递归 */ }
          else _luciaCloneShootBlade(cl);
        }
      } else if(mv && mv.hitWin){
        // 触发命中（近战 / AOE）
        if(mv.multiHit){
          for(let i=0; i<mv.hitWin.length; i+=2){
            const s = mv.hitWin[i], e = mv.hitWin[i+1];
            if(lucia.atkPhaseT >= s && lucia.atkPhaseT < e){
              if(!cl._multiHit) cl._multiHit = {};
              if(!cl._multiHit[i]){
                cl._multiHit[i] = true;
                _luciaCloneTryHit(cl, mv);
              }
            }
          }
        } else if(!cl._hitDone &&
                  lucia.atkPhaseT >= mv.hitWin[0] && lucia.atkPhaseT < mv.hitWin[1]){
          cl._hitDone = true;
          _luciaCloneTryHit(cl, mv);
        }
      }
    }
    // 本体攻击结束 → 分身淡出
    if(lucia.state !== 'attack'){
      cl.state = 'despawn';
      _luciaCloneDespawnFX(cl);
    }
    // hp 归 0 → 提前淡出
    if(cl.hp <= 0){
      cl.state = 'despawn';
      _luciaCloneDespawnFX(cl);
    }
  }

  if(cl.state === 'despawn'){
    cl.fade = Math.max(0, cl.fade - dt*4);
    if(cl.fade <= 0) lucia.clone = null;
  }
}

function _luciaCloneTryHit(cl, mv){
  if(mv.aoe){
    const dx = player.x - cl.x, dy = player.y - (cl.y - 20);
    if(Math.hypot(dx, dy) > mv.range) return;
    if(mv.blockable && typeof defendBlock === 'function' && defendBlock(cl.x, cl.y-20)) return;
    if(playerHurtTimer > 0) return;
    hurtPlayer(Math.floor(mv.dmg * 0.65), dx, dy, 0.42, 0.25);
    camShake(0.18, 6);
  } else {
    const hx = cl.x + cl.facing * 16, hy = cl.y - 20;
    const dx = player.x - hx, dy = player.y - hy;
    if(Math.hypot(dx, dy) > mv.range) return;
    if(mv.blockable && typeof defendBlock === 'function' && defendBlock(hx, hy)) return;
    if(playerHurtTimer > 0) return;
    hurtPlayer(Math.floor(mv.dmg * 0.65), dx, dy, 0.4, 0.25);
    camShake(0.14, 5);
    addParticle(hx, hy, {n:8, c:'#FFFFFF', spd:120, r:2, life:0.3, spread:Math.PI*2});
    addParticle(hx, hy, {n:6, c:'#CC2020', spd:90, r:2, life:0.3, spread:Math.PI*2});
  }
}

// 分身版血剑发射（伤害降低，与本体独立判定）
function _luciaCloneShootBlade(cl){
  const dirX = (player.x >= cl.x) ? 1 : -1;
  for(let i=-1; i<=1; i++){
    const a = i * 0.12;
    const ca = Math.cos(a), sa = Math.sin(a);
    const vx = (dirX*ca) * 260;
    const vy = (dirX*sa) * 260;
    lucia.blades.push({
      x: cl.x + dirX*20, y: cl.y - 20,
      vx, vy,
      age: 0, life: 1.3,
      r: 13,
      dmg: 14,    // 分身伤害减弱
    });
  }
  for(let i=0;i<10;i++){
    const a = Math.atan2(0, dirX) + (Math.random()-0.5)*0.4;
    addParticle(cl.x + dirX*16, cl.y-20,
      {n:1, c: i%2?'#FFFFFF':'#CC2020', spd:130+Math.random()*60,
       r:2, life:0.4, spread:0.1, angle:a});
  }
}

// 分身版火柱（玩家位置稍偏，仅 2 根）
function _luciaCloneSpawnPillars(cl){
  if(!lucia.pillars) lucia.pillars = [];
  const px = player.x + (Math.random()-0.5)*70;
  const py = player.y + (Math.random()-0.5)*30;
  lucia.pillars.push({x:px,    y:py,    t:0, delay:0.40, dur:0.6, fired:false, dmg:14});
  lucia.pillars.push({x:px+40, y:py+12, t:0, delay:0.60, dur:0.6, fired:false, dmg:14});
}

function _luciaDrawClone(c){
  if(!lucia.clone) return;
  const cl = lucia.clone;
  const sx = Math.floor(cl.x - ox());
  const sy = Math.floor((cl.y - oy()) * ISO_Y_SCALE);

  // 确定动画
  let animKey = 'hidle';
  let animT01 = 0;
  if(lucia.state === 'attack' && cl.attackKey){
    const mv = LUCIA_MOVES[cl.attackKey];
    animKey = mv.anim;
    animT01 = Math.min(0.99, lucia.atkPhaseT);
  } else {
    animKey = LUCIA_FRAME_COUNT.hidle ? 'hidle' : 'idle';
    const dur = LUCIA_FRAME_COUNT[animKey] / 22;
    animT01 = (cl.animT % dur) / dur;
  }
  const img = _luciaFrame(animKey, animT01);
  if(!img) return;

  const dh = (typeof BOSS_H!=='undefined'?BOSS_H:88) * 1.05;
  const dw = Math.round((img.width||1) / (img.height||1) * dh);
  const dx = sx - dw/2;
  const dy = sy - dh + 18;

  // 离屏 canvas 染色（避免矩形溢色到背景）
  if(!_luciaCloneBuf) _luciaCloneBuf = document.createElement('canvas');
  const flashA = cl.hurtTimer > 0 ? (cl.hurtTimer/0.25) * 0.65 : 0;
  _luciaTintBuf(_luciaCloneBuf, dw|0, dh|0, img, cl.facing, '#882020', 0.55, flashA);

  // 主体（screen 混合 → 半透明红影）
  c.save();
  c.globalAlpha = cl.fade * 0.92;
  c.globalCompositeOperation = 'screen';
  c.drawImage(_luciaCloneBuf, dx, dy);
  c.restore();

  // 再叠一层正常混合让剪影更实
  c.save();
  c.globalAlpha = cl.fade * 0.55;
  c.drawImage(_luciaCloneBuf, dx, dy);
  c.restore();

  // 分身轮廓飘散粒子（活跃时持续少量发散）
  if(cl.state === 'active' && Math.random() < 0.6){
    const px = cl.x + (Math.random()-0.5)*30;
    const py = cl.y - 20 + (Math.random()-0.5)*50;
    addParticle(px, py, {n:1, c:Math.random()<0.5?'#CC2020':'#660000',
      spd:25, r:1.6, life:0.35, spread:Math.PI*2, gravity:-10});
  }
}

// ────────────────────────────────────────────────────────────────
// 4) 外部接口：玩家命中分身（demo-3c.html 玩家攻击点调用）
// ────────────────────────────────────────────────────────────────

// 返回：true=命中（普通分身 / chargeGhost / ringClone 任一），false=未命中
function luciaTryHitClone(fx, fy, range, dmg, kx, ky){
  if(!lucia) return false;
  let hit = false;
  // 普通分身
  if(lucia.clone && lucia.clone.state === 'active'){
    const cl = lucia.clone;
    if(Math.hypot(cl.x - fx, (cl.y-30) - fy) <= range + 30){
      _luciaCloneHurtFX(cl, dmg);
      if(typeof luciaTakeDamage === 'function') luciaTakeDamage(dmg, kx||0, ky||0);
      hit = true;
    }
  }
  // 冲刺分身（wait / charging 两态都可命中）
  if(lucia.chargeGhost &&
     (lucia.chargeGhost.state === 'wait' || lucia.chargeGhost.state === 'charging')){
    const g = lucia.chargeGhost;
    if(Math.hypot(g.x - fx, (g.y-30) - fy) <= range + 30){
      _luciaCloneHurtFX(g, dmg);
      if(typeof luciaTakeDamage === 'function') luciaTakeDamage(dmg, kx||0, ky||0);
      if(g.hp <= 0){
        g.state = 'despawn';
        _luciaCloneDespawnFX(g);
      }
      hit = true;
    }
  }
  // 四方分身（多个独立 hp，逐个判定）
  if(lucia.ringClones && lucia.ringClones.length > 0){
    for(const g of lucia.ringClones){
      if(g.state !== 'wait' && g.state !== 'charging') continue;
      if(Math.hypot(g.x - fx, (g.y-30) - fy) <= range + 30){
        _luciaCloneHurtFX(g, dmg);
        if(typeof luciaTakeDamage === 'function') luciaTakeDamage(Math.floor(dmg*0.5), kx||0, ky||0);
        if(g.hp <= 0 && g.state !== 'despawn'){
          g.state = 'despawn';
          _luciaCloneDespawnFX(g);
        }
        hit = true;
        break;   // 一次只命中一个 ring clone
      }
    }
  }
  return hit;
}

function _luciaCloneHurtFX(target, dmg){
  target.hurtTimer = 0.25;
  target.hp -= dmg;
  const cx = target.x, cy = target.y - 30;
  for(let i=0;i<12;i++){
    addParticle(cx, cy, {
      n:1, c: i%2?'#CC2020':'#FFFFFF',
      spd:80+Math.random()*70, r:2, life:0.4,
      spread:Math.PI*2, gravity:60
    });
  }
  shockwaves.push({x:cx, y:cy, r:2, maxR:32, life:0.25, age:0, c:'#FFFFFF'});
}

window.luciaTryHitClone = luciaTryHitClone;

// ────────────────────────────────────────────────────────────────
// 5) 冲刺分身（chargeGhost）— P3 charge 专用
//    原地保留 → 0.3s 等待（淡入）→ 重演冲刺（带命中）→ 淡出消失
// ────────────────────────────────────────────────────────────────

function _luciaTrySpawnChargeGhost(){
  if(!lucia || lucia.phase !== 3) return;
  if(lucia.chargeGhost) return;
  // 在 Lucia 起手位置原地保留（朝向延续）
  lucia.chargeGhost = {
    x: lucia.x, y: lucia.y,
    facing: lucia.facing,
    state: 'wait',           // wait → charging → despawn
    waitT: 0,
    waitDur: 0.30,
    atkPhaseT: 0,
    fade: 0,
    hp: 100, maxHp: 100,
    hurtTimer: 0,
    _hitDone: false,
  };
  // 出现 FX（紧凑型）
  _luciaCloneSpawnFX(lucia.x, lucia.y);
}

function _luciaUpdateChargeGhost(dt){
  if(!lucia.chargeGhost) return;
  const g = lucia.chargeGhost;
  if(g.hurtTimer > 0) g.hurtTimer -= dt;

  if(g.state === 'wait'){
    g.fade = Math.min(1, g.fade + dt*5);     // 0.2s 淡入完成
    g.waitT += dt;
    if(g.waitT >= g.waitDur){
      g.state = 'charging';
      g.atkPhaseT = 0;
      g._hitDone = false;
      // 出发瞬间小特效
      camShake(0.10, 4);
      for(let i=0;i<10;i++){
        const a = Math.random()*Math.PI*2;
        addParticle(g.x, g.y-20,
          {n:1, c:i%2?'#CC2020':'#FFFFFF', spd:90+Math.random()*60,
           r:2, life:0.35, spread:0.1, angle:a, gravity:0});
      }
    }
  }

  if(g.state === 'charging'){
    const mv = LUCIA_MOVES.charge;
    g.atkPhaseT += dt / mv.dur;

    // 复刻冲刺位移（与本体逻辑一致）
    if(g.atkPhaseT > 0.15 && g.atkPhaseT < 0.7){
      const stepFactor = Math.sin((g.atkPhaseT - 0.15)/0.55 * Math.PI);
      const ms = mv.move * stepFactor * dt * 1.6;
      g.x += g.facing * ms;
      // 血色拖尾
      if(Math.random() < dt*40){
        addParticle(g.x - g.facing*(8+Math.random()*16),
                    g.y - 20 + (Math.random()-0.5)*30,
          {n:2, c:Math.random()<0.5?'#FFFFFF':'#AA0000',
           spd:30+Math.random()*40, r:2.2, life:0.45, spread:Math.PI*2, gravity:0});
      }
    }

    // 命中（伤害 65%）
    if(!g._hitDone && g.atkPhaseT >= mv.hitWin[0] && g.atkPhaseT < mv.hitWin[1]){
      const hx = g.x + g.facing * 16, hy = g.y - 20;
      const dx = player.x - hx, dy = player.y - hy;
      if(Math.hypot(dx, dy) < mv.range){
        const blocked = (mv.blockable && typeof defendBlock === 'function')
                          && defendBlock(hx, hy);
        if(!blocked && playerHurtTimer <= 0){
          hurtPlayer(Math.floor(mv.dmg * 0.65), dx, dy, 0.4, 0.25);
          camShake(0.20, 7);
        }
      }
      g._hitDone = true;
    }

    if(g.atkPhaseT >= 1){
      g.state = 'despawn';
      _luciaCloneDespawnFX(g);
    }
  }

  if(g.state === 'despawn'){
    g.fade = Math.max(0, g.fade - dt*4);
    if(g.fade <= 0) lucia.chargeGhost = null;
  }
}

function _luciaDrawChargeGhost(c){
  if(!lucia.chargeGhost) return;
  const g = lucia.chargeGhost;
  const sx = Math.floor(g.x - ox());
  const sy = Math.floor((g.y - oy()) * ISO_Y_SCALE);

  // 动画：等待时用蓄势姿势，冲刺时同步冲刺动画
  const mv = LUCIA_MOVES.charge;
  let animKey = mv.anim;
  let animT01 = 0;
  if(g.state === 'wait'){
    // 起手姿势（前段微动）
    animT01 = Math.min(0.15, g.waitT / g.waitDur * 0.15);
  } else if(g.state === 'charging'){
    animT01 = Math.min(0.99, g.atkPhaseT);
  } else {
    animT01 = 0.85;   // 收招
  }
  const img = _luciaFrame(animKey, animT01);
  if(!img) return;

  const dh = (typeof BOSS_H!=='undefined'?BOSS_H:88) * 1.05;
  const dw = Math.round((img.width||1) / (img.height||1) * dh);
  const dx = sx - dw/2;
  const dy = sy - dh + 18;

  if(!_luciaCloneBuf) _luciaCloneBuf = document.createElement('canvas');
  const flashA = g.hurtTimer > 0 ? (g.hurtTimer/0.25) * 0.65 : 0;
  _luciaTintBuf(_luciaCloneBuf, dw|0, dh|0, img, g.facing, '#882020', 0.55, flashA);

  c.save();
  c.globalAlpha = g.fade * 0.92;
  c.globalCompositeOperation = 'screen';
  c.drawImage(_luciaCloneBuf, dx, dy);
  c.restore();

  c.save();
  c.globalAlpha = g.fade * 0.55;
  c.drawImage(_luciaCloneBuf, dx, dy);
  c.restore();

  // 等待时持续小粒子提示
  if(g.state === 'wait' && Math.random() < 0.45){
    addParticle(g.x + (Math.random()-0.5)*22,
                g.y - 20 + (Math.random()-0.5)*40,
      {n:1, c: Math.random()<0.5?'#CC2020':'#660000',
       spd:20, r:1.6, life:0.32, spread:Math.PI*2, gravity:-10});
  }
}

// ────────────────────────────────────────────────────────────────
// 6) 大招 ring_rush — 四方分身轮番冲锋
//    在玩家四周生成 5 个分身，错峰冲刺（每个独立 hp / 命中判定）
// ────────────────────────────────────────────────────────────────

const LUCIA_RING_COUNT = 5;
const LUCIA_RING_RADIUS = 100;

function _luciaSpawnRingClones(){
  if(!lucia) return;
  if(!lucia.ringClones) lucia.ringClones = [];
  const baseAng = Math.random() * Math.PI*2;
  for(let i=0;i<LUCIA_RING_COUNT;i++){
    const a = baseAng + i/LUCIA_RING_COUNT * Math.PI*2;
    let cx = player.x + Math.cos(a) * LUCIA_RING_RADIUS;
    let cy = player.y + Math.sin(a) * LUCIA_RING_RADIUS * 0.6;
    cx = Math.max(60, Math.min(MAP_W*TILE - 60, cx));
    cy = Math.max(60, Math.min(MAP_H*TILE - 60, cy));
    const fac = (player.x < cx ? -1 : 1);
    lucia.ringClones.push({
      x: cx, y: cy, facing: fac,
      state: 'wait',
      waitT: 0,
      waitDur: 0.40 + i*0.20,    // 错峰冲刺
      atkPhaseT: 0,
      fade: 0,
      hp: 60, maxHp: 60,
      hurtTimer: 0,
      _hitDone: false,
    });
    _luciaCloneSpawnFX(cx, cy);
  }
}

function _luciaUpdateRingClones(dt){
  if(!lucia.ringClones || lucia.ringClones.length === 0) return;
  for(let i=lucia.ringClones.length-1; i>=0; i--){
    const g = lucia.ringClones[i];
    if(g.hurtTimer > 0) g.hurtTimer -= dt;

    if(g.state === 'wait'){
      g.fade = Math.min(1, g.fade + dt*5);
      g.waitT += dt;
      if(g.waitT >= g.waitDur){
        // 重新朝向玩家（玩家可能已经移动）
        g.facing = (player.x >= g.x) ? 1 : -1;
        // 朝向玩家方向冲刺：保存归一化向量
        const dxp = player.x - g.x, dyp = player.y - g.y;
        const L = Math.hypot(dxp, dyp) || 1;
        g._dx = dxp / L;
        g._dy = dyp / L;
        g.state = 'charging';
        g.atkPhaseT = 0;
        g._hitDone = false;
        camShake(0.07, 3);
        // 启动 FX
        for(let k=0;k<8;k++){
          const a = Math.random()*Math.PI*2;
          addParticle(g.x, g.y-20,
            {n:1, c:k%2?'#FFFFFF':'#CC2020', spd:80+Math.random()*40,
             r:2, life:0.3, spread:0.1, angle:a, gravity:0});
        }
      }
    }

    if(g.state === 'charging'){
      const mv = LUCIA_MOVES.charge;
      g.atkPhaseT += dt / mv.dur;

      // 冲刺位移（带 X/Y 分量，朝玩家锁定方向）
      if(g.atkPhaseT > 0.15 && g.atkPhaseT < 0.7){
        const stepFactor = Math.sin((g.atkPhaseT-0.15)/0.55 * Math.PI);
        const ms = mv.move * stepFactor * dt * 1.6;
        g.x += g._dx * ms;
        g.y += g._dy * ms;
        // 拖尾
        if(Math.random() < dt*35){
          addParticle(g.x - g._dx*(8+Math.random()*14),
                      g.y - 20 - g._dy*(8+Math.random()*14) + (Math.random()-0.5)*20,
            {n:1, c: Math.random()<0.5?'#FFFFFF':'#AA0000',
             spd:25+Math.random()*35, r:2, life:0.4, spread:Math.PI*2, gravity:0});
        }
      }

      // 命中（伤害较低，但数量多）
      if(!g._hitDone && g.atkPhaseT >= mv.hitWin[0] && g.atkPhaseT < mv.hitWin[1]){
        const hx = g.x + g.facing*16, hy = g.y - 20;
        const dx = player.x - hx, dy = player.y - hy;
        if(Math.hypot(dx, dy) < mv.range){
          const blocked = (mv.blockable && typeof defendBlock === 'function')
                            && defendBlock(hx, hy);
          if(!blocked && playerHurtTimer <= 0){
            hurtPlayer(Math.floor(mv.dmg * 0.55), dx, dy, 0.4, 0.25);
            camShake(0.14, 5);
          }
        }
        g._hitDone = true;
      }

      if(g.atkPhaseT >= 1){
        g.state = 'despawn';
        _luciaCloneDespawnFX(g);
      }
    }

    if(g.state === 'despawn'){
      g.fade = Math.max(0, g.fade - dt*4);
      if(g.fade <= 0){ lucia.ringClones.splice(i, 1); continue; }
    }

    if(g.hp <= 0 && g.state !== 'despawn'){
      g.state = 'despawn';
      _luciaCloneDespawnFX(g);
    }
  }
}

function _luciaDrawRingClones(c){
  if(!lucia.ringClones || lucia.ringClones.length === 0) return;
  for(const g of lucia.ringClones){
    const sx = Math.floor(g.x - ox());
    const sy = Math.floor((g.y - oy()) * ISO_Y_SCALE);
    const mv = LUCIA_MOVES.charge;
    const animKey = mv.anim;
    let animT01 = 0;
    if(g.state === 'wait'){
      animT01 = Math.min(0.15, g.waitT / g.waitDur * 0.15);
    } else if(g.state === 'charging'){
      animT01 = Math.min(0.99, g.atkPhaseT);
    } else {
      animT01 = 0.85;
    }
    const img = _luciaFrame(animKey, animT01);
    if(!img) continue;
    const dh = (typeof BOSS_H!=='undefined'?BOSS_H:88) * 1.05;
    const dw = Math.round((img.width||1) / (img.height||1) * dh);
    const dx = sx - dw/2;
    const dy = sy - dh + 18;

    if(!_luciaCloneBuf) _luciaCloneBuf = document.createElement('canvas');
    const flashA = g.hurtTimer > 0 ? (g.hurtTimer/0.25) * 0.65 : 0;
    _luciaTintBuf(_luciaCloneBuf, dw|0, dh|0, img, g.facing, '#882020', 0.55, flashA);

    c.save();
    c.globalAlpha = g.fade * 0.92;
    c.globalCompositeOperation = 'screen';
    c.drawImage(_luciaCloneBuf, dx, dy);
    c.restore();

    c.save();
    c.globalAlpha = g.fade * 0.55;
    c.drawImage(_luciaCloneBuf, dx, dy);
    c.restore();

    // 等待时：脚下警示光晕（替代圆环描边）
    if(g.state === 'wait'){
      const k = g.waitT / g.waitDur;
      c.save();
      c.globalCompositeOperation = 'lighter';
      const grd = c.createRadialGradient(sx, sy, 0, sx, sy, 24);
      grd.addColorStop(0, `rgba(204,32,32,${0.55*k})`);
      grd.addColorStop(0.6,`rgba(204,32,32,${0.25*k})`);
      grd.addColorStop(1, 'rgba(204,32,32,0)');
      c.fillStyle = grd;
      c.beginPath();
      c.ellipse(sx, sy, 24, 7, 0, 0, Math.PI*2);
      c.fill();
      c.restore();
      // 等待时小粒子
      if(Math.random() < 0.35){
        addParticle(g.x + (Math.random()-0.5)*18,
                    g.y - 20 + (Math.random()-0.5)*36,
          {n:1, c:'#990000', spd:18, r:1.4, life:0.3, spread:Math.PI*2, gravity:-10});
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 氛围 / 表现 增强模块
//   1) 招式名飘字   2) 死亡血柱   3) Low HP 狂暴抖动
//   4) Lucia 常驻氛围   5) P3 进入持续 vignette
// ═══════════════════════════════════════════════════════════════

const LUCIA_SKILL_NAMES = {
  atk_a:       '· 斩 ·',
  atk_b:       '· 连 斩 ·',
  atk_c:       '· 重 击 ·',
  atk2a:       '· 地 裂 ·',
  atk2b:       '· 旋 斩 ·',
  atk3:        '· 血 剑 ·',
  atk4:        '· 狂 袭 ·',
  atk4b:       '· 裂 魂 ·',
  atk4c:       '· 血 祭 ·',
  ult:         '· 血 色 风 暴 ·',
  charge:      '· 突 进 ·',
  pillar_fire: '· 血 柱 ·',
  ring_rush:   '· 血 祭 轮 回 ·',
  blood_seek:  '· 血 噬 ·',
  blood_chain: '· 血 锁 缚 灵 ·',
  shadow_cross:'· 血 影 双 煞 ·',
};

function _luciaSpawnSkillText(text, color){
  if(!lucia.skillTexts) lucia.skillTexts = [];
  lucia.skillTexts.push({
    text,
    color: color || '#FF4040',
    x: lucia.x, y: lucia.y - 90,
    age: 0, life: 1.1
  });
}

function _luciaUpdateSkillTexts(dt){
  if(!lucia.skillTexts) return;
  for(let i=lucia.skillTexts.length-1; i>=0; i--){
    lucia.skillTexts[i].age += dt;
    if(lucia.skillTexts[i].age >= lucia.skillTexts[i].life){
      lucia.skillTexts.splice(i, 1);
    }
  }
}

function _luciaDrawSkillTexts(c){
  if(!lucia.skillTexts || lucia.skillTexts.length === 0) return;
  for(const t of lucia.skillTexts){
    const k = 1 - t.age/t.life;
    const fadeIn = Math.min(1, t.age*4);
    const sx = t.x - ox();
    const sy = (t.y - oy()) * ISO_Y_SCALE - t.age * 30;   // 飘升
    c.save();
    c.globalAlpha = Math.min(fadeIn, k*1.5);
    c.font = 'bold 18px "Microsoft YaHei", Consolas, monospace';
    c.textAlign = 'center';
    // 黑色描边
    c.lineWidth = 4;
    c.strokeStyle = 'rgba(0,0,0,0.85)';
    c.strokeText(t.text, sx, sy);
    // 阴影色（半透深红）
    c.fillStyle = 'rgba(120,0,0,0.6)';
    c.fillText(t.text, sx+1, sy+1);
    // 主色
    c.fillStyle = t.color;
    c.fillText(t.text, sx, sy);
    // 内层白炽（缩小字号叠）
    c.globalAlpha = Math.min(fadeIn, k*1.5) * 0.5;
    c.font = 'bold 15px "Microsoft YaHei", Consolas, monospace';
    c.fillStyle = '#FFFFFF';
    c.fillText(t.text, sx, sy);
    c.textAlign = 'left';
    c.restore();
  }
}

function _luciaUpdateDeathPillars(dt){
  if(!lucia.deathPillars || lucia.deathPillars.length === 0) return;
  for(let i=lucia.deathPillars.length-1; i>=0; i--){
    const p = lucia.deathPillars[i];
    p.t += dt;
    if(p.t >= p.delay && !p.fired){
      p.fired = true;
      // 喷血柱
      for(let k=0;k<16;k++){
        addParticle(p.x, p.y, {
          n:1, c: k%3===0?'#FFFFFF':'#CC2020',
          spd:140+Math.random()*60, r:2.4, life:0.75,
          spread:0.05, angle:-Math.PI*0.5+(Math.random()-0.5)*0.4, gravity:-80
        });
      }
      shockwaves.push({x:p.x, y:p.y, r:3, maxR:55, life:0.4, age:0, c:'#CC2020'});
      shockwaves.push({x:p.x, y:p.y, r:2, maxR:32, life:0.3, age:0, c:'#FFFFFF'});
      camShake(0.16, 5);
    }
    if(p.t > p.delay + p.dur) lucia.deathPillars.splice(i, 1);
  }
}

function _luciaUpdateLowHpRage(dt){
  if(!lucia || lucia.state === 'dead'){
    lucia._tremorX = 0; lucia._tremorY = 0; return;
  }
  const pct = lucia.hp / lucia.maxHp;
  if(pct < 0.22){
    // 持续轻抖
    lucia._tremorX = (Math.random()-0.5) * 2.6;
    lucia._tremorY = (Math.random()-0.5) * 2.2;
    // 持续向上散血粒
    if(Math.random() < dt*36){
      addParticle(lucia.x + (Math.random()-0.5)*22,
                  lucia.y - 30 + (Math.random()-0.5)*28,
        {n:1, c: Math.random()<0.5?'#FFFFFF':'#990000',
         spd:35+Math.random()*35, r:1.6, life:0.55,
         spread:0.05, angle: -Math.PI*0.5 + (Math.random()-0.5)*0.6, gravity:-15});
    }
    // 攻击节奏加速：CD 缩减
    if(lucia.atkCD > 0) lucia.atkCD -= dt * 0.35;
    // P3 进入 vignette 已退时，加血色脉动
    if(lucia.p3IntroT <= 0) lucia.p3IntroT = 0;   // 防负数累计
  } else {
    lucia._tremorX *= 0.6;
    lucia._tremorY *= 0.6;
    if(Math.abs(lucia._tremorX) < 0.05) lucia._tremorX = 0;
    if(Math.abs(lucia._tremorY) < 0.05) lucia._tremorY = 0;
  }
}

// ── Lucia 常驻氛围（脚下血池 + 头顶血粒 + 轨道余烬）──
function _luciaDrawAmbience(c, sx, sy){
  if(lucia.state === 'dead' || lucia.state === 'fall') return;
  const phaseCfg = LUCIA_PHASES[lucia.phase];
  const mobile = typeof window !== 'undefined' && window.IS_MOBILE;

  c.save();
  c.globalCompositeOperation = 'lighter';

  // 1. 脚下脉动血池（手机端用纯色椭圆代替 radialGradient）
  const pulse = 0.5 + 0.3*Math.sin(lucia.animT*1.6);
  const R = 26 + lucia.phase * 9;
  if(mobile){
    c.fillStyle = `rgba(180,20,20,${0.32*pulse})`;
    c.beginPath();
    c.ellipse(sx, sy+3, R, R*0.30, 0, 0, Math.PI*2);
    c.fill();
  } else {
    const poolGrd = c.createRadialGradient(sx, sy+3, 2, sx, sy+3, R);
    poolGrd.addColorStop(0,   `rgba(220,30,30,${0.45*pulse})`);
    poolGrd.addColorStop(0.5, `rgba(120,0,0,${0.25*pulse})`);
    poolGrd.addColorStop(1,   'rgba(50,0,0,0)');
    c.fillStyle = poolGrd;
    c.beginPath();
    c.ellipse(sx, sy+3, R, R*0.30, 0, 0, Math.PI*2);
    c.fill();
  }

  // 2. 周身轨道余烬（手机端只画 2 颗 + 纯色 arc）
  const N = mobile ? 2 : Math.min(4, 1 + lucia.phase);
  const orbR = 36;
  for(let i=0;i<N;i++){
    const ang = lucia.animT * 1.3 + i/N * Math.PI*2;
    const ex = sx + Math.cos(ang)*orbR;
    const ey = sy - 32 + Math.sin(ang)*orbR*0.5;
    const r = 3 + Math.sin(lucia.animT*3.5 + i)*0.8;
    if(mobile){
      c.fillStyle = 'rgba(255,80,40,0.85)';
      c.beginPath(); c.arc(ex, ey, r*1.6, 0, Math.PI*2); c.fill();
    } else {
      const grd = c.createRadialGradient(ex, ey, 0, ex, ey, r*2.2);
      grd.addColorStop(0,   'rgba(255,80,40,0.9)');
      grd.addColorStop(0.5, 'rgba(180,20,20,0.5)');
      grd.addColorStop(1,   'rgba(100,0,0,0)');
      c.fillStyle = grd;
      c.beginPath();
      c.arc(ex, ey, r*2.2, 0, Math.PI*2);
      c.fill();
    }
  }
  c.restore();

  // 3. 头顶上飘血粒
  if(!mobile && Math.random() < 0.1){
    const ox_ = (Math.random()-0.5)*22;
    addParticle(lucia.x + ox_, lucia.y - 50,
      {n:1, c: Math.random()<0.3?'#FFFFFF':'#660000', spd:14, r:1.3, life:0.6,
       spread:0.5, angle:-Math.PI*0.5, gravity:-10});
  }
}

// ── 屏幕级 vignette / P3 entrance overlay（由 drawLuciaHUD 调用）──
function _luciaDrawScreenOverlay(c){
  const mobile = typeof window !== 'undefined' && window.IS_MOBILE;
  // P3 进入持续 vignette
  if(lucia.p3IntroT > 0){
    const k = lucia.p3IntroT / 5;
    const pulse = 0.5 + 0.5*Math.sin((5 - lucia.p3IntroT) * 3);
    c.save();
    if(mobile){
      c.fillStyle = `rgba(120,0,0,${0.22*k*pulse})`;
    } else {
      const grd = c.createRadialGradient(CW/2, CH/2, CW*0.25, CW/2, CH/2, CW*0.65);
      grd.addColorStop(0, 'rgba(80,0,0,0)');
      grd.addColorStop(0.55, `rgba(140,0,0,${0.18*k*pulse})`);
      grd.addColorStop(1, `rgba(100,0,0,${0.50*k*pulse})`);
      c.fillStyle = grd;
    }
    c.fillRect(0, 0, CW, CH);
    c.restore();
  }
  // Low HP 红色 vignette（< 22% 持续）
  if(lucia.hp/lucia.maxHp < 0.22 && lucia.state !== 'dead'){
    const pulse = 0.4 + 0.6*Math.sin(lucia.animT*4);
    c.save();
    if(mobile){
      c.fillStyle = `rgba(160,0,0,${0.18*pulse})`;
    } else {
      const grd = c.createRadialGradient(CW/2, CH/2, CW*0.35, CW/2, CH/2, CW*0.62);
      grd.addColorStop(0, 'rgba(60,0,0,0)');
      grd.addColorStop(1, `rgba(180,0,0,${0.28*pulse})`);
      c.fillStyle = grd;
    }
    c.fillRect(0, 0, CW, CH);
    c.restore();
  }
  // 死亡渐隐：屏幕变红 + 渐淡
  if(lucia.state === 'dead' && lucia.deadAge < 1.8){
    const k = Math.min(1, lucia.deadAge / 0.6);
    const fade = Math.max(0, 1 - Math.max(0, (lucia.deadAge - 0.6) / 1.2));
    c.save();
    c.fillStyle = `rgba(180,0,0,${0.35 * fade * k})`;
    c.fillRect(0, 0, CW, CH);
    c.restore();
  }
}

// ═══════════════════════════════════════════════════════════════
// blood_seek — 血色追踪弹（3 颗缓速追猎，撞击 AOE 爆炸）
// ═══════════════════════════════════════════════════════════════
function _luciaSpawnBloodSeek(){
  if(!lucia) return;
  const cx = lucia.x;
  const cy = lucia.y - 60;
  const N = 3;
  for(let i=0; i<N; i++){
    const ang = -Math.PI/2 + (i - (N-1)/2) * 0.35;
    const sp = 90 + Math.random()*40;
    lucia.bloodSeeks.push({
      x: cx + (Math.random()-0.5)*20,
      y: cy + (Math.random()-0.5)*10,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp,
      age: 0,
      life: 4.0,
      dmg: 60,
      r: 10,
      _spawnDelay: i * 0.12,
      _trail: [],
      exploded: false,
    });
  }
  if(typeof shockwaves !== 'undefined'){
    shockwaves.push({x: cx, y: cy, r:4, maxR:80, life:0.4, age:0, c:'#CC2020'});
  }
  if(typeof addParticle === 'function'){
    for(let i=0; i<14; i++){
      const a = i / 14 * Math.PI * 2;
      addParticle(cx, cy, {n:1, c: i%2 ? '#CC2020' : '#660000',
        spd: 80+Math.random()*40, r: 1.8, life: 0.5,
        spread: 0.2, angle: a, gravity: -10});
    }
  }
  if(typeof camShake === 'function') camShake(0.10, 4);
  _luciaSpawnSkillText('血 噬', '#CC2020');
}

function _luciaUpdateBloodSeeks(dt){
  if(!lucia || !lucia.bloodSeeks || !lucia.bloodSeeks.length) return;
  const list = lucia.bloodSeeks;
  for(let i=list.length-1; i>=0; i--){
    const p = list[i];
    p.age += dt;
    if(p._spawnDelay > 0){ p._spawnDelay -= dt; continue; }
    if(p.exploded){
      if(p.age >= p.life + 0.4) list.splice(i, 1);
      continue;
    }
    const dx = player.x - p.x;
    const dy = (player.y - 30) - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const acc = 380;
    p.vx += dx/d * acc * dt;
    p.vy += dy/d * acc * dt;
    const v = Math.hypot(p.vx, p.vy);
    const VMAX = 280;
    if(v > VMAX){ p.vx = p.vx/v*VMAX; p.vy = p.vy/v*VMAX; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p._trail.push({x: p.x, y: p.y});
    if(p._trail.length > 8) p._trail.shift();
    if(d < p.r + 22){
      p.exploded = true;
      p.life = p.age;
      if(Math.hypot(player.x - p.x, player.y - 30 - p.y) < 80){
        const blocked = (typeof defendBlock==='function') && defendBlock(p.x, p.y);
        if(!blocked && playerHurtTimer <= 0 && typeof hurtPlayer === 'function'){
          hurtPlayer(p.dmg, (player.x - p.x), (player.y - p.y), 0.5, 0.35);
        }
      }
      if(typeof shockwaves !== 'undefined'){
        shockwaves.push({x: p.x, y: p.y, r:4, maxR:90, life:0.45, age:0, c:'#CC2020'});
        shockwaves.push({x: p.x, y: p.y, r:2, maxR:55, life:0.35, age:0, c:'#FF6060'});
      }
      if(typeof addParticle === 'function'){
        for(let k=0; k<22; k++){
          const a = k / 22 * Math.PI * 2;
          addParticle(p.x, p.y, {n:1,
            c: k%3===0?'#FFFFFF':(k%3===1?'#CC2020':'#660000'),
            spd: 140+Math.random()*80, r: 2.0, life: 0.55,
            spread: 0.15, angle: a, gravity: 60});
        }
      }
      if(typeof camShake === 'function') camShake(0.10, 5);
      continue;
    }
    if(p.age >= p.life){
      p.exploded = true;
      if(typeof shockwaves !== 'undefined'){
        shockwaves.push({x: p.x, y: p.y, r:4, maxR:60, life:0.35, age:0, c:'#660000'});
      }
    }
    if(Math.random() < 0.6 && typeof addParticle === 'function'){
      addParticle(p.x, p.y, {n:1, c: Math.random()<0.5?'#CC2020':'#660000',
        spd: 30+Math.random()*30, r: 1.3, life: 0.35,
        spread: Math.PI*2, angle: Math.random()*Math.PI*2, gravity: 20});
    }
  }
}

function _luciaDrawBloodSeeks(c){
  if(!lucia || !lucia.bloodSeeks || !lucia.bloodSeeks.length) return;
  for(const p of lucia.bloodSeeks){
    if(p._spawnDelay > 0) continue;
    if(p.exploded) continue;
    const sx = p.x - ox();
    const sy = (p.y - oy()) * ISO_Y_SCALE;
    if(p._trail.length > 1){
      c.save();
      c.globalCompositeOperation = 'lighter';
      for(let i=1; i<p._trail.length; i++){
        const t0 = p._trail[i-1], t1 = p._trail[i];
        const k = i / p._trail.length;
        c.globalAlpha = k * 0.6;
        c.strokeStyle = '#CC2020';
        c.lineWidth = 2 + k * 4;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(t0.x - ox(), (t0.y - oy()) * ISO_Y_SCALE);
        c.lineTo(t1.x - ox(), (t1.y - oy()) * ISO_Y_SCALE);
        c.stroke();
      }
      c.restore();
    }
    c.save();
    c.globalCompositeOperation = 'lighter';
    const pulse = 0.8 + 0.2 * Math.sin(p.age * 18);
    c.fillStyle = `rgba(200,40,40,${0.35*pulse})`;
    c.beginPath(); c.arc(sx, sy, 14*pulse, 0, Math.PI*2); c.fill();
    c.fillStyle = `rgba(255,80,80,${0.55*pulse})`;
    c.beginPath(); c.arc(sx, sy, 8*pulse, 0, Math.PI*2); c.fill();
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#660000';
    c.beginPath(); c.arc(sx, sy, 4, 0, Math.PI*2); c.fill();
    c.restore();
  }
}

// ═══════════════════════════════════════════════════════════════
// shadow_cross — 血影双煞（2 个血色分身在玩家两侧空中夹击投剑）
// 流程：
//   0.0s  锁定玩家位置，召出 2 个血影（玩家左右各一，空中悬浮）
//   0.5s  分身蓄力（脚下深渊裂缝 + 头顶月牙 + 红雾向心）
//   0.9s  双分身同时投剑：每分身 3 把巨剑十字夹击玩家
//   1.4s  分身淡去（残影消散）
// 全程使用现有 blades 系统投剑 + addParticle/shockwaves/_addFxShape，
// 无新 update/draw 函数
// ═══════════════════════════════════════════════════════════════
function _luciaSpawnShadowCross(){
  if(!lucia) return;
  const _myId = lucia._id;   // 捕获实例 ID，setTimeout 里对比防止重启后继续执行
  const _safeCheck = () => lucia && lucia._id === _myId && lucia.state !== 'dead';
  const px = player.x, py = player.y;
  const SIDE = 130;     // 分身距玩家两侧距离
  const HEIGHT = 28;    // 分身略高于玩家头顶（空中感）
  // 两个分身位置（玩家左右）
  const ghosts = [
    { x: px - SIDE, y: py - HEIGHT, side: -1 },
    { x: px + SIDE, y: py - HEIGHT, side: +1 },
  ];

  // ─── 阶段 1：召唤（0.0s）── 血雾汇聚成形 ───
  ghosts.forEach((g, gi) => {
    // 召唤地标：脚下脉动血池
    if(typeof shockwaves !== 'undefined'){
      shockwaves.push({x: g.x, y: g.y + 30, r: 4, maxR: 60, life: 0.45, age: 0, c: '#CC2020'});
      shockwaves.push({x: g.x, y: g.y + 30, r: 2, maxR: 40, life: 0.35, age: 0, c: '#FF6060'});
    }
    // 血雾从四面八方汇聚（向心粒子）
    if(typeof addParticle === 'function'){
      for(let i=0; i<22; i++){
        const a = Math.random() * Math.PI * 2;
        const r = 50 + Math.random() * 30;
        addParticle(g.x + Math.cos(a)*r, g.y + Math.sin(a)*r*0.6, {n:1,
          c: i%3===0 ? '#FFFFFF' : (i%3===1 ? '#CC2020' : '#660000'),
          spd: 70 + Math.random()*40, r: 1.8, life: 0.50,
          spread: 0.10, angle: a + Math.PI, gravity: -10});
      }
    }
    // 头顶反向旋月（蓄势）
    if(typeof _addFxShape === 'function'){
      _addFxShape('crescent', g.x, g.y - 18, {
        r: 32, startAng: 0, sweep: Math.PI*1.95,
        thickness: 4, palette: 'red', life: 0.85, spinSpd: g.side * 8
      });
      // 内层小月反向
      _addFxShape('crescent', g.x, g.y - 18, {
        r: 18, startAng: Math.PI, sweep: Math.PI*1.95,
        thickness: 2, palette: 'red', life: 0.85, spinSpd: -g.side * 14
      });
    }
  });
  if(typeof camShake === 'function') camShake(0.10, 4);

  // ─── 阶段 2：蓄力（0.5s）── 脚下脉冲 + 红光收束 ───
  setTimeout(() => {
    if(!_safeCheck()) return;
    ghosts.forEach(g => {
      if(typeof _addFxShape === 'function'){
        // 蓄势月牙（替代 abyssrift / xslash，避免 _strokeAbyssPath 复杂渲染）
        _addFxShape('crescent', g.x, g.y - 12, {
          r: 26, startAng: 0, sweep: Math.PI*1.95,
          thickness: 4, palette: 'red', life: 0.40, spinSpd: 6 * g.side
        });
        _addFxShape('crescent', g.x, g.y + 28, {
          r: 32, startAng: 0, sweep: Math.PI*1.95,
          thickness: 3, palette: 'red', life: 0.40, spinSpd: -8 * g.side
        });
      }
      if(typeof addParticle === 'function'){
        for(let i=0; i<8; i++){
          const a = (i / 8) * Math.PI * 2;
          addParticle(g.x + Math.cos(a)*22, g.y + Math.sin(a)*10, {n:1,
            c: i%2 ? '#FF6060' : '#660000',
            spd: 40 + Math.random()*30, r: 1.5, life: 0.35,
            spread: 0.15, angle: a, gravity: -8});
        }
      }
      if(typeof shockwaves !== 'undefined'){
        shockwaves.push({x: g.x, y: g.y - 12, r: 3, maxR: 36, life: 0.35, age: 0, c: '#CC2020'});
      }
    });
  }, 500);

  // ─── 阶段 3：投剑（0.9s）── 双分身同时朝玩家投 3 剑十字夹击 ───
  setTimeout(() => {
    if(!_safeCheck()) return;
    if(!lucia.blades) lucia.blades = [];
    // 重新锁定玩家此刻位置（动态目标）
    const tx = player.x, ty = player.y - 22;
    ghosts.forEach(g => {
      const baseDx = tx - g.x, baseDy = ty - g.y;
      const baseAng = Math.atan2(baseDy, baseDx);
      // 每分身投 3 把剑：中间直射 + 上下偏 12°
      for(let i = -1; i <= 1; i++){
        const a = baseAng + i * 0.21;     // ±12°
        const sp = 360;
        const ca = Math.cos(a), sa = Math.sin(a);
        // 复用现有 blades 投射器（自带命中 + 拖尾）
        lucia.blades.push({
          x: g.x + ca * 10,
          y: g.y + sa * 10,
          vx: ca * sp,
          vy: sa * sp,
          age: 0, life: 1.6,
          r: 14,
          dmg: 22,
          // 标记血影血剑（绘制可加色调，但现有 draw 不依赖此字段也可正常）
          _shadowCross: true,
        });
      }
      // 投射 FX：分身位置爆光（用 crescent 替代 speedline，避免 NaN）
      if(typeof _addFxShape === 'function'){
        _addFxShape('crescent', g.x, g.y - 12, {
          r: 30, startAng: baseAng - Math.PI*0.3, sweep: Math.PI*0.6,
          thickness: 5, palette: 'red', life: 0.30
        });
      }
      if(typeof shockwaves !== 'undefined'){
        shockwaves.push({x: g.x, y: g.y - 12, r: 4, maxR: 60, life: 0.40, age: 0, c: '#CC2020'});
      }
      if(typeof addParticle === 'function'){
        for(let i=0; i<12; i++){
          addParticle(g.x, g.y - 12, {n:1,
            c: i%2 ? '#FFFFFF' : '#CC2020',
            spd: 130 + Math.random()*60, r: 1.6, life: 0.35,
            spread: 0.20, angle: baseAng, gravity: 20});
        }
      }
    });
    if(typeof camShake === 'function') camShake(0.12, 5);
  }, 900);

  // ─── 阶段 4：分身淡去（1.4s）── 红雾溃散 ───
  setTimeout(() => {
    if(!_safeCheck()) return;
    ghosts.forEach(g => {
      if(typeof addParticle === 'function'){
        for(let i=0; i<14; i++){
          const a = Math.random() * Math.PI * 2;
          addParticle(g.x, g.y - 12, {n:1,
            c: i%2 ? '#660000' : '#CC2020',
            spd: 60 + Math.random()*50, r: 1.6, life: 0.55,
            spread: Math.PI*2, angle: a, gravity: 30});
        }
      }
      if(typeof shockwaves !== 'undefined'){
        shockwaves.push({x: g.x, y: g.y - 12, r: 2, maxR: 30, life: 0.40, age: 0, c: '#660000'});
      }
    });
  }, 1400);
}


// ═══════════════════════════════════════════════════════════════
// blood_chain — 血色锁链束缚（锁定玩家位置，1.2s 后伸出 4 条血锁）
// ═══════════════════════════════════════════════════════════════
function _luciaSpawnBloodChain(){
  if(!lucia) return;
  const lockX = player.x, lockY = player.y;
  const N = 4;
  for(let i=0; i<N; i++){
    const ang = i / N * Math.PI * 2 + Math.random()*0.2;
    lucia.bloodChains.push({
      cx: lockX, cy: lockY,
      ang: ang,
      reach: 70,
      age: 0,
      telegraphT: 1.2,
      strikeT: 0.35,
      fadeT: 0.5,
      dmg: 70,
      hit: false,
      state: 'telegraph',
    });
  }
  if(typeof shockwaves !== 'undefined'){
    shockwaves.push({x: lockX, y: lockY, r:4, maxR:90, life:0.5, age:0, c:'#CC2020'});
    shockwaves.push({x: lockX, y: lockY, r:2, maxR:60, life:0.4, age:0, c:'#660000'});
  }
  if(typeof camShake === 'function') camShake(0.18, 7);
  _luciaSpawnSkillText('血 锁 缚 灵', '#CC2020');
}

function _luciaUpdateBloodChains(dt){
  if(!lucia || !lucia.bloodChains || !lucia.bloodChains.length) return;
  const list = lucia.bloodChains;
  for(let i=list.length-1; i>=0; i--){
    const ch = list[i];
    ch.age += dt;
    if(ch.state === 'telegraph'){
      if(Math.random() < 0.4 && typeof addParticle === 'function'){
        const r = ch.reach * (0.3 + Math.random()*0.7);
        const x = ch.cx + Math.cos(ch.ang) * r;
        const y = ch.cy + Math.sin(ch.ang) * r;
        addParticle(x, y, {n:1, c: Math.random()<0.5?'#CC2020':'#660000',
          spd: 30+Math.random()*40, r: 1.6, life: 0.5,
          spread: Math.PI*2, angle: -Math.PI/2 + Math.random()*0.6 - 0.3,
          gravity: -30});
      }
      if(ch.age >= ch.telegraphT){
        ch.state = 'strike';
        ch._strikeAge = 0;
      }
    } else if(ch.state === 'strike'){
      ch._strikeAge += dt;
      if(!ch.hit){
        const dx = player.x - ch.cx;
        const dy = player.y - ch.cy;
        const d = Math.hypot(dx, dy);
        const escaping = (typeof player !== 'undefined') && (player.dashDur > 0);
        if(d < ch.reach && !escaping){
          ch.hit = true;
          const blocked = (typeof defendBlock==='function') && defendBlock(ch.cx, ch.cy);
          if(!blocked && playerHurtTimer <= 0 && typeof hurtPlayer === 'function'){
            hurtPlayer(ch.dmg, dx, dy - 40, 0.6, 0.5);
          }
          if(typeof shockwaves !== 'undefined'){
            shockwaves.push({x: ch.cx, y: ch.cy, r:4, maxR:90, life:0.4, age:0, c:'#CC2020'});
          }
          if(typeof addParticle === 'function'){
            for(let k=0; k<14; k++){
              const a = k / 14 * Math.PI * 2;
              addParticle(ch.cx, ch.cy, {n:1, c: k%2?'#CC2020':'#660000',
                spd: 140+Math.random()*60, r: 1.8, life: 0.4,
                spread: 0.1, angle: a, gravity: 30});
            }
          }
          if(typeof camShake === 'function') camShake(0.18, 8);
        }
      }
      if(ch._strikeAge >= ch.strikeT){
        ch.state = 'fade';
        ch._fadeAge = 0;
      }
    } else if(ch.state === 'fade'){
      ch._fadeAge += dt;
      if(ch._fadeAge >= ch.fadeT) list.splice(i, 1);
    }
  }
}

function _luciaDrawBloodChains(c){
  if(!lucia || !lucia.bloodChains || !lucia.bloodChains.length) return;
  for(const ch of lucia.bloodChains){
    const csx = ch.cx - ox();
    const csy = (ch.cy - oy()) * ISO_Y_SCALE;
    if(ch.state === 'telegraph'){
      const k = ch.age / ch.telegraphT;
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = `rgba(204,32,32,${0.4 + 0.5*Math.sin(ch.age*12)})`;
      c.lineWidth = 2 + 2*Math.sin(ch.age*10);
      c.beginPath();
      c.ellipse(csx, csy, ch.reach, ch.reach * 0.45, 0, 0, Math.PI*2);
      c.stroke();
      const lx = Math.cos(ch.ang) * ch.reach * k;
      const ly = Math.sin(ch.ang) * ch.reach * 0.45 * k;
      c.strokeStyle = `rgba(255,80,80,0.7)`;
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(csx, csy);
      c.lineTo(csx + lx, csy + ly);
      c.stroke();
      c.restore();
    } else if(ch.state === 'strike'){
      const k = Math.min(1, ch._strikeAge / ch.strikeT);
      c.save();
      const ex = ch.cx + Math.cos(ch.ang) * ch.reach * k;
      const ey = ch.cy + Math.sin(ch.ang) * ch.reach * k;
      const esx = ex - ox();
      const esy = (ey - oy()) * ISO_Y_SCALE;
      c.strokeStyle = '#660000';
      c.lineWidth = 5;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(csx, csy);
      c.lineTo(esx, esy);
      c.stroke();
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = `rgba(255,80,80,0.9)`;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(csx, csy);
      c.lineTo(esx, esy);
      c.stroke();
      const segs = 8;
      for(let s=1; s<=segs; s++){
        const t = s / segs;
        const px = csx + (esx - csx) * t;
        const py = csy + (esy - csy) * t;
        c.fillStyle = `rgba(120,0,0,0.95)`;
        c.fillRect(px-3, py-3, 6, 6);
        c.fillStyle = `rgba(255,80,80,0.5)`;
        c.fillRect(px-2, py-2, 4, 4);
      }
      c.fillStyle = '#CC2020';
      c.beginPath();
      c.arc(esx, esy, 6, 0, Math.PI*2);
      c.fill();
      c.restore();
    } else if(ch.state === 'fade'){
      const k = 1 - ch._fadeAge / ch.fadeT;
      const ex = ch.cx + Math.cos(ch.ang) * ch.reach;
      const ey = ch.cy + Math.sin(ch.ang) * ch.reach;
      const esx = ex - ox();
      const esy = (ey - oy()) * ISO_Y_SCALE;
      c.save();
      c.globalAlpha = k * 0.6;
      c.strokeStyle = '#660000';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(csx, csy);
      c.lineTo(esx, esy);
      c.stroke();
      c.restore();
    }
  }
}
 
