
(function(){
  const IS_MOBILE = (() => {
    try {
      const ua = (navigator.userAgent || '').toLowerCase();
      const touch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
      const narrow = window.innerWidth < 900 || window.innerHeight < 700;
      const uaMob = /android|iphone|ipad|ipod|mobile|harmony/i.test(ua);
      return uaMob || (touch && narrow);
    } catch(e){ return false; }
  })();
  window.IS_MOBILE = IS_MOBILE;

  function enableMobile(){
    document.body.classList.add('mobile');
    fitCanvas();
    initJoystick();
    initSkillPad();
    initAIButton();
    initBossAIButton();
    initRotateHint();
    startCDLoop();
    window.addEventListener('resize', fitCanvas);
    window.addEventListener('orientationchange', () => setTimeout(fitCanvas, 250));
  }

  function initRotateHint(){
    const hint = document.getElementById('rotate-hint');
    if(!hint) return;
    if(window.innerHeight > window.innerWidth){
      document.body.classList.add('show-hint');
      const dismiss = (e) => {
        e && e.preventDefault();
        document.body.classList.add('hint-dismissed');
      };
      hint.addEventListener('touchstart', dismiss, { passive: false });
      hint.addEventListener('click', dismiss);
      setTimeout(() => document.body.classList.add('hint-dismissed'), 2500);
    }
  }

  function fitCanvas(){
    document.body.classList.toggle('portrait', window.innerHeight > window.innerWidth);
    const cv = document.getElementById('c');
    if(cv){
      cv.style.position = '';
      cv.style.left = cv.style.top = '';
      cv.style.width  = '800px';
      cv.style.height = '560px';
      cv.style.transform = '';
    }
    const wrap = document.getElementById('c-wrap');
    if(wrap){
      wrap.style.left = wrap.style.top = wrap.style.width = wrap.style.height = '';
      wrap.style.transform = '';
    }
  }

  function tryLockLandscape(){
    try {
      const el = document.documentElement;
      const req = el.requestFullscreen || el.webkitRequestFullscreen || el.webkitRequestFullScreen;
      if(req){
        req.call(el).then(() => {
          if(screen.orientation && screen.orientation.lock){
            screen.orientation.lock('landscape').catch(()=>{});
          }
        }).catch(()=>{});
      } else if(screen.orientation && screen.orientation.lock){
        screen.orientation.lock('landscape').catch(()=>{});
      }
    } catch(e){}
  }
  document.addEventListener('touchstart', () => {
    if(!window._lockTried){ window._lockTried = true; tryLockLandscape(); }
  }, { once: false, passive: true });

  if(IS_MOBILE){
    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', enableMobile);
    } else {
      enableMobile();
    }
    let lastTouchEnd = 0;
    document.addEventListener('touchend', e => {
      const now = Date.now();
      if(now - lastTouchEnd <= 350) e.preventDefault();
      lastTouchEnd = now;
    }, { passive: false });
    document.addEventListener('gesturestart', e => e.preventDefault());
    document.addEventListener('gesturechange', e => e.preventDefault());
    document.addEventListener('gestureend', e => e.preventDefault());
    document.addEventListener('contextmenu', e => e.preventDefault());
  }

  function fireKey(type, code){
    const e = new KeyboardEvent(type, { code, key: code.replace('Key',''), bubbles: true, cancelable: true });
    document.dispatchEvent(e);
  }

  function initJoystick(){
    const area = document.getElementById('joystick-area');
    const base = document.getElementById('joystick-base');
    const stick = document.getElementById('joystick-stick');
    if(!area || !base || !stick) return;
    let activeId = -1;
    let cx = 0, cy = 0;
    const RADIUS = 65;
    const DEAD = 0.18;

    window._JOY_IX = 0;
    window._JOY_IY = 0;

    function setStick(dx, dy){
      const len = Math.hypot(dx, dy);
      let nx = 0, ny = 0;
      if(len > 0){
        const k = Math.min(1, len / RADIUS);
        nx = dx / len * k;
        ny = dy / len * k;
      }
      stick.style.transform = `translate(calc(-50% + ${nx*RADIUS}px), calc(-50% + ${ny*RADIUS}px))`;
      const mag = Math.hypot(nx, ny);
      if(mag < DEAD){
        window._JOY_IX = 0; window._JOY_IY = 0;
      } else {
        const s = (mag - DEAD) / (1 - DEAD) / mag;
        window._JOY_IX = nx * s;
        window._JOY_IY = ny * s;
      }
    }

    function start(e){
      const t = e.changedTouches ? e.changedTouches[0] : e;
      activeId = t.identifier !== undefined ? t.identifier : 'mouse';
      cx = t.clientX; cy = t.clientY;
      area.classList.add('active');
      const areaRect = area.getBoundingClientRect();
      base.style.left = (cx - areaRect.left) + 'px';
      base.style.top  = (cy - areaRect.top) + 'px';
      setStick(0, 0);
      e.preventDefault();
    }
    function move(e){
      if(activeId === -1) return;
      const touches = e.changedTouches || [e];
      for(const t of touches){
        if((t.identifier !== undefined ? t.identifier : 'mouse') !== activeId) continue;
        setStick(t.clientX - cx, t.clientY - cy);
        e.preventDefault();
        break;
      }
    }
    function end(e){
      if(activeId === -1) return;
      const touches = e.changedTouches || [e];
      for(const t of touches){
        if((t.identifier !== undefined ? t.identifier : 'mouse') !== activeId) continue;
        activeId = -1;
        area.classList.remove('active');
        base.style.left = '50%';
        base.style.top  = '50%';
        setStick(0, 0);
        window._JOY_IX = 0; window._JOY_IY = 0;
        e.preventDefault();
        break;
      }
    }

    area.addEventListener('touchstart', start, { passive:false });
    area.addEventListener('touchmove',  move,  { passive:false });
    area.addEventListener('touchend',   end,   { passive:false });
    area.addEventListener('touchcancel',end,   { passive:false });
    area.addEventListener('mousedown', start);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
  }

  function initSkillPad(){
    const buttons = document.querySelectorAll('.skill-btn');
    buttons.forEach(btn => {
      const code = 'Key' + (btn.dataset.key || '');
      const isHold = btn.dataset.hold === '1';
      let touching = false;        //
      let keyDown  = false;        //

      const fireKeyDown = () => {
        if(keyDown) return;
        keyDown = true;
        btn.classList.add('pressed');
        fireKey('keydown', code);
        if(!isHold){
          setTimeout(() => {
            if(keyDown){
              keyDown = false;
              fireKey('keyup', code);
            }
          }, 50);
        }
      };
      const onTouchEnd = () => {
        touching = false;
        btn.classList.remove('pressed');
        if(keyDown){
          keyDown = false;
          fireKey('keyup', code);
        }
      };

      const onDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if(touching) return;     //
        touching = true;
        fireKeyDown();
      };
      const onUp = (e) => {
        if(!touching) return;
        e && e.preventDefault();
        onTouchEnd();
      };

      btn.addEventListener('touchstart', onDown, { passive:false });
      btn.addEventListener('touchend', onUp, { passive:false });
      btn.addEventListener('touchcancel', onUp, { passive:false });
      btn.addEventListener('mousedown', onDown);
      btn.addEventListener('mouseup', onUp);
      btn.addEventListener('mouseleave', onUp);
    });
  }

  function initAIButton(){
    const btn = document.getElementById('btn-ai');
    if(!btn) return;
    const tap = (e) => {
      e.preventDefault();
      if(typeof PlayerAI === 'undefined') return;
      PlayerAI.toggle();
      btn.classList.toggle('on', !!PlayerAI.enabled);
    };
    btn.addEventListener('touchstart', tap, { passive:false });
    btn.addEventListener('click', tap);
  }

  function initBossAIButton(){
    const btn = document.getElementById('btn-boss-ai');
    if(!btn) return;
    if(window.BOSS_AI === undefined) window.BOSS_AI = true;
    btn.classList.toggle('on', !!window.BOSS_AI);
    const tap = (e) => {
      e.preventDefault();
      window.BOSS_AI = !window.BOSS_AI;
      btn.classList.toggle('on', !!window.BOSS_AI);
      console.log('[BOSS_AI]', window.BOSS_AI ? 'ON' : 'OFF');
    };
    btn.addEventListener('touchstart', tap, { passive:false });
    btn.addEventListener('click', tap);
  }

  function startCDLoop(){
    const CD_MAP = {
      J: { cur: 'cdAtk1', max: 0.28 },
      P: { cur: 'cdAtk4', max: 12 },
      L: { cur: 'cdL',    max: 10 },
      O: { cur: null,     max: 12 },     // O
      U: { cur: 'cdU',    max: 25 },
      N: { cur: 'cdN',    max: 12 },
      M: { cur: 'cdM',    max: 12 },
      B: { cur: 'cdB',    max: 8 },
      V: { cur: 'cdV',    max: 15 },
    };
    setInterval(() => {
      const r3 = window.role3;
      if(!r3) return;
      for(const k in CD_MAP){
        const conf = CD_MAP[k];
        const btn = document.getElementById('sb-' + k);
        if(!btn) continue;
        if(!conf.cur){ btn.style.setProperty('--cd', '0%'); btn.classList.remove('dim'); continue; }
        const cur = r3[conf.cur] || 0;
        const pct = Math.max(0, Math.min(100, cur / conf.max * 100));
        btn.style.setProperty('--cd', pct + '%');
        btn.classList.toggle('dim', cur > 0.05);
      }
    }, 80);
  }
})();
