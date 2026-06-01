// game_state.js — 难度系统 + 死亡结算 + 难度选择 modal
// 依赖：window.playerHp/playerMaxHp, window.boss/lucia, window.PlayerAI

(function(){
  // ─────────────────────────────────────────────
  // 难度配置
  // ─────────────────────────────────────────────
  const DIFFICULTIES = {
    1: {
      name: '简单',
      label: '初心',
      desc: '初次接触者推荐',
      color: '#80FFB0',
      playerMaxHp: 15000,
      bossMaxHp:   80000,
      bossDmgMul:  0.6,
      playerDmgMul: 1.5,
      healRate:    1200,
    },
    2: {
      name: '普通',
      label: '修行',
      desc: '正统体验，平衡考验',
      color: '#FFD080',
      playerMaxHp: 10000,
      bossMaxHp:   150000,
      bossDmgMul:  1.0,
      playerDmgMul: 1.0,
      healRate:    800,
    },
    3: {
      name: '困难',
      label: '试炼',
      desc: '为绝对的强者准备',
      color: '#FF6060',
      playerMaxHp: 8000,
      bossMaxHp:   250000,
      bossDmgMul:  1.4,
      playerDmgMul: 0.7,
      healRate:    400,
    },
  };

  // ─────────────────────────────────────────────
  // 台词库（轮换）
  // ─────────────────────────────────────────────
  const VICTORY_LINES = [
    '解脱者归来，回声仍在轮回。',
    '万物归寂，唯有飞剑长鸣。',
    '业力终结，业镜碎成星屑。',
    '一剑惊鸿，无招胜有招。',
    '血色褪去时，我已在彼岸。',
  ];
  const DEFEAT_LINES = [
    '业火未熄，再赴一场轮回吧。',
    '剑还未磨利，再来。',
    '解脱不在死亡，而在再起的剑光里。',
    '回声尚未抵达，旅人。',
    '血主笑了——回来吧。',
  ];

  // ─────────────────────────────────────────────
  // 全局状态
  // ─────────────────────────────────────────────
  window.GAME_DIFFICULTY = DIFFICULTIES[2]; // 默认普通
  window.GAME_STATE = 'menu'; // 'menu' | 'playing' | 'victory' | 'defeat'

  // ─────────────────────────────────────────────
  // CSS（注入）
  // ─────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
  /* 通用 modal */
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

  /* 难度按钮 */
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

  /* 结算按钮 */
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

  // ─────────────────────────────────────────────
  // 难度选择 modal
  // ─────────────────────────────────────────────
  function showDifficultyModal(onChosen){
    let modal = document.getElementById('gs-diff-modal');
    if(!modal){
      modal = document.createElement('div');
      modal.id = 'gs-diff-modal';
      modal.className = 'gs-modal';
      modal.innerHTML = `
        <div class="gs-title">Moksha Echo</div>
        <div class="gs-sub">解 脱 回 声 · 选 择 试 炼</div>
        <div class="gs-diff-row">
          ${[1,2,3].map(i => {
            const d = DIFFICULTIES[i];
            return `
            <div class="gs-diff-btn" data-level="${i}">
              <span class="num" style="color:${d.color}">${i}</span>
              <span class="name" style="color:${d.color}">${d.label}</span>
              <span class="desc">${d.name} · ${d.desc}</span>
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

  // ─────────────────────────────────────────────
  // 结算 modal
  // ─────────────────────────────────────────────
  function showResultModal(victory){
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
    const titleText = victory ? '通 关 · 解 脱' : '陨 落 · 再 临';
    const subText = victory ? 'You Have Transcended' : 'Try Again';
    modal.innerHTML = `
      <div class="gs-title ${titleCls}">${titleText}</div>
      <div class="gs-sub">${subText}</div>
      <div class="gs-line">「${line}」</div>
      <div class="gs-btn-row">
        <button class="gs-btn primary" id="gs-retry">再 来 一 次</button>
        <button class="gs-btn" id="gs-change-diff">重 选 难 度</button>
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
      showDifficultyModal(() => restartGame());
    };
    const retryBtn = document.getElementById('gs-retry');
    const cdBtn   = document.getElementById('gs-change-diff');
    retryBtn.addEventListener('touchstart', retry, { passive: false });
    retryBtn.addEventListener('click', retry);
    cdBtn.addEventListener('touchstart', changeDiff, { passive: false });
    cdBtn.addEventListener('click', changeDiff);
  }

  // ─────────────────────────────────────────────
  // 重启游戏（应用当前难度）
  // ─────────────────────────────────────────────
  function restartGame(){
    const d = window.GAME_DIFFICULTY;

    // ── 玩家重置（通过桥接函数修改 let 变量）──
    if(typeof window._applyDifficulty === 'function'){
      window._applyDifficulty(d);
    }
    // 玩家状态
    if(typeof player !== 'undefined' && player){
      player.state = 'idle';
      player.stateTimer = 0;
      player.vx = 0; player.vy = 0;
      if(typeof LEVEL_3 !== 'undefined' && LEVEL_3.playerSpawn){
        player.x = LEVEL_3.playerSpawn.x;
        player.y = LEVEL_3.playerSpawn.y;
      } else if(typeof LEVEL_3 !== 'undefined' && LEVEL_3.spawnPoint){
        player.x = LEVEL_3.spawnPoint.x;
        player.y = LEVEL_3.spawnPoint.y;
      }
    }

    // ── BOSS 重置（通过桥接函数修改 let boss）──
    if(typeof window._resetBoss === 'function'){
      window._resetBoss(d);
    }

    // ── 飞剑使重置 ──
    if(window.role3 && window.role3SwordsAPI){
      if(window.role3Swords) window.role3Swords.length = 0;
      for(let i = 0; i < 3; i++){
        window.role3SwordsAPI.addOrbit({ phase: i / 3 * Math.PI * 2, r: 40, h: -36 });
      }
      ['cdAtk1','cdAtk4','cdL','cdU','cdN','cdM','cdB','cdV'].forEach(k => { window.role3[k] = 0; });
      window.role3.chargingO = 0;
      window.role3.chargingL = 0;
      window.role3.sanctuaryT = 0;
      window._r3InitDone = false;  // 重置被动剑初始化标记
      window._r3PassiveAcc = 0;
    }

    // ── 清屏特效 ──
    if(typeof window._clearFx === 'function'){
      window._clearFx();
    } else {
      if(window.fxShapesPool) window.fxShapesPool.length = 0;
    }

    // ── 必须最后设置，让主循环重新运行 ──
    window.GAME_STATE = 'playing';
    console.log('[GAME] restart →', d.name, '| playerHp=', d.playerMaxHp, '| bossHp=', d.bossMaxHp);
  }

  // ─────────────────────────────────────────────
  // 死亡检测（每帧调用，由主循环触发）
  // ─────────────────────────────────────────────
  function checkDeath(curPlayerHp){
    if(window.GAME_STATE !== 'playing') return;
    const hp = (curPlayerHp !== undefined) ? curPlayerHp : (window.playerHp || 0);
    // 玩家死亡
    if(hp <= 0){
      window.GAME_STATE = 'defeat';
      if(typeof player !== 'undefined' && player){
        player.state = 'dead';
      }
      setTimeout(() => showResultModal(false), 800);
      return;
    }
    // BOSS 死亡
    if(typeof boss !== 'undefined' && boss && boss.hp <= 0 && boss.state === 'dead'){
      if(window.GAME_STATE === 'playing'){
        window.GAME_STATE = 'victory';
        setTimeout(() => showResultModal(true), 1500);
      }
    }
  }

  // ─────────────────────────────────────────────
  // 顶部右侧：难度切换按钮（小标）
  // ─────────────────────────────────────────────
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

  // ─────────────────────────────────────────────
  // 启动流程
  // ─────────────────────────────────────────────
  function bootstrap(){
    initTopBar();
    // 首次显示难度选择
    showDifficultyModal(() => {
      restartGame();
      updateTagHighlight();
    });
  }

  // 等游戏 load 完成后启动
  window.addEventListener('load', () => {
    setTimeout(bootstrap, 400);  // 等 spawnLucia 等就绪
  });

  // 暴露 API
  window.GameState = {
    checkDeath,
    showDifficultyModal,
    showResultModal,
    restartGame,
    DIFFICULTIES,
  };

  // ─────────────────────────────────────────────
  // RunManager 事件监听（Roguelite 流程接入）
  // ─────────────────────────────────────────────
  if(window.Events){

    // 关卡切换：RunManager 通知换地图（V1.0 仅切换 spawnPoint）
    Events.on('run:load_level', function(data){
      const level = data.level;
      // 更新地图数据（若关卡系统已支持动态切换）
      if(level && typeof window._loadLevel === 'function'){
        window._loadLevel(level);
      }
      console.log('[GameState] RunManager 切换地图:', level.name);
    });

    // 玩家出生点重置
    Events.on('run:spawn_player', function(data){
      if(typeof player !== 'undefined' && player){
        player.x = data.x;
        player.y = data.y;
        player.vx = 0; player.vy = 0;
        player.state = 'idle';
      }
    });

    // 刷怪（V1.0：接入 archer/bomber_enemy）
    Events.on('run:spawn_enemies', function(data){
      if(typeof window.enemies === 'undefined') return;
      window.enemies.length = 0;
      data.spawns.forEach(function(sp){
        if(sp.type === 'archer' && typeof window.spawnArcher === 'function'){
          const e = window.spawnArcher(sp.x, sp.y);
          if(e) window.enemies.push(e);
        }
      });
      console.log('[GameState] 刷怪', window.enemies.length, '个');
    });

    // 召唤 Boss
    Events.on('run:spawn_boss', function(data){
      const sp = data.bossSpawn;
      if(sp.type === 'lucia' && typeof window.spawnLucia === 'function'){
        if(typeof window._resetBoss === 'function'){
          window._resetBoss(window.GAME_DIFFICULTY);
        } else {
          window.boss = window.spawnLucia(sp.x, sp.y);
        }
        console.log('[GameState] Boss 召唤:', sp.type);
      }
    });

    // RunManager 请求进入下一局
    Events.on('run:go_menu', function(){
      window.GAME_STATE = 'menu';
    });
  }
})();
