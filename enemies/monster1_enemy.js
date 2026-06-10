// monster1_enemy.js — 水墨恶魔 小型近战怪
// 动作：run(移动) / atk(攻击)
// 黑底帧用 screen 混合去背
(function(){
'use strict';

const HP_MAX   = 80;
const SPD_WALK = 62;
const ATK_R    = 38,  ATK_DMG = 12,  ATK_CD = 2.5;
const POST_PAUSE = 0.35;
const PATROL_DIST = 100;  // 平时保持距离，CD好了才冲进去

const FRAMES = { run: 36, atk: 28 };
const FPS    = { run: 29, atk: 38  };

// 帧画布 720×720，角色高约 600px 居中
const FRAME_W = 720, FRAME_H = 720;
const CHAR_PX_H = 600;
const DRAW_H = 34;
const DRAW_SCALE = DRAW_H / CHAR_PX_H;
const FULL_DH = Math.round(FRAME_H * DRAW_SCALE);
const FULL_DW = Math.round(FRAME_W * DRAW_SCALE);
const FEET_Y  = Math.round(680 * DRAW_SCALE);
const CTR_X   = Math.round(360 * DRAW_SCALE);

function _fx(t,x,y,p){ if(typeof window._addFxShape==='function') try{window._addFxShape(t,x,y,p||{});}catch(e){} }
function _hurtp(d,kx,ky){ if(typeof hurtPlayer==='function') hurtPlayer(d,kx||0,ky||0,0.5,0.35); }
function _sw(x,y,r,maxR,life,c){ if(typeof shockwaves!=='undefined') shockwaves.push({x,y,r,maxR,life,age:0,c}); }
function _ptcl(x,y,n,c,spd,ang,spread){
  if(typeof addParticle!=='function') return;
  for(let i=0;i<n;i++){
    const a=ang!=null?ang+(Math.random()-0.5)*(spread||1.4):Math.random()*Math.PI*2;
    addParticle(x,y,{n:1,c,spd:spd||80,r:2,life:0.4,spread:0.1,angle:a});
  }
}
function _shake(s,f){ if(typeof camShake==='function') camShake(s,f); }

function makeMonster1(x,y){
  const e={
    x,y,vx:0,vy:0,facing:1,
    isMonster1:true,
    hp:HP_MAX,maxHp:HP_MAX,
    state:'idle',stateTimer:0,hurtTimer:0,deadAge:0,
    _animT:Math.random()*10,
    _pauseT:0,_atkCD:0,
    _blendT:1,_prevKey:null,_prevIdx:0,

    takeDamage(dmg,kx,ky){
      if(this.state==='dead') return;
      this.hp=Math.max(0,this.hp-dmg);
      this.hurtTimer=0.12;
      if(this.hp<=0){ this._die(); return; }
      if(this.state!=='atk'){
        this.state='hurt'; this.stateTimer=0.18;
        this.vx=(kx||0)*1.0; this.vy=(ky||0)*0.5;
      }
    },

    _die(){
      this.state='dead'; this.deadAge=0; this.vx=this.vy=0;
      _sw(this.x,this.y-20,6,55,0.55,'#553333');
      _ptcl(this.x,this.y-20,18,'#221111',90);
      _fx('burst',this.x,this.y-20,{r:40,color:'#442222',life:0.5});
      _shake(0.15,6);
      if(typeof window.killCount!=='undefined') window.killCount++;
    },

    update(dt,player){
      if(this._atkCD>0) this._atkCD-=dt;
      if(this._pauseT>0) this._pauseT-=dt;
      if(this.hurtTimer>0) this.hurtTimer-=dt;
      if(this._blendT<1) this._blendT=Math.min(1,this._blendT+dt/0.12);
      const _prevAK=this.state==='atk'?'atk':'run';
      this._animT+=dt;

      if(this.state==='dead'){ this.deadAge+=dt; return; }

      if(this.state==='hurt'){
        this.stateTimer-=dt;
        this.x+=this.vx*dt; this.y+=this.vy*dt;
        this.vx*=Math.pow(0.01,dt); this.vy*=Math.pow(0.01,dt);
        if(this.stateTimer<=0) this.state='idle';
        return;
      }
      if(this.state==='atk'){
        this.stateTimer-=dt;
        if(this.stateTimer<=0){
          const pool=window.MONSTER1_IMG&&window.MONSTER1_IMG['atk'];
          if(pool){this._prevKey='atk';this._prevIdx=Math.floor(this._animT*FPS.atk)%pool.length;}
          this._blendT=0;
          this.state='idle';this._pauseT=POST_PAUSE;
        }
        return;
      }
      if(!player){this.state='idle';return;}
      if(this._pauseT>0){this._walkTo(dt,player);return;}

      const pdx=player.x-this.x, pdy=player.y-this.y;
      const pd=Math.hypot(pdx,pdy)||1;
      this.facing=pdx>=0?1:-1;

      if(this._atkCD<=0&&pd<ATK_R){
        this._doAtk(pdx,pdy,pd); return;
      }
      this._walkTo(dt,player);
    },

    _doAtk(pdx,pdy,pd){
      const dur=FRAMES.atk/FPS.atk;
      // 触发融合：记录切换前的帧
      const pool=window.MONSTER1_IMG&&window.MONSTER1_IMG['run'];
      if(pool){this._prevKey='run';this._prevIdx=Math.floor(this._animT*FPS.run)%pool.length;}
      this._blendT=0;
      this.state='atk'; this.stateTimer=dur; this._animT=0;
      this._atkCD=ATK_CD;
      const ang=Math.atan2(pdy,pdx);
      const cx=this.x+pdx/pd*24, cy=this.y-18;
      setTimeout(()=>{
        if(this.state==='dead') return;
        _fx('slashgash',cx,cy,{angle:ang,len:55,palette:'dark',life:0.18});
        _ptcl(cx,cy,10,'#331111',80,ang,1.2);
        _sw(cx,cy,3,38,0.18,'#441111');
        _shake(0.08,3);
        if(typeof player!=='undefined'&&Math.hypot(player.x-cx,player.y-cy)<ATK_R+8)
          _hurtp(ATK_DMG,pdx/pd*55,pdy/pd*28);
      },Math.round(8/FPS.atk*1000));
    },

    _walkTo(dt,player){
      const pdx=player.x-this.x,pdy=player.y-this.y;
      const pd=Math.hypot(pdx,pdy)||1;
      if(this._atkCD<=0){
        // CD好了：冲向玩家攻击
        if(pd>ATK_R-4){
          this.state='run';
          this.x+=pdx/pd*SPD_WALK*dt;
          this.y+=pdy/pd*SPD_WALK*dt;
        } else {
          this.state='idle';
        }
      } else {
        // CD冷却中：保持 PATROL_DIST 距离游荡
        if(pd<PATROL_DIST-20){
          this.state='run';
          this.x-=pdx/pd*SPD_WALK*0.55*dt;
          this.y-=pdy/pd*SPD_WALK*0.55*dt;
        } else if(pd>PATROL_DIST+40){
          this.state='run';
          this.x+=pdx/pd*SPD_WALK*0.4*dt;
          this.y+=pdy/pd*SPD_WALK*0.4*dt;
        } else {
          this.state='idle';
        }
      }
    },

    draw(ctx,ox_,oy_,ISO){
      ISO=ISO||1;
      const sx=this.x-(ox_||0), sy=(this.y-(oy_||0))*ISO;
      ctx.save();
      const fade=this.state==='dead'?Math.max(0,1-this.deadAge/0.7):1;
      ctx.globalAlpha=fade;

      // 脚下阴影
      ctx.save();
      const _sw2=FULL_DW*0.5, _sh2=_sw2*0.2;
      const _sg=ctx.createRadialGradient(sx,sy,0,sx,sy,_sw2);
      _sg.addColorStop(0,'rgba(0,0,0,0.45)');
      _sg.addColorStop(0.6,'rgba(0,0,0,0.12)');
      _sg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.scale(1,_sh2/_sw2);
      ctx.fillStyle=_sg;
      ctx.beginPath();ctx.arc(sx,sy*(_sw2/_sh2),_sw2,0,Math.PI*2);ctx.fill();
      ctx.restore();

      // 精灵（带 blend 融合）
      const animKey=this.state==='atk'?'atk':'run';
      const pool=window.MONSTER1_IMG&&window.MONSTER1_IMG[animKey];
      if(pool&&pool.length>0&&pool[0]){
        const fps=FPS[animKey];
        const fi=Math.floor(this._animT*fps)%pool.length;
        const img=pool[Math.max(0,fi)];
        const bt=this._blendT;

        // 前一帧淡出
        if(bt<1&&this._prevKey&&window.MONSTER1_IMG[this._prevKey]){
          const pp=window.MONSTER1_IMG[this._prevKey];
          const pi=Math.min(this._prevIdx,pp.length-1);
          const pimg=pp[pi];
          if(pimg&&pimg.complete&&pimg.naturalWidth){
            ctx.save();
            ctx.globalAlpha=fade*(1-bt);
            if(this.hurtTimer>0) ctx.filter='brightness(2.5) saturate(0.2)';
            if(this.facing<0){ctx.translate(sx,0);ctx.scale(-1,1);ctx.translate(-sx,0);}
            ctx.drawImage(pimg,sx-CTR_X,sy-FEET_Y,FULL_DW,FULL_DH);
            ctx.filter='none';
            ctx.restore();
          }
        }

        // 当前帧淡入
        if(img&&img.complete&&img.naturalWidth){
          ctx.save();
          ctx.globalAlpha=fade*(bt<1?bt:1);
          if(this.hurtTimer>0) ctx.filter='brightness(2.5) saturate(0.2)';
          if(this.facing<0){ctx.translate(sx,0);ctx.scale(-1,1);ctx.translate(-sx,0);}
          ctx.drawImage(img, sx-CTR_X, sy-FEET_Y, FULL_DW, FULL_DH);
          ctx.filter='none';
          ctx.restore();
        }
      } else {
        ctx.fillStyle=this.hurtTimer>0?'#FF8888':'#663333';
        ctx.beginPath();ctx.ellipse(sx,sy-22,12,18,0,0,Math.PI*2);ctx.fill();
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

window.spawnMonster1=(x,y)=>makeMonster1(x,y);

})();
