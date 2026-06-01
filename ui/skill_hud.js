/* skill_hud.js — canvas-drawn skill HUD (bottom-right of 800x560)
 * Exposes window.SkillHUD
 *
 * API:
 *   SkillHUD.render(ctx, player)
 *
 * Reads from player:
 *   cdHolyCharge, cdTwinMoon, cdSanctuary, sanctuaryT, dashCooldown
 *
 * Layout: 8 icons mapped to keys J K L I U O P N
 *   J  Light Attack    (no cd)
 *   K  Heavy / Holy Charge       -> cdHolyCharge
 *   L  Twin Moon                 -> cdTwinMoon
 *   I  Sanctuary (active+cd)     -> sanctuaryT (active) / cdSanctuary (cd)
 *   U  Dash                      -> dashCooldown
 *   O  Block / Parry             (no cd)
 *   P  Ultimate (placeholder)
 *   N  Item / Heal (placeholder)
 */
(function (global) {
  'use strict';

  // Approximate cooldown caps used to render fill ratios when a skill exposes
  // only a remaining-time scalar. Tweak via SkillHUD.config.maxCD.
  var DEFAULT_MAX = {
    cdHolyCharge: 4.0,
    cdTwinMoon:   6.0,
    cdSanctuary:  10.0,
    sanctuaryT:   3.0,    // active duration
    dashCooldown: 0.8
  };

  var SLOTS = [
    { key: 'J', label: 'J', icon: '⚔', name: 'Slash',     field: null,            max: 0  },
    { key: 'K', label: 'K', icon: '⚡', name: 'Holy',      field: 'cdHolyCharge',  max: DEFAULT_MAX.cdHolyCharge },
    { key: 'L', label: 'L', icon: '🌙', name: 'TwinMoon',  field: 'cdTwinMoon',    max: DEFAULT_MAX.cdTwinMoon   },
    { key: 'I', label: 'I', icon: '☀',  name: 'Sanctuary', field: 'cdSanctuary',   max: DEFAULT_MAX.cdSanctuary, activeField:'sanctuaryT', activeMax:DEFAULT_MAX.sanctuaryT },
    { key: 'U', label: 'U', icon: '✦',  name: 'Dash',      field: 'dashCooldown',  max: DEFAULT_MAX.dashCooldown },
    { key: 'O', label: 'O', icon: '🛡', name: 'Block',     field: null,            max: 0 },
    { key: 'P', label: 'P', icon: '★',  name: 'Ultimate',  field: null,            max: 0 },
    { key: 'N', label: 'N', icon: '✚',  name: 'Heal',      field: null,            max: 0 }
  ];

  var CFG = {
    cellW: 38,
    cellH: 38,
    gap:   6,
    pad:   10,
    canvasW: 800,
    canvasH: 560,
    maxCD: DEFAULT_MAX
  };

  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

  function getSlotState(slot, player) {
    // Returns { active:bool, ratio:0..1 (mask coverage), label:string|null }
    if (!player) return { active:false, ratio:0, label:null };

    // Sanctuary special: active duration drawn as a different color
    if (slot.activeField) {
      var at = +player[slot.activeField] || 0;
      if (at > 0) {
        var amax = slot.activeMax || 1;
        return { active:true, ratio: clamp01(at / amax), label: at.toFixed(1), kind:'active' };
      }
    }

    if (!slot.field) return { active:false, ratio:0, label:null };
    var t = +player[slot.field] || 0;
    if (t <= 0) return { active:false, ratio:0, label:null };
    var max = slot.max || 1;
    return { active:false, ratio: clamp01(t / max), label: t < 10 ? t.toFixed(1) : String(Math.round(t)), kind:'cd' };
  }

  function drawSlot(ctx, x, y, w, h, slot, st) {
    // background
    ctx.fillStyle = '#1a0a08';
    ctx.fillRect(x, y, w, h);

    // border
    ctx.strokeStyle = st.active ? '#ffcc66' : '#5a1a14';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    // inner glow when active
    if (st.active) {
      ctx.save();
      ctx.shadowColor = '#ff8a40';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = 'rgba(255,138,64,.6)';
      ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
      ctx.restore();
    }

    // icon (emoji/unicode)
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '18px "Segoe UI Emoji","Apple Color Emoji",sans-serif';
    ctx.fillStyle = st.active ? '#ffd9a8' : '#f3d7c2';
    ctx.fillText(slot.icon, x + w / 2, y + h / 2 - 2);
    ctx.restore();

    // CD gray mask (top-down fill = remaining)
    if (!st.active && st.ratio > 0) {
      var mh = (h - 2) * st.ratio;
      ctx.fillStyle = 'rgba(0,0,0,0.62)';
      ctx.fillRect(x + 1, y + 1, w - 2, mh);
      // sweep edge
      ctx.fillStyle = 'rgba(255,138,64,0.35)';
      ctx.fillRect(x + 1, y + 1 + mh - 1, w - 2, 1);
    }

    // active duration mask (bottom-up amber)
    if (st.active && st.ratio > 0) {
      var mhA = (h - 2) * st.ratio;
      ctx.fillStyle = 'rgba(255,170,80,0.22)';
      ctx.fillRect(x + 1, y + h - 1 - mhA, w - 2, mhA);
    }

    // remaining seconds label
    if (st.label) {
      ctx.save();
      ctx.font = 'bold 10px "Consolas","Courier New",monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = st.active ? '#ffe2b8' : '#ffd9a8';
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.lineWidth = 3;
      var tx = x + w / 2, ty = y + h / 2 + 2;
      ctx.strokeText(st.label, tx, ty);
      ctx.fillText(st.label, tx, ty);
      ctx.restore();
    }

    // key hint (top-left corner)
    ctx.save();
    ctx.font = 'bold 9px "Consolas","Courier New",monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(x + 1, y + 1, 11, 10);
    ctx.fillStyle = '#ff8a40';
    ctx.fillText(slot.label, x + 3, y + 2);
    ctx.restore();
  }

  function render(ctx, player) {
    if (!ctx) return;
    var n = SLOTS.length;
    var w = CFG.cellW, h = CFG.cellH, g = CFG.gap;
    var totalW = n * w + (n - 1) * g;
    var x0 = CFG.canvasW - CFG.pad - totalW;
    var y0 = CFG.canvasH - CFG.pad - h;

    ctx.save();
    // backing strip for legibility
    ctx.fillStyle = 'rgba(20,8,6,0.45)';
    ctx.fillRect(x0 - 6, y0 - 6, totalW + 12, h + 12);
    ctx.strokeStyle = 'rgba(255,138,64,0.18)';
    ctx.strokeRect(x0 - 5.5, y0 - 5.5, totalW + 11, h + 11);

    for (var i = 0; i < n; i++) {
      var slot = SLOTS[i];
      var st = getSlotState(slot, player);
      drawSlot(ctx, x0 + i * (w + g), y0, w, h, slot, st);
    }
    ctx.restore();
  }

  global.SkillHUD = {
    render: render,
    config: CFG,
    slots: SLOTS
  };
})(typeof window !== 'undefined' ? window : this);
