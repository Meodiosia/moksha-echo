//

(function(root){
  'use strict';

  function clamp(v, lo, hi){ return v < lo ? lo : (v > hi ? hi : v); }
  function emit(name, data){
    try{ if(root.Events) root.Events.emit(name, data); }catch(e){}
  }

  //   ctx.player       window.player
  //   ctx.role3        window.role3
  //   ctx.boss         window.boss

  var RELIC_DB = {


    magnetic_core: {
      id: 'magnetic_core',
      name: '磁核',
      icon: '🧲',
      desc: '飞剑自动追踪最近目标',
      rarity: 'common',
      slots: 1,
      onEquip: function(ctx){
        ctx.manager._flags.tracking = (ctx.manager._flags.tracking || 0) + 1;
      },
      onUnequip: function(ctx){
        ctx.manager._flags.tracking = Math.max(0, (ctx.manager._flags.tracking || 1) - 1);
      }
    },

    piercing_talisman: {
      id: 'piercing_talisman',
      name: '穿刺符',
      icon: '🔱',
      desc: '飞剑穿透命中，不消失',
      rarity: 'common',
      slots: 1,
      onEquip: function(ctx){
        ctx.manager._flags.piercing = (ctx.manager._flags.piercing || 0) + 1;
      },
      onUnequip: function(ctx){
        ctx.manager._flags.piercing = Math.max(0, (ctx.manager._flags.piercing || 1) - 1);
      }
    },

    mirror_stone: {
      id: 'mirror_stone',
      name: '镜石',
      icon: '💎',
      desc: '飞剑命中后弹射至附近敌人',
      rarity: 'common',
      slots: 1,
      onEquip: function(ctx){
        ctx.manager._flags.bounce = (ctx.manager._flags.bounce || 0) + 1;
      },
      onUnequip: function(ctx){
        ctx.manager._flags.bounce = Math.max(0, (ctx.manager._flags.bounce || 1) - 1);
      }
    },

    returning_blade: {
      id: 'returning_blade',
      name: '回旋刃',
      icon: '🌀',
      desc: '飞剑回归后往身后再次射出',
      rarity: 'common',
      slots: 1,
      onEquip: function(ctx){
        ctx.manager._flags.returning = (ctx.manager._flags.returning || 0) + 1;
      },
      onUnequip: function(ctx){
        ctx.manager._flags.returning = Math.max(0, (ctx.manager._flags.returning || 1) - 1);
      }
    },

    split_mirror: {
      id: 'split_mirror',
      name: '裂镜',
      icon: '🪞',
      desc: '飞剑命中时分裂为两枚',
      rarity: 'rare',
      slots: 1,
      onEquip: function(ctx){
        ctx.manager._flags.split = (ctx.manager._flags.split || 0) + 1;
      },
      onUnequip: function(ctx){
        ctx.manager._flags.split = Math.max(0, (ctx.manager._flags.split || 1) - 1);
      }
    },

    swift_sword: {
      id: 'swift_sword',
      name: '疾风剑',
      icon: '⚡',
      desc: '飞剑速度 ×1.4',
      rarity: 'common',
      slots: 1,
      onEquip: function(ctx){
        ctx.manager._flags.speedMul = (ctx.manager._flags.speedMul || 1.0) * 1.4;
      },
      onUnequip: function(ctx){
        ctx.manager._flags.speedMul = (ctx.manager._flags.speedMul || 1.4) / 1.4;
      }
    },

    spirit_shield: {
      id: 'spirit_shield',
      name: '灵盾',
      icon: '🛡',
      desc: '完美弹反窗口 +0.25s',
      rarity: 'common',
      slots: 1,
      onEquip: function(ctx){
        if(root.DEF_PARRY_WINDOW !== undefined) root.DEF_PARRY_WINDOW += 0.25;
        ctx.manager._flags.parryBonus = (ctx.manager._flags.parryBonus || 0) + 0.25;
      },
      onUnequip: function(ctx){
        if(root.DEF_PARRY_WINDOW !== undefined) root.DEF_PARRY_WINDOW -= 0.25;
        ctx.manager._flags.parryBonus = Math.max(0, (ctx.manager._flags.parryBonus || 0.25) - 0.25);
      }
    },

    void_step: {
      id: 'void_step',
      name: '虚空步',
      icon: '💨',
      desc: '冲刺距离+50%，CD -0.5s',
      rarity: 'common',
      slots: 1,
      onEquip: function(ctx){
        if(root.player) root.player.dashDur = (root.player.dashDur || 0.18) + 0.1;
        ctx.manager._flags.dashDurBonus = (ctx.manager._flags.dashDurBonus || 0) + 0.1;
        ctx.manager._flags.dashCDReduce = (ctx.manager._flags.dashCDReduce || 0) + 0.5;
      },
      onUnequip: function(ctx){
        if(root.player) root.player.dashDur = Math.max(0.1, (root.player.dashDur || 0.28) - 0.1);
        ctx.manager._flags.dashDurBonus = Math.max(0, (ctx.manager._flags.dashDurBonus || 0.1) - 0.1);
        ctx.manager._flags.dashCDReduce = Math.max(0, (ctx.manager._flags.dashCDReduce || 0.5) - 0.5);
      }
    },

    foundation_pill: {
      id: 'foundation_pill',
      name: '筑基丹',
      icon: '💊',
      desc: 'HP上限 +25%，立即回复',
      rarity: 'common',
      slots: 1,
      onEquip: function(ctx){
        var bonus = Math.floor((root.playerMaxHp || 10000) * 0.25);
        if(root.playerMaxHp !== undefined) root.playerMaxHp += bonus;
        if(root.playerHp !== undefined) root.playerHp = Math.min(root.playerHp + bonus, root.playerMaxHp);
        ctx.relic._hpBonus = bonus;
      },
      onUnequip: function(ctx){
        var bonus = ctx.relic._hpBonus || 0;
        if(root.playerMaxHp !== undefined) root.playerMaxHp = Math.max(1000, root.playerMaxHp - bonus);
        if(root.playerHp !== undefined) root.playerHp = Math.min(root.playerHp, root.playerMaxHp);
        ctx.relic._hpBonus = 0;
      }
    },

    sword_heart: {
      id: 'sword_heart',
      name: '剑心',
      icon: '⚔️',
      desc: '飞剑上限 +2',
      rarity: 'rare',
      slots: 1,
      onEquip: function(ctx){
        if(root.role3) root.role3.MAX_SWORDS += 2;
      },
      onUnequip: function(ctx){
        if(root.role3) root.role3.MAX_SWORDS = Math.max(2, root.role3.MAX_SWORDS - 2);
      }
    },

    lightning_seal: {
      id: 'lightning_seal',
      name: '雷印',
      icon: '⚡',
      desc: '每次命中0.8s内追加15点闪电伤害',
      rarity: 'rare',
      slots: 1,
      _lastT: 0,
      onEquip: function(ctx){ ctx.relic._lastT = 0; },
      onHit: function(ctx){
        var now = performance.now() / 1000;
        if(now - ctx.relic._lastT < 0.8) return;
        ctx.relic._lastT = now;
        var b = root.boss;
        if(!b || b.state === 'dead') return;
        if(typeof root.hitBoss === 'function') root.hitBoss(15, 0, 0);
        if(typeof root._addFxShape === 'function'){
          root._addFxShape('spike', b.x, b.y - 40, {
            count:6, len:30, thickness:3, color:'#AAEEFF', life:0.25
          });
        }
        if(typeof root.addParticle === 'function'){
          for(var i=0;i<6;i++){
            root.addParticle(b.x, b.y-40, {n:1, c:'#FFFFFF',
              spd:80+Math.random()*40, r:1.5, life:0.3,
              spread:Math.PI*2, angle:Math.random()*Math.PI*2});
          }
        }
        ctx.manager._stats.relicHits++;
      }
    },

  }; // end RELIC_DB

  var COMBO_DB = {

    returning_tracker: {
      id: 'returning_tracker',
      name: '追迹回旋',
      desc: '磁核+回旋刃：飞剑追踪+回旋+穿透',
      requires: ['magnetic_core', 'returning_blade'],
      icon: '🌀🧲',
      color: '#AAEEFF',
      onActivate: function(mgr){
        mgr._flags.combo_returning_tracker = true;
        mgr._flags.tracking = (mgr._flags.tracking || 0) + 1;
        mgr._flags.returning = (mgr._flags.returning || 0) + 1;
        mgr._flags.piercing = (mgr._flags.piercing || 0) + 1; //
      },
      onDeactivate: function(mgr){
        mgr._flags.combo_returning_tracker = false;
        mgr._flags.tracking = Math.max(0, (mgr._flags.tracking||1)-1);
        mgr._flags.returning = Math.max(0, (mgr._flags.returning||1)-1);
        mgr._flags.piercing = Math.max(0, (mgr._flags.piercing||1)-1);
      }
    },

    phantom_sword: {
      id: 'phantom_sword',
      name: '幻影剑阵',
      desc: '穿刺符+镜石：超级穿透+连续弹射',
      requires: ['piercing_talisman', 'mirror_stone'],
      icon: '',
      color: '#FFEEBB',
      onActivate: function(mgr){
        mgr._flags.combo_phantom = true;
        mgr._flags.piercing = (mgr._flags.piercing || 0) + 2;
        // 弹射次数固定为2（不叠加，镜石已给了1次）
        mgr._flags.bounce = 2;
        mgr._flags.bounceLife = 0.6; // 弹射后飞0.6秒，快速回来
      },
      onDeactivate: function(mgr){
        mgr._flags.combo_phantom = false;
        mgr._flags.piercing = Math.max(0, (mgr._flags.piercing||2)-2);
        mgr._flags.bounce = Math.max(0, (mgr._flags.bounce||2)-1); // 保留镜石的1次
        mgr._flags.bounceLife = 0;
      }
    },

    ten_thousand_swords: {
      id: 'ten_thousand_swords',
      name: '万剑归宗',
      desc: '裂镜+剑心：飞剑+6枚，自动攻击',
      requires: ['split_mirror', 'sword_heart'],
      icon: '⚔️🪞',
      color: '#FFD0A0',
      _autoT: 0,
      onActivate: function(mgr){
        mgr._flags.combo_tenk = true;
        if(root.role3) root.role3.MAX_SWORDS += 6; //
        mgr._flags.autoShootInterval = 0.8;
        mgr._flags.autoShootT = 0;
      },
      onDeactivate: function(mgr){
        mgr._flags.combo_tenk = false;
        if(root.role3) root.role3.MAX_SWORDS = Math.max(2, root.role3.MAX_SWORDS - 6);
        mgr._flags.autoShootInterval = 0;
      },
      onUpdate: function(mgr, dt){
        if(!mgr._flags.combo_tenk) return;
        mgr._flags.autoShootT = (mgr._flags.autoShootT || 0) - dt;
        if(mgr._flags.autoShootT > 0) return;
        mgr._flags.autoShootT = mgr._flags.autoShootInterval;
        if(typeof root.role3SwordsAPI === 'undefined') return;
        var orbits = root.role3SwordsAPI.getOrbits();
        if(orbits.length === 0) return;
        var s = orbits[Math.floor(Math.random()*orbits.length)];
        var b = root.boss;
        if(!b || b.state === 'dead') return;
        s.state = 'shoot';
        s.shootAngle = Math.atan2(b.y - s.y, b.x - s.x);
        s.shootSpd = 420;
        s.dmg = 10;
        s.age = 0; s.life = 1.2;
        s.trail = []; s._hitMap = {}; s._hitTimer = 0;
        s.returnTo = root.player;
      }
    }

  }; // end COMBO_DB

  var MAX_SLOTS = 6;

  var RelicManager = {
    _inventory: [],       // [{relic: RELIC_DB[id], slot: 0..5}]
    _activeCombos: [],    // [comboId, ...]
    _flags: {},           //
    _stats: {             //
      relicHits: 0,
      blocksTriggered: 0,
      combosTrigered: 0,
      dashHits: 0
    },

    _ctx: function(relicObj){
      return {
        relic:   relicObj,
        manager: RelicManager,
        player:  root.player,
        role3:   root.role3,
        boss:    root.boss
      };
    },

    equip: function(id){
      var relic = RELIC_DB[id];
      if(!relic){
        console.warn('[Relic] unknown id:', id);
        return false;
      }
      if(this._inventory.length >= MAX_SLOTS){
        console.warn('[Relic] inventory full');
        return false;
      }
      var slot = this._inventory.length;
      this._inventory.push({ relic: relic, slot: slot });

      // onEquip
      var ctx = this._ctx(relic);
      if(typeof relic.onEquip === 'function'){
        try{ relic.onEquip(ctx); }catch(e){ console.error('[Relic] onEquip error', id, e); }
      }

      this._checkCombos();
      emit('relic:equipped', { id: id, relic: relic });
      return true;
    },

    remove: function(id){
      var idx = -1;
      for(var i=0; i<this._inventory.length; i++){
        if(this._inventory[i].relic.id === id){ idx = i; break; }
      }
      if(idx < 0) return false;

      var entry = this._inventory.splice(idx, 1)[0];
      var ctx = this._ctx(entry.relic);
      if(typeof entry.relic.onUnequip === 'function'){
        try{ entry.relic.onUnequip(ctx); }catch(e){ console.error('[Relic] onUnequip error', id, e); }
      }

      this._checkCombos();
      emit('relic:removed', { id: id });
      return true;
    },

    has: function(id){
      return this._inventory.some(function(e){ return e.relic.id === id; });
    },

    count: function(id){
      return this._inventory.filter(function(e){ return e.relic.id === id; }).length;
    },

    getInventory: function(){
      return this._inventory.slice();
    },

    getActiveCombos: function(){
      return this._activeCombos.slice();
    },

    getStats: function(){
      return Object.assign({}, this._stats);
    },

    _checkCombos: function(){
      var self = this;
      var newActive = [];

      for(var cid in COMBO_DB){
        var combo = COMBO_DB[cid];
        var satisfied = combo.requires.every(function(rid){
          return self.has(rid);
        });
        if(satisfied) newActive.push(cid);
      }

      var self2 = this;
      newActive.forEach(function(cid){
        if(self2._activeCombos.indexOf(cid) < 0){
          self2._activeCombos.push(cid);
          var combo = COMBO_DB[cid];
          if(typeof combo.onActivate === 'function'){
            try{ combo.onActivate(self2); }catch(e){ console.error('[Combo] onActivate error', cid, e); }
          }
          self2._stats.combosTrigered++;
          emit('combo:activated', { id: cid, combo: combo });
          console.log('[RelicSystem] combo activated: ' + cid);
        }
      });

      this._activeCombos = this._activeCombos.filter(function(cid){
        if(newActive.indexOf(cid) < 0){
          var combo = COMBO_DB[cid];
          if(typeof combo.onDeactivate === 'function'){
            try{ combo.onDeactivate(self2); }catch(e){}
          }
          emit('combo:deactivated', { id: cid });
          return false;
        }
        return true;
      });
    },

    triggerHit: function(dmg){
      var ctx;
      this._inventory.forEach(function(e){
        if(typeof e.relic.onHit === 'function'){
          ctx = RelicManager._ctx(e.relic);
          ctx.dmg = dmg;
          try{ e.relic.onHit(ctx); }catch(err){ console.error('[Relic] onHit', e.relic.id, err); }
        }
      });
    },

    triggerBlock: function(isPerfect){
      this._stats.blocksTriggered++;
      var ctx;
      this._inventory.forEach(function(e){
        if(typeof e.relic.onBlock === 'function'){
          ctx = RelicManager._ctx(e.relic);
          ctx.isPerfect = isPerfect;
          try{ e.relic.onBlock(ctx); }catch(err){ console.error('[Relic] onBlock', e.relic.id, err); }
        }
      });
    },

    triggerDash: function(hit){
      if(hit) this._stats.dashHits++;
      var ctx;
      this._inventory.forEach(function(e){
        if(typeof e.relic.onDash === 'function'){
          ctx = RelicManager._ctx(e.relic);
          ctx.hit = hit;
          try{ e.relic.onDash(ctx); }catch(err){ console.error('[Relic] onDash', e.relic.id, err); }
        }
      });
    },

    triggerKill: function(){
      var ctx;
      this._inventory.forEach(function(e){
        if(typeof e.relic.onKill === 'function'){
          ctx = RelicManager._ctx(e.relic);
          try{ e.relic.onKill(ctx); }catch(err){ console.error('[Relic] onKill', e.relic.id, err); }
        }
      });
    },

    update: function(dt){
      var self = this;
      this._activeCombos.forEach(function(cid){
        var combo = COMBO_DB[cid];
        if(typeof combo.onUpdate === 'function'){
          try{ combo.onUpdate(self, dt); }catch(e){}
        }
      });
    },

    reset: function(){
      var ids = this._inventory.map(function(e){ return e.relic.id; });
      var self = this;
      ids.forEach(function(id){ self.remove(id); });
      this._inventory = [];
      this._activeCombos = [];
      this._flags = {};
      this._stats = { relicHits:0, blocksTriggered:0, combosTrigered:0, dashHits:0 };
    },

    debugDump: function(){
      console.group('[RelicManager] debugDump');
      console.log('');
      console.log('');
      console.log('Flags:', JSON.stringify(this._flags));
      console.log('Stats:', JSON.stringify(this._stats));
      console.groupEnd();
    }
  };

  function bindEvents(){
    if(!root.Events){
      console.warn('[Relic] Events not available, skipping bind');
      return;
    }
    root.Events.on('sword:hit_boss',  function(dmg){ RelicManager.triggerHit(dmg); });
    root.Events.on('player:block',    function(isPerfect){ RelicManager.triggerBlock(isPerfect); });
    root.Events.on('player:dash_hit', function(){ RelicManager.triggerDash(true); });
    root.Events.on('player:dash_miss',function(){ RelicManager.triggerDash(false); });
    root.Events.on('boss:dead',       function(){ RelicManager.triggerKill(); });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', bindEvents);
  } else {
    bindEvents();
  }

  root.RELIC_DB    = RELIC_DB;
  root.COMBO_DB    = COMBO_DB;
  root.RelicManager = RelicManager;

})(typeof window !== 'undefined' ? window : globalThis);
