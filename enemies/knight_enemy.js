// knight_enemy.js — 黄金骑士 精英怪 v2
// atk1: 近战斩击（普攻）
// atk2: 金光法阵 — 原地召唤，击退周围目标
// atk3: 金色光柱 — 向前射出光柱
// 黑底帧用 screen 混合模式去背
(function(){
'use strict';

// ── 数值 ──────────────────────────────────────
const HP_MAX      = 540;
const SHIELD_MAX  = 120;
const SPD_WALK    = 55;
const SPD_RUSH    = 200;

const ATK_R=65,   ATK_DMG=22,  ATK_CD=2.2;  // 普攻
const SK2_R=100,  SK2_DMG=20,  SK2_CD=8.0,  SK2_KB=180;  // 金光法阵
const SK3_RANGE=280,SK3_DMG=28,SK3_CD=10.0;              // 金色光柱

const ATK_PER_SKILL = 3;   // 3次普攻释放1个技能
const POST_PAUSE    = 0.6;

// ── 帧 / FPS ──────────────────────────────────
const FRAMES = { walk:40, atk1:40, atk2:40, atk3:39 };
const FPS    = { walk:12, atk1:16, atk2:13, atk3:13 };

// 骑士在帧内的位置（1300×1000 黑底画布）
// 头顶 y≈220  脚底 y≈680  角色高≈460px  中心x≈620/1300
const FRAME_W=1300, FRAME_H=1000;
const CHAR_PX_H=460;  // 角色在帧内像素高度
const DRAW_H=63;       // 游戏内目标高度 (1.5×玩家42px)
const DRAW_SCALE=DRAW_H/CHAR_PX_H;   // ≈0.137
const FULL_DH=Math.round(FRAME_H*DRAW_SCALE); // ≈137
const FULL_DW=Math.round(FRAME_W*DRAW_SCALE); // ≈178
const FEET_Y=Math.round(680*DRAW_SCALE);       // ≈93 (脚底距渲染框顶部)
const CTR_X =Math.round(620*DRAW_SCALE);       // ≈85 (中心距渲染框左侧)

// ── 工具 ──────────────────────────────────────
function _fx(t,x,y,p){ if(typeof window._addFxShape==='function') try{window._addFxShape(t,x,y,p||{});}catch(e){} }
function _hurtp(d,kx,ky){ if(typeof hurtPlayer==='function') hurtPlayer(d,kx||0,ky||0,0.5,0.35); }
function _sw(x,y,r,maxR,life,c){ if(typeof shockwaves!=='undefined') shockwaves.push({x,y,r,maxR,life,age:0,c}); }
function _proj(p){ if(typeof bossProjectiles!=='undefined') bossProjectiles.push(p); }
function _ptcl(x,y,n,c,spd,ang,spread){
  if(typeof addParticle!=='function') return;
  for(let i=0;i<n;i++){
    const a = ang!=null ? ang+(Math.random()-0.5)*(spread||1.4) : Math.random()*Math.PI*2;
    addParticle(x,y,{n:1,c,spd:spd||80,r:2.5,life:0.5,spread:0.15,angle:a});
  }
}
function _shake(s,f){ if(typeof camShake==='function') camShake(s,f); }

// ── 工厂 ──────────────────────────────────────
function makeKnight(x,y){
  const e={
    x,y,vx:0,vy:0,facing:1,
    hp:HP_MAX,maxHp:HP_MAX,
    shield:SHIELD_MAX,maxShield:SHIELD_MAX,
    isElite:true,isKnight:true,
    state:'idle',stateTimer:0,hurtTimer:0,deadAge:0,
    _animT:Math.random()*10,
    _pauseT:0,
    _atkCD:0,_sk2CD:0,_sk3CD:0,
    _atkCount:0,_nextSk:2,  // 下一技能轮次：2或3
    _rushDir:{x:1,y:0},_rushHit:false,
    _defCD:0,

    takeDamage(dmg,kx,ky){
      if(this.state==='dead') return;
      let d=dmg;
      if(this.shield>0){
        const ab=Math.min(this.shield,d); this.shield-=ab; d-=ab;
        _fx('ring',this.x,this.y-30,{r:28,color:'#80AAFF',life:0.3});
        if(this.shield<=0){
          _fx('ring',this.x,this.y-30,{r:44,color:'#FFD060',life:0.45});
          _sw(this.x,this.y-30,8,55,0.35,'#AACCFF');
          _shake(0.1,4);
        }
      }
      if(d<=0) return;
      this.hp=Math.max(0,this.hp-d);
      this.hurtTimer=0.15;
      if(this.hp<=0){ this._die(); return; }
      if(this.state!=='sk2'&&this.state!=='sk3'){
        this.state='hurt'; this.stateTimer=0.20;
        this.vx=(kx||0)*1.2; this.vy=(ky||0)*0.6;
      }
    },

    _die(){
      this.state='dead'; this.deadAge=0; this.vx=this.vy=0;
      _sw(this.x,this.y-25,10,80,0.7,'#FFD060');
      _sw(this.x,this.y-25,6,50,0.45,'#FFFFFF');
      _ptcl(this.x,this.y-25,28,'#FFD060',110);
      _ptcl(this.x,this.y-25,12,'#FFFFFF',65);
      _fx('burst',this.x,this.y-25,{r:55,color:'#FFD060',life:0.6});
      _shake(0.25,9);
      if(typeof window.killCount!=='undefined') window.killCount++;
    },

    update(dt,player){
      for(const k of ['_atkCD','_sk2CD','_sk3CD','_pauseT','hurtTimer','_defCD'])
        if(this[k]>0) this[k]-=dt;
      this._animT+=dt;

      if(this.state==='dead'){ this.deadAge+=dt; return; }

      const pdx=player?player.x-this.x:0;
      const pdy=player?player.y-this.y:0;
      const pd=Math.hypot(pdx,pdy)||1;
      if(player) this.facing=pdx>=0?1:-1;

      // 硬直
      if(this.state==='hurt'){
        this.stateTimer-=dt;
        this.x+=this.vx*dt; this.y+=this.vy*dt;
        this.vx*=Math.pow(0.005,dt); this.vy*=Math.pow(0.005,dt);
        if(this.stateTimer<=0) this.state='idle';
        return;
      }
      // 普攻后摇
      if(this.state==='atk'){
        this.stateTimer-=dt;
        if(this.stateTimer<=0){this.state='idle';this._pauseT=POST_PAUSE;}
        return;
      }
      // 金光法阵
      if(this.state==='sk2'){
        this.stateTimer-=dt;
        if(this.stateTimer<=0){this.state='idle';this._pauseT=POST_PAUSE;}
        return;
      }
      // 金色光柱
      if(this.state==='sk3'){
        this.stateTimer-=dt;
        if(this.stateTimer<=0){this.state='idle';this._pauseT=POST_PAUSE;}
        return;
      }

      if(!player){this.state='idle';return;}
      if(this._pauseT>0){this._walkTo(dt,pd,pdx,pdy);return;}

      // ── 行为树 3普攻→1技能 ──────────────────
      if(this._atkCount<ATK_PER_SKILL){
        if(this._atkCD<=0&&pd<ATK_R){
          this._doAtk(pdx,pdy,pd);
          return;
        }
        this._walkTo(dt,pd,pdx,pdy);
        return;
      }
      // 轮到技能
      const sk=this._nextSk;
      if(sk===2&&this._sk2CD<=0){
        this._doSk2(pdx,pdy,pd);
        return;
      }
      if(sk===3&&this._sk3CD<=0&&pd<SK3_RANGE){
        this._doSk3(pdx,pdy,pd);
        return;
      }
      // CD未好/距离不对：继续普攻等待
      if(this._atkCD<=0&&pd<ATK_R){
        this._doAtk(pdx,pdy,pd);
        return;
      }
      this._walkTo(dt,pd,pdx,pdy);
    },

    // ── 普攻·近战斩击 ──────────────────────────
    _doAtk(pdx,pdy,pd){
      const dur=FRAMES.atk1/FPS.atk1;
      this.state='atk'; this.stateTimer=dur; this._animT=0;
      this._atkCD=ATK_CD; this._atkCount++;
      const ang=Math.atan2(pdy,pdx);
      const cx=this.x+pdx/pd*36,cy=this.y-28;
      // hitDelay 约第15帧
      setTimeout(()=>{
        if(this.state==='dead') return;
        _fx('crescent',cx,cy,{r:60,startAng:ang-1.0,sweep:2.0,thickness:11,palette:'gold',life:0.28});
        _fx('slashgash',cx,cy,{angle:ang,len:85,palette:'gold',life:0.22});
        _ptcl(cx,cy,18,'#FFD060',120,ang,1.5);
        _ptcl(cx,cy,8,'#FFFFFF',55,ang,0.8);
        _sw(cx,cy,5,55,0.22,'#FFCC44'); _shake(0.12,5);
        if(typeof player!=='undefined'&&Math.hypot(player.x-cx,player.y-cy)<ATK_R)
          _hurtp(ATK_DMG,pdx/pd*70,pdy/pd*35);
      },Math.round(15/FPS.atk1*1000));
    },

    // ── SK2·金光法阵 ───────────────────────────
    _doSk2(pdx,pdy,pd){
      const dur=FRAMES.atk2/FPS.atk2;
      this.state='sk2'; this.stateTimer=dur; this._animT=0;
      this._sk2CD=SK2_CD;
      this._atkCount=0;
      this._nextSk=3;  // 下次用sk3
      const cx=this.x,cy=this.y-8;
      // 蓄力特效
      _ptcl(cx,cy,16,'#FFDD44',55);
      _fx('spiral',cx,cy,{r:58,life:0.6,palette:'gold'});

      // 延迟 ~20帧 法阵爆发
      setTimeout(()=>{
        if(this.state==='dead') return;
        // 六边形光圈 + 多层冲击波
        _sw(cx,cy,10,SK2_R,0.55,'#FFD060');
        _sw(cx,cy,6,SK2_R*0.65,0.4,'#FFFFFF');
        _sw(cx,cy,4,SK2_R*1.3,0.35,'#FFAA00');
        _fx('darkring',cx,cy,{r:SK2_R*0.8,life:0.5,color:'#FFD060'});
        _ptcl(cx,cy,30,'#FFD060',120); _ptcl(cx,cy,14,'#FFFFFF',70);
        _shake(0.3,12);
        // 法阵符文
        for(let i=0;i<6;i++){
          const a=i/6*Math.PI*2;
          const rx=cx+Math.cos(a)*50,ry=cy+Math.sin(a)*50;
          _fx('ring',rx,ry,{r:14,color:'#FFD060',life:0.4});
          _ptcl(rx,ry,6,'#FFD060',50);
        }
        // 击退玩家
        if(typeof player!=='undefined'){
          const dx2=player.x-cx,dy2=player.y-cy;
          const d2=Math.hypot(dx2,dy2)||1;
          if(d2<SK2_R+20)
            _hurtp(SK2_DMG,dx2/d2*SK2_KB,dy2/d2*(SK2_KB*0.5));
        }
      },Math.round(20/FPS.atk2*1000));
    },

    // ── SK3·金色光柱 ───────────────────────────
    _doSk3(pdx,pdy,pd){
      const dur=FRAMES.atk3/FPS.atk3;
      this.state='sk3'; this.stateTimer=dur; this._animT=0;
      this._sk3CD=SK3_CD;
      this._atkCount=0;
      this._nextSk=2;  // 下次用sk2
      const ang=Math.atan2(pdy,pdx);
      // 蓄力
      _ptcl(this.x,this.y-28,12,'#FFEE88',50,ang,0.5);
      _fx('ring',this.x,this.y-28,{r:25,color:'#FFD060',life:0.35});

      // 延迟 ~15帧 发射
      setTimeout(()=>{
        if(this.state==='dead') return;
        const ox=this.x+Math.cos(ang)*20,oy=this.y-28+Math.sin(ang)*20;
        // 主光柱弹丸
        _proj({
          x:ox,y:oy,
          vx:Math.cos(ang)*420,vy:Math.sin(ang)*420,
          r:16,life:2.2,age:0,
          dmg:SK3_DMG,
          type:'beam_fast',angle:ang,trail:[],
          glow:'#FFDD44',core:'#FFFFAA',
          isKnightBeam:true
        });
        // 副光束（稍宽）
        _proj({
          x:ox,y:oy,
          vx:Math.cos(ang)*380,vy:Math.sin(ang)*380,
          r:8,life:2.0,age:0,
          dmg:Math.round(SK3_DMG*0.5),
          type:'beam_fast',angle:ang,trail:[],
          glow:'#FFFFCC',core:'#FFFFFF',
          isKnightBeam:true
        });
        // 发射口特效
        _sw(ox,oy,4,42,0.25,'#FFD060');
        _ptcl(ox,oy,22,'#FFD060',160,ang,0.6);
        _ptcl(ox,oy,10,'#FFFFFF',80,ang+Math.PI,1.0);
        _fx('firepillar',ox,oy,{r:22,life:0.28,color:'#FFDD44'});
        _shake(0.18,7);
      },Math.round(15/FPS.atk3*1000));
    },

    _walkTo(dt,pd,pdx,pdy){
      const target=75;
      if(pd>target+18){ this.state='walk'; this.x+=pdx/pd*SPD_WALK*dt; this.y+=pdy/pd*SPD_WALK*dt; }
      else if(pd<target-22){ this.state='walk'; this.x-=pdx/pd*SPD_WALK*0.5*dt; this.y-=pdy/pd*SPD_WALK*0.5*dt; }
      else{ this.state='idle'; }
    },

    // ── 渲染 ──────────────────────────────────
    draw(ctx,ox_,oy_,ISO){
      ISO=ISO||1;
      const sx=this.x-(ox_||0),sy=(this.y-(oy_||0))*ISO;

      ctx.save();
      const fade=this.state==='dead'?Math.max(0,1-this.deadAge/0.8):1;
      ctx.globalAlpha=fade;

      // 阴影
      ctx.fillStyle='rgba(0,0,0,0.35)';
      ctx.beginPath();ctx.ellipse(sx,sy+2,22,22*ISO*0.42,0,0,6.283);ctx.fill();

      // 护盾光晕
      if(this.shield>0){
        const sr=32+Math.sin(this._animT*2.5)*3;
        const sg=ctx.createRadialGradient(sx,sy-28,sr*0.3,sx,sy-28,sr*1.6);
        sg.addColorStop(0,`rgba(100,180,255,${0.12+this.shield/this.maxShield*0.1})`);
        sg.addColorStop(1,'rgba(50,120,200,0)');
        ctx.fillStyle=sg;ctx.beginPath();ctx.arc(sx,sy-28,sr*1.6,0,Math.PI*2);ctx.fill();
      }

      // 精灵图：screen 混合去黑底
      const animKey=this._animKey();
      const pool=window.KNIGHT_IMG&&window.KNIGHT_IMG[animKey];
      if(pool&&pool.length>0&&pool[0].complete&&pool[0].naturalWidth){
        const fps=FPS[animKey]||12;
        const fi=Math.floor(this._animT*fps)%pool.length;
        const img=pool[Math.max(0,fi)];
        if(img&&img.complete&&img.naturalWidth){
          // 脚下阴影
          ctx.save();
          const _sw=FULL_DW*0.45, _sh=_sw*0.18;
          const _sg=ctx.createRadialGradient(sx,sy,0,sx,sy,_sw);
          _sg.addColorStop(0,'rgba(0,0,0,0.5)');_sg.addColorStop(0.6,'rgba(0,0,0,0.15)');_sg.addColorStop(1,'rgba(0,0,0,0)');
          ctx.scale(1,_sh/_sw); ctx.fillStyle=_sg;
          ctx.beginPath();ctx.arc(sx,sy*(_sw/_sh),_sw,0,Math.PI*2);ctx.fill();
          ctx.restore();

          ctx.save();
          if(this.hurtTimer>0) ctx.filter='brightness(2.5) saturate(0.3)';
          if(this.facing<0){ ctx.translate(sx,0);ctx.scale(-1,1);ctx.translate(-sx,0); }
          ctx.globalCompositeOperation='screen';
          ctx.drawImage(img, sx-CTR_X, sy-FEET_Y, FULL_DW, FULL_DH);
          ctx.filter='none';
          ctx.restore();
        }
      } else {
        // 占位
        ctx.fillStyle=this.hurtTimer>0?'#FFCC88':'#C8A030';
        ctx.beginPath();ctx.ellipse(sx,sy-28,13,22,0,0,6.283);ctx.fill();
        ctx.fillStyle='#FFD060';
        ctx.beginPath();ctx.ellipse(sx,sy-50,11,12,0,0,6.283);ctx.fill();
      }

      // ── 血条 + 护盾条 ─────────────────────
      const BW=48,BH=4,bx=sx-BW/2,by=sy-DRAW_H-14;
      if(this.shield>0){
        ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(bx,by-7,BW,BH);
        const sg2=ctx.createLinearGradient(bx,0,bx+BW,0);
        sg2.addColorStop(0,'#60BBFF');sg2.addColorStop(1,'#A0E0FF');
        ctx.fillStyle=sg2;ctx.fillRect(bx,by-7,BW*this.shield/this.maxShield,BH);
      }
      ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(bx,by,BW,BH);
      const hr=this.hp/this.maxHp;
      ctx.fillStyle=hr>0.5?'#44DD44':hr>0.25?'#DDCC22':'#DD3322';
      ctx.fillRect(bx,by,BW*hr,BH);
      // 精英★
      ctx.fillStyle='rgba(255,210,50,0.95)';
      ctx.font='bold 9px monospace';ctx.textAlign='center';
      ctx.fillText('★',sx,by-4);

      ctx.restore();
    },

    _animKey(){
      const m={idle:'walk',walk:'walk',atk:'atk1',sk2:'atk2',sk3:'atk3',hurt:'walk',dead:'walk'};
      return m[this.state]||'walk';
    }
  };
  return e;
}

window.spawnKnight=(x,y)=>makeKnight(x,y);

})();
