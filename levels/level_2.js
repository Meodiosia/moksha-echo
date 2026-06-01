// ── levels/level_2.js ─────────────────────────────────────────
// 第 2 关：熔火回廊（Molten Corridor）
//
// 形状：西侧长走廊 + 东侧圆形 Boss 竞技场（区别于 1 关的对称大厅）
// tile 语义：0 = 虚空（不可走），1 = 地面（可走），与 GROUND_MASK 同
// 复用 map_atlas.js 的 PROP_DEFS（不新增绘制代码）
//
// 暴露：window.LEVEL_2
// ──────────────────────────────────────────────────────────────
(function () {
  const T = 24;
  const W = 72;
  const H = 48;

  // ── 1. 生成 mapData ───────────────────────────────────────
  const mapData = [];
  for (let y = 0; y < H; y++) {
    const row = new Array(W).fill(0);
    mapData.push(row);
  }

  function carveRect(x0, y0, x1, y1) {
    for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++)
      for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++)
        mapData[y][x] = 1;
  }

  function carveDisc(cx, cy, r) {
    const r2 = r * r;
    for (let y = Math.max(0, cy - r); y <= Math.min(H - 1, cy + r); y++)
      for (let x = Math.max(0, cx - r); x <= Math.min(W - 1, cx + r); x++) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy <= r2) mapData[y][x] = 1;
      }
  }

  // 主走廊：x ∈ [6, 44]，y ∈ [21, 26]（6 tile 高）
  carveRect(6, 21, 44, 26);

  // 走廊起点小室（玩家入口）
  carveRect(4, 19, 10, 28);

  // 走廊中段两侧壁龛（用于摆烛台/火盆）
  carveRect(18, 18, 22, 20);   // 北
  carveRect(18, 27, 22, 29);   // 南
  carveRect(30, 18, 34, 20);   // 北
  carveRect(30, 27, 34, 29);   // 南

  // 收口（走廊→竞技场之间的窄门）
  carveRect(43, 22, 47, 25);

  // 圆形 Boss 竞技场：中心 (55,24)，半径 11
  carveDisc(55, 24, 11);

  // ── 2. 配置 ───────────────────────────────────────────────
  const LEVEL_2 = {
    id: 2,
    name: '熔火回廊',
    mapW: W,
    mapH: H,
    tile: T,

    // 二维 tile id 数组（与 1 关 GROUND_MASK 同结构语义）
    mapData: mapData,

    // 玩家出生点（红框位置：竞技场左侧）
    spawnPoint: { x: 48 * T, y: 27 * T },

    // Boss 出生点（蓝框位置：竞技场中右侧）
    bossSpawn: { type: 'lucia', x: 53 * T, y: 27 * T },

    // 小怪刷新点（像素坐标，type 与 enemies/ 系统对齐）
    enemySpawns: [
      // 走廊段：两批近战怪
      { type: 'monster', x: 14 * T, y: 24 * T, count: 2 },
      { type: 'monster', x: 26 * T, y: 24 * T, count: 2 },
      // 走廊壁龛上的弓手（远程压制）
      { type: 'archer',  x: 20 * T, y: 19 * T },
      { type: 'archer',  x: 32 * T, y: 28 * T },
      // 竞技场入口前哨
      { type: 'monster', x: 45 * T, y: 23 * T, count: 2 },
      // 竞技场环形位（Boss 召唤位）
      { type: 'archer',  x: 55 * T, y: 15 * T },
      { type: 'archer',  x: 55 * T, y: 33 * T },
    ],

    // 氛围装饰：复用 map_atlas.js PROP_DEFS 的 type
    // {type, tx, ty} 与 ANCHOR_PROPS 同格式，可被 generateLevelProps 直接消费
    ambientProps: [
      // 走廊起点：双火盆柱（守门）
      { type: 'pillarTorch', tx: 6,  ty: 20 },
      { type: 'pillarTorch', tx: 6,  ty: 27 },

      // 走廊壁龛火祭坛
      { type: 'altarFire',   tx: 20, ty: 19 },
      { type: 'altarFire',   tx: 20, ty: 28 },
      { type: 'altarFire',   tx: 32, ty: 19 },
      { type: 'altarFire',   tx: 32, ty: 28 },

      // 走廊每段烛台节奏
      { type: 'candelabra',  tx: 12, ty: 22 },
      { type: 'candelabra',  tx: 12, ty: 26 },
      { type: 'candelabra',  tx: 26, ty: 22 },
      { type: 'candelabra',  tx: 26, ty: 26 },
      { type: 'candelabra',  tx: 38, ty: 22 },
      { type: 'candelabra',  tx: 38, ty: 26 },

      // 收口窄门：双链石柱
      { type: 'pillarChain', tx: 43, ty: 22 },
      { type: 'pillarChain', tx: 43, ty: 25 },

      // 竞技场环形列柱（半径 ~9，避开 Boss 中心）
      { type: 'pillarLion',  tx: 47, ty: 18 },
      { type: 'pillarLion',  tx: 47, ty: 30 },
      { type: 'pillarLion',  tx: 63, ty: 18 },
      { type: 'pillarLion',  tx: 63, ty: 30 },
      { type: 'pillarA',     tx: 55, ty: 15 },
      { type: 'pillarB',     tx: 55, ty: 33 },

      // 竞技场北/南方尖碑
      { type: 'obeliskHigh', tx: 51, ty: 16 },
      { type: 'obeliskHigh', tx: 59, ty: 16 },
      { type: 'obeliskA',    tx: 51, ty: 31 },
      { type: 'obeliskB',    tx: 59, ty: 31 },

      // 竞技场中心地纹（Boss 召唤印）
      { type: 'floorSeal1',  tx: 54, ty: 23 },

      // 竞技场背景大拱门（Boss 身后）
      { type: 'archGate',    tx: 53, ty: 14 },
    ],

    bgColor: '#0c0608',

    description:
      '熔火回廊：自西向东的狭长熔岩石廊，尽头是露西亚把守的圆形祭场。' +
      '走廊壁龛中燃着永不熄灭的紫焰，地面残留前来挑战者的烬骨。',
  };

  // 暴露
  if (typeof window !== 'undefined') window.LEVEL_2 = LEVEL_2;
  if (typeof module !== 'undefined' && module.exports) module.exports = LEVEL_2;
})();
