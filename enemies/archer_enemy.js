// API: window.spawnArcher(x, y) -> archerObj
(function(){
  'use strict';

  const HP_MAX      = 35;
  const RANGE       = 200;   //
  const KEEP_DIST   = 160;   //
  const FLEE_DIST   = 80;    //
  const SPD_WALK    = 38;
  const SPD_BACK    = 55;
  const SPD_DASH    = 220;   //
  const CHARGE_T    = 1.2;   //
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
    if(typeof hurtPlayer === 'function'){
      hurtPlayer(dmg, kx, ky, 0.5, 0.35);
      return;
    }
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

        if(pd < FLEE_DIST && this._dashCD<=0){
          this.state='dash';
          this.stateTimer = DASH_T;
          this._dashCD = DASH_CD;
          this.vx = -pdx/pd * SPD_DASH;
          this.vy = -pdy/pd * SPD_DASH;
          this._chargeT = 0;            //
          _fx('crackline', this.x, this.y-4, {
            count:1, len:30,
            color:'rgba(140,20,20,0.85)', life:0.35
          });
          this._updateProjectiles(dt, player);
          return;
        }

        if(this.state==='aim'){
          this._chargeT += dt;
          this._aimAng = Math.atan2(pdy, pdx);
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

        if(pd < RANGE){
          if(pd < KEEP_DIST*0.9){
            this.x += -pdx/pd * SPD_BACK * dt;
            this.y += -pdy/pd * SPD_BACK * dt;
          } else if(pd > KEEP_DIST*1.15){
            this.x += pdx/pd * SPD_WALK * dt;
            this.y += pdy/pd * SPD_WALK * dt;
          }
          if(this._shotCD<=0){
            this.state = 'aim';
            this._chargeT = 0;
            this._aimAng = Math.atan2(pdy, pdx);
          }
        } else {
          this.x += pdx/pd * SPD_WALK * dt;
          this.y += pdy/pd * SPD_WALK * dt;
        }

        this._updateProjectiles(dt, player);
      },

      _fireVolley(player){
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

        const fade = this.state==='dead'
          ? Math.max(0, 1 - this.deadAge/0.6) : 1;
        ctx.globalAlpha = fade;

        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.ellipse(sx, sy+2, 13, 13*ISO*0.55, 0, 0, 6.283);
        ctx.fill();

        const hurtFlash = this.hurtTimer>0 ? (this.hurtTimer/0.22) : 0;

        const bob = Math.sin(this._wobble)*1.4;
        const bodyH = 30;
        const bodyY = sy - bodyH/2 + bob;

        ctx.fillStyle = '#3A0A0A';
        ctx.beginPath();
        ctx.moveTo(sx-12, sy+1);
        ctx.quadraticCurveTo(sx-14, sy-10, sx-10, sy-22);
        ctx.lineTo(sx+10, sy-22);
        ctx.quadraticCurveTo(sx+14, sy-10, sx+12, sy+1);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#5A0E0E';
        ctx.beginPath();
        ctx.ellipse(sx, bodyY+4, 10, 14, 0, 0, 6.283);
        ctx.fill();

        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.ellipse(sx, bodyY+8, 7, 9, 0, 0, 6.283);
        ctx.fill();

        ctx.fillStyle = '#2A0606';
        ctx.beginPath();
        ctx.ellipse(sx, sy-30+bob, 8, 9, 0, 0, 6.283);
        ctx.fill();

        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.beginPath();
        ctx.ellipse(sx, sy-28+bob, 5.5, 5, 0, 0, 6.283);
        ctx.fill();

        const eyeGlow = this.state==='aim'
          ? Math.min(1, this._chargeT/CHARGE_T) : 0.35;
        ctx.fillStyle = `rgba(${200+eyeGlow*55|0},${30+eyeGlow*40|0},${30+eyeGlow*40|0},${0.7+eyeGlow*0.3})`;
        const eyeR = 0.9 + eyeGlow*0.6;
        ctx.beginPath();
        ctx.ellipse(sx-2, sy-28+bob, eyeR, eyeR, 0, 0, 6.283);
        ctx.ellipse(sx+2, sy-28+bob, eyeR, eyeR, 0, 0, 6.283);
        ctx.fill();

        const bowAng = this.state==='aim' || this.state==='idle'
          ? this._aimAng
          : (this.facing>0 ? 0 : Math.PI);
        const bowX = sx + Math.cos(bowAng)*10;
        const bowY = sy - 14 + Math.sin(bowAng)*10 + bob*0.5;

        ctx.save();
        ctx.translate(bowX, bowY);
        ctx.rotate(bowAng);

        ctx.strokeStyle = '#1A0A05';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 9, -1.2, 1.2);
        ctx.stroke();

        const draw = this.state==='aim'
          ? Math.min(1, this._chargeT/CHARGE_T) : 0;
        ctx.strokeStyle = 'rgba(220,220,220,0.7)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(Math.cos(-1.2)*9, Math.sin(-1.2)*9);
        ctx.lineTo(-draw*5, 0);
        ctx.lineTo(Math.cos(1.2)*9, Math.sin(1.2)*9);
        ctx.stroke();

        if(draw > 0.05){
          ctx.fillStyle = `rgba(200,30,30,${0.6+draw*0.4})`;
          ctx.beginPath();
          ctx.moveTo(-draw*5-2, 0);
          ctx.lineTo(8, -1);
          ctx.lineTo(8, 1);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = `rgba(255,80,40,${draw*0.7})`;
          ctx.beginPath();
          ctx.ellipse(8, 0, 2.2, 1.2, 0, 0, 6.283);
          ctx.fill();
        }
        ctx.restore();

        if(this.state==='aim' && draw > 0.6){
          ctx.fillStyle = `rgba(200,20,20,${(draw-0.6)*0.7})`;
          ctx.beginPath();
          ctx.ellipse(sx, sy-14, 16+draw*4, 20+draw*4, 0, 0, 6.283);
          ctx.fill();
        }

        if(hurtFlash > 0){
          ctx.globalCompositeOperation = 'source-atop';
          ctx.fillStyle = `rgba(255,255,255,${hurtFlash*0.7})`;
          ctx.fillRect(sx-16, sy-44, 32, 50);
          ctx.globalCompositeOperation = 'source-over';
        }

        for(const p of this._projectiles){
          const px = p.x - (ox_||0);
          const py = (p.y - (oy_||0)) * ISO;
          const tx = px - p.vx*0.04;
          const ty = py - p.vy*0.04*ISO;
          ctx.strokeStyle = 'rgba(180,30,30,0.55)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(px, py);
          ctx.stroke();
          ctx.fillStyle = 'rgba(220,40,40,1)';
          ctx.beginPath();
          ctx.ellipse(px, py, 2.6, 2.6, 0, 0, 6.283);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,200,180,0.8)';
          ctx.beginPath();
          ctx.ellipse(px, py, 1.1, 1.1, 0, 0, 6.283);
          ctx.fill();
        }

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
