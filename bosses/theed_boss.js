// theed_boss.js — 木桩练习 Boss  v10  (combo + 5 skills + behavior tree)
(function(){
'use strict';

// ── 体型 / 帧 ──
const FRAME_W = 1280, FRAME_H = 720;
const CHAR_H_PX = 525;
const DRAW_H   = 84;
const SCALE    = DRAW_H / CHAR_H_PX;
const FULL_DH  = Math.round(FRAME_H * SCALE);

// ── 战斗参数 ──
const HP_MAX      = 5000;
const WALK_SPEED  = 68;
const CLOSE_RANGE = 176;
const MID_RANGE   = 320;
const FAR_RANGE   = 600;
const BLEND_DUR   = 0.18;
const ACCEL       = 6;

// 各动画 FPS
const FPS = {
  idle: 24, walk: 24, def: 216,
  atk01: 24, atk02: 24, atk03: 24,
  atk04: 24, atk05: 24, atk06: 24, atk07: 24, atk08: 24,
};

// ── 普攻连段（随机选） ──
// hits: [{ f: 触发帧, dmg, range, kx }]
const COMBO = {
  atk01: { dur: 48/24, hits: [{ f:22, dmg:18, range:92,  kx:160 }] },
  atk02: { dur: 53/24, hits: [{ f:24, dmg:22, range:100, kx:200 }] },
  atk03: { dur: 42/24, hits: [{ f:18, dmg:16, range:88,  kx:140 },
                              { f:30, dmg:20, range:90,  kx:180 }] },
};
const COMBO_KEYS = ['atk01', 'atk02', 'atk03'];

// ── 技能配置 ──
// atk04 「破云」突进刺击（中近距，快冲一刺）
// atk05 「乱舞」回转剑舞（贴身AOE，多段）
// atk06 「裂空」远程飞剑（扇形3飞剑）
// atk07 「剑阵」九宫剑阵（围杀大招，HP<70%解锁）
// atk08 「天降」流星剑落（区域剑雨，HP<70%解锁）
const SKILL_DEFS = {
  atk04: {
    dur: 41/24, cd: 3.5, minR: 80,  maxR: 280, phase: 1,
    dashStart: 10, dashEnd: 22, dashSpeed: 460,
    hits: [{ f:22, dmg:38, range:100, kx:280 }],
    name: '破云',
  },
  atk05: {
    dur: 82/24, cd: 5.0, minR: 0,   maxR: CLOSE_RANGE + 30, phase: 1,
    hits: [
      { f:30, dmg:14, range:130, kx:130 },
      { f:46, dmg:16, range:140, kx:160 },
      { f:62, dmg:22, range:150, kx:220 },
    ],
    spinFx: true,
    name: '乱舞',
  },
  atk06: {
    dur: 64/24, cd: 4.5, minR: 200, maxR: FAR_RANGE, phase: 1,
    shootFrame: 32, projCount: 3, projSpread: 0.32, projSpeed: 340, projDmg: 28,
    name: '裂空',
  },
  atk07: {
    dur: 144/24, cd: 13, minR: 100, maxR: FAR_RANGE, phase: 2,
    chargeEnd: 40, summonFrame: 56, convergeStart: 96, convergeEnd: 120,
    swordCount: 6, swordRadius: 130, swordDmg: 26,
    name: '剑阵',
  },
  atk08: {
    dur: 96/24, cd: 10, minR: 60,  maxR: MID_RANGE + 100, phase: 2,
    strikeFrames: [42, 52, 62, 72, 82],
    strikeRange: 95, strikeDmg: 26, telegraph: 0.55,
    name: '天降',
  },
};
const SKILL_KEYS = ['atk04', 'atk05', 'atk06', 'atk07', 'atk08'];

function lerp(a, b, t){ return a + (b - a) * t; }

// 是否在攻击/技能态
function isAtkState(s){ return s && s.indexOf('atk') === 0; }

function spawnTheed(x, y){
  const t = {
    x, y,
    _vx: 0, _vy: 0,
    facing: -1,
    hp: HP_MAX, maxHp: HP_MAX,
    state: 'idle',
    _animT: 0,
    _defT: 0, _defCD: 0, _defDur: 0,
    _hurtFlash: 0,
    _stepT: 0,
    _prevState: null,
    _prevAnimT: 0,
    _blendT: BLEND_DUR,
    isTheed: true,

    // ── 行为树状态 ──
    _decisionT: 0.6,        // 下一次决策等待
    _comboCount: 0,         // 当前连段数
    _comboMax: 2,
    _hitFlags: [],          // 当前攻击已触发的命中标记

    // ── 技能 ──
    _skillCD: { atk04:0, atk05:0, atk06:0, atk07:0, atk08:0 },
    _skill: null,           // 当前正在执行的技能 key
    _skillDef: null,
    _skillT: 0,             // 技能内部计时（秒）
    _skillData: null,       // 技能临时数据（剑阵的 swords 等）

    _calcDefDur(){
      const pool = window.THEED_IMG && window.THEED_IMG.def;
      return (pool && pool.length > 0) ? pool.length / FPS.def : 1.0;
    },

    _setState(next){
      if(next === this.state) return;
      this._prevState = this.state;
      this._prevAnimT = this._animT;
      this._blendT    = 0;
      this.state      = next;
      this._animT     = 0;
      this._hitFlags  = [];
    },

    takeDamage(dmg, kx, ky){
      if(this.state === 'dead') return;

      if(this.state === 'def'){
        this._hurtFlash = 0.2;
        if(typeof camShake === 'function') camShake(0.06, 3);
        if(typeof addParticle === 'function'){
          for(let i=0;i<40;i++){
            const cc=['#000000','#0A0A0A','#111111','#0A0A1A','#1A0A0A','#050505'][i%6];
            addParticle(this.x, this.y-50, {n:1, c:cc,
              spd:30+Math.random()*120, r:1.5+Math.random()*3,
              life:0.6+Math.random()*0.7,
              spread:Math.PI*2, angle:Math.random()*Math.PI*2, gravity:-60-Math.random()*40});
          }
          for(let i=0;i<18;i++){
            addParticle(this.x+(Math.random()-.5)*40, this.y-30, {n:1,
              c:i%2===0?'#080808':'#0D0D15',
              spd:15+Math.random()*30, r:2+Math.random()*3.5,
              life:0.9+Math.random()*0.6,
              spread:0.5, angle:-Math.PI/2+(Math.random()-.5)*0.6, gravity:-20});
          }
          for(let i=0;i<12;i++){
            addParticle(this.x, this.y-55, {n:1, c:'#FFFFFF',
              spd:180+Math.random()*100, r:1+Math.random()*1.5, life:0.12+Math.random()*0.1,
              spread:Math.PI*2, angle:Math.random()*Math.PI*2});
          }
          for(let i=0;i<8;i++){
            addParticle(this.x, this.y-55, {n:1, c:'#8833FF',
              spd:100+Math.random()*80, r:1, life:0.2,
              spread:Math.PI*2, angle:Math.random()*Math.PI*2});
          }
        }
        if(typeof dmgNums!=='undefined'&&typeof DMGNUM_MAX!=='undefined'&&dmgNums.length<DMGNUM_MAX)
          dmgNums.push({x:this.x, y:this.y-90, val:'BLOCK', age:0, life:1.0, vy:-40});
        return;
      }

      this.hp = Math.max(0, this.hp - dmg);
      this._hurtFlash = 0.18;
      if(typeof camShake === 'function') camShake(0.05 + dmg*0.001, 2);
      if(this.hp <= 0){
        this._setState('dead');
        if(typeof addParticle === 'function')
          addParticle(this.x, this.y-60, {n:24, c:'#888', spd:100, r:3, life:0.8, spread:Math.PI*2});
      }
    },

    _phase(){
      const r = this.hp / this.maxHp;
      if(r < 0.4) return 3;
      if(r < 0.7) return 2;
      return 1;
    },

    // 触发普攻（随机选）
    _startCombo(player){
      const key = COMBO_KEYS[Math.floor(Math.random() * COMBO_KEYS.length)];
      this._setState(key);
      this._skill = null;
      this._skillDef = null;
      this._skillT = 0;
    },

    // 触发技能
    _startSkill(key, player){
      const def = SKILL_DEFS[key];
      this._setState(key);
      this._skill = key;
      this._skillDef = def;
      this._skillT = 0;
      this._skillCD[key] = def.cd;
      this._skillData = null;

      if(key === 'atk04'){
        // 突进方向锁定
        const dx = player.x - this.x, dy = player.y - this.y;
        const d  = Math.hypot(dx, dy) || 1;
        this._skillData = { dirX: dx/d, dirY: dy/d };
        if(typeof camShake === 'function') camShake(0.04, 2);
      } else if(key === 'atk05'){
        if(typeof camShake === 'function') camShake(0.05, 2);
      } else if(key === 'atk06'){
        const dx = player.x - this.x, dy = player.y - this.y;
        this._skillData = { aimAng: Math.atan2(dy, dx), shot: false };
      } else if(key === 'atk07'){
        // 剑阵：锁定玩家位置作为中心
        this._skillData = {
          centerX: player.x, centerY: player.y,
          summoned: false, swords: [], converged: false,
        };
      } else if(key === 'atk08'){
        // 流星剑落：5 个落点
        const strikes = [];
        const px = player.x, py = player.y;
        for(let i = 0; i < 5; i++){
          strikes.push({
            x: px + (Math.random()-0.5) * 220,
            y: py + (Math.random()-0.5) * 90,
            triggered: false,
          });
        }
        this._skillData = { strikes };
      }
    },

    // 技能内部更新（位移、特效、伤害）
    _updateSkill(dt, player){
      // 普攻分支
      if(this._skill === null){
        const cdef = COMBO[this.state];
        if(!cdef) return;
        const fps = FPS[this.state] || 24;
        const fi  = Math.floor(this._animT * fps);
        for(let h = 0; h < cdef.hits.length; h++){
          const hit = cdef.hits[h];
          if(this._hitFlags[h]) continue;
          if(fi >= hit.f){
            this._hitFlags[h] = true;
            this._tryMeleeHit(player, hit);
          }
        }
        return;
      }

      // 技能分支
      const def = this._skillDef;
      if(!def) return;
      this._skillT += dt;
      const fps = FPS[this._skill] || 24;
      const fi  = Math.floor(this._animT * fps);

      const key = this._skill;

      if(key === 'atk04'){
        // 突进 + 一刺
        if(fi >= def.dashStart && fi <= def.dashEnd && this._skillData){
          const k = 1 - Math.exp(-12 * dt);
          this._vx = lerp(this._vx, this._skillData.dirX * def.dashSpeed, k);
          this._vy = lerp(this._vy, this._skillData.dirY * def.dashSpeed, k);
          this.x  += this._vx * dt;
          this.y  += this._vy * dt;
          // 风迹粒子
          if(typeof addParticle === 'function' && Math.random() < 0.7){
            addParticle(this.x, this.y - 40, {
              n:1, c:'#101015',
              spd: 40 + Math.random()*30, r: 2.5 + Math.random()*2,
              life: 0.35, spread: Math.PI*0.6,
              angle: Math.atan2(-this._skillData.dirY, -this._skillData.dirX),
            });
          }
        } else {
          this._vx = lerp(this._vx, 0, 1 - Math.exp(-10*dt));
          this._vy = lerp(this._vy, 0, 1 - Math.exp(-10*dt));
          this.x  += this._vx * dt;
          this.y  += this._vy * dt;
        }
        // 命中
        for(let h = 0; h < def.hits.length; h++){
          const hit = def.hits[h];
          if(this._hitFlags[h]) continue;
          if(fi >= hit.f){
            this._hitFlags[h] = true;
            this._tryMeleeHit(player, hit);
            // 突进刺击命中加强：白光闪
            if(typeof addParticle === 'function'){
              for(let i = 0; i < 14; i++){
                addParticle(this.x + this.facing*40, this.y - 36, {
                  n:1, c: i%2 ? '#FFFFFF' : '#DDDDFF',
                  spd: 120 + Math.random()*100, r: 1.5,
                  life: 0.25, spread: Math.PI*0.5,
                  angle: this.facing > 0 ? 0 : Math.PI,
                });
              }
            }
          }
        }
      }
      else if(key === 'atk05'){
        // 旋转剑舞：原地多段 AOE
        for(let h = 0; h < def.hits.length; h++){
          const hit = def.hits[h];
          if(this._hitFlags[h]) continue;
          if(fi >= hit.f){
            this._hitFlags[h] = true;
            this._tryMeleeHit(player, hit);
          }
        }
        // 持续旋转水墨粒子
        if(typeof addParticle === 'function' && fi > 22 && fi < 70){
          const nspawn = 3;
          for(let i = 0; i < nspawn; i++){
            const ang = this._animT * 8 + i * (Math.PI*2/nspawn);
            const rd  = 70 + Math.sin(this._animT*4 + i)*15;
            addParticle(this.x + Math.cos(ang)*rd, this.y - 40 + Math.sin(ang)*rd*0.5, {
              n:1, c: i%2 ? '#0A0A12' : '#15151E',
              spd: 30 + Math.random()*30, r: 2.5 + Math.random()*2,
              life: 0.5 + Math.random()*0.3, spread: Math.PI*2,
              angle: Math.random()*Math.PI*2, gravity: -10,
            });
          }
        }
      }
      else if(key === 'atk06'){
        // 飞剑：单次发射
        if(!this._skillData.shot && fi >= def.shootFrame){
          this._skillData.shot = true;
          this._spawnFlyingSwords(player, def);
        }
      }
      else if(key === 'atk07'){
        // 剑阵
        const sd = this._skillData;
        // 蓄力期：地标
        if(fi < def.summonFrame && typeof addParticle === 'function'){
          if(Math.random() < 0.4){
            const ang = Math.random() * Math.PI * 2;
            const rd  = def.swordRadius + (Math.random()-0.5)*16;
            addParticle(sd.centerX + Math.cos(ang)*rd,
                        sd.centerY + Math.sin(ang)*rd*0.7, {
              n:1, c:'#FFAA00',
              spd: 8 + Math.random()*10, r: 2 + Math.random()*1.5,
              life: 0.5, spread: Math.PI*2,
              angle: Math.random()*Math.PI*2, gravity: -12,
            });
          }
        }
        // 召唤：6 把剑围圈
        if(!sd.summoned && fi >= def.summonFrame){
          sd.summoned = true;
          for(let i = 0; i < def.swordCount; i++){
            const a  = (Math.PI * 2 / def.swordCount) * i;
            const x0 = sd.centerX + Math.cos(a) * def.swordRadius;
            const y0 = sd.centerY + Math.sin(a) * def.swordRadius * 0.7;
            sd.swords.push({
              x0, y0,                     // 起始
              tx: sd.centerX, ty: sd.centerY, // 目标
              x: x0, y: y0,
              ang: a + Math.PI,           // 朝向圆心
              prog: 0,                    // 0~1 收束进度
            });
          }
          if(typeof camShake === 'function') camShake(0.08, 4);
          if(typeof addParticle === 'function'){
            for(let i = 0; i < 30; i++){
              addParticle(sd.centerX, sd.centerY, {
                n:1, c: i%2 ? '#FFCC44' : '#FFFFFF',
                spd: 60 + Math.random()*50, r: 1.5 + Math.random()*1.5,
                life: 0.4, spread: Math.PI*2,
                angle: Math.random()*Math.PI*2,
              });
            }
          }
        }
        // 收束：所有剑同时冲向圆心
        if(sd.summoned && !sd.converged && fi >= def.convergeStart){
          const tprog = (fi - def.convergeStart) / (def.convergeEnd - def.convergeStart);
          const p = Math.max(0, Math.min(1, tprog));
          for(const s of sd.swords){
            s.prog = p;
            s.x = lerp(s.x0, s.tx, p);
            s.y = lerp(s.y0, s.ty, p);
          }
          // 命中（在收束完成的瞬间）
          if(p >= 1 && !sd.converged){
            sd.converged = true;
            // 检测玩家是否在中心附近
            const ddx = player.x - sd.centerX;
            const ddy = player.y - sd.centerY;
            if(Math.hypot(ddx, ddy) < 80){
              if(typeof hurtPlayer === 'function'){
                if(typeof defendBlock === 'function' && defendBlock(sd.centerX, sd.centerY)){
                  // 玩家格挡了
                } else {
                  hurtPlayer(def.swordDmg * def.swordCount * 0.3,
                             ddx*0.3, ddy*0.3 - 100);
                }
              }
            }
            if(typeof camShake === 'function') camShake(0.15, 6);
            if(typeof addParticle === 'function'){
              for(let i = 0; i < 50; i++){
                addParticle(sd.centerX, sd.centerY, {
                  n:1, c: i%3===0 ? '#FFFFFF' : i%2 ? '#FFCC44' : '#0A0A14',
                  spd: 100 + Math.random()*120, r: 2 + Math.random()*2,
                  life: 0.5 + Math.random()*0.3, spread: Math.PI*2,
                  angle: Math.random()*Math.PI*2,
                });
              }
            }
          }
        }
      }
      else if(key === 'atk08'){
        const sd = this._skillData;
        // 落雷剑雨
        for(let i = 0; i < sd.strikes.length; i++){
          const s  = sd.strikes[i];
          const tf = def.strikeFrames[i];
          if(s.triggered) continue;

          // 提前 telegraph 秒做地标
          if(fi >= tf - def.telegraph * 24 && typeof addParticle === 'function'){
            if(Math.random() < 0.6){
              addParticle(s.x + (Math.random()-0.5)*60, s.y + (Math.random()-0.5)*30, {
                n:1, c:'#CC4422',
                spd: 6 + Math.random()*8, r: 2 + Math.random()*1.5,
                life: 0.4, spread: Math.PI*2,
                angle: Math.random()*Math.PI*2, gravity: -8,
              });
            }
          }

          if(fi >= tf){
            s.triggered = true;
            // 命中检测
            const ddx = player.x - s.x;
            const ddy = player.y - s.y;
            if(Math.hypot(ddx, ddy) < def.strikeRange){
              if(typeof defendBlock === 'function' && defendBlock(s.x, s.y)){
                // 格挡
              } else if(typeof hurtPlayer === 'function'){
                hurtPlayer(def.strikeDmg, ddx*0.5, ddy*0.5 - 80);
              }
            }
            // 冲击波 + 粒子
            if(typeof shockwaves !== 'undefined'){
              shockwaves.push({ x:s.x, y:s.y, r:6, maxR:90, life:0.35, age:0, c:'#FF6622' });
            }
            if(typeof camShake === 'function') camShake(0.08, 3);
            if(typeof addParticle === 'function'){
              for(let k = 0; k < 22; k++){
                addParticle(s.x, s.y, {
                  n:1, c: k%3===0 ? '#FFFFFF' : k%2 ? '#FF7733' : '#0A0A0A',
                  spd: 80 + Math.random()*120, r: 2 + Math.random()*2,
                  life: 0.4 + Math.random()*0.3, spread: Math.PI*2,
                  angle: Math.random()*Math.PI*2, gravity: -50,
                });
              }
            }
          }
        }
      }
    },

    // 普攻 / 技能近战命中
    _tryMeleeHit(player, hit){
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      if(Math.hypot(dx, dy) > hit.range) return;
      // 检查朝向（必须在面向一侧 ±90°）
      if(Math.sign(dx) !== this.facing && Math.abs(dx) > 30) return;

      if(typeof defendBlock === 'function' && defendBlock(this.x + this.facing*30, this.y - 30)){
        return;
      }
      if(typeof hurtPlayer === 'function'){
        hurtPlayer(hit.dmg, this.facing * hit.kx, -40);
      }
      if(typeof camShake === 'function') camShake(0.05, 2);
      if(typeof addParticle === 'function'){
        for(let i = 0; i < 8; i++){
          addParticle(player.x, player.y - 30, {
            n:1, c: i%2 ? '#FF4422' : '#FFAA66',
            spd: 80 + Math.random()*60, r: 1.5 + Math.random(),
            life: 0.25, spread: Math.PI*2,
            angle: Math.random()*Math.PI*2,
          });
        }
      }
    },

    // 投出 3 飞剑
    _spawnFlyingSwords(player, def){
      if(typeof bossProjectiles === 'undefined') return;
      const ang = this._skillData.aimAng;
      for(let i = 0; i < def.projCount; i++){
        const a = ang + (i - (def.projCount-1)/2) * def.projSpread;
        bossProjectiles.push({
          x: this.x + this.facing * 24,
          y: this.y - 40,
          vx: Math.cos(a) * def.projSpeed,
          vy: Math.sin(a) * def.projSpeed,
          r: 9, life: 1.6, age: 0,
          dmg: def.projDmg,
          type: 'beam_fast',
          angle: a, trail: [],
          glow: '#88AAFF', core: '#EEEEFF',
        });
      }
      if(typeof addParticle === 'function'){
        for(let i = 0; i < 16; i++){
          addParticle(this.x + this.facing*24, this.y - 40, {
            n:1, c: i%2 ? '#AACCFF' : '#FFFFFF',
            spd: 90 + Math.random()*80, r: 1.5,
            life: 0.3, spread: 0.6, angle: ang,
          });
        }
      }
      if(typeof camShake === 'function') camShake(0.08, 3);
    },

    update(dt, player){
      if(!player) return;
      this._animT += dt;
      if(this._blendT < BLEND_DUR) this._blendT += dt;
      if(this._defCD > 0)        this._defCD -= dt;
      if(this._hurtFlash > 0)    this._hurtFlash -= dt;

      // 技能 CD
      for(const k in this._skillCD){
        if(this._skillCD[k] > 0) this._skillCD[k] -= dt;
      }

      if(this.state === 'dead') return;

      const pdx = player.x - this.x;
      const pdy = player.y - this.y;
      const pd  = Math.hypot(pdx, pdy) || 1;

      // 攻击/技能态期间不重新选朝向（保持锁定）
      if(!isAtkState(this.state) && this.state !== 'def'){
        this.facing = pdx >= 0 ? 1 : -1;
      }

      // ── 玩家攻击 → 100% 触发格挡 (仅 idle/walk 时) ──
      if(window._playerAttackFlag && this._defCD <= 0
          && this.state !== 'def' && !isAtkState(this.state)){
        this._defDur = this._calcDefDur();
        this._defT   = this._defDur;
        this._defCD  = this._defDur + 0.1;
        this._setState('def');
      }

      // ── def 倒计时 ──
      if(this.state === 'def'){
        this._defT -= dt;
        if(this._defT <= 0){
          this._setState(pd > CLOSE_RANGE ? 'walk' : 'idle');
        }
        this._vx = lerp(this._vx, 0, 1 - Math.exp(-8*dt));
        this._vy = lerp(this._vy, 0, 1 - Math.exp(-8*dt));
        return;
      }

      // ── 攻击状态：执行命中、特效、推进 ──
      if(isAtkState(this.state)){
        const fps = FPS[this.state] || 24;
        const totalDur = this._skill ? this._skillDef.dur : COMBO[this.state].dur;
        this._updateSkill(dt, player);

        // 攻击期间速度衰减（atk04 突进里自己处理位移）
        if(this._skill !== 'atk04'){
          const k = 1 - Math.exp(-12 * dt);
          this._vx = lerp(this._vx, 0, k);
          this._vy = lerp(this._vy, 0, k);
          this.x  += this._vx * dt;
          this.y  += this._vy * dt;
        }

        // 攻击结束 → 回 idle
        if(this._animT >= totalDur){
          // 普攻可能继续连段
          if(this._skill === null){
            this._comboCount++;
            if(this._comboCount < this._comboMax && pd < CLOSE_RANGE + 30){
              this._startCombo(player);
            } else {
              this._comboCount = 0;
              this._setState('idle');
              this._decisionT = 0.35 + Math.random() * 0.4;
            }
          } else {
            this._skill = null;
            this._skillDef = null;
            this._skillData = null;
            this._setState('idle');
            this._decisionT = 0.5 + Math.random() * 0.6;
          }
        }
        return;
      }

      // ── 行为决策（idle/walk） ──
      this._decisionT -= dt;
      const phase = this._phase();

      if(this._decisionT <= 0){
        this._decisionT = 0.3 + Math.random() * 0.4;

        // 技能优先级（按距离 + CD 筛选）
        const candidates = [];
        for(const k of SKILL_KEYS){
          const def = SKILL_DEFS[k];
          if(this._skillCD[k] > 0) continue;
          if(def.phase > phase)    continue;
          if(pd < def.minR || pd > def.maxR) continue;
          candidates.push(k);
        }

        // phase3 攻击欲望加成
        const skillChance = phase === 3 ? 0.55 : phase === 2 ? 0.42 : 0.30;

        if(candidates.length > 0 && Math.random() < skillChance){
          const k = candidates[Math.floor(Math.random() * candidates.length)];
          this._startSkill(k, player);
          return;
        }

        // 普攻范围内 → 触发普攻
        if(pd < CLOSE_RANGE - 10){
          this._comboMax = phase === 3 ? 3 : phase === 2 ? 2 : 2;
          this._startCombo(player);
          return;
        }
      }

      // ── 移动逻辑 ──
      if(pd > CLOSE_RANGE){
        this._setState('walk');
        const tx = (pdx / pd) * WALK_SPEED;
        const ty = (pdy / pd) * WALK_SPEED;
        const k  = 1 - Math.exp(-ACCEL * dt);
        this._vx = lerp(this._vx, tx, k);
        this._vy = lerp(this._vy, ty, k);
      } else {
        this._setState('idle');
        const k = 1 - Math.exp(-10 * dt);
        this._vx = lerp(this._vx, 0, k);
        this._vy = lerp(this._vy, 0, k);
      }
      this.x += this._vx * dt;
      this.y += this._vy * dt;

      // 脚步烟尘
      if(this.state === 'walk' && typeof addParticle === 'function'){
        this._stepT -= dt;
        if(this._stepT <= 0){
          this._stepT = 0.16 + Math.random() * 0.08;
          const dustColors = ['#7A6548','#9A8060','#5E4A32','#887060'];
          for(let i = 0; i < 4; i++){
            addParticle(
              this.x + (Math.random()-0.5) * 14,
              this.y + (Math.random()-0.5) * 5,
              { n:1, c: dustColors[i % dustColors.length],
                spd: 6 + Math.random()*14, r: 1.8 + Math.random()*2.5,
                life: 0.35 + Math.random()*0.25,
                spread: Math.PI*2, angle: Math.random()*Math.PI*2,
                gravity: -22 }
            );
          }
        }
      }
    },

    draw(ctx, ox_, oy_, ISO_Y_SCALE){
      const ISO = ISO_Y_SCALE || 1;
      const sx  = this.x - (ox_ || 0);
      const sy  = (this.y - (oy_ || 0)) * ISO;

      ctx.save();

      // 阴影
      ctx.save();
      ctx.filter = 'blur(10px)';
      const shadowCY = sy - DRAW_H * 0.18;
      const shadowRX = DRAW_H * 0.38;
      const shadowRY = shadowRX * 0.22;
      const shadowLayers = [
        { scale: 1.0, op: 0.28 },
        { scale: 1.4, op: 0.12 },
        { scale: 1.9, op: 0.05 },
      ];
      for(const l of shadowLayers){
        const g = ctx.createRadialGradient(sx, shadowCY, 0, sx, shadowCY, shadowRX * l.scale);
        g.addColorStop(0,   `rgba(0,0,0,${l.op})`);
        g.addColorStop(0.6, `rgba(0,0,0,${(l.op*0.4).toFixed(2)})`);
        g.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(sx, shadowCY, shadowRX * l.scale, shadowRY * l.scale, 0, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.restore();

      if(this.state === 'dead'){ ctx.restore(); return; }

      // ── 帧渲染（含交叉淡出） ──
      const blendAlpha = Math.min(1, this._blendT / BLEND_DUR);

      const drawFrame = (key, animT, alpha) => {
        const pool = window.THEED_IMG && window.THEED_IMG[key];
        if(!pool || pool.length === 0) return;
        const fps = FPS[key] || 24;
        // idle/walk 循环；def + atk 类不循环（夹住末帧）
        const noLoop = key === 'def' || key.indexOf('atk') === 0;
        const fi  = noLoop
          ? Math.min(Math.floor(animT * fps), pool.length - 1)
          : Math.floor(animT * fps) % pool.length;
        const img = pool[fi];
        if(!img || !img.complete || !img.naturalWidth) return;

        const natW = img.naturalWidth, natH = img.naturalHeight;
        const dh   = FULL_DH;
        const dw   = natW / natH * dh;
        const ctrX = 685 / FRAME_W * dw;
        const feetY= 615 / FRAME_H * dh;

        ctx.save();
        ctx.globalAlpha = alpha;
        if(this._hurtFlash > 0) ctx.filter = 'brightness(2) saturate(0)';
        if(this.facing > 0){
          ctx.translate(sx, 0); ctx.scale(-1, 1); ctx.translate(-sx, 0);
        }
        ctx.drawImage(img, sx - ctrX, sy - feetY, dw, dh);
        ctx.filter = 'none';
        ctx.restore();
      };

      const curKey  = this.state;
      const prevKey = this._prevState || 'idle';

      if(this._prevState && blendAlpha < 1){
        drawFrame(prevKey, this._prevAnimT + this._blendT, 1 - blendAlpha);
      }
      drawFrame(curKey, this._animT, blendAlpha < 1 ? blendAlpha : 1);

      // ── def 水墨烟雾 ──
      if(this.state === 'def' || (this._prevState === 'def' && this._blendT < BLEND_DUR)){
        const fadeIn  = this.state === 'def'
          ? Math.min(1, (this._defDur - this._defT + 0.06) / 0.12) : 0;
        const fadeOut = this.state === 'def'
          ? Math.min(1, this._defT / 0.25)
          : Math.max(0, 1 - this._blendT / BLEND_DUR);
        const sa = Math.min(fadeIn, fadeOut);
        if(sa > 0.01){
          const shieldX = sx + this.facing * 14;
          const shieldY = sy - 42;
          const t = this._animT;
          const P = [
            [  0, 0.00, 0.00,  26, 0.82, 1],
            [ 18, 0.90, 0.00,  22, 0.64, 2],
            [ 16, 0.90, 1.26,  20, 0.60, 2],
            [ 19, 0.90, 2.51,  21, 0.58, 2],
            [ 17, 0.90, 3.77,  19, 0.55, 2],
            [ 18,-0.70, 5.03,  22, 0.52, 2],
            [ 38, 0.45, 0.00,  24, 0.32, 5],
            [ 36, 0.45, 0.90,  22, 0.28, 5],
            [ 40, 0.45, 1.80,  25, 0.26, 5],
            [ 37,-0.38, 2.70,  21, 0.24, 6],
            [ 39, 0.45, 3.60,  23, 0.22, 5],
            [ 36,-0.38, 4.50,  24, 0.20, 6],
            [ 41, 0.45, 5.40,  22, 0.18, 5],
            [ 66, 0.22, 0.00,  26, 0.11, 9],
            [ 62, 0.22, 1.05,  24, 0.10, 9],
            [ 68,-0.18, 2.09,  27, 0.09, 10],
            [ 64, 0.22, 3.14,  25, 0.09, 9],
            [ 67,-0.18, 4.19,  23, 0.08, 10],
            [ 63, 0.22, 5.24,  26, 0.07, 10],
            [ 92, 0.12, 0.52,  28, 0.05, 13],
            [ 88, 0.12, 2.62,  26, 0.04, 13],
            [ 94,-0.10, 4.71,  27, 0.04, 14],
          ];

          ctx.save();
          ctx.globalAlpha = sa * 0.88;
          ctx.translate(shieldX, shieldY);

          for(const [dist, spd, phase, r, op, blur] of P){
            const angle = t * spd + phase;
            const cx = Math.cos(angle) * dist;
            const cy = Math.sin(angle) * dist * 0.72;
            ctx.save();
            ctx.filter = `blur(${blur}px)`;
            ctx.translate(cx, cy);
            const g = ctx.createRadialGradient(0,0,0, 0,0,r);
            g.addColorStop(0,    `rgba(7,5,3,${op})`);
            g.addColorStop(0.5,  `rgba(4,3,2,${(op*0.4).toFixed(2)})`);
            g.addColorStop(1,    'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          ctx.restore();
        }
      }

      // ── 剑阵：在玩家位置画蓄力法阵 + 6 把剑 ──
      if(this._skill === 'atk07' && this._skillData){
        const sd = this._skillData;
        const cx = sd.centerX - (ox_ || 0);
        const cy = (sd.centerY - (oy_ || 0)) * ISO;

        // 蓄力地标圆环
        const fps = 24;
        const fi  = Math.floor(this._animT * fps);
        const def = this._skillDef;
        const chargeP = Math.min(1, fi / def.summonFrame);

        ctx.save();
        ctx.globalAlpha = 0.5 * chargeP;
        ctx.strokeStyle = '#FFAA22';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, def.swordRadius, def.swordRadius * 0.7,
                    this._animT * 0.8, 0, Math.PI*2);
        ctx.stroke();
        // 内圈
        ctx.globalAlpha = 0.3 * chargeP;
        ctx.beginPath();
        ctx.ellipse(cx, cy, def.swordRadius * 0.6, def.swordRadius * 0.42,
                    -this._animT * 1.2, 0, Math.PI*2);
        ctx.stroke();
        ctx.restore();

        // 6 把剑
        if(sd.swords && sd.swords.length){
          ctx.save();
          for(const s of sd.swords){
            const sxw = s.x - (ox_ || 0);
            const syw = (s.y - (oy_ || 0)) * ISO;
            const ang = Math.atan2(s.ty - s.y0, s.tx - s.x0);
            const len = 26;

            // 剑光尾迹
            ctx.globalAlpha = 0.85;
            ctx.strokeStyle = '#FFE0AA';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(sxw, syw);
            ctx.lineTo(sxw + Math.cos(ang) * len, syw + Math.sin(ang) * len);
            ctx.stroke();

            ctx.globalAlpha = 1.0;
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(sxw, syw);
            ctx.lineTo(sxw + Math.cos(ang) * len * 0.85,
                       syw + Math.sin(ang) * len * 0.85);
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      // ── 流星剑落：地面落点标记 ──
      if(this._skill === 'atk08' && this._skillData){
        const sd = this._skillData;
        const def = this._skillDef;
        const fps = 24;
        const fi  = Math.floor(this._animT * fps);
        for(let i = 0; i < sd.strikes.length; i++){
          const s = sd.strikes[i];
          const tf = def.strikeFrames[i];
          const tStart = tf - def.telegraph * fps;
          if(s.triggered) continue;
          if(fi < tStart) continue;

          const p = (fi - tStart) / (tf - tStart);
          const sxw = s.x - (ox_ || 0);
          const syw = (s.y - (oy_ || 0)) * ISO;
          ctx.save();
          // 红色危险标记
          ctx.globalAlpha = 0.4 + 0.4 * p;
          ctx.strokeStyle = '#FF3322';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(sxw, syw, def.strikeRange, def.strikeRange * 0.5,
                      0, 0, Math.PI*2);
          ctx.stroke();
          // 内圈填充提示
          ctx.globalAlpha = 0.18 * p;
          ctx.fillStyle = '#FF6633';
          ctx.beginPath();
          ctx.ellipse(sxw, syw, def.strikeRange * 0.85, def.strikeRange * 0.42,
                      0, 0, Math.PI*2);
          ctx.fill();
          ctx.restore();
        }
      }

      ctx.restore();
    }
  };
  return t;
}

window.spawnTheed = spawnTheed;

})();
