/* result_screen.js
 * Exposes window.ResultScreen
 *
 * API:
 *   ResultScreen.show(stats)
 *     stats: {
 *       outcome: 'victory'|'defeat',
 *       time, damage, taken, hits, maxCombo, deaths,
 *       hpRatio (0..1, optional),
 *       onRetry, onNext, onMain
 *     }
 *   ResultScreen.hide()
 *   ResultScreen.computeRating(stats) -> 'S'|'A'|'B'|'C'
 */
(function (global) {
  'use strict';

  var WRAP_ID = 'c-wrap';
  var ROOT_ID = 'cm-result-root';
  var _root = null;

  function sfx(name) {
    try { if (global.SFX && typeof global.SFX.play === 'function') global.SFX.play(name); } catch (e) {}
  }

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  function getWrap() {
    return document.getElementById(WRAP_ID) || document.body;
  }

  function ensureRoot() {
    if (_root && _root.isConnected) return _root;
    var r = document.getElementById(ROOT_ID);
    if (!r) {
      r = document.createElement('div');
      r.id = ROOT_ID;
      r.className = 'cm-overlay cm-hidden';
      var w = getWrap();
      if (w !== document.body) {
        var cs = window.getComputedStyle(w);
        if (cs.position === 'static') w.style.position = 'relative';
      }
      w.appendChild(r);
    }
    _root = r;
    return r;
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

  function fmtTime(t) {
    if (t == null || isNaN(t)) return '--:--';
    var s = Math.max(0, Math.floor(t));
    var m = Math.floor(s / 60);
    var ss = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (ss < 10 ? '0' : '') + ss;
  }
  function fmtNum(n) {
    if (n == null || isNaN(n)) return '0';
    return String(Math.round(n));
  }

  /**
   * Rating heuristic.
   *  - Victory required for S/A.
   *  - Score = HP retained + time bonus + low-damage bonus + combo bonus - death penalty.
   */
  function computeRating(stats) {
    stats = stats || {};
    var win = stats.outcome === 'victory';
    if (!win) {
      // defeat: C unless was very close (low taken)
      var taken = +stats.taken || 0;
      if (taken < 200 && (stats.hpRatio == null || stats.hpRatio > 0.0)) return 'C';
      return 'C';
    }
    var score = 0;
    var hp = stats.hpRatio == null ? 0.6 : Math.max(0, Math.min(1, +stats.hpRatio));
    score += hp * 50;                                            // 0..50

    var t = +stats.time || 0;
    // sub-60s great, 180s baseline, >300s poor
    if (t > 0) {
      if (t < 60)       score += 25;
      else if (t < 120) score += 18;
      else if (t < 180) score += 12;
      else if (t < 300) score += 6;
    }

    var taken2 = +stats.taken || 0;
    if (taken2 < 50)        score += 15;
    else if (taken2 < 200)  score += 10;
    else if (taken2 < 500)  score += 5;

    var mc = +stats.maxCombo || 0;
    if (mc >= 30)      score += 10;
    else if (mc >= 15) score += 6;
    else if (mc >= 8)  score += 3;

    var deaths = +stats.deaths || 0;
    score -= deaths * 12;

    if (score >= 85) return 'S';
    if (score >= 65) return 'A';
    if (score >= 40) return 'B';
    return 'C';
  }

  function buildStatsGrid(stats) {
    var g = el('div', 'cm-stats');
    var rows = [
      ['Time',       fmtTime(stats.time)],
      ['Damage',     fmtNum(stats.damage)],
      ['Taken',      fmtNum(stats.taken)],
      ['Hits',       fmtNum(stats.hits)],
      ['Max Combo',  fmtNum(stats.maxCombo)],
      ['Deaths',     fmtNum(stats.deaths)]
    ];
    for (var i = 0; i < rows.length; i++) {
      g.appendChild(el('div', 'k', rows[i][0]));
      g.appendChild(el('div', 'v', rows[i][1]));
    }
    return g;
  }

  function show(stats) {
    stats = stats || {};
    var win = stats.outcome === 'victory';
    var rating = computeRating(stats);

    var r = ensureRoot();
    while (r.firstChild) r.removeChild(r.firstChild);

    var panel = el('div', 'cm-panel');

    panel.appendChild(el('div', 'cm-sub', win ? 'Trial Cleared' : 'Trial Failed'));
    var title = el('h1', 'cm-title' + (win ? ' cm-victory' : ' cm-dead'),
                   win ? 'VICTORY' : 'YOU DIED');
    panel.appendChild(title);

    var rateBox = el('div', 'cm-rating r-' + rating, rating);
    panel.appendChild(rateBox);

    panel.appendChild(buildStatsGrid(stats));

    var row = el('div', 'cm-btn-row');
    if (win) {
      var bNext = el('button', 'cm-btn cm-primary', 'Continue');
      bindBtn(bNext, stats.onNext || stats.onRetry || null);
      row.appendChild(bNext);
    } else {
      var bRetry = el('button', 'cm-btn cm-primary', 'Retry');
      bindBtn(bRetry, stats.onRetry || null);
      row.appendChild(bRetry);
    }
    var bMain = el('button', 'cm-btn', 'Main Menu');
    bindBtn(bMain, stats.onMain || null);
    row.appendChild(bMain);
    panel.appendChild(row);

    r.appendChild(panel);
    r.classList.remove('cm-hidden');

    sfx(win ? 'ui_victory' : 'ui_defeat');
  }

  function hide() {
    if (!_root) return;
    _root.classList.add('cm-hidden');
    while (_root.firstChild) _root.removeChild(_root.firstChild);
  }

  global.ResultScreen = {
    show: show,
    hide: hide,
    computeRating: computeRating
  };
})(typeof window !== 'undefined' ? window : this);
