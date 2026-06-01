// archer_enemy.js — 远程射手小怪
// API: window.spawnArcher(x, y) -> archerObj
// 全程序化绘制，FX 调 window._addFxShape
(function(){
  'use strict';

  const HP_MAX      = 35;
  const RANGE       = 200;   // 射程
  const KEEP_DIST   = 160;   // 期望保持距离
  const FLEE_DIST   = 80;    // 玩家近身触发闪避冲刺
  const SPD_WALK    = 38;
  const SPD_BACK    = 55;
  const SPD_DASH    = 220;   // 闪避冲刺
  const CHARGE_T    = 1.2;   // 蓄力时间
  const SHOT_CD     = 1.6;
  const PROJ_SPD    = 260;
  const PROJ_LIFE   = 0.95;
  const PROJ_DMG    = 8;
  const DASH_T      = 0.35;
  const DASH_CD     = 2.4;

  function _fx(type, x, y, p){
    if(typeof window._addFxShape === 'function'){
      try{ window._addFxShape(type, x, y, p); }catch(e){}
    }
  }

  function _hurtPlayer(player, dmg, kx, ky){
    if(!player) return;
    if(typeof player.takeDamage === 'function'){
      player.takeDamage(dmg, kx, ky);
    } else if(typeof player.hp === 'number'){
      player.hp -= dmg;
      if(player.hp < 0) player.hp = 0;
    }
  }

  function makeArcher(x, y){
    const e = {
      x:x, y:y, vx:0, vy:0, facing:1,
      hp:HP_MAX, maxHp:HP_MAX,
      state:'idle',          // idle | aim | shoot | flee | dash | hurt | dead
      stateTimer:0,
      hurtTimer:0,
      deadAge:0,
      isArcher:true,

      // 内部
      _animT:Math.random()*10,
      _shotCD:0,
      _dashCD:0,
      _chargeT:0,
      _aimAng:0,
      _projectiles:[],       // {x,y,vx,vy,life,age}
      _wobble:Math.random()*6.28,

      update(dt, player){
        if(this.hurtTimer>0) this.hurtTimer-=dt;
        if(this._shotCD>0)   this._shotCD-=dt;
        if(this._dashCD>0)   this._dashCD-=dt;
        this._animT += dt;
        this._wobble += dt*1.7;

        // 死亡淡出 + 残留弹幕继续飞
        if(this.state==='dead'){
          this.deadAge += dt;
          this.vx *= Math.pow(0.001, dt);
          this.vy *= Math.pow(0.001, dt);
          this._updateProjectiles(dt, player);
          return;
        }

        const pdx = (player?player.x:this.x) - this.x;
        const pdy = (player?player.y:this.y) - this.y;
        const pd  = Math.hypot(pdx, pdy) || 1;
        this.facing = pdx>=0 ? 1 : -1;

        // ── hurt：击退滑行
        if(this.state==='hurt'){
          this.x += this.vx*dt;
          this.y += this.vy*dt;
          this.vx *= Math.pow(0.005, dt*4);
          this.vy *= Math.pow(0.005, dt*4);
          this.stateTimer -= dt;
          if(this.stateTimer<=0) this.state='idle';
          this._updateProjectiles(dt, player);
          return;
        }

        // ── dash 闪避：玩家近身→反向冲刺逃跑
        if(this.state==='dash'){
          this.stateTimer -= dt;
          this.x += this.vx*dt;
          this.y += this.vy*dt;
          this.vx *= Math.pow(0.6, dt*4);
          this.vy *= Math.pow(0.6, dt*4);
          if(this.stateTimer<=0) this.state='idle';
          this._updateProjectiles(dt, player);
          return;
        }

        // 玩家近身触发 dash
        if(pd < FLEE_DIST && this._dashCD<=0){
          this.state='dash';
          this.stateTimer = DASH_T;
          this._dashCD = DASH_CD;
          this.vx = -pdx/pd * SPD_DASH;
          this.vy = -pdy/pd * SPD_DASH;
          this._chargeT = 0;            // 取消蓄力
          // 视觉：留下一道暗红裂缝
          _fx('crackline', this.x, this.y-4, {
            count:1, len:30,
            color:'rgba(140,20,20,0.85)', life:0.35
          });
          this._updateProjectiles(dt, player);
          return;
        }

        // ── aim：蓄力中（站定）
        if(this.state==='aim'){
          this._chargeT += dt;
          this._aimAng = Math.atan2(pdy, pdx);
          // 微微后退保持距离
          if(pd < KEEP_DIST*0.8){
            this.x += -pdx/pd * SPD_BACK*0.5*dt;
            this.y += -pdy/pd * SPD_BACK*0.5*dt;
          }
          if(this._chargeT >= CHARGE_T){
            this._fireVolley(player);
            this._chargeT = 0;
            this._shotCD = SHOT_CD;
            this.state = 'idle';
          }
          this._updateProjectiles(dt, player);
          return;
        }

        // ── idle / 走位：在射程内时保持距离
        if(pd < RANGE){
          // 距离调整
          if(pd < KEEP_DIST*0.9){
            // 后撤
            this.x += -pdx/pd * SPD_BACK * dt;
            this.y += -pdy/pd * SPD_BACK * dt;
          } else if(pd > KEEP_DIST*1.15){
            // 前压一点（保持射程内）
            this.x += pdx/pd * SPD_WALK * dt;
            this.y += pdy/pd * SPD_WALK * dt;
          }
          // 起手蓄力
          if(this._shotCD<=0){
            this.state = 'aim';
            this._chargeT = 0;
            this._aimAng = Math.atan2(pdy, pdx);
          }
        } else {
          // 玩家在射程外：靠近
          this.x += pdx/pd * SPD_WALK * dt;
          this.y += pdy/pd * SPD_WALK * dt;
        }

        this._updateProjectiles(dt, player);
      },

      _fireVolley(player){
        // 发射 3 颗血色弹丸（小扇形）
        const base = this._aimAng;
        const spreads = [-0.18, 0, 0.18];
        for(const s of spreads){
          const a = base + s;
          this._projectiles.push({
            x:this.x + Math.cos(a)*10,
            y:this.y - 14 + Math.sin(a)*10,
            vx:Math.cos(a)*PROJ_SPD,
            vy:Math.sin(a)*PROJ_SPD,
            life:PROJ_LIFE, age:0,
          });
        }
        // 出手 FX：暗红短刃
        _fx('xslash', this.x, this.y-14, {
          len:18, thickness:4,
          color:'rgba(160,20,20,0.9)', life:0.18
        });
      },

      _updateProjectiles(dt, player){
        const list = this._projectiles;
        for(let i=list.length-1; i>=0; i--){
          const p = list[i];
          p.age += dt;
          p.x += p.vx*dt;
          p.y += p.vy*dt;
          // 命中玩家
          if(player && player.x!=null){
            const d = Math.hypot(p.x-player.x, p.y-player.y);
            const hitR = (player.r || 12) + 4;
            if(d < hitR){
              const kl = Math.hypot(p.vx,p.vy)||1;
              _hurtPlayer(player, PROJ_DMG, p.vx/kl, p.vy/kl);
              _fx('crackline', p.x, p.y, {
                count:1, len:14,
                color:'rgba(180,30,30,1)', life:0.25
              });
              list.splice(i,1);
              continue;
            }
          }
          if(p.age >= p.life) list.splice(i,1);
        }
      },

      takeDamage(dmg, kx, ky){
        if(this.state==='dead') return;
        this.hp -= dmg;
        this.hurtTimer = 0.22;
        const kl = Math.hypot(kx||0, ky||0) || 1;
        this.vx = (kx||0)/kl * 180;
        this.vy = (ky||0)/kl * 180;
        if(this.hp <= 0){
          this.hp = 0;
          this.state = 'dead';
          this.stateTimer = 0.6;
          this._chargeT = 0;
          _fx('crackline', this.x, this.y-6, {
            count:4, len:22,
            color:'rgba(140,20,20,0.95)', life:0.55
          });
        } else {
          this.state = 'hurt';
          this.stateTimer = 0.18;
        }
      },

      draw(ctx, ox_, oy_, ISO_Y_SCALE){
        const ISO = ISO_Y_SCALE || 1;
        const sx = this.x - (ox_||0);
        const sy = (this.y - (oy_||0)) * ISO;

        ctx.save();

        // 死亡淡出
        const fade = this.state==='dead'
          ? Math.max(0, 1 - this.deadAge/0.6) : 1;
        ctx.globalAlpha = fade;

        // ── 地面阴影
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.ellipse(sx, sy+2, 13, 13*ISO*0.55, 0, 0, 6.283);
        ctx.fill();

        // 受伤闪白
        const hurtFlash = this.hurtTimer>0 ? (this.hurtTimer/0.22) : 0;

        // ── 暗红长袍主体（软 blob）
        const bob = Math.sin(this._wobble)*1.4;
        const bodyH = 30;
        const bodyY = sy - bodyH/2 + bob;

        // 长袍下摆（梯形 blob）
        ctx.fillStyle = '#3A0A0A';
        ctx.beginPath();
        ctx.moveTo(sx-12, sy+1);
        ctx.quadraticCurveTo(sx-14, sy-10, sx-10, sy-22);
        ctx.lineTo(sx+10, sy-22);
        ctx.quadraticCurveTo(sx+14, sy-10, sx+12, sy+1);
        ctx.closePath();
        ctx.fill();

        // 长袍主层（暗红）
        ctx.fillStyle = '#5A0E0E';
        ctx.beginPath();
        ctx.ellipse(sx, bodyY+4, 10, 14, 0, 0, 6.283);
        ctx.fill();

        // 长袍胸前阴影
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.ellipse(sx, bodyY+8, 7, 9, 0, 0, 6.283);
        ctx.fill();

        // ── 头兜（深色 blob）
        ctx.fillStyle = '#2A0606';
        ctx.beginPath();
        ctx.ellipse(sx, sy-30+bob, 8, 9, 0, 0, 6.283);
        ctx.fill();

        // 兜下黑暗（看不到脸）
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.beginPath();
        ctx.ellipse(sx, sy-28+bob, 5.5, 5, 0, 0, 6.283);
        ctx.fill();

        // 兜内眼睛（蓄力时变亮）
        const eyeGlow = this.state==='aim'
          ? Math.min(1, this._chargeT/CHARGE_T) : 0.35;
        ctx.fillStyle = `rgba(${200+eyeGlow*55|0},${30+eyeGlow*40|0},${30+eyeGlow*40|0},${0.7+eyeGlow*0.3})`;
        const eyeR = 0.9 + eyeGlow*0.6;
        ctx.beginPath();
        ctx.ellipse(sx-2, sy-28+bob, eyeR, eyeR, 0, 0, 6.283);
        ctx.ellipse(sx+2, sy-28+bob, eyeR, eyeR, 0, 0, 6.283);
        ctx.fill();

        // ── 弓箭剪影（侧面，朝玩家）
        const bowAng = this.state==='aim' || this.state==='idle'
          ? this._aimAng
          : (this.facing>0 ? 0 : Math.PI);
        const bowX = sx + Math.cos(bowAng)*10;
        const bowY = sy - 14 + Math.sin(bowAng)*10 + bob*0.5;

        ctx.save();
        ctx.translate(bowX, bowY);
        ctx.rotate(bowAng);

        // 弓身（暗木色弧）
        ctx.strokeStyle = '#1A0A05';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 9, -1.2, 1.2);
        ctx.stroke();

        // 弓弦（蓄力时拉满）
        const draw = this.state==='aim'
          ? Math.min(1, this._chargeT/CHARGE_T) : 0;
        ctx.strokeStyle = 'rgba(220,220,220,0.7)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(Math.cos(-1.2)*9, Math.sin(-1.2)*9);
        ctx.lineTo(-draw*5, 0);
        ctx.lineTo(Math.cos(1.2)*9, Math.sin(1.2)*9);
        ctx.stroke();

        // 蓄力箭（血色）
        if(draw > 0.05){
          ctx.fillStyle = `rgba(200,30,30,${0.6+draw*0.4})`;
          ctx.beginPath();
          ctx.moveTo(-draw*5-2, 0);
          ctx.lineTo(8, -1);
          ctx.lineTo(8, 1);
          ctx.closePath();
          ctx.fill();
          // 箭头血光
          ctx.fillStyle = `rgba(255,80,40,${draw*0.7})`;
          ctx.beginPath();
          ctx.ellipse(8, 0, 2.2, 1.2, 0, 0, 6.283);
          ctx.fill();
        }
        ctx.restore();

        // 蓄力满时身周血色脉动
        if(this.state==='aim' && draw > 0.6){
          ctx.fillStyle = `rgba(200,20,20,${(draw-0.6)*0.7})`;
          ctx.beginPath();
          ctx.ellipse(sx, sy-14, 16+draw*4, 20+draw*4, 0, 0, 6.283);
          ctx.fill();
        }

        // 受伤闪白覆盖
        if(hurtFlash > 0){
          ctx.globalCompositeOperation = 'source-atop';
          ctx.fillStyle = `rgba(255,255,255,${hurtFlash*0.7})`;
          ctx.fillRect(sx-16, sy-44, 32, 50);
          ctx.globalCompositeOperation = 'source-over';
        }

        // ── 弹幕绘制
        for(const p of this._projectiles){
          const px = p.x - (ox_||0);
          const py = (p.y - (oy_||0)) * ISO;
          // 拖尾
          const tx = px - p.vx*0.04;
          const ty = py - p.vy*0.04*ISO;
          ctx.strokeStyle = 'rgba(180,30,30,0.55)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(px, py);
          ctx.stroke();
          // 头部血珠
          ctx.fillStyle = 'rgba(220,40,40,1)';
          ctx.beginPath();
          ctx.ellipse(px, py, 2.6, 2.6, 0, 0, 6.283);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,200,180,0.8)';
          ctx.beginPath();
          ctx.ellipse(px, py, 1.1, 1.1, 0, 0, 6.283);
          ctx.fill();
        }

        // ── HP bar（活着时）
        if(this.state!=='dead' && this.hp < this.maxHp){
          const w = 22, h = 3;
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(sx-w/2, sy-42, w, h);
          ctx.fillStyle = '#C82020';
          ctx.fillRect(sx-w/2, sy-42, w*(this.hp/this.maxHp), h);
        }

        ctx.restore();
      },
    };
    return e;
  }

  window.spawnArcher = function(x, y){
    return makeArcher(x, y);
  };
})();
