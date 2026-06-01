/* ui/relic_reward.js — 游戏内法宝选择面板
 * 由 Events('run:show_relic_select') 触发，暂停游戏循环
 * 依赖：Events、RELIC_DB、RelicManager
 *
 * API：
 *   RelicReward.show(relicIds, onSelect, onSkip)
 *   RelicReward.hide()
 */
(function(root){
  'use strict';

  // ── CSS 注入（只注入一次）──────────────────────
  var _cssInjected = false;
  function injectCSS(){
    if(_cssInjected) return;
    _cssInjected = true;
    var s = document.createElement('style');
    s.textContent = [
      /* 全屏半透明遮罩 */
      '.rr-overlay{',
        'position:fixed;inset:0;',
        'background:rgba(4,4,12,0.88);',
        'display:flex;align-items:center;justify-content:center;flex-direction:column;',
        'z-index:8000;',
        'opacity:0;transition:opacity 0.25s;',
        'pointer-events:none;',
      '}',
      '.rr-overlay.rr-visible{opacity:1;pointer-events:all;}',

      /* 标题 */
      '.rr-title{',
        'color:#FFD080;font-size:15px;font-weight:bold;',
        'letter-spacing:2px;margin-bottom:6px;',
        'font-family:Consolas,monospace;',
        'text-shadow:0 0 12px rgba(255,208,128,0.6);',
      '}',
      '.rr-sub{',
        'color:#445;font-size:10px;margin-bottom:22px;',
        'font-family:Consolas,monospace;letter-spacing:1px;',
      '}',

      /* 卡片行 */
      '.rr-cards{display:flex;gap:16px;flex-wrap:wrap;justify-content:center;}',

      /* 单张卡片 */
      '.rr-card{',
        'width:148px;padding:16px 13px 13px;',
        'background:#0a0a16;',
        'border:1px solid #2a2a40;border-radius:7px;',
        'cursor:pointer;text-align:center;',
        'transition:transform 0.15s,border-color 0.15s,box-shadow 0.15s;',
        'font-family:Consolas,monospace;',
        'position:relative;',
      '}',
      '.rr-card:hover{',
        'transform:translateY(-5px);',
        'border-color:#FFD080;',
        'box-shadow:0 8px 24px rgba(255,208,128,0.2);',
      '}',
      '.rr-card.rr-rare{border-color:#334;}',
      '.rr-card.rr-rare:hover{border-color:#AAEEFF;box-shadow:0 8px 24px rgba(170,238,255,0.2);}',
      '.rr-card.rr-legendary{border-color:#443;}',
      '.rr-card.rr-legendary:hover{border-color:#FFD080;box-shadow:0 8px 28px rgba(255,208,128,0.35);}',

      /* 卡片内容 */
      '.rr-icon{font-size:32px;display:block;margin-bottom:8px;}',
      '.rr-name{color:#eee;font-size:13px;font-weight:bold;margin-bottom:3px;}',
      '.rr-rarity{font-size:9px;letter-spacing:1px;margin-bottom:6px;}',
      '.rr-rarity.rr-common{color:#556;}',
      '.rr-rarity.rr-rare{color:#AAEEFF;}',
      '.rr-rarity.rr-legendary{color:#FFD080;}',
      '.rr-desc{color:#556;font-size:10px;line-height:1.5;}',

      /* 道法提示徽章 */
      '.rr-combo-hint{',
        'position:absolute;top:-8px;left:50%;transform:translateX(-50%);',
        'background:#FFD080;color:#0a0a00;',
        'font-size:9px;padding:2px 7px;border-radius:8px;',
        'white-space:nowrap;font-weight:bold;',
      '}',

      /* 已装备标记 */
      '.rr-owned{',
        'position:absolute;top:5px;right:7px;',
        'color:#4CAF50;font-size:10px;',
      '}',

      /* 跳过按钮 */
      '.rr-skip{',
        'margin-top:18px;color:#334;font-size:11px;',
        'cursor:pointer;font-family:Consolas,monospace;',
        'letter-spacing:1px;transition:color 0.15s;',
      '}',
      '.rr-skip:hover{color:#556;}',

      /* 道法激活横幅（独立显示） */
      '.rr-combo-banner{',
        'position:fixed;top:50%;left:50%;',
        'transform:translate(-50%,-50%) scale(0.8);',
        'background:rgba(4,4,12,0.95);',
        'border:1px solid #FFD080;border-radius:8px;',
        'padding:20px 32px;text-align:center;',
        'z-index:9000;opacity:0;',
        'transition:opacity 0.3s,transform 0.3s;',
        'pointer-events:none;',
        'font-family:Consolas,monospace;',
      '}',
      '.rr-combo-banner.rr-show{',
        'opacity:1;transform:translate(-50%,-50%) scale(1);',
      '}',
      '.rr-combo-banner .rr-cb-title{',
        'color:#FFD080;font-size:18px;font-weight:bold;',
        'letter-spacing:3px;margin-bottom:6px;',
        'text-shadow:0 0 16px rgba(255,208,128,0.8);',
      '}',
      '.rr-combo-banner .rr-cb-sub{color:#889;font-size:11px;}',
    ].join('');
    document.head.appendChild(s);
  }

  // ── DOM 构建 ─────────────────────────────────
  var _overlay = null;
  var _banner  = null;

  function getOverlay(){
    if(_overlay && _overlay.isConnected) return _overlay;
    injectCSS();
    var el = document.createElement('div');
    el.className = 'rr-overlay';
    el.id = 'rr-overlay';
    document.body.appendChild(el);
    _overlay = el;
    return el;
  }

  function getBanner(){
    if(_banner && _banner.isConnected) return _banner;
    var el = document.createElement('div');
    el.className = 'rr-combo-banner';
    document.body.appendChild(el);
    _banner = el;
    return el;
  }

  // ── 主入口 ───────────────────────────────────
  function show(relicIds, onSelect, onSkip){
    var ov = getOverlay();
    ov.innerHTML = '';

    // 暂停游戏
    if(root.GAME_STATE === 'playing') root.GAME_STATE = 'reward';

    // 标题
    var title = document.createElement('div');
    title.className = 'rr-title';
    title.textContent = '　法宝现世　';
    ov.appendChild(title);

    var sub = document.createElement('div');
    sub.className = 'rr-sub';
    sub.textContent = '选择一件，纳入此世修行';
    ov.appendChild(sub);

    // 卡片行
    var row = document.createElement('div');
    row.className = 'rr-cards';

    relicIds.forEach(function(id){
      var relic = root.RELIC_DB && root.RELIC_DB[id];
      if(!relic) return;

      var card = document.createElement('div');
      card.className = 'rr-card rr-' + relic.rarity;

      // 检测：选此法宝是否触发道法
      var comboHint = _checkComboHint(id);

      var ownedCount = root.RelicManager ? root.RelicManager.count(id) : 0;

      card.innerHTML =
        (comboHint ? '<div class="rr-combo-hint">⚡ ' + comboHint + '</div>' : '') +
        (ownedCount > 0 ? '<div class="rr-owned">×' + ownedCount + '</div>' : '') +
        '<span class="rr-icon">' + relic.icon + '</span>' +
        '<div class="rr-name">' + relic.name + '</div>' +
        '<div class="rr-rarity rr-' + relic.rarity + '">' + relic.rarity.toUpperCase() + '</div>' +
        '<div class="rr-desc">' + relic.desc + '</div>';

      card.addEventListener('click', function(){
        _select(id, relic, onSelect, comboHint);
      });

      row.appendChild(card);
    });

    ov.appendChild(row);

    // 跳过按钮
    var skip = document.createElement('div');
    skip.className = 'rr-skip';
    skip.textContent = '此世无缘，继续前行';
    skip.addEventListener('click', function(){
      hide();
      if(root.GAME_STATE === 'reward') root.GAME_STATE = 'playing';
      if(typeof onSkip === 'function') onSkip();
    });
    ov.appendChild(skip);

    // 淡入
    requestAnimationFrame(function(){
      ov.classList.add('rr-visible');
    });
  }

  function _select(id, relic, onSelect, comboHint){
    hide();

    // 装备法宝
    if(root.RelicManager) root.RelicManager.equip(id);

    // 恢复游戏
    if(root.GAME_STATE === 'reward') root.GAME_STATE = 'playing';

    if(typeof onSelect === 'function') onSelect(id);

    // 如果触发了道法，显示横幅
    if(comboHint){
      _showComboBanner(comboHint);
    }
  }

  function hide(){
    var ov = document.getElementById('rr-overlay');
    if(!ov) return;
    ov.classList.remove('rr-visible');
    setTimeout(function(){
      ov.innerHTML = '';
    }, 260);
  }

  // ── 道法激活提示横幅 ─────────────────────────
  function _showComboBanner(comboName){
    var bn = getBanner();
    bn.innerHTML =
      '<div class="rr-cb-title">道法成就</div>' +
      '<div class="rr-cb-title" style="font-size:22px;margin:8px 0;">⚡ ' + comboName + ' ⚡</div>' +
      '<div class="rr-cb-sub">天道感应，此法大成</div>';
    bn.classList.add('rr-show');
    setTimeout(function(){
      bn.classList.remove('rr-show');
    }, 2200);
  }

  // ── 辅助：检测选此法宝能否触发道法 ──────────
  function _checkComboHint(targetId){
    if(!root.COMBO_DB || !root.RelicManager) return null;
    for(var cid in root.COMBO_DB){
      var combo = root.COMBO_DB[cid];
      // 当前已有的法宝（加上目标法宝后）是否满足道法要求
      var wouldActivate = combo.requires.every(function(rid){
        if(rid === targetId) return true;       // 目标法宝满足
        return root.RelicManager.has(rid);      // 已装备满足
      });
      // 且当前尚未激活（否则没意义提示）
      var alreadyActive = root.RelicManager.getActiveCombos().indexOf(cid) >= 0;
      if(wouldActivate && !alreadyActive){
        return combo.name;
      }
    }
    return null;
  }

  // ── Events 监听 ──────────────────────────────
  function bindEvents(){
    if(!root.Events) return;
    root.Events.on('run:show_relic_select', function(data){
      show(data.relics, data.onSelect, data.onSkip);
    });
    // 道法激活时也展示横幅（游戏内触发时）
    root.Events.on('combo:activated', function(data){
      if(root.GAME_STATE === 'playing'){
        _showComboBanner(data.combo.name);
      }
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', bindEvents);
  } else {
    bindEvents();
  }

  root.RelicReward = { show: show, hide: hide, showComboBanner: _showComboBanner };

})(typeof window !== 'undefined' ? window : globalThis);
