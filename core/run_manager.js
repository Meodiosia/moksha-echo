// core/run_manager.js — Roguelite 单局流程管理器
// 依赖：Events、RelicManager、Save（可选）
// 
// 对外 API：
//   RunManager.startRun(difficulty)   开始新一局
//   RunManager.getState()             当前状态字符串
//   RunManager.getCurrentRoom()       当前房间配置对象
//   RunManager.getRoomIndex()         当前房间序号（0-based）
//   RunManager.getTotalRooms()        本局总房间数
//   RunManager.completeRoom()         手动标记当前房间完成（通常由清场检测调用）
//   RunManager.onRoomClear            挂载清场检测回调
//   RunManager.reset()                重置（新局开始时 startRun 自动调用）
//
// 状态机：
//   idle → selecting_relic → transitioning → in_room → reward → transitioning → ... → boss → result

(function(root){
  'use strict';

  // ─────────────────────────────────────────────
  // 房间序列定义（V1.0 固定顺序，V2.0 改为随机生成）
  // ─────────────────────────────────────────────
  // type: 'combat' | 'treasure' | 'elite' | 'boss'
  // levelId: 对应 LEVEL_2 / LEVEL_3
  // enemies: 覆盖 level 默认刷怪（null = 用 level 自带）
  // rewardCount: 奖励法宝数量

  var ROOM_SEQUENCES = {
    // 标准路线（4房间：战斗→宝库→精英→Boss）
    standard: [
      {
        type: 'combat',
        label: '试炼·初境',
        levelId: 1,
        enemies: [
          // 左下大平台 3只
          { type: 'archer', x: 10 * 24, y: 32 * 24 },
          { type: 'archer', x: 18 * 24, y: 36 * 24 },
          { type: 'archer', x: 24 * 24, y: 28 * 24 },
          // 右上平台 3只
          { type: 'archer', x: 48 * 24, y: 14 * 24 },
          { type: 'archer', x: 56 * 24, y: 18 * 24 },
          { type: 'archer', x: 44 * 24, y: 12 * 24 },
        ],
        rewardCount: 3,
        clearCondition: 'kill_all',
      },
      {
        type: 'treasure',
        label: '法宝秘藏',
        levelId: 1,
        enemies: [],
        rewardCount: 3,
        clearCondition: 'auto',
      },
      {
        type: 'elite',
        label: '试炼·中境',
        levelId: 1,
        enemies: [
          // 左下平台 4只
          { type: 'archer', x: 8  * 24, y: 30 * 24 },
          { type: 'archer', x: 14 * 24, y: 38 * 24 },
          { type: 'archer', x: 22 * 24, y: 34 * 24 },
          { type: 'archer', x: 26 * 24, y: 28 * 24 },
          // 右上平台 4只
          { type: 'archer', x: 42 * 24, y: 10 * 24 },
          { type: 'archer', x: 52 * 24, y: 16 * 24 },
          { type: 'archer', x: 60 * 24, y: 20 * 24 },
          { type: 'archer', x: 48 * 24, y: 22 * 24 },
        ],
        rewardCount: 3,
        clearCondition: 'kill_all',
        eliteBonus: true,
      },
      {
        type: 'boss',
        label: '渡劫·终境',
        levelId: 3,
        enemies: [],
        rewardCount: 0,
        clearCondition: 'kill_boss',
      },
    ]
  };

  // ─────────────────────────────────────────────
  // 过渡动画配置
  // ─────────────────────────────────────────────
  var TRANSITION_OUT = 0.4;  // 黑屏淡出时长(s)
  var TRANSITION_IN  = 0.35; // 淡入时长(s)

  // ─────────────────────────────────────────────
  // RunManager
  // ─────────────────────────────────────────────
  var RunManager = {
    _state: 'idle',          // 当前状态
    _roomIndex: -1,          // 当前房间序号
    _sequence: [],           // 本局房间序列
    _difficulty: null,       // 当前难度对象
    _transitionT: 0,         // 过渡动画计时
    _transitioning: false,
    _transitionPhase: 'out', // 'out' | 'in'
    _transitionCallback: null,
    _overlay: null,          // 黑屏 overlay DOM 元素
    _currentEnemies: [],     // 当前房间存活敌人列表（外部注入）
    _bossAlive: false,

    // ── 生命周期 ────────────────────────────────

    startRun: function(difficulty){
      this.reset();
      this._difficulty = difficulty || null;
      this._sequence   = ROOM_SEQUENCES.standard.slice();
      this._state      = 'selecting_relic';

      // 重置法宝
      if(root.RelicManager) root.RelicManager.reset();

      emit('run:started', { difficulty: difficulty });
      console.log('[RunManager] 新一局开始，难度:', difficulty && difficulty.name || '默认');

      // 触发出发前法宝选择
      this._showRelicSelection(2, function(){
        RunManager._enterRoom(0);
      });
    },

    reset: function(){
      this._state       = 'idle';
      this._roomIndex   = -1;
      this._sequence    = [];
      this._difficulty  = null;
      this._transitioning = false;
      this._transitionT   = 0;
      this._currentEnemies = [];
      this._bossAlive   = false;
    },

    getState:       function(){ return this._state; },
    getRoomIndex:   function(){ return this._roomIndex; },
    getTotalRooms:  function(){ return this._sequence.length; },
    getCurrentRoom: function(){
      if(this._roomIndex < 0 || this._roomIndex >= this._sequence.length) return null;
      return this._sequence[this._roomIndex];
    },

    isPlaying: function(){
      return this._state === 'in_room' || this._state === 'boss';
    },

    // ── 房间进入 ────────────────────────────────

    _enterRoom: function(index){
      if(index >= this._sequence.length){
        // 所有房间完成
        this._endRun('victory');
        return;
      }

      var self = this;
      var room = this._sequence[index];
      this._roomIndex = index;

      // 黑屏过渡
      this._doTransition(function(){
        // 过渡中间：切换地图 + 刷怪
        self._loadRoom(room);
      }, function(){
        // 过渡完成：设置状态
        if(room.type === 'boss'){
          self._state = 'boss';
          self._bossAlive = true;
        } else if(room.type === 'treasure'){
          self._state = 'reward';
          // 宝库房直接显示法宝选择
          setTimeout(function(){
            self._showRelicSelection(room.rewardCount, function(){
              self._enterRoom(index + 1);
            });
          }, 600);
        } else {
          self._state = 'in_room';
        }
        emit('run:room_entered', { room: room, index: index });
        console.log('[RunManager] 进入房间:', room.label, '(' + room.type + ')');
      });
    },

    _loadRoom: function(room){
      // 获取关卡数据
      var level = this._getLevelById(room.levelId);
      if(!level){ console.error('[RunManager] 关卡未找到:', room.levelId); return; }

      // 通知外部切换地图（demo-3c.html 监听此事件）
      emit('run:load_level', { level: level, room: room });

      // 生成敌人（通知外部创建）
      var spawns = (room.enemies && room.enemies.length > 0)
        ? room.enemies
        : (level.enemySpawns || []);

      this._currentEnemies = [];
      this._bossAlive = (room.type === 'boss');

      if(room.type !== 'boss' && spawns.length > 0){
        emit('run:spawn_enemies', { spawns: spawns, room: room });
      }
      if(room.type === 'boss'){
        var bossSpawn = level.bossSpawn || { type: 'lucia', x: 44*24, y: 29*24 };
        emit('run:spawn_boss', { bossSpawn: bossSpawn, room: room });
      }

      // 重置玩家位置（通知外部）
      var spawn = level.spawnPoint || { x: 30*24, y: 25*24 };
      emit('run:spawn_player', { x: spawn.x, y: spawn.y });
    },

    _getLevelById: function(id){
      if(id === 2 && root.LEVEL_2) return root.LEVEL_2;
      if(id === 3 && root.LEVEL_3) return root.LEVEL_3;
      return null;
    },

    // ── 清场检测（每帧由外部调用）──────────────

    checkClear: function(enemies, bossState){
      if(!this.isPlaying()) return;
      var room = this.getCurrentRoom();
      if(!room) return;

      if(room.clearCondition === 'auto') return; // 宝库：进入即触发

      if(room.clearCondition === 'kill_all'){
        var allDead = !enemies || enemies.every(function(e){ return e.state === 'dead'; });
        if(allDead && enemies && enemies.length > 0){
          this.completeRoom();
        }
      }

      if(room.clearCondition === 'kill_boss'){
        if(bossState === 'dead'){
          this.completeRoom();
        }
      }
    },

    completeRoom: function(){
      if(this._state !== 'in_room' && this._state !== 'boss') return;
      var room = this.getCurrentRoom();
      if(!room) return;

      emit('run:room_clear', { room: room, index: this._roomIndex });
      console.log('[RunManager] 房间清场:', room.label);

      if(room.type === 'boss'){
        // Boss 击败 → 胜利结算
        emit('run:boss_defeated', { room: room });
        this._endRun('victory');
        return;
      }

      // 普通/精英房 → 显示法宝奖励
      this._state = 'reward';
      var self = this;
      var count = room.rewardCount || 3;

      setTimeout(function(){
        self._showRelicSelection(count, function(){
          self._enterRoom(self._roomIndex + 1);
        }, room.eliteBonus);
      }, 800); // 清场后延迟 0.8s 弹出奖励（给玩家缓冲）
    },

    // ── 结局 ────────────────────────────────────

    _endRun: function(outcome){
      this._state = 'result';
      var stats = root.RelicManager ? root.RelicManager.getStats() : {};
      stats.outcome = outcome;
      stats.relics  = root.RelicManager ? root.RelicManager.getInventory() : [];
      stats.combos  = root.RelicManager ? root.RelicManager.getActiveCombos() : [];

      emit('run:ended', { outcome: outcome, stats: stats });
      console.log('[RunManager] 本局结束:', outcome);

      // 触发结算界面（外部监听）
      if(typeof root.ResultScreen !== 'undefined' && typeof root.ResultScreen.show === 'function'){
        root.ResultScreen.show({
          outcome: outcome === 'victory' ? 'victory' : 'defeat',
          onRetry: function(){ RunManager.startRun(RunManager._difficulty); },
          onMain:  function(){ emit('run:go_menu'); }
        });
      }
    },

    // ── 过渡动画 ────────────────────────────────

    _getOverlay: function(){
      if(this._overlay && this._overlay.isConnected) return this._overlay;
      var el = document.getElementById('run-transition-overlay');
      if(!el){
        el = document.createElement('div');
        el.id = 'run-transition-overlay';
        el.style.cssText = [
          'position:fixed','top:0','left:0','width:100%','height:100%',
          'background:#000','pointer-events:none',
          'z-index:9999','opacity:0',
          'transition:opacity 0s'
        ].join(';');
        document.body.appendChild(el);
      }
      this._overlay = el;
      return el;
    },

    _doTransition: function(onMid, onDone){
      var self = this;
      var ov = this._getOverlay();

      // 淡出（变黑）
      ov.style.transition = 'opacity ' + TRANSITION_OUT + 's ease-in';
      ov.style.opacity = '1';

      setTimeout(function(){
        // 黑屏中间：执行地图切换
        if(typeof onMid === 'function') onMid();

        // 淡入（变透明）
        setTimeout(function(){
          ov.style.transition = 'opacity ' + TRANSITION_IN + 's ease-out';
          ov.style.opacity = '0';
          setTimeout(function(){
            if(typeof onDone === 'function') onDone();
          }, TRANSITION_IN * 1000);
        }, 150); // 黑屏停留 150ms

      }, TRANSITION_OUT * 1000);
    },

    // ── 法宝选择面板 ────────────────────────────

    _showRelicSelection: function(count, onDone, eliteBonus){
      // 从法宝池随机抽取（排除已持有，稀有权重加成）
      var pool = this._buildRelicPool(count, eliteBonus);
      emit('run:show_relic_select', {
        relics: pool,
        count: count,
        canSkip: false,
        onSelect: function(id){
          if(id && root.RelicManager){
            root.RelicManager.equip(id);
          }
          if(typeof onDone === 'function') onDone();
        },
        onSkip: function(){
          if(typeof onDone === 'function') onDone();
        }
      });
    },

    _buildRelicPool: function(count, eliteBonus){
      if(!root.RELIC_DB) return [];
      var owned = root.RelicManager ? root.RelicManager.getInventory().map(function(e){ return e.relic.id; }) : [];
      
      // 全部法宝候选（允许重复装备，但优先未装备的）
      var allIds = Object.keys(root.RELIC_DB);
      
      // 按稀有度加权抽取
      var weighted = [];
      allIds.forEach(function(id){
        var r = root.RELIC_DB[id].rarity;
        var weight = (r === 'legendary') ? 1 : (r === 'rare') ? 3 : 6;
        // 精英房强制保证至少1个 rare+
        if(eliteBonus && r === 'rare') weight += 4;
        for(var i=0; i<weight; i++) weighted.push(id);
      });

      // 随机不重复抽 count 个
      var result = [];
      var tried = 0;
      while(result.length < count && tried < 200){
        tried++;
        var pick = weighted[Math.floor(Math.random() * weighted.length)];
        if(result.indexOf(pick) < 0) result.push(pick);
      }
      return result;
    },

    // ── 调试 ────────────────────────────────────
    debugDump: function(){
      console.group('[RunManager] 当前状态');
      console.log('state:', this._state);
      console.log('roomIndex:', this._roomIndex, '/', this._sequence.length);
      var room = this.getCurrentRoom();
      console.log('currentRoom:', room ? room.label + ' (' + room.type + ')' : 'null');
      console.log('difficulty:', this._difficulty && this._difficulty.name);
      console.groupEnd();
    }
  };

  // ─────────────────────────────────────────────
  // 工具
  // ─────────────────────────────────────────────
  function emit(name, data){
    try{ if(root.Events) root.Events.emit(name, data); }catch(e){}
  }

  // ─────────────────────────────────────────────
  // 对外暴露
  // ─────────────────────────────────────────────
  root.RunManager = RunManager;
  root.ROOM_SEQUENCES = ROOM_SEQUENCES;

})(typeof window !== 'undefined' ? window : globalThis);
