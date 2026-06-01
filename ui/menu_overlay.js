/* menu_overlay.js — DOM overlay menus (start / pause / gameover / victory)
 * Exposes window.MenuUI
 *
 * API:
 *   MenuUI.showStart({onPlay, onSettings})
 *   MenuUI.showPause({onResume, onMain})
 *   MenuUI.showGameOver(stats)   // delegates rich UI to ResultScreen if present
 *   MenuUI.showVictory(stats)
 *   MenuUI.hide()
 *   MenuUI.isOpen()
 */
(function (global) {
  'use strict';

  var WRAP_ID = 'c-wrap';
  var ROOT_ID = 'cm-menu-root';

  var _root = null;
  var _open = false;
  var _cssInjected = false;

  function ensureCss() {
    if (_cssInjected) return;
    // Try linking ui.css if not already present
    var has = false;
    var links = document.querySelectorAll('link[rel="stylesheet"]');
    for (var i = 0; i < links.length; i++) {
      if ((links[i].href || '').indexOf('ui.css') >= 0) { has = true; break; }
    }
    if (!has) {
      var l = document.createElement('link');
      l.rel = 'stylesheet';
      // best-effort relative path; works when served from project root or game/ui/
      l.href = (typeof MenuUI !== 'undefined' && MenuUI.cssHref) || 'game/ui/ui.css';
      document.head.appendChild(l);
    }
    _cssInjected = true;
  }

  function getWrap() {
    var w = document.getElementById(WRAP_ID);
    if (!w) {
      // fallback: body
      w = document.body;
    }
    // ensure positioning context
    var cs = window.getComputedStyle(w);
    if (cs.position === 'static' && w !== document.body) {
      w.style.position = 'relative';
    }
    return w;
  }

  function ensureRoot() {
    ensureCss();
    if (_root && _root.isConnected) return _root;
    var r = document.getElementById(ROOT_ID);
    if (!r) {
      r = document.createElement('div');
      r.id = ROOT_ID;
      r.className = 'cm-overlay cm-hidden';
      getWrap().appendChild(r);
    }
    _root = r;
    return r;
  }

  function sfx(name) {
    try { if (global.SFX && typeof global.SFX.play === 'function') global.SFX.play(name); } catch (e) {}
  }

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  function bindBtn(btn, fn) {
    btn.addEventListener('mouseenter', function () { sfx('ui_hover'); });
    btn.addEventListener('click', function (ev) {
      ev.preventDefault();
      sfx('ui_click');
      if (typeof fn === 'function') {
        try { fn(); } catch (e) { console.error(e); }
      }
    });
  }

  function clearRoot() {
    var r = ensureRoot();
    while (r.firstChild) r.removeChild(r.firstChild);
    return r;
  }

  function open(panelEl) {
    var r = clearRoot();
    r.appendChild(panelEl);
    r.classList.remove('cm-hidden');
    _open = true;
  }

  function hide() {
    if (!_root) return;
    _root.classList.add('cm-hidden');
    while (_root.firstChild) _root.removeChild(_root.firstChild);
    _open = false;
  }

  function isOpen() { return !!_open; }

  function makePanel() {
    var p = el('div', 'cm-panel');
    return p;
  }

  function addStatsGrid(panel, stats) {
    if (!stats) return;
    var g = el('div', 'cm-stats');
    var rows = [
      ['Time',     fmtTime(stats.time)],
      ['Damage',   fmtNum(stats.damage)],
      ['Taken',    fmtNum(stats.taken)],
      ['Hits',     fmtNum(stats.hits)],
      ['Max Combo',fmtNum(stats.maxCombo)],
      ['Deaths',   fmtNum(stats.deaths)]
    ];
    for (var i = 0; i < rows.length; i++) {
      var k = rows[i][0], v = rows[i][1];
      if (v == null || v === '') continue;
      var dk = el('div', 'k', k);
      var dv = el('div', 'v', v);
      g.appendChild(dk); g.appendChild(dv);
    }
    panel.appendChild(g);
  }

  function fmtNum(n) {
    if (n == null || isNaN(n)) return '';
    return String(Math.round(n));
  }
  function fmtTime(t) {
    if (t == null || isNaN(t)) return '';
    var s = Math.max(0, Math.floor(t));
    var m = Math.floor(s / 60);
    var ss = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (ss < 10 ? '0' : '') + ss;
  }

  // ---- public ----

  function showStart(opts) {
    opts = opts || {};
    var panel = makePanel();
    panel.appendChild(el('div', 'cm-sub', 'Hellspire Chronicle'));
    panel.appendChild(el('h1', 'cm-title', 'INFERNUM'));
    panel.appendChild(el('div', 'cm-sub', 'press start to descend'));

    var row = el('div', 'cm-btn-row');
    var bPlay = el('button', 'cm-btn cm-primary', 'Begin');
    var bSet  = el('button', 'cm-btn', 'Settings');
    bindBtn(bPlay, opts.onPlay);
    bindBtn(bSet,  opts.onSettings);
    row.appendChild(bPlay);
    row.appendChild(bSet);
    panel.appendChild(row);

    open(panel);
  }

  function showPause(opts) {
    opts = opts || {};
    var panel = makePanel();
    panel.appendChild(el('h1', 'cm-title', 'PAUSED'));
    panel.appendChild(el('div', 'cm-sub', 'the flames stand still'));

    var row = el('div', 'cm-btn-row');
    var bRes  = el('button', 'cm-btn cm-primary', 'Resume');
    var bMain = el('button', 'cm-btn', 'Main Menu');
    bindBtn(bRes,  opts.onResume);
    bindBtn(bMain, opts.onMain);
    row.appendChild(bRes);
    row.appendChild(bMain);
    panel.appendChild(row);

    open(panel);
  }

  function showGameOver(stats) {
    // Prefer rich result screen if loaded
    if (global.ResultScreen && typeof global.ResultScreen.show === 'function') {
      var s = Object.assign({ outcome: 'defeat' }, stats || {});
      global.ResultScreen.show(s);
      _open = true;
      return;
    }
    var panel = makePanel();
    panel.appendChild(el('h1', 'cm-title cm-dead', 'YOU DIED'));
    panel.appendChild(el('div', 'cm-sub', 'consumed by embers'));
    addStatsGrid(panel, stats);

    var row = el('div', 'cm-btn-row');
    var bRetry = el('button', 'cm-btn cm-primary', 'Retry');
    var bMain  = el('button', 'cm-btn', 'Main Menu');
    bindBtn(bRetry, (stats && stats.onRetry) || null);
    bindBtn(bMain,  (stats && stats.onMain)  || null);
    row.appendChild(bRetry);
    row.appendChild(bMain);
    panel.appendChild(row);

    open(panel);
  }

  function showVictory(stats) {
    if (global.ResultScreen && typeof global.ResultScreen.show === 'function') {
      var s = Object.assign({ outcome: 'victory' }, stats || {});
      global.ResultScreen.show(s);
      _open = true;
      return;
    }
    var panel = makePanel();
    panel.appendChild(el('h1', 'cm-title cm-victory', 'VICTORY'));
    panel.appendChild(el('div', 'cm-sub', 'the spire has fallen'));
    addStatsGrid(panel, stats);

    var row = el('div', 'cm-btn-row');
    var bNext = el('button', 'cm-btn cm-primary', 'Continue');
    var bMain = el('button', 'cm-btn', 'Main Menu');
    bindBtn(bNext, (stats && stats.onNext) || null);
    bindBtn(bMain, (stats && stats.onMain) || null);
    row.appendChild(bNext);
    row.appendChild(bMain);
    panel.appendChild(row);

    open(panel);
  }

  var MenuUI = {
    cssHref: 'game/ui/ui.css',
    showStart: showStart,
    showPause: showPause,
    showGameOver: showGameOver,
    showVictory: showVictory,
    hide: hide,
    isOpen: isOpen
  };

  global.MenuUI = MenuUI;
})(typeof window !== 'undefined' ? window : this);
