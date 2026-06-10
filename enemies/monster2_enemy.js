// monster2_enemy.js — 水墨恶魔 中型近战怪（重击版）
// 动作：run(移动) / atk(攻击)
(function(){
'use strict';

const HP_MAX   = 160;
const SPD_WALK = 60;
const ATK_R    = 50,  ATK_DMG = 22,  ATK_CD = 2.5;
const POST_PAUSE = 0.55;
const PATROL_DIST = 110;

const FRAMES = { run: 27, atk: 76 };
const FPS    = { run: 21, atk: 108 };

// run 帧参数（720x720 原始帧，角色高580px，脚底660px）
const FRAME_W = 720, FRAME_H = 720;
const CHAR_PX_H = 580;
const DRAW_H = 70;
const DRAW_SCALE = DRAW_H / CHAR_PX_H;
const FULL_DH = Math.round(FRAME_H * DRAW_SCALE);
const FULL_DW = Math.round(FRAME_W * DRAW_SCALE);
const FEET_Y  = Math.round(660 * DRAW_SCALE);
const CTR_X   = Math.round(360 * DRAW_SCALE);

// atk 帧参数（已裁剪到角色范围 720x719 → 241x240，角色充满）
// ATK_FEET_Y 按 run 帧脚底位置对齐，消除切换时瞬移
const ATK_FULL_DW = 140;
const ATK_FULL_DH = 140;
const ATK_FEET_Y  = 98;
const ATK_CTR_X   = 70;

// 出现/消失水墨烟雾 — 挂到 window，三种怪物共用
window._drawInkSmoke=function(ctx,sx,sy,age,dur,fade,dw,fy){
  if(age>=dur) return;
  const t=age/dur;
  const rising=sy-fy*0.3;
  for(let i=0;i<5;i++){
    const off=(i/5+t*1.1)%1;
    const r=dw*(0.12+off*0.28);
    const oy=-off*fy*0.55;
    const ox=(i-2)*dw*0.08;
    const alpha=fade*(1-off)*(1-t)*0.55;
    if(alpha<=0) continue;
    ctx.save();
    ctx.globalAlpha=alpha;
    ctx.fillStyle=i%2===0?'#080310':'#060D18';
    ctx.beginPath();ctx.arc(sx+ox,rising+oy,r,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
};

function _fx(t,x,y,p){ if(typeof window._addFxShape==='function') try{window._addFxShape(t,x,y,p||{});}catch(e){} }
function _hurtp(d,kx,ky){ if(typeof hurtPlayer==='function') hurtPlayer(d,kx||0,ky||0,0.6,0.4); }
function _sw(x,y,r,maxR,life,c){ if(typeof shockwaves!=='undefined') shockwaves.push({x,y,r,maxR,life,age:0,c}); }
function _ptcl(x,y,n,c,spd,ang,spread){
  if(typeof addParticle!=='function') return;
  for(let i=0;i<n;i++){
    const a=ang!=null?ang+(Math.random()-0.5)*(spread||1.4):Math.random()*Math.PI*2;
    addParticle(x,y,{n:1,c,spd:spd||80,r:2.5,life:0.5,spread:0.1,angle:a});
  }
}
function _shake(s,f){ if(typeof camShake==='function') camShake(s,f); }

function makeMonster2(x,y){
  const e={
    x,y,vx:0,vy:0,facing:1,
    isMonster2:true,
    hp:HP_MAX,maxHp:HP_MAX,
    state:'idle',stateTimer:0,hurtTimer:0,deadAge:0,
    _animT:Math.random()*10,
    _pauseT:0,_atkCD:0,
    _blendT:1,_prevKey:null,_prevIdx:0,

    takeDamage(dmg,kx,ky){
      if(this.state==='dead') return;
      this.hp=Math.max(0,this.hp-dmg);
      this.hurtTimer=0.14;
      if(this.hp<=0){ this._die(); return; }
      if(this.state!=='atk'){
        this.state='hurt'; this.stateTimer=0.22;
        this.vx=(kx||0)*0.8; this.vy=(ky||0)*0.4;
      }
    },

    _die(){
      this.state='dead'; this.deadAge=0; this.vx=this.vy=0;
      _sw(this.x,this.y-28,10,70,0.65,'#442222');
      _ptcl(this.x,this.y-28,24,'#331111',100);
      _fx('burst',this.x,this.y-28,{r:55,color:'#552222',life:0.6});
      _shake(0.22,8);
      if(typeof window.killCount!=='undefined') window.killCount++;
    },

    update(dt,player){
      if(this._atkCD>0) this._atkCD-=dt;
      if(this._pauseT>0) this._pauseT-=dt;
      if(this.hurtTimer>0) this.hurtTimer-=dt;
      if(this._blendT<1) this._blendT=Math.min(1,this._blendT+dt/0.12);
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
          const pool=window.MONSTER2_IMG&&window.MONSTER2_IMG['atk'];
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
      const pool=window.MONSTER2_IMG&&window.MONSTER2_IMG['run'];
      if(pool){this._prevKey='run';this._prevIdx=Math.floor(this._animT*FPS.run)%pool.length;}
      this._blendT=0;
      this.state='atk'; this.stateTimer=dur; this._animT=0;
      this._atkCD=ATK_CD;
      const ang=Math.atan2(pdy,pdx);
      const cx=this.x+pdx/pd*32, cy=this.y-24;
      setTimeout(()=>{
        if(this.state==='dead') return;
        _fx('crescent',cx,cy,{r:52,startAng:ang-0.9,sweep:1.8,thickness:10,palette:'dark',life:0.24});
        _ptcl(cx,cy,16,'#441111',100,ang,1.3);
        _sw(cx,cy,6,52,0.22,'#552222');
        _shake(0.14,5);
        if(typeof player!=='undefined'&&Math.hypot(player.x-cx,player.y-cy)<ATK_R+10)
          _hurtp(ATK_DMG,pdx/pd*75,pdy/pd*38);
      },Math.round(10/FPS.atk*1000));
    },

    _walkTo(dt,player){
      const pdx=player.x-this.x,pdy=player.y-this.y;
      const pd=Math.hypot(pdx,pdy)||1;
      if(this._atkCD<=0){
        if(pd>ATK_R-6){
          this.state='run';
          this.x+=pdx/pd*SPD_WALK*dt;
          this.y+=pdy/pd*SPD_WALK*dt;
        } else {
          this.state='idle';
        }
      } else {
        if(pd<PATROL_DIST-20){
          this.state='run';
          this.x-=pdx/pd*SPD_WALK*0.5*dt;
          this.y-=pdy/pd*SPD_WALK*0.5*dt;
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
      const fade=this.state==='dead'?Math.max(0,1-this.deadAge/0.75):1;
      ctx.globalAlpha=fade;

      ctx.save();
      const _sw2=FULL_DW*0.52, _sh2=_sw2*0.22;
      const _sg=ctx.createRadialGradient(sx,sy,0,sx,sy,_sw2);
      _sg.addColorStop(0,'rgba(0,0,0,0.45)');
      _sg.addColorStop(0.6,'rgba(0,0,0,0.12)');
      _sg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.scale(1,_sh2/_sw2);
      ctx.fillStyle=_sg;
      ctx.beginPath();ctx.arc(sx,sy*(_sw2/_sh2),_sw2,0,Math.PI*2);ctx.fill();
      ctx.restore();

      const animKey=this.state==='atk'?'atk':'run';
      // atk 帧已裁剪至角色范围，使用独立绘制参数
      const dw=animKey==='atk'?ATK_FULL_DW:FULL_DW;
      const dh=animKey==='atk'?ATK_FULL_DH:FULL_DH;
      const fy=animKey==='atk'?ATK_FEET_Y:FEET_Y;
      const cx2=animKey==='atk'?ATK_CTR_X:CTR_X;
      const pool=window.MONSTER2_IMG&&window.MONSTER2_IMG[animKey];
      if(pool&&pool.length>0&&pool[0]){
        const fps=FPS[animKey];
        const fi=Math.floor(this._animT*fps)%pool.length;
        const img=pool[Math.max(0,fi)];
        const bt=this._blendT;
        if(bt<1&&this._prevKey&&window.MONSTER2_IMG[this._prevKey]){
          const pp=window.MONSTER2_IMG[this._prevKey];
          const pi=Math.min(this._prevIdx,pp.length-1);
          const pimg=pp[pi];
          const pdw=this._prevKey==='atk'?ATK_FULL_DW:FULL_DW;
          const pdh=this._prevKey==='atk'?ATK_FULL_DH:FULL_DH;
          const pfy=this._prevKey==='atk'?ATK_FEET_Y:FEET_Y;
          const pcx=this._prevKey==='atk'?ATK_CTR_X:CTR_X;
          if(pimg&&pimg.complete&&pimg.naturalWidth){
            ctx.save();ctx.globalAlpha=fade*(1-bt);
            if(this.facing>0){ctx.translate(sx,0);ctx.scale(-1,1);ctx.translate(-sx,0);}
            ctx.drawImage(pimg,sx-pcx,sy-pfy,pdw,pdh);ctx.restore();
          }
        }
        if(img&&img.complete&&img.naturalWidth){
          ctx.save();
          ctx.globalAlpha=fade*(bt<1?bt:1);
          if(this.hurtTimer>0) ctx.filter='brightness(2.5) saturate(0.2)';
          if(this.facing>0){ctx.translate(sx,0);ctx.scale(-1,1);ctx.translate(-sx,0);}
          ctx.drawImage(img, sx-cx2, sy-fy, dw, dh);
          ctx.filter='none';ctx.restore();
        }
      } else {
        ctx.fillStyle=this.hurtTimer>0?'#FF8888':'#552222';
        ctx.beginPath();ctx.ellipse(sx,sy-28,14,22,0,0,Math.PI*2);ctx.fill();
      }

      // 出现/消失水墨烟雾
      if(typeof window._drawInkSmoke==='function'){
        window._drawInkSmoke(ctx,sx,sy,this._animT,0.55,fade,FULL_DW,FEET_Y);
        if(this.state==='dead'&&this.deadAge<0.9)
          window._drawInkSmoke(ctx,sx,sy,this.deadAge,0.9,1,FULL_DW,FEET_Y);
      }

      ctx.restore();
    }
  };
  return e;
}

window.spawnMonster2=(x,y)=>makeMonster2(x,y);

})();
