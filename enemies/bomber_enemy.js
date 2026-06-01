// bomber_enemy.js — 自爆冲锋小怪
// API: window.spawnBomber(x, y) -> bomberObj
// 全程序化绘制，FX 调 window._addFxShape
(function(){
  'use strict';

  const HP_MAX     = 25;
  const TRIG_R     = 80;     // 玩家进入此半径触发引信
  const FUSE_T     = 1.0;    // 闪烁时长
  const AOE_R      = 60;
  const AOE_DMG    = 30;
  const SPD_ROAM   = 28;
  const SPD_RUSH   = 90;     // 引信中冲向玩家
  const SPD_PEAK   = 150;    // 临爆前冲速

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

  function makeBomber(x, y){
    const e = {
      x:x, y:y, vx:0, vy:0, facing:1,
      hp:HP_MAX, maxHp:HP_MAX,
      state:'idle',          // idle | fuse | boom | hurt | dead
      stateTimer:0,
      hurtTimer:0,
      deadAge:0,
      isBomber:true,

      _animT:Math.random()*10,
      _fuseT:0,
      _exploded:false,

      update(dt, player){
        if(this.hurtTimer>0) this.hurtTimer-=dt;
        this._animT += dt;

        if(this.state==='dead'){
          this.deadAge += dt;
          this.vx *= Math.pow(0.001, dt);
          this.vy *= Math.pow(0.001, dt);
          return;
        }

        const pdx = (player?player.x:this.x) - this.x;
        const pdy = (player?player.y:this.y) - this.y;
        const pd  = Math.hypot(pdx, pdy) || 1;
        this.facing = pdx>=0 ? 1 : -1;

        // hurt
        if(this.state==='hurt'){
          this.x += this.vx*dt;
          this.y += this.vy*dt;
          this.vx *= Math.pow(0.005, dt*4);
          this.vy *= Math.pow(0.005, dt*4);
          this.stateTimer -= dt;
          if(this.stateTimer<=0) this.state='idle';
          return;
        }

        // 引信激活：冲向玩家 + 闪烁 + 倒计时
        if(this.state==='fuse'){
          this._fuseT += dt;
          // 速度从 SPD_RUSH → SPD_PEAK 渐增
          const k = Math.min(1, this._fuseT/FUSE_T);
          const spd = SPD_RUSH + (SPD_PEAK-SPD_RUSH)*k;
          this.x += pdx/pd * spd * dt;
          this.y += pdy/pd * spd * dt;

          if(this._fuseT >= FUSE_T){
            this._explode(player);
          }
          return;
        }

        // boom 后短暂残留再消失
        if(this.state==='boom'){
          this.stateTimer -= dt;
          if(this.stateTimer<=0){
            this.state='dead';
            this.deadAge=0;
          }
          return;
        }

        // idle：玩家进入触发圈 → fuse
        if(pd < TRIG_R){
          this.state = 'fuse';
          this._fuseT = 0;
          // 起爆 FX 警示：地面暗红裂痕
          _fx('crackline', this.x, this.y-2, {
            count:3, len:24,
            color:'rgba(140,20,20,0.85)', life:0.5
          });
          return;
        }

        // 否则：缓慢漫游/朝玩家挪
        if(pd < TRIG_R*4){
          this.x += pdx/pd * SPD_ROAM * dt;
          this.y += pdy/pd * SPD_ROAM * dt;
        }
      },

      _explode(player){
        if(this._exploded) return;
        this._exploded = true;
        this.state = 'boom';
        this.stateTimer = 0.35;

        // FX：xslash + crackline + darkring
        _fx('xslash', this.x, this.y-6, {
          len: AOE_R*1.3, thickness: 10,
          color:'rgba(220,30,30,1)', life:0.5
        });
        _fx('crackline', this.x, this.y-2, {
          count:6, len: AOE_R*0.95,
          color:'rgba(180,20,20,1)', life:0.7
        });
        _fx('darkring', this.x, this.y-6, {
          r: AOE_R*0.95, life:0.6
        });
        _fx('spike', this.x, this.y-6, {
          count:8, len:38, thickness:4,
          color:'rgba(220,40,40,0.9)', life:0.45
        });

        // AOE 伤害
        if(player && player.x!=null){
          const dx = player.x - this.x;
          const dy = player.y - this.y;
          const d  = Math.hypot(dx, dy);
          if(d < AOE_R){
            const kl = d || 1;
            // 距离衰减
            const k = 1 - 0.4 * (d / AOE_R);
            _hurtPlayer(player, Math.round(AOE_DMG*k), dx/kl, dy/kl);
          }
        }
      },

      takeDamage(dmg, kx, ky){
        if(this.state==='dead' || this.state==='boom') return;
        this.hp -= dmg;
        this.hurtTimer = 0.18;
        const kl = Math.hypot(kx||0, ky||0) || 1;
        this.vx = (kx||0)/kl * 200;
        this.vy = (ky||0)/kl * 200;
        if(this.hp <= 0){
          // 被打死：直接引爆（更危险）
          this._explode(null);
        } else {
          // 受伤后立即激活引信（如果还没）
          if(this.state==='idle'){
            this.state='fuse';
            this._fuseT = 0;
          } else if(this.state!=='fuse'){
            this.state='hurt';
            this.stateTimer=0.18;
          }
        }
      },

      draw(ctx, ox_, oy_, ISO_Y_SCALE){
        const ISO = ISO_Y_SCALE || 1;
        const sx = this.x - (ox_||0);
        const sy = (this.y - (oy_||0)) * ISO;

        // dead 后期不绘制
        if(this.state==='dead' && this.deadAge > 0.4) return;

        ctx.save();

        // boom 状态：只画地面焦痕（爆炸视觉由 FX 完成）
        if(this.state==='boom'){
          const k = this.stateTimer / 0.35;
          ctx.globalAlpha = Math.max(0, k);
          ctx.fillStyle = 'rgba(0,0,0,0.7)';
          ctx.beginPath();
          ctx.ellipse(sx, sy+1, AOE_R*0.45, AOE_R*0.45*ISO*0.55, 0, 0, 6.283);
          ctx.fill();
          ctx.fillStyle = 'rgba(120,20,20,0.6)';
          ctx.beginPath();
          ctx.ellipse(sx, sy+1, AOE_R*0.28, AOE_R*0.28*ISO*0.55, 0, 0, 6.283);
          ctx.fill();
          ctx.restore();
          return;
        }

        // dead 淡出
        const fade = this.state==='dead'
          ? Math.max(0, 1 - this.deadAge/0.4) : 1;
        ctx.globalAlpha = fade;

        // 引信中：脉冲参数
        const inFuse = this.state==='fuse';
        const fuseK  = inFuse ? Math.min(1, this._fuseT/FUSE_T) : 0;
        // 闪烁频率随时间加快
        const blinkF = 4 + fuseK*22;
        const blink  = inFuse ? (Math.sin(this._animT*blinkF)*0.5+0.5) : 0;
        // 抖动（临爆前剧烈）
        const shakeX = inFuse ? (Math.sin(this._animT*40)*1.4*fuseK) : 0;
        const shakeY = inFuse ? (Math.cos(this._animT*37)*1.4*fuseK) : 0;

        // 地面阴影
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.ellipse(sx, sy+2, 11, 11*ISO*0.55, 0, 0, 6.283);
        ctx.fill();

        // 引信中：地面预警光圈
        if(inFuse){
          const r = 18 + fuseK*36;
          ctx.fillStyle = `rgba(${180+blink*60|0},${20+blink*30|0},${20+blink*30|0},${0.18+blink*0.25})`;
          ctx.beginPath();
          ctx.ellipse(sx, sy+1, r, r*ISO*0.55, 0, 0, 6.283);
          ctx.fill();
          // 蓄力靠近 AOE 范围预警
          if(fuseK > 0.6){
            ctx.strokeStyle = `rgba(220,30,30,${(fuseK-0.6)*1.5})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.ellipse(sx, sy+1, AOE_R*0.95, AOE_R*0.95*ISO*0.55, 0, 0, 6.283);
            ctx.stroke();
          }
        }

        // 主体：黑色球形 blob（漂浮 + 抖动）
        const bob = Math.sin(this._animT*4)*1.5;
        const bx = sx + shakeX;
        const by = sy - 12 + bob + shakeY;
        const R  = 10 + fuseK*1.5;

        // 外层暗影
        ctx.fillStyle = 'rgba(10,5,5,0.95)';
        ctx.beginPath();
        ctx.ellipse(bx, by, R+2, R+2, 0, 0, 6.283);
        ctx.fill();

        // 主黑球
        ctx.fillStyle = '#0A0606';
        ctx.beginPath();
        ctx.ellipse(bx, by, R, R, 0, 0, 6.283);
        ctx.fill();

        // 表面裂纹（引信中显现）
        if(inFuse && fuseK > 0.2){
          ctx.strokeStyle = `rgba(${180+blink*70|0},${20+blink*30|0},${20+blink*30|0},${0.4+0.5*blink})`;
          ctx.lineWidth = 0.9;
          ctx.beginPath();
          ctx.moveTo(bx-R*0.6, by-R*0.2);
          ctx.lineTo(bx-R*0.2, by+R*0.1);
          ctx.lineTo(bx+R*0.3, by-R*0.3);
          ctx.lineTo(bx+R*0.7, by+R*0.2);
          ctx.moveTo(bx-R*0.3, by+R*0.5);
          ctx.lineTo(bx+R*0.4, by+R*0.6);
          ctx.stroke();
        }

        // 内部脉动红心
        const heartPulse = (Math.sin(this._animT*(6+fuseK*16))*0.5+0.5);
        const heartR = (3 + heartPulse*1.4 + fuseK*1.8);
        // 红心晕
        ctx.fillStyle = `rgba(220,30,30,${0.3+heartPulse*0.3+fuseK*0.4})`;
        ctx.beginPath();
        ctx.ellipse(bx, by, heartR+2, heartR+2, 0, 0, 6.283);
        ctx.fill();
        // 红心实体
        ctx.fillStyle = `rgba(255,${60+heartPulse*60|0},${40+heartPulse*30|0},1)`;
        ctx.beginPath();
        ctx.ellipse(bx, by, heartR, heartR, 0, 0, 6.283);
        ctx.fill();
        // 红心高光
        ctx.fillStyle = `rgba(255,220,200,${0.4+heartPulse*0.3})`;
        ctx.beginPath();
        ctx.ellipse(bx-heartR*0.3, by-heartR*0.3, heartR*0.4, heartR*0.4, 0, 0, 6.283);
        ctx.fill();

        // 引信顶冒火星
        if(inFuse){
          const sparkA = (Math.sin(this._animT*30)*0.5+0.5);
          ctx.fillStyle = `rgba(255,${160+sparkA*80|0},${40+sparkA*60|0},${0.7+sparkA*0.3})`;
          ctx.beginPath();
          ctx.ellipse(bx + Math.sin(this._animT*9)*1.5, by-R-2, 1.6+sparkA*0.6, 1.6+sparkA*0.6, 0, 0, 6.283);
          ctx.fill();
          // 上飘小烟
          ctx.fillStyle = `rgba(80,30,30,${0.4*(1-sparkA)})`;
          ctx.beginPath();
          ctx.ellipse(bx + Math.sin(this._animT*3)*2, by-R-6-sparkA*3, 2, 2, 0, 0, 6.283);
          ctx.fill();
        }

        // 受伤闪白
        if(this.hurtTimer > 0){
          const k = this.hurtTimer/0.18;
          ctx.fillStyle = `rgba(255,255,255,${k*0.6})`;
          ctx.beginPath();
          ctx.ellipse(bx, by, R+1, R+1, 0, 0, 6.283);
          ctx.fill();
        }

        // HP bar
        if(this.state!=='dead' && this.hp < this.maxHp){
          const w = 20, h = 3;
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(sx-w/2, sy-32, w, h);
          ctx.fillStyle = '#C82020';
          ctx.fillRect(sx-w/2, sy-32, w*(this.hp/this.maxHp), h);
        }

        ctx.restore();
      },
    };
    return e;
  }

  window.spawnBomber = function(x, y){
    return makeBomber(x, y);
  };
})();
