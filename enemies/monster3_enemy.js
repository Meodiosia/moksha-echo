// monster3_enemy.js — 水墨精灵枪手
// AI 逻辑完全复用 archer_enemy.js（state/shoot/flee/dash）
// draw 换成 screen 混合精灵帧
(function(){
'use strict';

const HP_MAX    = 55;
const RANGE     = 220;
const KEEP_DIST = 170;
const FLEE_DIST = 85;
const SPD_WALK  = 35;
const SPD_BACK  = 50;
const SPD_DASH  = 230;
const CHARGE_T  = 1.0;
const SHOT_CD   = 2.2;
const PROJ_SPD  = 180;
const PROJ_LIFE = 1.0;
const PROJ_DMG  = 14;
const DASH_T    = 0.32;
const DASH_CD   = 2.2;

// 帧参数（处理后帧 124x120，原帧 960x960）
const FRAME_W = 960, FRAME_H = 960;
const CHAR_PX_H = 800;
const DRAW_H = 32;
const DRAW_SCALE = DRAW_H / CHAR_PX_H;
const FULL_DH = Math.round(FRAME_H * DRAW_SCALE);
const FULL_DW = Math.round(FRAME_W * DRAW_SCALE);
const FEET_Y  = Math.round(880 * DRAW_SCALE);
const CTR_X   = Math.round(480 * DRAW_SCALE);

function _fx(t,x,y,p){ if(typeof window._addFxShape==='function') try{window._addFxShape(t,x,y,p||{});}catch(e){} }
function _hurtPlayer(player,dmg,kx,ky){
  if(!player) return;
  if(typeof hurtPlayer==='function'){ hurtPlayer(dmg,kx,ky,0.5,0.35); return; }
  if(typeof player.takeDamage==='function') player.takeDamage(dmg,kx,ky);
  else if(typeof player.hp==='number'){ player.hp=Math.max(0,player.hp-dmg); }
}

function makeMonster3(x,y){
  const e={
    x,y,vx:0,vy:0,facing:1,
    hp:HP_MAX,maxHp:HP_MAX,
    state:'idle',stateTimer:0,hurtTimer:0,deadAge:0,
    isArcher:true,
    _animT:Math.random()*10,
    _blendT:1,_prevKey:null,_prevIdx:0,
    _shotCD:0,_dashCD:0,_chargeT:0,_aimAng:0,
    _projectiles:[],
    _wobble:Math.random()*6.28,

    update(dt,player){
      if(this.hurtTimer>0) this.hurtTimer-=dt;
      if(this._shotCD>0)   this._shotCD-=dt;
      if(this._dashCD>0)   this._dashCD-=dt;
      if(this._blendT<1)   this._blendT=Math.min(1,this._blendT+dt/0.14);
      this._animT+=dt;
      this._wobble+=dt*1.7;

      if(this.state==='dead'){
        this.deadAge+=dt;
        this.vx*=Math.pow(0.001,dt); this.vy*=Math.pow(0.001,dt);
        this._updateProjectiles(dt,player);
        return;
      }

      const pdx=(player?player.x:this.x)-this.x;
      const pdy=(player?player.y:this.y)-this.y;
      const pd=Math.hypot(pdx,pdy)||1;
      this.facing=pdx>=0?1:-1;

      if(this.state==='hurt'){
        this.x+=this.vx*dt; this.y+=this.vy*dt;
        this.vx*=Math.pow(0.005,dt*4); this.vy*=Math.pow(0.005,dt*4);
        this.stateTimer-=dt;
        if(this.stateTimer<=0) this.state='idle';
        this._updateProjectiles(dt,player);
        return;
      }

      if(this.state==='dash'){
        this.stateTimer-=dt;
        this.x+=this.vx*dt; this.y+=this.vy*dt;
        this.vx*=Math.pow(0.6,dt*4); this.vy*=Math.pow(0.6,dt*4);
        if(this.stateTimer<=0) this.state='idle';
        this._updateProjectiles(dt,player);
        return;
      }

      if(pd<FLEE_DIST&&this._dashCD<=0){
        this.state='dash'; this.stateTimer=DASH_T; this._dashCD=DASH_CD;
        this.vx=-pdx/pd*SPD_DASH; this.vy=-pdy/pd*SPD_DASH;
        this._chargeT=0;
        this._updateProjectiles(dt,player); return;
      }

      if(this.state==='aim'){
        this._chargeT+=dt;
        this._aimAng=Math.atan2(pdy,pdx);
        if(pd<KEEP_DIST*0.8){ this.x+=-pdx/pd*SPD_BACK*0.5*dt; this.y+=-pdy/pd*SPD_BACK*0.5*dt; }
        if(this._chargeT>=CHARGE_T){
          const pool=window.MONSTER3_IMG&&window.MONSTER3_IMG['atk'];
          if(pool){this._prevKey='atk';this._prevIdx=Math.floor(this._animT*35)%pool.length;}
          this._blendT=0;
          this._fireVolley(player);
          this._chargeT=0; this._shotCD=SHOT_CD; this.state='idle';
        }
        this._updateProjectiles(dt,player); return;
      }

      // 垂直于玩家方向的横向分量
      const perpX=-pdy/pd, perpY=pdx/pd;
      const sway=Math.sin(this._wobble*0.4)*SPD_WALK*0.65;

      if(pd<RANGE){
        if(pd<KEEP_DIST*0.9){
          this.state='run';
          this.x+=-pdx/pd*SPD_BACK*dt + perpX*sway*dt;
          this.y+=-pdy/pd*SPD_BACK*dt + perpY*sway*dt;
        } else if(pd>KEEP_DIST*1.15){
          this.state='run';
          this.x+=pdx/pd*SPD_WALK*dt + perpX*sway*dt;
          this.y+=pdy/pd*SPD_WALK*dt + perpY*sway*dt;
        } else {
          // 射程舒适区：横向游走，不停
          this.state='run';
          this.x+=perpX*sway*dt;
          this.y+=perpY*sway*dt;
        }
        if(this._shotCD<=0){ this.state='aim'; this._chargeT=0; this._aimAng=Math.atan2(pdy,pdx); }
      } else {
        this.state='run';
        this.x+=pdx/pd*SPD_WALK*dt;
        this.y+=pdy/pd*SPD_WALK*dt;
      }
      this._updateProjectiles(dt,player);
    },

    _fireVolley(player){
      const a=this._aimAng;
      this._projectiles.push({
        x:this.x+Math.cos(a)*12, y:this.y-18+Math.sin(a)*12,
        vx:Math.cos(a)*PROJ_SPD, vy:Math.sin(a)*PROJ_SPD,
        life:PROJ_LIFE, age:0
      });
    },

    _updateProjectiles(dt,player){
      const pl=player||(typeof window.player!=='undefined'?window.player:null);
      const list=this._projectiles;
      for(let i=list.length-1;i>=0;i--){
        const p=list[i];
        p.age+=dt; p.x+=p.vx*dt; p.y+=p.vy*dt;
        if(pl&&typeof pl.x==='number'){
          const d=Math.hypot(p.x-pl.x,p.y-pl.y);
          if(d<16){
            const kl=Math.hypot(p.vx,p.vy)||1;
            _hurtPlayer(pl,PROJ_DMG,p.vx/kl,p.vy/kl);
            list.splice(i,1); continue;
          }
        }
        if(p.age>=p.life) list.splice(i,1);
      }
    },

    takeDamage(dmg,kx,ky){
      if(this.state==='dead') return;
      this.hp=Math.max(0,this.hp-dmg);
      this.hurtTimer=0.22;
      const kl=Math.hypot(kx||0,ky||0)||1;
      this.vx=(kx||0)/kl*180; this.vy=(ky||0)/kl*180;
      if(this.hp<=0){
        this.state='dead'; this.stateTimer=0.6; this._chargeT=0;
      } else {
        this.state='hurt'; this.stateTimer=0.18;
      }
    },

    draw(ctx,ox_,oy_,ISO_Y_SCALE){
      const ISO=ISO_Y_SCALE||1;
      const sx=this.x-(ox_||0);
      const sy=(this.y-(oy_||0))*ISO;
      ctx.save();

      const fade=this.state==='dead'?Math.max(0,1-this.deadAge/0.6):1;
      ctx.globalAlpha=fade;

      // 脚下阴影
      ctx.save();
      const _sw=FULL_DW*0.45, _sh=_sw*0.18;
      const _sg=ctx.createRadialGradient(sx,sy,0,sx,sy,_sw);
      _sg.addColorStop(0,'rgba(0,0,0,0.4)');
      _sg.addColorStop(0.6,'rgba(0,0,0,0.1)');
      _sg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.scale(1,_sh/_sw);
      ctx.fillStyle=_sg;
      ctx.beginPath();ctx.arc(sx,sy*(_sw/_sh),_sw,0,Math.PI*2);ctx.fill();
      ctx.restore();

      // 精灵帧
      const animKey=(this.state==='aim'||this.state==='atk')?'atk':'run';
      const pool=window.MONSTER3_IMG&&window.MONSTER3_IMG[animKey];
      if(pool&&pool.length>0&&pool[0]){
        const fpsMap={run:26,atk:35};
        const fps=fpsMap[animKey]||26;
        const fi=Math.floor(this._animT*fps)%pool.length;
        const img=pool[Math.max(0,fi)];
        const bt=this._blendT;
        if(bt<1&&this._prevKey&&window.MONSTER3_IMG[this._prevKey]){
          const pp=window.MONSTER3_IMG[this._prevKey];
          const pi=Math.min(this._prevIdx,pp.length-1);
          const pimg=pp[pi];
          if(pimg&&pimg.complete&&pimg.naturalWidth){
            ctx.save();ctx.globalAlpha=fade*(1-bt);
            if(this.facing<0){ctx.translate(sx,0);ctx.scale(-1,1);ctx.translate(-sx,0);}
            ctx.drawImage(pimg,sx-CTR_X,sy-FEET_Y,FULL_DW,FULL_DH);ctx.restore();
          }
        }
        if(img&&img.complete&&img.naturalWidth){
          ctx.save();
          ctx.globalAlpha=fade*(bt<1?bt:1);
          if(this.hurtTimer>0) ctx.filter='brightness(2.5) saturate(0.2)';
          if(this.facing<0){ctx.translate(sx,0);ctx.scale(-1,1);ctx.translate(-sx,0);}
          ctx.drawImage(img,sx-CTR_X,sy-FEET_Y,FULL_DW,FULL_DH);
          ctx.filter='none';
          ctx.restore();
        }
      } else {
        // fallback：复用 archer 原始绘制占位
        ctx.fillStyle=this.hurtTimer>0?'#AAFFDD':'#336655';
        ctx.beginPath();ctx.ellipse(sx,sy-24,9,18,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#55DDBB';
        ctx.beginPath();ctx.ellipse(sx,sy-42,7,9,0,0,Math.PI*2);ctx.fill();
      }

      // 蓄力光晕（改为暗色烟雾）
      if(this.state==='aim'&&this._chargeT>0){
        const gp=Math.min(1,this._chargeT/CHARGE_T);
        ctx.save();
        ctx.globalAlpha=fade*gp*0.25;
        ctx.fillStyle='rgba(20,15,30,1)';
        ctx.beginPath();ctx.arc(sx,sy-FEET_Y*0.5,14+gp*8,0,Math.PI*2);ctx.fill();
        ctx.restore();
      }

      // 弹丸 — 虚化箭矢 + 黑青烟
      for(const p of this._projectiles){
        const px=p.x-(ox_||0);
        const py=(p.y-(oy_||0))*ISO;
        const ang=Math.atan2(p.vy*ISO,p.vx);
        const lifeRatio=1-p.age/p.life;

        // 蓝绿光晕（screen混合，柔光扩散）
        ctx.save();
        ctx.globalCompositeOperation='screen';
        ctx.globalAlpha=fade*lifeRatio*0.55;
        const gr=ctx.createRadialGradient(px,py,0,px,py,14);
        gr.addColorStop(0,'rgba(100,240,200,1)');
        gr.addColorStop(0.4,'rgba(40,180,160,0.6)');
        gr.addColorStop(1,'rgba(0,80,80,0)');
        ctx.fillStyle=gr;
        ctx.beginPath();ctx.arc(px,py,14,0,Math.PI*2);ctx.fill();
        ctx.restore();

        // 黑青烟雾拖尾
        for(let t=1;t<=5;t++){
          const tx2=px-Math.cos(ang)*t*6, ty2=py-Math.sin(ang)*t*6;
          const sr=3.2-t*0.4;
          if(sr<=0) continue;
          ctx.save();
          ctx.globalAlpha=fade*lifeRatio*(0.28-t*0.04);
          ctx.fillStyle=t%2===0?'#002020':'#05050F';
          ctx.beginPath();ctx.arc(tx2,ty2,sr,0,Math.PI*2);ctx.fill();
          ctx.restore();
        }

        // 箭矢本体（加粗加亮）
        ctx.save();
        ctx.globalAlpha=fade*lifeRatio*0.92;
        ctx.translate(px,py);
        ctx.rotate(ang);
        // 箭杆
        ctx.strokeStyle='rgba(120,220,190,0.9)';
        ctx.lineWidth=1.8;
        ctx.beginPath();ctx.moveTo(-12,0);ctx.lineTo(5,0);ctx.stroke();
        // 箭头
        ctx.fillStyle='rgba(160,255,220,1)';
        ctx.beginPath();ctx.moveTo(9,0);ctx.lineTo(4,-2.5);ctx.lineTo(4,2.5);ctx.closePath();ctx.fill();
        // 箭尾羽
        ctx.strokeStyle='rgba(60,160,130,0.7)';
        ctx.lineWidth=1.0;
        ctx.beginPath();
        ctx.moveTo(-8,0);ctx.lineTo(-12,-2.5);
        ctx.moveTo(-8,0);ctx.lineTo(-12,2.5);
        ctx.stroke();
        ctx.restore();
      }

      // 出现/消失水墨烟雾
      if(typeof window._drawInkSmoke==='function'){
        window._drawInkSmoke(ctx,sx,sy,this._animT,0.5,fade,FULL_DW,FEET_Y);
        if(this.state==='dead'&&this.deadAge<0.9)
          window._drawInkSmoke(ctx,sx,sy,this.deadAge,0.9,1,FULL_DW,FEET_Y);
      }

      ctx.restore();
    }
  };
  return e;
}

window.spawnMonster3=(x,y)=>makeMonster3(x,y);

})();
