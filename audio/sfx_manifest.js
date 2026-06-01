/**
 * sfx_manifest.js
 * Central URL registry for all SFX and BGM assets.
 * Uses freesound.org preview URLs as placeholders.
 * Replace with actual CDN URLs before shipping.
 */
window.SFX_MANIFEST = {
  // ── Player ──────────────────────────────────────────────────────────────
  player_hit:             'https://freesound.org/data/previews/514/514044_5121236-lq.mp3',
  player_dash:            'https://freesound.org/data/previews/399/399303_4397472-lq.mp3',
  player_parry:           'https://freesound.org/data/previews/411/411089_5121236-lq.mp3',
  player_parry_perfect:   'https://freesound.org/data/previews/270/270402_5121236-lq.mp3',
  player_block:           'https://freesound.org/data/previews/513/513867_5121236-lq.mp3',
  player_atk1:            'https://freesound.org/data/previews/441/441581_7107620-lq.mp3',
  player_atk2:            'https://freesound.org/data/previews/441/441582_7107620-lq.mp3',
  player_atk3:            'https://freesound.org/data/previews/441/441583_7107620-lq.mp3',
  player_holy_charge:     'https://freesound.org/data/previews/519/519200_5121236-lq.mp3',
  player_twin_moon:       'https://freesound.org/data/previews/462/462087_9497060-lq.mp3',
  player_sanctuary:       'https://freesound.org/data/previews/476/476178_9497060-lq.mp3',
  player_ult_activate:    'https://freesound.org/data/previews/523/523651_5121236-lq.mp3',
  player_death:           'https://freesound.org/data/previews/487/487360_9497060-lq.mp3',

  // ── Boss ─────────────────────────────────────────────────────────────────
  boss_hit:               'https://freesound.org/data/previews/160/160301_2758482-lq.mp3',
  boss_dead:              'https://freesound.org/data/previews/423/423767_7107620-lq.mp3',
  boss_phase_transit:     'https://freesound.org/data/previews/403/403015_7107620-lq.mp3',
  boss_telegraph:         'https://freesound.org/data/previews/366/366111_6829862-lq.mp3',

  // ── Lucia (Boss abilities) ────────────────────────────────────────────────
  lucia_atk_a:            'https://freesound.org/data/previews/209/209942_3797507-lq.mp3',
  lucia_atk_b:            'https://freesound.org/data/previews/209/209943_3797507-lq.mp3',
  lucia_atk_c:            'https://freesound.org/data/previews/209/209944_3797507-lq.mp3',
  lucia_charge:           'https://freesound.org/data/previews/351/351565_6143542-lq.mp3',
  lucia_ult:              'https://freesound.org/data/previews/415/415510_5121236-lq.mp3',
  lucia_pillar:           'https://freesound.org/data/previews/467/467430_9497060-lq.mp3',
  lucia_ring_summon:      'https://freesound.org/data/previews/399/399934_4397472-lq.mp3',
  lucia_clone_spawn:      'https://freesound.org/data/previews/456/456966_9497060-lq.mp3',
  lucia_clone_despawn:    'https://freesound.org/data/previews/456/456967_9497060-lq.mp3',

  // ── UI ───────────────────────────────────────────────────────────────────
  ui_click:               'https://freesound.org/data/previews/220/220206_4100837-lq.mp3',
  ui_hover:               'https://freesound.org/data/previews/220/220173_4100837-lq.mp3',
  ui_open:                'https://freesound.org/data/previews/242/242501_4284968-lq.mp3',
  ui_close:               'https://freesound.org/data/previews/242/242502_4284968-lq.mp3',

  // ── Pickups ──────────────────────────────────────────────────────────────
  heart_pickup:           'https://freesound.org/data/previews/341/341695_5858296-lq.mp3',
  mana_pickup:            'https://freesound.org/data/previews/415/415079_5121236-lq.mp3',

  // ── BGM (longer tracks – streamed differently by BGM manager) ────────────
  bgm_title:              'https://freesound.org/data/previews/320/320655_5260872-lq.mp3',
  bgm_exploration:        'https://freesound.org/data/previews/458/458519_8190645-lq.mp3',
  bgm_boss_phase1:        'https://freesound.org/data/previews/389/389847_1676145-lq.mp3',
  bgm_boss_phase2:        'https://freesound.org/data/previews/389/389848_1676145-lq.mp3',
  bgm_victory:            'https://freesound.org/data/previews/270/270545_5121236-lq.mp3',
};
