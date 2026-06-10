// theed_boss.js — 木桩练习 Boss  v9
(function(){
'use strict';

const FRAME_W = 1280, FRAME_H = 720;
const CHAR_H_PX = 525;
const DRAW_H   = 84;             // 体型 ×1.2
const SCALE    = DRAW_H / CHAR_H_PX;
const FULL_DW  = Math.round(FRAME_W * SCALE);
const FULL_DH  = Math.round(FRAME_H * SCALE);
const FEET_Y   = Math.round(615  * SCALE);
const CTR_X    = Math.round(685  * SCALE);

const HP_MAX      = 5000;
const WALK_SPEED  = 68;
const CLOSE_RANGE = 176;
const BLEND_DUR   = 0.18;   // 动作切换交叉淡出时长(s)
const ACCEL       = 6;      // 速度平滑系数（越大跟随越紧）
const FPS = { idle: 24, walk: 24, def: 216 };

function lerp(a, b, t){ return a + (b - a) * t; }

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
    _stepT: 0,             // 脚步烟尘计时
    // 动作融合
    _prevState: null,
    _prevAnimT: 0,
    _blendT: BLEND_DUR,
    isTheed: true,

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
    },

    takeDamage(dmg, kx, ky){
      if(this.state === 'dead') return;

      if(this.state === 'def'){
        // 100% 格挡
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

    update(dt, player){
      if(!player) return;
      this._animT += dt;
      if(this._blendT < BLEND_DUR) this._blendT += dt;
      if(this._defCD > 0) this._defCD -= dt;
      if(this._hurtFlash > 0) this._hurtFlash -= dt;

      if(this.state === 'dead') return;

      const pdx = player.x - this.x;
      const pdy = player.y - this.y;
      const pd  = Math.hypot(pdx, pdy) || 1;

      this.facing = pdx >= 0 ? 1 : -1;

      // 侦测玩家出手 → 100% 触发格挡
      if(window._playerAttackFlag && this._defCD <= 0 && this.state !== 'def'){
        this._defDur = this._calcDefDur();
        this._defT   = this._defDur;
        this._defCD  = this._defDur + 0.1;
        this._setState('def');
      }

      // def 倒计时
      if(this.state === 'def'){
        this._defT -= dt;
        if(this._defT <= 0){
          this._setState(pd > CLOSE_RANGE ? 'walk' : 'idle');
        }
        // def 期间停止移动，速度归零
        this._vx = lerp(this._vx, 0, 1 - Math.exp(-8*dt));
        this._vy = lerp(this._vy, 0, 1 - Math.exp(-8*dt));
        return;
      }

      // 移动逻辑 — 缓动速度
      if(pd > CLOSE_RANGE){
        this._setState('walk');
        const tx = (pdx / pd) * WALK_SPEED;
        const ty = (pdy / pd) * WALK_SPEED;
        const k  = 1 - Math.exp(-ACCEL * dt);
        this._vx = lerp(this._vx, tx, k);
        this._vy = lerp(this._vy, ty, k);
      } else {
        this._setState('idle');
        // 减速停下
        const k = 1 - Math.exp(-10 * dt);
        this._vx = lerp(this._vx, 0, k);
        this._vy = lerp(this._vy, 0, k);
      }
      this.x += this._vx * dt;
      this.y += this._vy * dt;

      // ── 脚步烟尘 ──
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

      // 阴影（黑雾状，无硬边）
      ctx.save();
      ctx.filter = 'blur(10px)';
      const shadowCY = sy - DRAW_H * 0.18;   // 往上偏移
      const shadowRX = DRAW_H * 0.38;
      const shadowRY = shadowRX * 0.22;
      // 多层叠加，边缘极虚
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
        const fi  = key === 'def'
          ? Math.min(Math.floor(animT * fps), pool.length - 1)
          : Math.floor(animT * fps) % pool.length;
        const img = pool[fi];
        if(!img || !img.complete || !img.naturalWidth) return;

        // 用实际帧尺寸保持 1:1 像素比，按帧高缩放
        const natW = img.naturalWidth, natH = img.naturalHeight;
        const dh   = FULL_DH;                  // 目标帧高（固定）
        const dw   = natW / natH * dh;         // 保持原始宽高比
        const ctrX = 685 / FRAME_W * dw;       // 角色中心 x（原帧中的比例位置）
        const feetY= 615 / FRAME_H * dh;       // 角色脚底 y

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

      const curKey  = this.state === 'def' ? 'def' : this.state === 'walk' ? 'walk' : 'idle';
      const prevKey = this._prevState === 'def' ? 'def' : this._prevState === 'walk' ? 'walk' : 'idle';

      // 先画前一状态（淡出）
      if(this._prevState && blendAlpha < 1){
        drawFrame(prevKey, this._prevAnimT + this._blendT, 1 - blendAlpha);
      }
      // 再画当前状态（淡入）
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
          // [dist, angSpd, phase, radius, opacity, blurPx]
          const P = [
            // 核心（胸前静止浓墨）
            [  0, 0.00, 0.00,  26, 0.82, 1],
            // 内层 — 5个
            [ 18, 0.90, 0.00,  22, 0.64, 2],
            [ 16, 0.90, 1.26,  20, 0.60, 2],
            [ 19, 0.90, 2.51,  21, 0.58, 2],
            [ 17, 0.90, 3.77,  19, 0.55, 2],
            [ 18,-0.70, 5.03,  22, 0.52, 2],
            // 中层 — 7个
            [ 38, 0.45, 0.00,  24, 0.32, 5],
            [ 36, 0.45, 0.90,  22, 0.28, 5],
            [ 40, 0.45, 1.80,  25, 0.26, 5],
            [ 37,-0.38, 2.70,  21, 0.24, 6],
            [ 39, 0.45, 3.60,  23, 0.22, 5],
            [ 36,-0.38, 4.50,  24, 0.20, 6],
            [ 41, 0.45, 5.40,  22, 0.18, 5],
            // 外层缭绕 — 6个
            [ 66, 0.22, 0.00,  26, 0.11, 9],
            [ 62, 0.22, 1.05,  24, 0.10, 9],
            [ 68,-0.18, 2.09,  27, 0.09, 10],
            [ 64, 0.22, 3.14,  25, 0.09, 9],
            [ 67,-0.18, 4.19,  23, 0.08, 10],
            [ 63, 0.22, 5.24,  26, 0.07, 10],
            // 远端虚烟 — 3个
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
            const cy = Math.sin(angle) * dist * 0.72; // 轻微y压缩保持整体椭圆感
            ctx.save();
            ctx.filter = `blur(${blur}px)`;
            ctx.translate(cx, cy);
            const g = ctx.createRadialGradient(0,0,0, 0,0,r);
            g.addColorStop(0,    `rgba(7,5,3,${op})`);
            g.addColorStop(0.5,  `rgba(4,3,2,${(op*0.4).toFixed(2)})`);
            g.addColorStop(1,    'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2); // 纯圆，无 scale 变形
            ctx.fill();
            ctx.restore();
          }

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
