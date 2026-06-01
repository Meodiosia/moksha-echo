/* ui/skill_hud.js — 飞剑使专属 HUD（连携进度 + 背包 + 渡劫层）
 * 替换旧版技能 CD 显示，适配 Roguelite 系统
 *
 * API：
 *   SkillHUD.render(ctx)   — 在 canvas 上绘制，每帧调用
 *
 * 读取：
 *   window.role3           — 连携计数器（_jHitCount / _kHitCount / _iBlockCount）
 *   window.RelicManager    — 背包法宝列表
 *   window.RunManager      — 当前房间信息、渡劫层数
 *
 * 坐标系：画布 800×560（CW=800, CH=560）
 */
(function(global){
  'use strict';

  // ── 布局常量 ──────────────────────────────────
  var CW = 800, CH = 560;
  var PAD = 10;

  // 连携进度条区域（左下角）
  var CHAIN_X  = PAD;
  var CHAIN_Y  = CH - PAD - 72;   // 3条进度条 + 间隔
  var CHAIN_W  = 90;
  var CHAIN_H  = 16;
  var CHAIN_GAP = 6;

  // 背包格区域（右下角）
  var INV_SLOT  = 38;              // 每格大小
  var INV_GAP   = 5;
  var INV_COLS  = 6;
  var INV_X     = CW - PAD - (INV_SLOT * INV_COLS + INV_GAP * (INV_COLS - 1));
  var INV_Y     = CH - PAD - INV_SLOT;

  // 渡劫层数（左上角，紧贴 HP 条下方）
  var FLOOR_X = PAD + 2;
  var FLOOR_Y = 64;

  // 道法激活飘字
  var _comboNotifs = [];           // [{text, age, life, y}]

  // ── 连携配置 ──────────────────────────────────
  var CHAINS = [
    { label: 'J', color: '#AAEEFF', max: 10, getCount: function(){ return (global.role3 && global.role3._jHitCount) || 0; }, milestones: [5, 10] },
    { label: 'K', color: '#FFD080', max: 2,  getCount: function(){ return (global.role3 && global.role3._kHitCount) || 0; }, milestones: [2] },
    { label: 'I', color: '#AAFFCC', max: 3,  getCount: function(){ return (global.role3 && global.role3._iBlockCount) || 0; }, milestones: [3] },
  ];

  // ── emoji 字符缓存（canvas emoji 渲染较慢，缓存到 offscreen）──
  var _emojiCache = {};
  function getEmojiCanvas(emoji, size){
    var key = emoji + '_' + size;
    if(_emojiCache[key]) return _emojiCache[key];
    var oc = document.createElement('canvas');
    oc.width = size; oc.height = size;
    var ox = oc.getContext('2d');
    ox.font = Math.floor(size * 0.72) + 'px "Segoe UI Emoji","Apple Color Emoji",sans-serif';
    ox.textAlign = 'center';
    ox.textBaseline = 'middle';
    ox.fillText(emoji, size / 2, size / 2);
    _emojiCache[key] = oc;
    return oc;
  }

  // ── 主渲染 ────────────────────────────────────
  function render(ctx){
    if(!ctx) return;
    ctx.save();

    _renderChains(ctx);
    _renderInventory(ctx);
    _renderFloor(ctx);
    _renderComboNotifs(ctx);

    ctx.restore();
  }

  // ── 连携进度条 ────────────────────────────────
  function _renderChains(ctx){
    var r3 = global.role3;
    if(!r3) return;

    CHAINS.forEach(function(chain, i){
      var x = CHAIN_X;
      var y = CHAIN_Y + i * (CHAIN_H + CHAIN_GAP);
      var count = chain.getCount();
      var ratio = Math.min(1, count / chain.max);

      // 背景条
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      _roundRect(ctx, x, y, CHAIN_W, CHAIN_H, 3);
      ctx.fill();

      // 进度填充
      if(ratio > 0){
        var grd = ctx.createLinearGradient(x, y, x + CHAIN_W * ratio, y);
        grd.addColorStop(0, hexAlpha(chain.color, 0.35));
        grd.addColorStop(1, hexAlpha(chain.color, 0.85));
        ctx.fillStyle = grd;
        _roundRect(ctx, x, y, CHAIN_W * ratio, CHAIN_H, 3);
        ctx.fill();
      }

      // 里程碑刻度线
      chain.milestones.forEach(function(ms){
        var mx = x + (ms / chain.max) * CHAIN_W;
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(mx, y + 2);
        ctx.lineTo(mx, y + CHAIN_H - 2);
        ctx.stroke();
      });

      // 边框
      ctx.strokeStyle = hexAlpha(chain.color, 0.3);
      ctx.lineWidth = 1;
      _roundRect(ctx, x, y, CHAIN_W, CHAIN_H, 3);
      ctx.stroke();

      // 键位标签
      ctx.font = 'bold 9px Consolas,monospace';
      ctx.fillStyle = chain.color;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(chain.label, x + 4, y + CHAIN_H / 2);

      // 计数文字
      ctx.font = '9px Consolas,monospace';
      ctx.fillStyle = hexAlpha(chain.color, 0.9);
      ctx.textAlign = 'right';
      ctx.fillText(count + '/' + chain.max, x + CHAIN_W - 4, y + CHAIN_H / 2);

      // 满进度闪光
      if(ratio >= 1){
        ctx.fillStyle = hexAlpha(chain.color, 0.15 + 0.1 * Math.sin(Date.now() / 150));
        _roundRect(ctx, x, y, CHAIN_W, CHAIN_H, 3);
        ctx.fill();
      }
    });
  }

  // ── 背包格 ────────────────────────────────────
  function _renderInventory(ctx){
    var items = (global.RelicManager && global.RelicManager.getInventory()) || [];
    var activeCombos = (global.RelicManager && global.RelicManager.getActiveCombos()) || [];

    for(var i = 0; i < INV_COLS; i++){
      var x = INV_X + i * (INV_SLOT + INV_GAP);
      var y = INV_Y;
      var entry = items[i] || null;

      // 背景
      ctx.fillStyle = entry ? 'rgba(10,10,24,0.8)' : 'rgba(0,0,0,0.3)';
      _roundRect(ctx, x, y, INV_SLOT, INV_SLOT, 4);
      ctx.fill();

      // 边框
      var rarityColor = '#2a2a40';
      if(entry){
        if(entry.relic.rarity === 'legendary') rarityColor = '#FFD080';
        else if(entry.relic.rarity === 'rare')  rarityColor = '#AAEEFF';
        else                                     rarityColor = '#3a3a55';
      }
      ctx.strokeStyle = rarityColor;
      ctx.lineWidth = entry ? 1.5 : 1;
      _roundRect(ctx, x, y, INV_SLOT, INV_SLOT, 4);
      ctx.stroke();

      // 虚线（空格）
      if(!entry){
        ctx.strokeStyle = 'rgba(50,50,70,0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        _roundRect(ctx, x + 2, y + 2, INV_SLOT - 4, INV_SLOT - 4, 3);
        ctx.stroke();
        ctx.setLineDash([]);
        continue;
      }

      // emoji 图标
      try{
        var ec = getEmojiCanvas(entry.relic.icon, INV_SLOT);
        ctx.drawImage(ec, x, y, INV_SLOT, INV_SLOT);
      }catch(e){
        // fallback: 文字
        ctx.font = '18px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#eee';
        ctx.fillText(entry.relic.icon, x + INV_SLOT/2, y + INV_SLOT/2);
      }
    }

    // 道法激活时底部卡片微发光
    if(activeCombos.length > 0){
      ctx.strokeStyle = 'rgba(255,208,128,0.25)';
      ctx.lineWidth = 1;
      var totalW = INV_COLS * INV_SLOT + (INV_COLS-1) * INV_GAP;
      _roundRect(ctx, INV_X - 3, INV_Y - 3, totalW + 6, INV_SLOT + 6, 6);
      ctx.stroke();
    }
  }

  // ── 渡劫层数 + 房间进度 ───────────────────────
  function _renderFloor(ctx){
    var rm = global.RunManager;
    if(!rm || rm.getState() === 'idle') return;

    var idx   = rm.getRoomIndex();
    var total = rm.getTotalRooms();
    var room  = rm.getCurrentRoom();
    var label = room ? room.label : '—';

    ctx.font = 'bold 10px Consolas,monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // 背景
    var tw = ctx.measureText(label).width + 14;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    _roundRect(ctx, FLOOR_X - 2, FLOOR_Y - 2, tw, 15, 3);
    ctx.fill();

    // 文字
    ctx.fillStyle = '#FFD080';
    ctx.fillText(label, FLOOR_X + 4, FLOOR_Y);

    // 小点进度（每个房间一个点）
    if(total > 0){
      var dotY = FLOOR_Y + 18;
      for(var i = 0; i < total; i++){
        var dotX = FLOOR_X + i * 10;
        ctx.beginPath();
        ctx.arc(dotX + 4, dotY + 4, 3, 0, Math.PI * 2);
        if(i < idx)       ctx.fillStyle = '#4CAF50';
        else if(i === idx) ctx.fillStyle = '#FFD080';
        else               ctx.fillStyle = '#2a2a40';
        ctx.fill();
      }
    }
  }

  // ── 道法飘字 ──────────────────────────────────
  function addComboNotif(text){
    _comboNotifs.push({
      text:  '⚡ ' + text,
      age:   0,
      life:  2.2,
      y:     CH * 0.42,
    });
  }

  function _renderComboNotifs(ctx){
    var dead = [];
    _comboNotifs.forEach(function(n, i){
      n.age += 0.016; // 约 60fps
      if(n.age > n.life){ dead.push(i); return; }
      var t = n.age / n.life;
      var alpha = t < 0.15 ? (t / 0.15) : (t > 0.7 ? (1 - (t - 0.7) / 0.3) : 1);
      var ny = n.y - t * 30;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 14px Consolas,monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 阴影
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillText(n.text, CW/2 + 1, ny + 1);
      // 主文字
      ctx.fillStyle = '#FFD080';
      ctx.fillText(n.text, CW/2, ny);
      ctx.restore();
    });
    // 清理死亡通知
    for(var j = dead.length - 1; j >= 0; j--){
      _comboNotifs.splice(dead[j], 1);
    }
  }

  // ── 工具函数 ──────────────────────────────────
  function _roundRect(ctx, x, y, w, h, r){
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function hexAlpha(hex, a){
    // '#AAEEFF' → rgba
    var r = parseInt(hex.slice(1,3),16);
    var g = parseInt(hex.slice(3,5),16);
    var b = parseInt(hex.slice(5,7),16);
    return 'rgba('+r+','+g+','+b+','+a+')';
  }

  // ── Events 监听（道法飘字）────────────────────
  function bindEvents(){
    if(!global.Events) return;
    global.Events.on('combo:activated', function(data){
      addComboNotif(data.combo.name);
    });
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', bindEvents);
  } else {
    bindEvents();
  }

  // ── 对外暴露 ──────────────────────────────────
  global.SkillHUD = {
    render: render,
    addComboNotif: addComboNotif,
    config: { chainX: CHAIN_X, invX: INV_X, invY: INV_Y }
  };

})(typeof window !== 'undefined' ? window : globalThis);
