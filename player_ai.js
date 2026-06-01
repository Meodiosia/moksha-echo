// player_ai.js - 玩家 AI（通过虚拟输入驱动移动）
// window._AI_IX / _AI_IY 会被主循环的移动代码读取

// 战斗中心锚点（十字地图中央交叉区域中心）
// level_3: tile(36,24) = world(864,576)
const AI_HOME = { x: 36*24, y: 24*24, pullRadius: 180, maxPull: 2.1 };

// 获取"回中心"方向向量（距离越远权重越大）
function _homeDir(px, py){
  const dx = AI_HOME.x - px, dy = AI_HOME.y - py;
  const dist = Math.hypot(dx, dy);
  if(dist < AI_HOME.pullRadius * 0.4) return {x:0, y:0, w:0};  // 范围内不拉
  const t = Math.min(1, (dist - AI_HOME.pullRadius*0.4) / (AI_HOME.pullRadius*0.6));
  const w = t * AI_HOME.maxPull;
  const l = dist || 1;
  return { x: dx/l, y: dy/l, w };
}

window._AI_IX = 0;
window._AI_IY = 0;

window.PlayerAI = {
  enabled: false,
  _tick: 0, TICK: 0.08,
  _defUsedT: 0, _skillUsedT: 0,
  _strafeDir: 1, _strafeFlipT: 0,

  toggle(){
    this.enabled = !this.enabled;
    window._AI_IX = 0; window._AI_IY = 0;
    console.log('[PlayerAI]', this.enabled ? 'ON (F1=off)' : 'OFF (F1=on)');
  },

  update(dt){
    if(!this.enabled) return;
    if(!player || player.state === 'dead'){ window._AI_IX=0; window._AI_IY=0; return; }
    this._tick -= dt;
    this._defUsedT   += dt;
    this._skillUsedT += dt;
    this._strafeFlipT -= dt;
    if(this._tick > 0) return;
    this._tick = this.TICK;
    this._run();
  },

  _run(){
    const b = this._boss();
    const r3 = (currentChar === 3 && typeof role3 !== 'undefined') ? role3 : null;
    if(player.state === 'hit' || player.state === 'hurt'){
      window._AI_IX=0; window._AI_IY=0; return;
    }
    const dist = b ? Math.hypot(b.x-player.x, b.y-player.y) : 999;

    // 判断是否有技能可用（有技能时主动进攻，不逃跑）
    const hasSword = r3 ? r3.swordCount() >= 1 : false;
    const hasSkill = r3 ? (r3.cdAtk1 <= 0 || r3.cdAtk4 <= 0 || r3.cdN <= 0) : false;
    const beAggressive = hasSword && hasSkill;

    // 危险响应（只有没技能或者大招才逃）
    if(b && this._isDanger(b, dist)){
      // 有技能时：只逃必逃的大招，其他尝试格挡
      const atk = b.attackKey || '';
      const mustDodge = ['ring_rush','ult'].some(k=>atk.includes(k));
      if(!beAggressive || mustDodge){
        if(this._handleDanger(b, dist)) return;
      } else {
        // 有技能时优先格挡而不是逃
        const parryable = ['atk_a','atk_b','atk_c','atk2a','atk2b'].some(k=>atk.includes(k));
        if(parryable && dist<160){
          const pre=(b.state==='telegraph'&&b.stateTimer<0.30)
                 ||(b.state==='attack'&&(b.atkPhaseT||0)<0.18);
          if(pre && this._defUsedT>0.7 && player.state!=='defend'){
            if(typeof doDefend==='function') doDefend();
            this._defUsedT=0; window._AI_IX=0; window._AI_IY=0; return;
          }
        }
      }
    }

    // 攻击（有技能时射程适当延长）
    const canAct = player.state==='idle' || player.state==='run';
    const atkRange = beAggressive ? 320 : 280;
    if(b && canAct && r3 && dist<=atkRange && player.dashDur<=0){
      if(this._doAttack(b, dist, r3)) return;
    }

    // 走位（有技能时缩短理想距离，主动接近）
    if(b) this._move(b, dist, beAggressive);
    else { window._AI_IX=0; window._AI_IY=0; }
  },

  _arenaEdge(){ return null; },   // 已废弃，用 _clampArena 硬约束

  _isDanger(b, dist){
    if(b.state!=='attack' && b.state!=='telegraph') return false;
    const a=b.attackKey||'';
    if(['ring_rush','ult','charge','pillar_fire'].some(k=>a.includes(k))) return true;
    return dist < 130;
  },

  _handleDanger(b, dist){
    const a=b.attackKey||'';
    const mustDodge = ['ring_rush','ult'].some(k=>a.includes(k));
    const parryable = ['atk_a','atk_b','atk_c','atk2a','atk2b'].some(k=>a.includes(k));

    if(mustDodge && player.dashCooldown<=0) return this._dash(b);

    if(parryable && dist<140){
      const pre=(b.state==='telegraph'&&b.stateTimer<0.25)
              ||(b.state==='attack'&&(b.atkPhaseT||0)<0.15);
      if(pre && this._defUsedT>0.8 && player.state!=='defend'){
        if(typeof doDefend==='function') doDefend();
        this._defUsedT=0; window._AI_IX=0; window._AI_IY=0; return true;
      }
    }
    if(dist<120 && player.dashCooldown<=0) return this._dash(b);
    if(dist<100){
      const dx=player.x-b.x, dy=player.y-b.y;
      const l=Math.hypot(dx,dy)||1;
      this._dir(dx/l, dy/l); return true;
    }
    return false;
  },

  _dash(b){
    if(player.dashCooldown>0||player.dashDur>0) return false;
    const awX=player.x-b.x, awY=player.y-b.y;
    const awL=Math.hypot(awX,awY)||1;
    const px=-awY/awL, py=awX/awL;
    const sd=this._strafeDir;
    let dx=awX/awL*0.6+px*sd*0.4;
    let dy=awY/awL*0.6+py*sd*0.4;
    // 混合中心引力（逃离时也尽量往中心方向）
    const home=_homeDir(player.x, player.y);
    if(home.w>0.2){
      dx=dx*0.6+home.x*0.4;
      dy=dy*0.6+home.y*0.4;
    }
    const l=Math.hypot(dx,dy)||1;
    this._dir(dx/l, dy/l);
    if(typeof doDash==='function') doDash();
    return true;
  },

  _doAttack(b, dist, r3){
    // 攻击前始终面朝 boss
    player.facing = b.x > player.x ? 1 : -1;

    const sw = r3.swordCount();
    const ok = (k) => (r3['cd'+k] || 0) <= 0;
    const charging = r3.chargingL > 0 || r3.chargingO > 0;

    // V — 圣域反弹（boss 蓄招/危险时优先放）
    if(ok('V') && b.attackKey && b.atkPhaseT && b.atkPhaseT > 0.1 && b.atkPhaseT < 0.4 && dist < 180){
      r3.doSanctuary(); this._skillUsedT = 0; return true;
    }
    // B — 千机突刺（中距瞬步切入）
    if(ok('B') && sw >= 2 && dist > 130 && dist < 320){
      r3.doBladeStep(); this._skillUsedT = 0; return true;
    }
    // M — 环刃（被逼近立即反制，最高优先）
    if(ok('M') && dist < 120){
      r3.doSwordOrbit(); this._skillUsedT = 0; return true;
    }
    // U — 大招（剑满即放，不等间隔）
    if(sw >= 6 && ok('U')){
      r3.doUltimate(); this._skillUsedT = 0; return true;
    }
    // N — 时停斩（剑4+，中近距）
    if(sw >= 4 && ok('N') && dist < 200){
      r3.doSwordCall(); this._skillUsedT = 0; return true;
    }
    // L — 蓄力剑阵（剑3+，蓄力后立放）
    if(sw >= 3 && !charging && ok('L') && dist < 260){
      r3.startChargeL();
      setTimeout(() => { if(r3.chargingL > 0) r3._releaseL(); }, 800 + Math.random()*300|0);
      this._skillUsedT = 0; return true;
    }
    // O — 蓄力射剑（剑2+）
    if(sw >= 2 && !charging && dist < 280){
      r3.startChargeO();
      setTimeout(() => { if(r3.chargingO > 0) r3._releaseO(); }, 600 + Math.random()*200|0);
      this._skillUsedT = 0; return true;
    }
    // P — 天落剑雨（任何时候 dist<250）
    if(ok('Atk4') && dist < 250){
      r3.doAtk4(); this._skillUsedT = 0; return true;
    }
    // J — 普攻连射（有剑 + 距离合适）
    if(ok('Atk1') && dist < 200 && (player.state === 'idle' || sw > 0)){
      r3.doAtk1(); return true;
    }
    return false;
  },

  _move(b, dist, aggressive){
    if(player.dashDur>0) return;
    if(this._strafeFlipT<=0){
      this._strafeDir*=-1;
      this._strafeFlipT=2.8+Math.random()*1.4;
    }
    const dx=b.x-player.x, dy=b.y-player.y;
    const l=Math.hypot(dx,dy)||1;
    const px=-dy/l, py=dx/l;
    const nearLimit = aggressive ? 110 : 135;
    const farLimit  = aggressive ? 180 : 230;
    let mx=0, my=0;
    if(dist < nearLimit){
      const rs = aggressive ? 0.3 : 0.7;
      mx=-dx/l*rs+px*this._strafeDir*(1-rs)*0.5;
      my=-dy/l*rs+py*this._strafeDir*(1-rs)*0.5;
    } else if(dist > farLimit){
      // 接近+绕圈
      mx=dx/l*0.7+px*this._strafeDir*0.3;
      my=dy/l*0.7+py*this._strafeDir*0.3;
    } else {
      // 理想距离：纯绕圈
      mx=px*this._strafeDir;
      my=py*this._strafeDir;
    }
    // Y 轴对齐：如果 Y 差距 > 20px，主动靠近同高度
    const yDiff = b.y - player.y;
    if(Math.abs(yDiff) > 20){
      const yAlign = Math.sign(yDiff) * 0.9;
      my = my * 0.25 + yAlign * 0.75;
    }

    // 中心引力
    const home = _homeDir(player.x, player.y);
    if(home.w > 0){
      const iw = 1 - home.w;
      mx = mx * iw + home.x * home.w;
      my = my * iw + home.y * home.w;
    }
    this._dir(mx, my);
    player.facing = b.x>player.x ? 1 : -1;
  },

  // 写虚拟方向输入
  _dir(dx, dy){
    const l=Math.hypot(dx,dy);
    if(l<0.05){ window._AI_IX=0; window._AI_IY=0; return; }
    window._AI_IX=dx/l; window._AI_IY=dy/l;
  },

  _boss(){
    return (typeof boss!=='undefined'&&boss&&boss.state!=='dead') ? boss : null;
  },
};
