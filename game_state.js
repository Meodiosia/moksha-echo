
(function(){
  const DIFFICULTIES = {
    1: {
      name: '简单',
      label: '简单',
      desc: '放松模式，Boss血量减少，玩家伤害提高',
      color: '#80FFB0',
      playerMaxHp: 15000,
      bossMaxHp:   80000,
      bossDmgMul:  0.6,
      playerDmgMul: 1.5,
      healRate:    1200,
    },
    2: {
      name: '普通',
      label: '普通',
      desc: '标准挑战',
      color: '#FFD080',
      playerMaxHp: 10000,
      bossMaxHp:   150000,
      bossDmgMul:  1.0,
      playerDmgMul: 1.0,
      healRate:    800,
    },
    3: {
      name: '困难',
      label: '困难',
      desc: '高难度，Boss血量大幅提升',
      color: '#FF6060',
      playerMaxHp: 8000,
      bossMaxHp:   250000,
      bossDmgMul:  1.4,
      playerDmgMul: 0.7,
      healRate:    400,
    },
  };

  const VICTORY_LINES = [
    '击败了！',
    '胜利！',
    '完美！',
    '绝妙！',
    '任务完成！',
  ];
  const DEFEAT_LINES = [
    '倒下了...',
    '再试一次！',
    '继续战斗！',
    '不要放弃！',
    '重新站起来！',
  ];

  window.GAME_DIFFICULTY = DIFFICULTIES[2]; //
  window.GAME_STATE = 'menu'; // 'menu' | 'playing' | 'victory' | 'defeat'

  const style = document.createElement('style');
  style.textContent = `
  .gs-modal{
    position:fixed; inset:0;
    background: radial-gradient(circle at center, rgba(40,10,8,0.85) 0%, rgba(0,0,0,0.95) 80%);
    z-index: 999;
    display: none;
    align-items: center; justify-content: center;
    flex-direction: column;
    color: #FFE7B0;
    font: 600 16px/1.6 'PingFang SC','Microsoft YaHei',sans-serif;
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
    user-select: none; -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .gs-modal.show{ display:flex; }
  .gs-title{
    font-size: 32px; font-weight: 900;
    color: #FFE7B0;
    text-shadow: 0 0 12px rgba(255,140,50,0.7), 0 2px 4px rgba(0,0,0,0.9);
    letter-spacing: 6px;
    margin-bottom: 14px;
  }
  .gs-title.win{ color: #FFF6C8; }
  .gs-title.lose{ color: #FF6060; text-shadow: 0 0 12px rgba(255,30,30,0.7), 0 2px 4px rgba(0,0,0,0.9); }
  .gs-sub{
    font-size: 13px; color: rgba(255,200,140,0.7);
    letter-spacing: 4px; margin-bottom: 30px;
  }
  .gs-line{
    font-size: 15px; color: rgba(255,230,180,0.85);
    letter-spacing: 2px; margin-bottom: 38px;
    max-width: 80vw; text-align: center;
    font-style: italic;
  }

  .gs-diff-row{
    display: flex; gap: 18px; flex-wrap: wrap; justify-content: center;
  }
  .gs-diff-btn{
    width: 130px; padding: 16px 14px;
    background: linear-gradient(180deg, rgba(40,16,12,0.85) 0%, rgba(15,5,4,0.92) 100%);
    border: 2px solid rgba(255,180,80,0.40);
    border-radius: 8px;
    cursor: pointer;
    text-align: center;
    transition: transform 0.12s, border-color 0.2s, box-shadow 0.2s;
    box-shadow:
      inset 0 1px 0 rgba(255,200,140,0.18),
      inset 0 -1px 0 rgba(0,0,0,0.7),
      0 2px 8px rgba(0,0,0,0.6);
  }
  .gs-diff-btn:hover, .gs-diff-btn:active{
    transform: translateY(-3px) scale(1.03);
    border-color: rgba(255,220,140,0.95);
    box-shadow:
      inset 0 1px 0 rgba(255,230,180,0.4),
      inset 0 -1px 0 rgba(0,0,0,0.7),
      0 0 22px rgba(255,140,50,0.55),
      0 4px 10px rgba(0,0,0,0.7);
  }
  .gs-diff-btn .num{
    display:block; font-size: 28px; font-weight: 900;
    text-shadow: 0 0 10px currentColor, 0 1px 3px rgba(0,0,0,0.9);
    margin-bottom: 4px;
  }
  .gs-diff-btn .name{
    display:block; font-size: 16px; font-weight: 800;
    margin-bottom: 6px;
    letter-spacing: 4px;
  }
  .gs-diff-btn .desc{
    display:block; font-size: 11px;
    color: rgba(255,220,170,0.55);
    letter-spacing: 1px;
  }

  .gs-btn-row{
    display: flex; gap: 14px; flex-wrap: wrap; justify-content: center;
  }
  .gs-btn{
    padding: 12px 28px;
    font: 700 14px/1 'PingFang SC',sans-serif;
    letter-spacing: 4px;
    color: #FFE7B0;
    background: linear-gradient(180deg, rgba(60,22,15,0.85) 0%, rgba(25,8,6,0.92) 100%);
    border: 1.5px solid rgba(255,180,80,0.55);
    border-radius: 6px;
    cursor: pointer;
    transition: transform 0.1s, box-shadow 0.2s;
    box-shadow:
      inset 0 1px 0 rgba(255,200,140,0.20),
      inset 0 -1px 0 rgba(0,0,0,0.7),
      0 2px 6px rgba(0,0,0,0.6);
    -webkit-tap-highlight-color: transparent;
  }
  .gs-btn.primary{
    background: linear-gradient(180deg, rgba(140,55,30,0.9) 0%, rgba(80,25,15,0.95) 100%);
    border-color: #FFC470;
    color: #FFFFFF;
    box-shadow:
      inset 0 1px 0 rgba(255,220,160,0.45),
      inset 0 -1px 0 rgba(40,10,5,0.7),
      0 0 14px rgba(255,160,60,0.55),
      0 2px 6px rgba(0,0,0,0.7);
  }
  .gs-btn:hover, .gs-btn:active{
    transform: translateY(-2px) scale(1.04);
    box-shadow:
      inset 0 1px 0 rgba(255,230,180,0.5),
      inset 0 -1px 0 rgba(0,0,0,0.7),
      0 0 22px rgba(255,180,80,0.7);
  }
  `;
  document.head.appendChild(style);

  function showDifficultyModal(onChosen){
    let modal = document.getElementById('gs-diff-modal');
    if(!modal){
      modal = document.createElement('div');
      modal.id = 'gs-diff-modal';
      modal.className = 'gs-modal';
      modal.innerHTML = `
        <div class="gs-title">Moksha Echo</div>
        <div class="gs-sub">选择难度</div>
        <div class="gs-diff-row">
          ${[1,2,3].map(i => {
            const d = DIFFICULTIES[i];
            return `
            <div class="gs-diff-btn" data-level="${i}">
              <span class="num" style="color:${d.color}">${i}</span>
              <span class="name" style="color:${d.color}">${d.label}</span>
              <span class="desc">${d.name}
            </div>`;
          }).join('')}
        </div>
      `;
      document.body.appendChild(modal);
      modal.querySelectorAll('.gs-diff-btn').forEach(btn => {
        const tap = (e) => {
          e.preventDefault();
          const lv = parseInt(btn.dataset.level);
          window.GAME_DIFFICULTY = DIFFICULTIES[lv];
          modal.classList.remove('show');
          if(window._gs_onChosen) window._gs_onChosen();
        };
        btn.addEventListener('touchstart', tap, { passive: false });
        btn.addEventListener('click', tap);
      });
    }
    window._gs_onChosen = onChosen;
    modal.classList.add('show');
  }

  function showResultModal(victory){
    // 若已重开游戏，不弹结算
    if(window.GAME_STATE === 'playing') return;
    let modal = document.getElementById('gs-result-modal');
    if(!modal){
      modal = document.createElement('div');
      modal.id = 'gs-result-modal';
      modal.className = 'gs-modal';
      document.body.appendChild(modal);
    }
    const lines = victory ? VICTORY_LINES : DEFEAT_LINES;
    const line = lines[Math.floor(Math.random() * lines.length)];
    const titleCls = victory ? 'win' : 'lose';
    const titleText = victory ? '胜利' : '失败';
    const subText   = victory ? line : line;

    let relicHTML = '';
    if(window.RelicManager){
      const items = window.RelicManager.getInventory();
      const combos = window.RelicManager.getActiveCombos();
      if(items.length > 0){
        relicHTML = `
          <div style="margin:14px 0 8px;font-size:11px;color:rgba(255,200,140,0.5);letter-spacing:3px">
            — 法宝 —
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:10px">
            ${items.map(e => `
              <div style="
                padding:6px 10px;border-radius:5px;
                background:rgba(10,10,24,0.8);
                border:1px solid ${e.relic.rarity==='rare'?'#AAEEFF':e.relic.rarity==='legendary'?'#FFD080':'#2a2a40'};
                font-size:11px;color:#ddd;text-align:center;
              ">
                <span style="font-size:18px;display:block">${e.relic.icon}</span>
                ${e.relic.name}
              </div>
            `).join('')}
          </div>
          ${combos.length > 0 ? `
            <div style="font-size:11px;color:#FFD080;margin-bottom:6px;letter-spacing:2px">
              ${combos.map(id => { const c = window.COMBO_DB && window.COMBO_DB[id]; return c ? c.name : id; }).join(', ')}
            </div>
          ` : ''}
        `;
      }
    }

    const sealsEarned = victory ? 100 : 30;
    const totalSeals = (window.Save && window.Save.getMeta) ? window.Save.getMeta().seals : sealsEarned;
    const totalRuns  = (window.Save && window.Save.getMeta) ? window.Save.getMeta().totalRuns : 1;
    const sealHTML = `
      <div style="
        margin:10px 0;padding:8px 20px;
        background:rgba(255,208,128,0.08);
        border:1px solid rgba(255,208,128,0.25);
        border-radius:5px;font-size:12px;
        color:#FFD080;letter-spacing:2px;
      ">
        +${sealsEarned} 印记
      </div>
    `;

    let statsHTML = '';
    if(window.RelicManager){
      const stats = window.RelicManager.getStats() || {};
      statsHTML = `
        <div style="display:flex;gap:16px;justify-content:center;margin:8px 0;font-size:10px;color:rgba(255,200,140,0.5)">
          <span>伤害: ${stats.totalDmg||0}</span>
          <span>命中: ${stats.hitCount||0}</span>
          <span>局数: ${totalRuns||1}</span>
          <span>印记: ${totalSeals||0}</span>
        </div>
      `;
    }

    modal.innerHTML = `
      <div class="gs-title ${titleCls}">${titleText}</div>
      <div class="gs-sub">${subText}</div>
      <div class="gs-line">
      ${statsHTML}
      ${relicHTML}
      ${sealHTML}
      <div class="gs-btn-row">
        <button class="gs-btn primary" id="gs-retry">再来一局</button>
        <button class="gs-btn" id="gs-change-diff">切换难度</button>
      </div>
    `;
    modal.classList.add('show');

    const retry = (e) => {
      e && e.preventDefault();
      modal.classList.remove('show');
      restartGame();
    };
    const changeDiff = (e) => {
      e && e.preventDefault();
      modal.classList.remove('show');
      showDifficultyModal(() => {
        updateTagHighlight();
        restartGame();
      });
    };
    const retryBtn = document.getElementById('gs-retry');
    const cdBtn    = document.getElementById('gs-change-diff');
    retryBtn.addEventListener('touchstart', retry, { passive: false });
    retryBtn.addEventListener('click', retry);
    cdBtn.addEventListener('touchstart', changeDiff, { passive: false });
    cdBtn.addEventListener('click', changeDiff);
  }

  function restartGame(){
    const d = window.GAME_DIFFICULTY;

    if(typeof window._applyDifficulty === 'function'){
      window._applyDifficulty(d);
    }
    if(typeof player !== 'undefined' && player){
      player.state = 'idle';
      player.stateTimer = 0;
      player.vx = 0; player.vy = 0;
      const _activeLv = (typeof LEVEL_4 !== 'undefined' && LEVEL_4)
        || (typeof LEVEL_3 !== 'undefined' && LEVEL_3)
        || null;
      const _lvSp = _activeLv ? (_activeLv.playerSpawn || _activeLv.spawnPoint) : null;
      if(_lvSp){ player.x = _lvSp.x; player.y = _lvSp.y; }
    }

    window.killCount = 0;
    window._bossSpawnTriggered = false;
    // 重置 L5 升级/boss 状态
    if(window._L5 && window._L5.active){
      window._L5.level = 1;
      window._L5.exp   = 0;
      window._L5._bossSpawnTriggered = false;
    }
    if(typeof window._resetWaveState === 'function') window._resetWaveState();

    if(window.enemies) window.enemies.length = 0;

    if(typeof window.boss !== 'undefined') window.boss = null;

    if(window.role3 && window.role3SwordsAPI){
      if(window.role3Swords) window.role3Swords.length = 0;
      for(let i = 0; i < 3; i++){
        window.role3SwordsAPI.addOrbit({ phase: i / 3 * Math.PI * 2, r: 40, h: -36 });
      }
      ['cdAtk1','cdAtk4','cdL','cdU','cdN','cdM','cdB','cdV'].forEach(k => { window.role3[k] = 0; });
      window.role3.chargingO = 0;
      window.role3.chargingL = 0;
      window.role3.sanctuaryT = 0;
      window._r3InitDone = false;
      window._r3PassiveAcc = 0;
      // L5 模式：重置到初始最低配置
      if(window._L5 && window._L5.active){
        window.role3.MAX_SWORDS = 3;
        if(window.RelicManager) window.RelicManager.reset();
      } else {
        window.role3.MAX_SWORDS = 8;
      }
    }

    if(typeof window._clearFx === 'function'){
      window._clearFx();
    } else {
      if(window.fxShapesPool) window.fxShapesPool.length = 0;
    }

    setTimeout(() => {
      if(typeof initEnemies === 'function') initEnemies();
    }, 50);

    window.GAME_STATE = 'playing';
    console.log('[GAME] restart OK');
  }

  function checkDeath(curPlayerHp){
    if(window.GAME_STATE !== 'playing') return;
    const hp = (curPlayerHp !== undefined) ? curPlayerHp : (window.playerHp || 0);
    if(hp <= 0){
      window.GAME_STATE = 'defeat';
      if(typeof player !== 'undefined' && player){
        player.state = 'dead';
      }
      setTimeout(() => showResultModal(false), 800);
      return;
    }
    if(typeof boss !== 'undefined' && boss && boss.hp <= 0 && boss.state === 'dead'){
      if(window.GAME_STATE === 'playing'){
        window.GAME_STATE = 'victory';
        setTimeout(() => showResultModal(true), 1500);
      }
    }
  }

  function initTopBar(){
    let bar = document.getElementById('gs-topbar');
    if(bar) return;
    bar = document.createElement('div');
    bar.id = 'gs-topbar';
    bar.style.cssText = `
      position:fixed; right: calc(env(safe-area-inset-right, 0) + 76px);
      top: calc(env(safe-area-inset-top, 0) + 12px);
      z-index: 60; display: flex; gap: 6px;
      pointer-events: auto;
    `;
    bar.innerHTML = [1,2,3].map(i => {
      const d = DIFFICULTIES[i];
      return `<div class="gs-diff-tag" data-level="${i}" style="
        width:30px; height:30px;
        display:flex; align-items:center; justify-content:center;
        font:700 13px/1 'PingFang SC',sans-serif;
        color: ${d.color};
        background: rgba(20,8,6,0.55);
        border: 1px solid ${d.color}80;
        border-radius: 4px;
        cursor: pointer;
        text-shadow: 0 0 4px ${d.color}, 0 1px 2px rgba(0,0,0,0.9);
        transition: transform 0.08s, box-shadow 0.15s;
        -webkit-tap-highlight-color: transparent;
      ">${i}</div>`;
    }).join('');
    document.body.appendChild(bar);
    bar.querySelectorAll('.gs-diff-tag').forEach(t => {
      const tap = (e) => {
        e.preventDefault();
        const lv = parseInt(t.dataset.level);
        if(DIFFICULTIES[lv] && DIFFICULTIES[lv] !== window.GAME_DIFFICULTY){
          window.GAME_DIFFICULTY = DIFFICULTIES[lv];
          updateTagHighlight();
          restartGame();
        }
      };
      t.addEventListener('touchstart', tap, { passive: false });
      t.addEventListener('click', tap);
    });
    updateTagHighlight();
  }
  function updateTagHighlight(){
    const cur = window.GAME_DIFFICULTY;
    document.querySelectorAll('.gs-diff-tag').forEach(t => {
      const lv = parseInt(t.dataset.level);
      const d = DIFFICULTIES[lv];
      const active = (d === cur);
      t.style.background = active ? `${d.color}40` : 'rgba(20,8,6,0.55)';
      t.style.boxShadow = active ? `0 0 12px ${d.color}, inset 0 0 6px ${d.color}80` : 'none';
      t.style.transform = active ? 'scale(1.10)' : 'scale(1)';
    });
  }

  function bootstrap(){
    initTopBar();
    showDifficultyModal(() => {
      updateTagHighlight();
      restartGame();
    });
  }

  window.addEventListener('load', () => {
    setTimeout(bootstrap, 400);  //
  });

  window.GameState = {
    checkDeath,
    showDifficultyModal,
    showResultModal,
    restartGame,
    DIFFICULTIES,
  };

})();
