
let _stormGlobalHitMap = {};
let _stormHitMapClearT = 0;
function _r3HitTryStorm(x, y, range, dmg){
  if(typeof _r3HitTry !== 'function'){
    if(typeof window._r3HitTry === 'function') window._r3HitTry(x, y, range, dmg);
    return;
  }
  const fake = { _hitMap: _stormGlobalHitMap };
  if(typeof window._r3HitTry === 'function') window._r3HitTry(x, y, range, dmg, fake);
}
setInterval(() => { _stormGlobalHitMap = {}; }, 250);

window.role3 = {
  cdAtk1: 0, cdAtk4: 0, cdL: 0, cdU: 0, cdN: 0, cdM: 0,
  cdB: 0, cdV: 0, cdH: 0,
  sanctuaryT: 0,
  orbitStormT: 0,
  chargingO: 0, chargingL: 0,
  combo1T: 0, combo2T: 0, combo4T: 0,
  jChainCount: 0, jChainTimer: 0,
  MAX_SWORDS: 8,
  jAnimVariant: 0,

  _jHitCount: 0,
  _kHitCount: 0,
  _bTrigCount: 0,
  _iBlockCount: 0,
  _mTrigCount: 0,
  _cdUAuto: 0,

  swordCount(){
    if(typeof role3Swords === 'undefined') return 0;
    return role3Swords.filter(s => s.state === 'orbit' && !s._temp).length;
  },
  isBusy(){
    if(player.state === 'attack' && !this.chargingO && !this.chargingL){
      const dur = player.attackDur || 0.3;
      const remain = player.stateTimer || 0;
      if(remain > dur * 0.35) return true;
    }
    if(typeof defend !== 'undefined' && defend.active) return true;
    return false;
  },
  _aimVec(){
    let dx = 0, dy = 0;
    if(typeof K !== 'undefined'){
      if(K['KeyA']||K['ArrowLeft'])  dx -= 1;
      if(K['KeyD']||K['ArrowRight']) dx += 1;
      if(K['KeyW']||K['ArrowUp'])    dy -= 1;
      if(K['KeyS']||K['ArrowDown'])  dy += 1;
    }
    if(dx === 0 && dy === 0){ dx = player.facing; dy = 0; }
    const L = Math.hypot(dx, dy) || 1;
    return { x: dx/L, y: dy/L };
  },
  _findTarget(fromX, fromY, range){
    let best = null, bestD = range;
    if(typeof boss !== 'undefined' && boss && boss.state !== 'dead'){
      const d = Math.hypot(boss.x - fromX, boss.y - fromY);
      if(d < bestD){ best = {x: boss.x, y: boss.y - 24}; bestD = d; }
    }
    if(typeof enemies !== 'undefined'){
      for(const e of enemies){
        if(!e || e.state === 'dead') continue;
        const d = Math.hypot(e.x - fromX, e.y - fromY);
        if(d < bestD){ best = {x: e.x, y: e.y - 16}; bestD = d; }
      }
    }
    return best;
  },
  _shootAngle(fromX, fromY){
    const aim = this._aimVec();
    const aimAng = Math.atan2(aim.y, aim.x);
    const tgt = this._findTarget(fromX, fromY, 260);
    if(!tgt) return aimAng;
    const ta = Math.atan2(tgt.y - fromY, tgt.x - fromX);
    let dAng = ta - aimAng;
    while(dAng > Math.PI) dAng -= Math.PI*2;
    while(dAng < -Math.PI) dAng += Math.PI*2;
    if(Math.abs(dAng) > Math.PI/3) return aimAng;
    return ta;
  },
  _setFacing(a){ player.facing = Math.cos(a) >= 0 ? 1 : -1; },

  gainSword(){
    if(this.swordCount() >= this.MAX_SWORDS) return false;
    const phase = Math.random() * Math.PI * 2;
    const s = role3SwordsAPI.addOrbit({ phase, r: 40, h: -36 });
    // 自适应间距：重排所有 orbit 剑均匀分布
    if(typeof _rebalanceOrbitPhases === 'function') _rebalanceOrbitPhases();
    if(typeof _addFxShape === 'function'){
      _addFxShape('crescent', player.x, player.y - 36, {
        r: 28, startAng: phase - Math.PI*0.3, sweep: Math.PI*0.6,
        thickness: 5, palette: 'white', life: 0.30
      });
    }
    if(typeof addParticle === 'function'){
      for(let k=0; k<4; k++){
        addParticle(player.x, player.y - 36, {n:1, c:'#AAEEFF',
          spd:100+Math.random()*40, r:1.5, life:0.3,
          spread:Math.PI*2, angle:Math.random()*Math.PI*2});
      }
    }
    return true;
  },

  consumeSwords(n){
    const orbits = role3Swords.filter(s => s.state === 'orbit' && !s._temp);
    const maxConsume = Math.max(0, orbits.length - 1);
    const actual = Math.min(n, maxConsume);
    for(let i=0; i<actual; i++){
      orbits[i].state = 'dead';
    }
    window.role3Swords = role3Swords.filter(s => s.state !== 'dead');
    return actual;
  },

  onSkillHit(which){
    if(which === 1) this.combo1T = 0.8;
    if(which === 2) this.combo2T = 0.6;
    if(which === 4) this.combo4T = 0.6;
    if(typeof role3Swords !== 'undefined'){
      for(const s of role3Swords){
        if(s.state === 'orbit') s.orbitPhase += 0.5;
      }
    }
  },
  _cd(base){ return this.combo1T > 0 ? base * 0.5 : base; },

  update(dt){
    // DEBUG 模式：强制所有 CD 归零
    if(typeof window !== 'undefined' && window.DEBUG_NO_CD){
      this.cdAtk1 = 0; this.cdAtk4 = 0;
      this.cdL = 0; this.cdU = 0; this.cdN = 0;
      this.cdM = 0; this.cdB = 0; this.cdV = 0; this.cdH = 0;
      this._cdUAuto = 0;
      // 补满飞剑到上限
      const maxS = this.MAX_SWORDS;
      const cur = this.swordCount();
      if(cur < maxS && typeof role3SwordsAPI !== 'undefined'){
        for(let _i = cur; _i < maxS; _i++){
          role3SwordsAPI.addOrbit({ phase: _i / maxS * Math.PI * 2, r: 40, h: -36 });
        }
        if(typeof _rebalanceOrbitPhases === 'function') _rebalanceOrbitPhases();
      }
    } else {
      if(this.cdAtk1 > 0) this.cdAtk1 -= dt;
      if(this.cdAtk4 > 0) this.cdAtk4 -= dt;
      if(this.cdL    > 0) this.cdL    -= dt;
      if(this.cdU    > 0) this.cdU    -= dt;
      if(this.cdN    > 0) this.cdN    -= dt;
      if(this.cdM    > 0) this.cdM    -= dt;
      if(this.cdB    > 0) this.cdB    -= dt;
      if(this.cdV    > 0) this.cdV    -= dt;
      if(this.cdH    > 0) this.cdH    -= dt;
    }
    if(this.sanctuaryT > 0){
      this.sanctuaryT -= dt;
      if(typeof addParticle === 'function' && Math.random() < 0.5){
        const a = Math.random() * Math.PI * 2;
        addParticle(player.x + Math.cos(a)*36, player.y - 28 + Math.sin(a)*14, {n:1,
          c: Math.random()<0.5 ? '#FFFFFF' : '#FFEEAA',
          spd: 30+Math.random()*30, r: 1.4, life: 0.45,
          spread: Math.PI*2, angle: a, gravity: -20});
      }
    }
    if(typeof role3Swords !== 'undefined'){
      for(const s of role3Swords){
        if(!s._vFormation) continue;
        s._vFormPhase = (s._vFormPhase || 0) + dt * 14;   //
        const r = s._vTightR || 22;
        s.x = player.x + Math.cos(s._vFormPhase) * r;
        s.y = player.y - 30 + Math.sin(s._vFormPhase) * 8;
        s.angle = s._vFormPhase + Math.PI / 2;
        if(Math.random() < 0.6 && typeof addParticle === 'function'){
          addParticle(s.x, s.y, {n:1,
            c: Math.random()<0.5 ? '#FFFFFF' : '#AAEEFF',
            spd: 30+Math.random()*30, r: 1.3, life: 0.30,
            spread: Math.PI*2, angle: Math.random()*Math.PI*2, gravity: -15});
        }
      }
    }
    if(this.orbitStormT > 0){
      this.orbitStormT -= dt;
      if(typeof role3Swords !== 'undefined'){
        const px = (typeof player !== 'undefined') ? player.x : 0;
        const py = (typeof player !== 'undefined') ? player.y : 0;
        for(const s of role3Swords){
          if(s.state === 'orbit' && !s._defHidden){
            if(s._stormBaseR === undefined) s._stormBaseR = s.orbitR || 40;
            const targetR = s._stormBaseR * 2.0;
            s.orbitR = targetR;
            s.orbitPhase += dt * 9;
            s.x = px + Math.cos(s.orbitPhase) * targetR;
            s.y = py + (s.orbitH || -36) + Math.sin(s.orbitPhase) * 10;
            s.angle = s.orbitPhase + Math.PI / 2;
            if(!s._stormHitTimer) s._stormHitTimer = 0;
            s._stormHitTimer -= dt;
            if(s._stormHitTimer <= 0){
              s._stormHitTimer = 0.08;
              _r3HitTryStorm(s.x, s.y, 28, 12);
            }
            if(!s._stormPT) s._stormPT = 0;
            s._stormPT -= dt;
            if(s._stormPT <= 0 && typeof addParticle === 'function'){
              s._stormPT = 0.05;
              addParticle(s.x, s.y, {n:1,
                c: Math.random()<0.5 ? '#FFFFFF' : '#AAEEFF',
                spd: 30+Math.random()*40, r: 1.5, life: 0.4,
                spread: Math.PI*2, angle: Math.random()*Math.PI*2,
                gravity: -10});
            }
          }
        }
      }
      if(this.orbitStormT <= 0){
        if(typeof role3Swords !== 'undefined'){
          for(const s of role3Swords){
            if(s.state === 'orbit' && !s._temp){
              s.orbitR = s._stormBaseR || 40;
              delete s._stormBaseR;
            }
            delete s._stormHitTimer;
            delete s._stormPT;
          }
        }
        if(typeof _addFxShape === 'function'){
          _addFxShape('crescent', player.x, player.y - 28, {
            r: 56, startAng: 0, sweep: Math.PI*2,
            thickness: 3, palette: 'white', life: 0.25, spinSpd: 0
          });
        }
        if(typeof addParticle === 'function'){
          for(let i=0; i<10; i++){
            const a = i / 10 * Math.PI*2;
            addParticle(player.x + Math.cos(a)*30, player.y - 28 + Math.sin(a)*12, {n:1,
              c: i%2?'#FFFFFF':'#AAEEFF',
              spd: 60+Math.random()*30, r: 1.3, life: 0.35,
              spread: 0.2, angle: a, gravity: 0});
          }
        }
      }
    }
    if(this.combo1T > 0) this.combo1T -= dt;
    if(this.combo2T > 0) this.combo2T -= dt;
    if(this.combo4T > 0) this.combo4T -= dt;
    if(this.jChainTimer > 0){
      this.jChainTimer -= dt;
      if(this.jChainTimer <= 0) this.jChainCount = 0;
    }
    if(this.chargingO > 0){
      this.chargingO += dt;
      if(!K['KeyO']) this._releaseO();
      if(typeof role3Swords !== 'undefined'){
        const orbits = role3Swords.filter(s => s.state === 'orbit');
        const tightR = Math.max(20, 40 - this.chargingO * 25);
        orbits.forEach(s => { s.orbitR = tightR; s.orbitPhase += dt * 6; });
      }
      if(!this._chargeParticleT) this._chargeParticleT = 0;
      this._chargeParticleT -= dt;
      if(this._chargeParticleT <= 0 && typeof addParticle === 'function'){
        this._chargeParticleT = 0.08;
        const aim = this._aimVec();
        addParticle(player.x, player.y - 22, {n:3, c:'#AAEEFF',
          spd: 60+Math.random()*40, r: 1.3, life: 0.3,
          spread: 0.5, angle: Math.atan2(aim.y, aim.x), gravity:-20});
      }
    }
    if(this.chargingL > 0){
      this.chargingL += dt;
      if(!K['KeyL']) this._releaseL();
      if(typeof role3Swords !== 'undefined'){
        const orbits = role3Swords.filter(s => s.state === 'orbit');
        const tightR = Math.max(18, 40 - this.chargingL * 28);
        orbits.forEach((s, i) => {
          s.orbitR = tightR;
          s.orbitPhase += dt * 8;
        });
      }
    }

    if(this._cdUAuto > 0) this._cdUAuto -= dt;
    if(this._cdUAuto <= 0 && this.swordCount() >= this.MAX_SWORDS &&
       !(typeof window !== 'undefined' && window.DEBUG_NO_CD)){
      this._cdUAuto = 30.0;
      this.cdU = 0;
      this.doUltimate();
    }
  },


  onJHit(){
    this._jHitCount++;
    if(this._jHitCount === 10){
      this._jHitCount = 0;
      this.cdV = 0; //
      this.chargingO = 0.001;
      player.state = 'attack';
      player.stateTimer = 9.0;
      player.attackDur = 9.0;
      comboIndex = 1;
      setTimeout(() => { if(this.chargingO > 0) this._releaseO(); }, 100);
    } else if(this._jHitCount === 5){
      this.cdV = 0;
      this.doSanctuary();
    }
  },

  onKHit(){
    this._kHitCount++;
    if(this._kHitCount >= 2){
      this._kHitCount = 0;
      this.cdB = 0;
      const triggered = this._tryBladeStepChain();
      if(triggered) this._bTrigCount++;
      if(this._bTrigCount >= 2){
        this._bTrigCount = 0;
        setTimeout(() => {
          this.cdL = 0;
          this.chargingL = 0.001;
          player.state = 'attack';
          player.stateTimer = 9.0;
          player.attackDur = 9.0;
          comboIndex = 2;
          setTimeout(() => { if(this.chargingL > 0) this._releaseL(); }, 100);
        }, 600); // B
      }
    }
  },

  _tryBladeStepChain(){
    if(this.isBusy()) return false;
    if(this.swordCount() < 2) return false;
    this.cdB = 0;
    this.doBladeStep();
    return true;
  },

  onIBlock(){
    this._iBlockCount++;
    if(this._iBlockCount >= 3){
      this._iBlockCount = 0;
      setTimeout(() => {
        this.cdM = 0;
        if(!this.isBusy()) this.doSwordOrbit();
        this._mTrigCount++;
        if(this._mTrigCount >= 3){
          this._mTrigCount = 0;
          setTimeout(() => {
            this.cdN = 0;
            if(!this.isBusy()) this.doSwordCall();
          }, 1600); // M
        }
      }, 350); //
    }
  },

  doAtk1(){
    if(this.cdAtk1 > 0 || this.isBusy()) return;
    if(this.swordCount() === 0){
      this._emptySlash();
      return;
    }
    const buffed = this.combo4T > 0;
    const dmg = buffed ? 33 : 22;
    const spd = buffed ? 720 : 520;
    this.cdAtk1 = this._cd(0.28);

    this.jAnimVariant = (this.jAnimVariant + 1) % 3;
    comboIndex = this.jAnimVariant;
    const dur = [0.28, 0.32, 0.30][this.jAnimVariant];
    player.state = 'attack';
    player.stateTimer = dur;
    player.attackDur = dur;

    this.jChainCount++;
    this.jChainTimer = 2.0;
    if(this.jChainCount >= 3){
      this.jChainCount = 0;
      if(this.gainSword()){
        if(typeof shockwaves !== 'undefined'){
          shockwaves.push({x: player.x, y: player.y - 36, r: 4, maxR: 56, life: 0.4, age: 0, c: '#FFFFFF'});
        }
        if(typeof camShake === 'function') camShake(0.10, 4);
      }
    }

    const sx = player.x, sy = player.y - 30;
    const angle = this._shootAngle(sx, sy);
    this._setFacing(angle);

    const orbits = role3SwordsAPI.getOrbits();
    const used = orbits[0];
    used.state = 'shoot';
    used.shootAngle = angle;
    used.shootSpd = spd;
    used.dmg = dmg;
    used.kx = Math.cos(angle) * 220 * (buffed ? 1.5 : 1);
    used.ky = Math.sin(angle) * 220 * (buffed ? 1.5 : 1);
    used.age = 0;
    used.life = 0.32;
    used._hitMap = {};
    used._hitTimer = 0;
    used._comboTag = 1;
    used.trail = [];
    used.returnTo = player;

    if(window.RelicManager && window.RelicManager._flags.split){
      const extraOrbits = role3SwordsAPI.getOrbits();
      if(extraOrbits.length > 0){
        const ex = extraOrbits[0];
        ex.state = 'shoot';
        ex.shootAngle = angle + (Math.random() > 0.5 ? 0.2 : -0.2);
        ex.shootSpd = spd;
        ex.dmg = Math.max(1, Math.floor(dmg * 0.6));
        ex.kx = Math.cos(ex.shootAngle) * 160;
        ex.ky = Math.sin(ex.shootAngle) * 160;
        ex.age = 0; ex.life = 0.32;
        ex._hitMap = {}; ex._hitTimer = 0;
        ex._comboTag = 1; ex.trail = [];
        ex.returnTo = player;
        ex._temp = true; //
      }
    }
    if(typeof _addFxShape === 'function'){
      const fxX = sx + Math.cos(angle) * 20;
      const fxY = sy + Math.sin(angle) * 20;
      _addFxShape('crescent', fxX, fxY, {
        r: buffed ? 28 : 20, startAng: angle - Math.PI*0.35,
        sweep: Math.PI*0.7, thickness: buffed ? 8 : 5,
        palette: 'white', life: 0.20
      });
    }
    if(typeof addParticle === 'function'){
      const fxX = sx + Math.cos(angle) * 18;
      const fxY = sy + Math.sin(angle) * 18;
      for(let i=0; i<8; i++){
        addParticle(fxX, fxY, {n:1, c: i%2?'#FFFFFF':'#AAEEFF',
          spd: 100+Math.random()*60, r: 1.5, life: 0.3,
          spread: 0.4, angle: angle, gravity: 30});
      }
    }
    if(typeof camShake === 'function') camShake(buffed ? 0.10 : 0.05, buffed ? 5 : 3);
  },

  _emptySlash(){
    this.cdAtk1 = this._cd(0.35);
    this.jAnimVariant = (this.jAnimVariant + 1) % 3;
    comboIndex = this.jAnimVariant;
    player.state = 'attack';
    player.stateTimer = 0.32;
    player.attackDur = 0.32;
    const dirX = player.facing;
    const fx = player.x + dirX * 28, fy = player.y - 18;
    if(typeof hitEnemiesInRange === 'function') hitEnemiesInRange(fx, fy, 30);
    if(typeof boss !== 'undefined' && boss && boss.state !== 'dead'){
      if(Math.hypot(boss.x - fx, boss.y - fy) < (BOSS_HIT_R || 30) + 30){
        if(typeof hitBoss === 'function') hitBoss(8, dirX * 80, 0);
      }
    }
    if(typeof _addFxShape === 'function'){
      _addFxShape('slashgash', fx, fy, {
        angle: -0.3 * dirX, len: 38, thickness: 5,
        palette: 'white', life: 0.22
      });
    }
    if(typeof camShake === 'function') camShake(0.04, 2);
  },

  startChargeO(){
    if(this.swordCount() === 0) return;
    if(this.chargingO > 0 || this.chargingL > 0) return;
    if(this.isBusy()) return;
    this.chargingO = 0.001;
    player.state = 'attack';
    player.stateTimer = 9.0;
    player.attackDur = 9.0;
    comboIndex = 1;
  },
  _releaseO(){
    const charge = Math.min(1.5, this.chargingO);
    this.chargingO = 0;
    const orbits = role3Swords.filter(s => s.state === 'orbit' && !s._temp);
    if(orbits.length === 0){
      player.state = 'idle';
      return;
    }
    const shotList = orbits.length > 1 ? orbits.slice(0, orbits.length - 1) : [];
    const n = shotList.length;
    if(n === 0){
      player.state = 'idle';
      return;
    }
    const baseDmg = 22 + Math.floor(charge * 30) + n * 6;
    const sx = player.x, sy = player.y - 26;
    const angle = this._shootAngle(sx, sy);
    this._setFacing(angle);

    const spread = Math.min(Math.PI * 0.45, n * 0.10);
    shotList.forEach((s, i) => {
      const t = (i - (n-1)/2) / Math.max(1, n-1);
      s.state = 'shoot';
      s.shootAngle = angle + t * spread;
      s.shootSpd = 600;
      s.dmg = baseDmg;
      s.kx = Math.cos(s.shootAngle) * 280;
      s.ky = Math.sin(s.shootAngle) * 280;
      s.age = 0;
      s.life = 1.0;
      s._hitMap = {};
      s._hitTimer = 0;
      s._comboTag = 2;
      s.trail = [];
      s._temp = true;
      s.returnTo = null;
    });
    console.log('[role3 O] consume', n, 'swords, remain:', this.swordCount());
    if(typeof _addFxShape === 'function'){
      const fxX = sx + Math.cos(angle)*24, fyY = sy + Math.sin(angle)*24;
      _addFxShape('spike', fxX, fyY, {
        count: 6 + Math.min(6, n), len: 30 + n*2, thickness: 4,
        color: 'rgba(220,240,255,1)', life: 0.30
      });
      const beamPerp = angle + Math.PI/2;
      for(let i=0; i<n; i++){
        const t = (i - (n-1)/2) / Math.max(1, n);
        const offX = Math.cos(beamPerp) * t * 14;
        const offY = Math.sin(beamPerp) * t * 14;
        _addFxShape('slashgash', fxX + offX + Math.cos(angle)*40, fyY + offY + Math.sin(angle)*40, {
          angle: angle, len: 60 + n*3, thickness: 3,
          palette: 'white', life: 0.28
        });
      }
    }
    if(typeof addParticle === 'function'){
      const fxX = sx + Math.cos(angle) * 24, fxY = sy + Math.sin(angle) * 24;
      for(let i=0; i<14; i++){
        addParticle(fxX, fxY, {n:1, c: i%2?'#FFFFFF':'#AAEEFF',
          spd: 130+Math.random()*100, r: 1.6, life: 0.4,
          spread: 0.5, angle: angle + (Math.random()-0.5)*0.4, gravity: 40});
      }
    }
    if(typeof camShake === 'function') camShake(0.20 + n*0.02, 8 + n);
    if(typeof triggerHitStop === 'function') triggerHitStop(0.08);
    player.state = 'attack';
    player.stateTimer = 0.35;
    player.attackDur = 0.35;
  },

  startChargeL(){
    if(this.cdL > 0) return;
    if(this.swordCount() === 0) return;
    if(this.chargingO > 0 || this.chargingL > 0) return;
    if(this.isBusy()) return;
    this.chargingL = 0.001;
    player.state = 'attack';
    player.stateTimer = 9.0;
    player.attackDur = 9.0;
    comboIndex = 8;  // atk10
  },
  _releaseL(){
    const charge = Math.min(1.5, this.chargingL);
    this.chargingL = 0;
    const orbits = role3SwordsAPI.getOrbits();
    if(orbits.length === 0){ player.state = 'idle'; return; }
    const useList = orbits.length > 1 ? orbits.slice(0, orbits.length - 1) : orbits.slice(0);
    const n = useList.length;
    const tgt = this._findTarget(player.x, player.y, 320);
    let tx, ty;
    if(tgt){ tx = tgt.x; ty = tgt.y + 16; }
    else { const aim = this._aimVec(); tx = player.x + aim.x*90; ty = player.y + aim.y*90; }
    this._setFacing(Math.atan2(ty - player.y, tx - player.x));

    const R = 95;
    const baseDmg = 18 + Math.floor(charge * 20) + n * 4;
    useList.forEach((s, i) => {
      const ang = i / n * Math.PI * 2;
      s.x = tx + Math.cos(ang) * R;
      s.y = ty + Math.sin(ang) * R;
      const inward = ang + Math.PI;
      s.state = 'shoot';
      s.shootAngle = inward;
      s.shootSpd = 580;
      s.dmg = baseDmg;
      s.kx = Math.cos(inward) * 150;
      s.ky = Math.sin(inward) * 150;
      s.age = 0;
      s.life = 0.4;
      s._hitMap = {};
      s._hitTimer = 0;
      s._comboTag = 1;
      s.trail = [];
      s.returnTo = player;
    });
    if(typeof _addFxShape === 'function'){
      _addFxShape('crescent', tx, ty, {
        r: R+5, startAng:0, sweep:Math.PI*1.95,
        thickness:5, palette:'white', life:0.4, spinSpd:8
      });
    }
    if(typeof shockwaves !== 'undefined'){
      shockwaves.push({x: tx, y: ty, r:3, maxR: 80, life:0.4, age:0, c:'#AAEEFF'});
    }

    if(typeof addParticle === 'function'){
      const ang = Math.atan2(ty - player.y, tx - player.x);
      for(let i=0; i<8; i++){
        addParticle(player.x, player.y - 22, {n:1, c: i%2?'#FFFFFF':'#AAEEFF',
          spd: 110+Math.random()*60, r: 1.4, life: 0.35,
          spread: 0.4, angle: ang, gravity: 30});
      }
      for(let i=0; i<10; i++){
        const a = i / 10 * Math.PI * 2;
        addParticle(tx + Math.cos(a)*60, ty + Math.sin(a)*20, {n:1, c:'#FFFFFF',
          spd: 50+Math.random()*30, r: 1.4, life: 0.5,
          spread: 0.2, angle: a + Math.PI, gravity: 20});
      }
    }

    const recoilAng = Math.atan2(player.y - ty, player.x - tx);
    const recoilSpd = 220 + n * 18;
    player.vx = Math.cos(recoilAng) * recoilSpd;
    player.vy = Math.sin(recoilAng) * recoilSpd;
    if(typeof addParticle === 'function'){
      for(let i=0; i<8; i++){
        addParticle(player.x, player.y - 18, {n:1, c:'#AAEEFF',
          spd: 80 + Math.random()*40, r: 1.5, life: 0.3,
          spread: 0.4, angle: -recoilAng + Math.PI, gravity: 30});
      }
    }

    setTimeout(() => {
      if(typeof _addFxShape === 'function'){
        _addFxShape('xslash', tx, ty, {
          len: 80 + n*3, thickness: 8 + n,
          color: 'rgba(220,240,255,1)', life: 0.45,
          palette: 'white'
        });
        _addFxShape('spike', tx, ty, {
          count: 8 + n, len: 50 + n*2, thickness: 6,
          color: 'rgba(180,220,255,1)', life: 0.45
        });
      }
      if(typeof shockwaves !== 'undefined'){
        shockwaves.push({x: tx, y: ty, r: 5, maxR: 130, life: 0.5, age: 0, c: '#FFFFFF'});
        shockwaves.push({x: tx, y: ty, r: 3, maxR: 80, life: 0.35, age: 0, c: '#AAEEFF'});
      }
      if(typeof boss !== 'undefined' && boss && boss.state !== 'dead'){
        if(Math.hypot(boss.x - tx, boss.y - ty) < 70){
          if(typeof hitBoss === 'function') hitBoss(40 + n*4, 0, 0);
        }
      }
      if(typeof hitEnemiesInRange === 'function') hitEnemiesInRange(tx, ty, 65);
      if(typeof camShake === 'function') camShake(0.35 + n*0.02, 12);
      if(typeof triggerHitStop === 'function') triggerHitStop(0.10);
    }, 350);
    player.state = 'attack';
    player.stateTimer = 0.45;
    player.attackDur = 0.45;
    this.cdL = 10.0;
  },

  doAtk4(){
    if(this.cdAtk4 > 0 || this.isBusy()) return;
    const have = this.swordCount();
    const buffed = this.combo2T > 0;
    this.cdAtk4 = this._cd(12.0);
    player.state = 'attack';
    player.stateTimer = 1.10;
    player.attackDur = 1.10;
    comboIndex = 3;  // atk4
    const tgt = this._findTarget(player.x, player.y, 320);
    let tx, ty;
    if(tgt){ tx = tgt.x; ty = tgt.y + 16; }
    else { const aim = this._aimVec(); tx = player.x + aim.x*80; ty = player.y + aim.y*80; }
    this._setFacing(Math.atan2(ty - player.y, tx - player.x));

    const N = Math.min(9, 4 + have + (buffed ? 2 : 0));
    const swordOrder = [];
    for(let i=0; i<N; i++){
      const t = N > 1 ? (i - (N-1)/2) / (N-1) : 0;
      const perpAng = Math.atan2(ty - player.y, tx - player.x) + Math.PI/2;
      const offset = t * 110;
      const ax = tx + Math.cos(perpAng) * offset;
      const ay = ty + Math.sin(perpAng) * offset * 0.3;
      const orderIdx = Math.abs(t * 2);
      swordOrder.push({ax, ay, delay: (1 - orderIdx) * 0.45});
    }
    swordOrder.forEach(o => {
      setTimeout(() => {
        role3SwordsAPI.drop(o.ax, o.ay, {
          hoverH: 130, hoverT: 0.30, dmg: 26
        });
      }, 220 + o.delay * 1000);
    });
    if(typeof _addFxShape === 'function'){
      _addFxShape('crescent', tx, ty - 80, {
        r: 50, startAng:0, sweep: Math.PI*1.9,
        thickness: 6, palette: 'white', life: 0.4, spinSpd: 5
      });
    }
    if(typeof addParticle === 'function'){
      for(let i=0; i<8; i++){
        addParticle(tx + (Math.random()-0.5)*60, ty - 100, {n:1, c:'#FFFFFF',
          spd: 30+Math.random()*30, r: 1.3, life: 0.55,
          spread: 0.3, angle: Math.PI/2, gravity: 100});
      }
    }
    if(typeof camShake === 'function') camShake(0.14, 5);
  },

  doUltimate(){
    if(this.cdU > 0 || this.isBusy()) return;
    this.cdU = 25.0;
    const n = this.swordCount();
    player.state = 'attack';
    player.stateTimer = 1.35;
    player.attackDur = 1.35;
    comboIndex = 6;  // atk8
    for(let i=0; i<12; i++){
      const s = role3SwordsAPI.addOrbit({ phase: i / 12 * Math.PI*2, r: 55, h: -42 });
      s._temp = true;
    }
    if(typeof triggerSlowMo === 'function') triggerSlowMo(0.5, 0.20);
    if(typeof _addFxShape === 'function'){
      _addFxShape('crescent', player.x, player.y - 36, {
        r: 60, startAng: 0, sweep: Math.PI*1.95,
        thickness: 8, palette: 'white', life: 1.0, spinSpd: 18
      });
    }
    if(typeof addParticle === 'function'){
      for(let i=0; i<24; i++){
        const a = i / 24 * Math.PI * 2;
        addParticle(player.x + Math.cos(a)*55, player.y - 28 + Math.sin(a)*20, {n:1,
          c: i%3===0?'#FFD060': i%2?'#FFFFFF':'#AAEEFF',
          spd: 60+Math.random()*40, r: 1.7, life: 0.6,
          spread: 0.2, angle: a, gravity: -10});
      }
    }
    if(typeof camShake === 'function') camShake(0.30, 12);
    setTimeout(() => {
      const orbits = role3Swords.filter(s => s.state === 'orbit' && s._temp);
      const targets = [];
      if(typeof boss !== 'undefined' && boss && boss.state !== 'dead'){
        targets.push({x: boss.x, y: boss.y - 24, weight: 3});
      }
      if(typeof enemies !== 'undefined'){
        for(const e of enemies){
          if(e && e.state !== 'dead') targets.push({x: e.x, y: e.y - 16, weight: 1});
        }
      }
      let totalW = 0;
      targets.forEach(t => totalW += t.weight);
      orbits.forEach((s, i) => {
        let tgtX, tgtY;
        if(targets.length > 0){
          let r = (i + 0.5) / orbits.length * totalW;
          let pick = targets[0];
          for(const t of targets){
            r -= t.weight;
            if(r <= 0){ pick = t; break; }
          }
          tgtX = pick.x + (Math.random()-0.5) * 20;
          tgtY = pick.y + (Math.random()-0.5) * 12;
        } else {
          const ang = i / orbits.length * Math.PI * 2;
          tgtX = player.x + Math.cos(ang) * 200;
          tgtY = player.y + Math.sin(ang) * 200;
        }
        const ang2 = Math.atan2(tgtY - s.y, tgtX - s.x);
        s.state = 'shoot';
        s.shootAngle = ang2;
        s.shootSpd = 760;
        s.dmg = 35;
        s.kx = Math.cos(ang2) * 280;
        s.ky = Math.sin(ang2) * 280;
        s.age = -i * 0.04;
        s.life = 0.9;
        s._hitMap = {};
        s._hitTimer = 0;
        s._comboTag = 4;
        s.trail = [];
        s._temp = true;
        s.returnTo = null;
      });
      if(typeof camShake === 'function') camShake(0.45, 14);
      if(typeof triggerHitStop === 'function') triggerHitStop(0.14);
    }, 1000);
  },

  doSwordOrbit(){
    if(this.cdM > 0 || this.isBusy()) return;
    if(this.swordCount() === 0) return;
    this.cdM = 12.0;
    this.orbitStormT = 1.5;
    player.state = 'attack';
    player.stateTimer = 0.50;
    player.attackDur = 0.50;
    comboIndex = 1;
    if(typeof _addFxShape === 'function'){
      _addFxShape('crescent', player.x, player.y - 28, {
        r: 64, startAng: 0, sweep: Math.PI*1.95,
        thickness: 4, palette: 'white', life: 0.45, spinSpd: 12
      });
      _addFxShape('crescent', player.x, player.y - 28, {
        r: 50, startAng: 0, sweep: Math.PI*1.95,
        thickness: 3, palette: 'white', life: 0.4, spinSpd: -16
      });
    }
    if(typeof shockwaves !== 'undefined'){
      shockwaves.push({x: player.x, y: player.y - 28, r: 4, maxR: 80, life: 0.4, age: 0, c: '#AAEEFF'});
    }
    if(typeof addParticle === 'function'){
      for(let i=0; i<14; i++){
        const a = i / 14 * Math.PI * 2;
        addParticle(player.x + Math.cos(a)*40, player.y - 28 + Math.sin(a)*15, {n:1,
          c: i%2?'#FFFFFF':'#AAEEFF',
          spd: 80+Math.random()*40, r: 1.5, life: 0.45,
          spread: 0.2, angle: a, gravity: 0});
      }
    }
    if(typeof camShake === 'function') camShake(0.12, 5);
  },

  doSwordCall(){
    if(this.cdN > 0 || this.isBusy()) return;
    this.cdN = 12.0;
    const n = this.swordCount();
    const cuts = 5 + n;
    const dmg = 32 + n * 6;

    player.state = 'attack';
    player.stateTimer = 0.60;
    player.attackDur = 0.60;
    comboIndex = 5;  // atk7
    const tgt = this._findTarget(player.x, player.y, 380);
    let tx, ty;
    if(tgt){ tx = tgt.x; ty = tgt.y + 16; }
    else {
      const aim = this._aimVec();
      tx = player.x + aim.x * 100;
      ty = player.y + aim.y * 100;
    }
    this._setFacing(Math.atan2(ty - player.y, tx - player.x));

    const homeX = player.x, homeY = player.y;

    if(typeof triggerSlowMo === 'function') triggerSlowMo(0.18, 0.55);

    if(typeof _addFxShape === 'function'){
      _addFxShape('crescent', player.x, player.y - 22, {
        r: 26, startAng: 0, sweep: Math.PI*1.95,
        thickness: 4, palette: 'white', life: 0.30, spinSpd: 16
      });
    }
    if(typeof addParticle === 'function'){
      for(let i=0; i<14; i++){
        const a = i / 14 * Math.PI * 2;
        addParticle(player.x, player.y - 22, {n:1,
          c: i%2?'#FFFFFF':'#AAEEFF',
          spd: 90+Math.random()*40, r: 1.5, life: 0.35,
          spread: 0.2, angle: a, gravity: 0});
      }
    }

    for(let i=0; i<cuts; i++){
      const delay = 80 + i * 55;
      setTimeout(() => {
        const ang = i / cuts * Math.PI * 2 + Math.random() * 0.3;
        const r = 36 + Math.random() * 12;
        const px = tx + Math.cos(ang) * r;
        const py = ty + Math.sin(ang) * r * 0.5;
        const slashAng = ang + Math.PI;

        if(typeof afterTrail !== 'undefined'){
          afterTrail.push({x: player.x, y: player.y, facing: player.facing,
                           age:0, life:0.20});
        }
        player.x = px;
        player.y = py;
        player.facing = Math.cos(slashAng) >= 0 ? 1 : -1;

        if(typeof _addFxShape === 'function'){
          _addFxShape('slashgash', tx, ty, {
            angle: slashAng, len: 70, thickness: 6,
            palette: 'white', life: 0.45
          });
        }
        if(typeof boss !== 'undefined' && boss && boss.state !== 'dead'){
          if(Math.hypot(boss.x - tx, boss.y - ty) < 50){
            if(typeof hitBoss === 'function') hitBoss(dmg, 0, 0);
          }
        }
        if(typeof hitEnemiesInRange === 'function'){
          hitEnemiesInRange(tx, ty, 50);
        }
        if(typeof addParticle === 'function'){
          for(let k=0; k<5; k++){
            addParticle(tx, ty, {n:1, c: k%2?'#FFFFFF':'#AAEEFF',
              spd: 140+Math.random()*60, r: 1.4, life: 0.3,
              spread: 0.5, angle: Math.random()*Math.PI*2, gravity: 30});
          }
        }
        if(typeof camShake === 'function') camShake(0.06, 3);
      }, delay);
    }

    const totalT = 80 + cuts * 55 + 100;
    setTimeout(() => {
      if(typeof afterTrail !== 'undefined'){
        afterTrail.push({x: player.x, y: player.y, facing: player.facing,
                         age:0, life:0.30});
      }
      player.x = homeX;
      player.y = homeY;
      if(typeof _addFxShape === 'function'){
        _addFxShape('crescent', tx, ty, {
          r: 60, startAng: 0, sweep: Math.PI*1.95,
          thickness: 6, palette: 'white', life: 0.5, spinSpd: 18
        });
      }
      if(typeof shockwaves !== 'undefined'){
        shockwaves.push({x: tx, y: ty, r: 4, maxR: 130, life: 0.5, age: 0, c: '#FFFFFF'});
        shockwaves.push({x: tx, y: ty, r: 2, maxR: 80, life: 0.4, age: 0, c: '#AAEEFF'});
      }
      if(typeof addParticle === 'function'){
        for(let k=0; k<18; k++){
          const a = k / 18 * Math.PI * 2;
          addParticle(tx, ty, {n:1, c: k%2?'#FFFFFF':'#AAEEFF',
            spd: 200+Math.random()*80, r: 1.8, life: 0.5,
            spread: 0.1, angle: a, gravity: 50});
        }
      }
      if(typeof camShake === 'function') camShake(0.4, 14);
      if(typeof triggerHitStop === 'function') triggerHitStop(0.14);
    }, totalT);
  },

  onDashConsume(){
    const orbits = role3Swords.filter(s => s.state === 'orbit' && !s._temp);
    if(orbits.length <= 1) return false;
    const victim = orbits[orbits.length - 1];
    victim.state = 'dead';
    window.role3Swords = role3Swords.filter(s => s.state !== 'dead');
    console.log('[role3 K] consume sword, remain:', this.swordCount());
    return true;
  },
  onDashHit(){
    if(Math.random() < 0.5){
      this.gainSword();
      if(typeof _addFxShape === 'function'){
        _addFxShape('crescent', player.x, player.y - 36, {
          r: 26, startAng:0, sweep: Math.PI*1.95,
          thickness:3, palette:'white', life:0.3, spinSpd:15
        });
      }
    }
  },

  doBladeStep(){
    if(this.cdB > 0 || this.isBusy()) return;
    if(this.swordCount() < 2) return;
    this.cdB = 8.0;

    const bossTgt = (typeof boss !== 'undefined' && boss && boss.state !== 'dead') ? boss : null;
    let eTgt = null;
    if(!bossTgt && typeof enemies !== 'undefined'){
      let bestD = 400;
      for(const en of enemies){
        if(en.state === 'dead') continue;
        const d = Math.hypot(en.x - player.x, en.y - player.y);
        if(d < bestD){ bestD = d; eTgt = en; }
      }
    }
    const target = bossTgt || eTgt;

    if(!target){
      player.state = 'attack';
      player.stateTimer = 0.85;
      player.attackDur = 0.85;
      comboIndex = 4;  // atk6
      const baseAng = player.facing >= 0 ? 0 : Math.PI;
      const orbits0 = role3SwordsAPI.getOrbits().slice();
      const spread0 = Math.PI * 0.55;
      orbits0.forEach((s, i) => {
        const t = orbits0.length > 1 ? (i - (orbits0.length-1)/2) / (orbits0.length-1) : 0;
        const sa = baseAng + t * spread0;
        s.state = 'shoot';
        s.shootAngle = sa;
        s.shootSpd = 600;
        s.dmg = 20;
        s.kx = Math.cos(sa) * 220;
        s.ky = Math.sin(sa) * 220;
        s.age = 0; s.life = 0.35;
        s._hitMap = {}; s._hitTimer = 0; s.trail = [];
        s.returnTo = player;
      });
      if(typeof camShake === 'function') camShake(0.12, 5);
      return;
    }

    const dx = target.x - player.x, dy = target.y - player.y;
    const dist = Math.hypot(dx, dy) || 1;
    const dirX = dx / dist, dirY = dy / dist;
    const tx = target.x + dirX * 50;
    const ty = target.y;
    const fromX = player.x, fromY = player.y;

    if(typeof afterTrail !== 'undefined'){
      afterTrail.push({x: fromX, y: fromY, facing: player.facing, age:0, life:0.35});
      afterTrail.push({x: (fromX+tx)/2, y: (fromY+ty)/2, facing: player.facing, age:0, life:0.30});
    }
    if(typeof _addFxShape === 'function'){
      _addFxShape('speedline', (fromX+tx)/2, (fromY+ty)/2, {
        angle: Math.atan2(ty-fromY, tx-fromX), len: dist,
        thickness: 6, palette: 'white', life: 0.25
      });
    }
    if(typeof addParticle === 'function'){
      for(let i=0;i<14;i++){
        const t = i / 14;
        addParticle(fromX + (tx-fromX)*t, fromY + (ty-fromY)*t - 18, {n:1,
          c: i%2?'#FFFFFF':'#AAEEFF', spd: 60+Math.random()*40, r: 1.5, life: 0.35,
          spread: Math.PI*2, angle: Math.random()*Math.PI*2, gravity: -10});
      }
    }

    player.x = tx;
    player.y = ty;
    player.facing = dirX >= 0 ? -1 : 1;     //
    player.state = 'attack';
    player.stateTimer = 0.85;
    player.attackDur = 0.85;
    comboIndex = 4;  // atk6

    const orbits = role3SwordsAPI.getOrbits().slice();
    const stabAng = Math.atan2(target.y - ty, target.x - tx);
    orbits.forEach((s, i) => {
      const offset = (i - (orbits.length-1)/2) * 14;
      const px = -Math.sin(stabAng) * offset;
      const py =  Math.cos(stabAng) * offset;
      s.x = player.x + px;
      s.y = player.y - 30 + py;
      s.state = 'shoot';
      s.shootAngle = stabAng;
      s.shootSpd = 600;
      s.dmg = 18;
      s.kx = Math.cos(stabAng) * 260;
      s.ky = Math.sin(stabAng) * 260;
      s.age = 0;
      s.life = 0.28;
      s._hitMap = {};
      s._hitTimer = 0;
      s.trail = [];
      s.returnTo = player;
    });

    if(typeof _addFxShape === 'function'){
      _addFxShape('xslash', target.x, target.y - 30, {
        len: 80, thickness: 8, palette:'white', life: 0.3, spinSpd: 6
      });
      _addFxShape('crescent', target.x, target.y - 30, {
        r: 50, startAng: stabAng - Math.PI*0.4, sweep: Math.PI*0.8,
        thickness: 6, palette: 'white', life: 0.3
      });
    }
    if(typeof shockwaves !== 'undefined'){
      shockwaves.push({x: target.x, y: target.y - 30, r:4, maxR:90, life:0.4, age:0, c:'#FFFFFF'});
    }
    if(typeof addParticle === 'function'){
      for(let i=0;i<16;i++){
        const a = i / 16 * Math.PI * 2;
        addParticle(target.x, target.y - 30, {n:1,
          c: i%2?'#FFFFFF':'#AAEEFF', spd: 160+Math.random()*60, r: 1.6, life: 0.4,
          spread: 0.15, angle: a, gravity: 30});
      }
    }
    if(typeof hitBoss === 'function'){
      hitBoss(28, dirX * 60, -20);
    }
    if(typeof camShake === 'function') camShake(0.18, 7);
    if(typeof triggerHitStop === 'function') triggerHitStop(0.06);
  },

  doThrust(){
    if((this.cdH||0) > 0 || this.isBusy()) return;
    if(this.swordCount() === 0){ this._emptySlash(); return; }
    this.cdH = this._cd(6.0);

    player.state = 'attack';
    player.stateTimer = 0.38;
    player.attackDur  = 0.38;
    comboIndex = 8;  // atk10

    const sx = player.x, sy = player.y - 28;
    const angle = this._shootAngle(sx, sy);
    this._setFacing(angle);

    const orbits = role3SwordsAPI.getOrbits();
    if(orbits.length === 0) return;
    const s = orbits[0];

    s.x = sx;
    s.y = sy;
    s.state      = 'shoot';
    s.shootAngle = angle;
    s.shootSpd   = 1200;    //
    s.dmg        = 40;
    s.kx         = Math.cos(angle) * 320;
    s.ky         = Math.sin(angle) * 320;
    s.age        = 0;
    s.life       = 0.55;    //
    s._pierce    = true;    //
    s._hitMap    = {};
    s._hitTimer  = 0;
    s.trail      = [];
    s.returnTo   = player;
    s._comboTag  = 3;

    if(typeof _addFxShape === 'function'){
      _addFxShape('spike', sx + Math.cos(angle)*20, sy + Math.sin(angle)*20, {
        count: 8, len: 45, thickness: 5,
        color: 'rgba(220,240,255,1)', life: 0.28
      });
      _addFxShape('slashgash', sx + Math.cos(angle)*40, sy + Math.sin(angle)*40, {
        angle: angle, len: 60, thickness: 6, palette: 'white', life: 0.25
      });
    }
    if(typeof addParticle === 'function'){
      for(let i=0;i<10;i++){
        addParticle(sx + Math.cos(angle)*i*8, sy + Math.sin(angle)*i*8, {
          n:1, c: i%2?'#FFFFFF':'#AAEEFF',
          spd: 40+Math.random()*30, r: 1.4, life: 0.30,
          spread: 0.25, angle: angle + Math.PI, gravity: -15
        });
      }
    }
    if(typeof camShake === 'function') camShake(0.08, 3);
  },

  doSanctuary(){
    if(this.cdV > 0 || this.isBusy()) return;
    if(this.swordCount() === 0) return;
    this.cdV = 15.0;

    const target = (typeof boss !== 'undefined' && boss && boss.state !== 'dead') ? boss : null;

    player.state = 'attack';
    player.stateTimer = 1.25;
    player.attackDur = 1.25;
    comboIndex = 7;  // atk9
    if(target) player.facing = target.x > player.x ? 1 : -1;

    const orbits = role3SwordsAPI.getOrbits().slice();
    const N = orbits.length;
    if(N === 0) return;

    const tightR = 22;
    orbits.forEach((s, i) => {
      s._vFormation = true;
      s._vFormPhase = i / N * Math.PI * 2;
      s._vFormStart = performance.now() / 1000;
      s._vTightR = tightR;
    });

    if(typeof _addFxShape === 'function'){
      _addFxShape('crescent', player.x, player.y - 28, {
        r: 50, startAng: 0, sweep: Math.PI*2,
        thickness: 4, palette: 'white', life: 0.45, spinSpd: 8
      });
      _addFxShape('crescent', player.x, player.y - 28, {
        r: 36, startAng: 0, sweep: Math.PI*2,
        thickness: 3, palette: 'white', life: 0.45, spinSpd: -10
      });
    }
    if(typeof shockwaves !== 'undefined'){
      shockwaves.push({x: player.x, y: player.y - 28, r:4, maxR:80, life:0.45, age:0, c:'#FFFFFF'});
    }
    if(typeof addParticle === 'function'){
      for(let i=0; i<18; i++){
        const a = i / 18 * Math.PI*2;
        addParticle(player.x + Math.cos(a)*40, player.y - 28 + Math.sin(a)*16, {n:1,
          c: i%2 ? '#FFFFFF' : '#AAEEFF',
          spd: 90+Math.random()*40, r: 1.6, life: 0.5,
          spread: 0.15, angle: a + Math.PI, gravity: 0});
      }
    }
    if(typeof camShake === 'function') camShake(0.10, 4);

    const _shootSword = (s, idx) => {
      if(!s || s.state !== 'orbit') return;
      let aimX, aimY;
      if(target && target.state !== 'dead'){
        aimX = target.x;
        aimY = target.y - 30;
      } else {
        aimX = player.x + player.facing * 200;
        aimY = player.y - 30;
      }
      const ang = Math.atan2(aimY - (player.y - 30), aimX - player.x);
      s.x = player.x + Math.cos(s._vFormPhase || 0) * 22;
      s.y = player.y - 30 + Math.sin(s._vFormPhase || 0) * 8;
      delete s._vFormation;
      delete s._vFormPhase;
      delete s._vFormStart;
      delete s._vTightR;
      s.state = 'shoot';
      s.shootAngle = ang;
      s.shootSpd = 720;
      s.dmg = 26;
      s.kx = Math.cos(ang) * 240;
      s.ky = Math.sin(ang) * 240;
      s.age = 0;
      s.life = 0.40;
      s._hitMap = {};
      s._hitTimer = 0;
      s.trail = [];
      s.returnTo = player;

      if(typeof _addFxShape === 'function'){
        _addFxShape('crescent', s.x + Math.cos(ang)*16, s.y + Math.sin(ang)*16, {
          r: 20, startAng: ang - Math.PI*0.3, sweep: Math.PI*0.6,
          thickness: 4, palette: 'white', life: 0.18
        });
      }
      if(typeof addParticle === 'function'){
        for(let k=0; k<5; k++){
          addParticle(s.x, s.y, {n:1,
            c: k%2 ? '#FFFFFF' : '#AAEEFF',
            spd: 120+Math.random()*60, r: 1.4, life: 0.30,
            spread: 0.3, angle: ang, gravity: 20});
        }
      }
      if(typeof camShake === 'function') camShake(0.04, 2);
    };

    const FORMATION_T = 450;   // ms
    const INTERVAL = 80;       // ms /
    orbits.forEach((s, i) => {
      setTimeout(() => _shootSword(s, i), FORMATION_T + i * INTERVAL);
    });
    setTimeout(() => {
      if(typeof _addFxShape === 'function'){
        _addFxShape('crescent', player.x, player.y - 28, {
          r: 56, startAng: 0, sweep: Math.PI*2,
          thickness: 3, palette: 'white', life: 0.30, spinSpd: 0
        });
      }
      if(typeof shockwaves !== 'undefined'){
        shockwaves.push({x: player.x, y: player.y - 28, r:4, maxR:90, life:0.4, age:0, c:'#FFFFFF'});
      }
      if(typeof camShake === 'function') camShake(0.14, 6);
    }, FORMATION_T + N * INTERVAL + 80);
  },

  trySanctuaryReflect(dmg, kx, ky){
    return false;
  }
};

window.addEventListener('keydown', e => {
  if((window.currentChar !== 3 && window.currentChar !== 5) || !window.role3) return;
  if(e.code === 'KeyO'){
    if(window.role3.chargingO === 0) window.role3.startChargeO();
  }
  if(e.code === 'KeyL'){
    if(window.role3.chargingL === 0) window.role3.startChargeL();
  }
});
