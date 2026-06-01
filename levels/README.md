# levels/

存放关卡布局配置 JS 文件。

## 文件命名

```
level_{name}.js
```

例：
```
level_hell_arena.js     # 当前默认地图（熔岩竞技场）
level_ice_cavern.js     # 新地图
level_blood_temple.js
```

## 文件内容（推荐结构）

```js
const LEVEL_HELL_ARENA = {
  // 资源路径（相对 game/）
  ground:     'ground_clean.png',
  groundMask: GROUND_MASK,        // 已 include 的 mask
  back:       'back.png',

  // 地图尺寸
  mapW: 72,
  mapH: 48,
  tile: 24,

  // 玩家/Boss 出生点（tile 坐标）
  playerSpawn: { tx: 36, ty: 38 },
  bossSpawn:   { tx: 36, ty: 10 },

  // 装饰锚定
  anchorProps: [
    { type:'archGate',   tx:34, ty:6 },
    { type:'altarFire',  tx:28, ty:11 },
    // ...
  ],

  // 关联的 Boss 类型（多 Boss 系统用）
  boss: 'knight',

  // 关联的小怪类型
  enemyTypes: ['basic'],
  enemyCount: 8,

  // 氛围参数（可覆盖 map_atlas.js 默认）
  atmosphere: {
    fireHue: 28,            // 篝火色调
    embersColor: '#FFB55A', // 余烬颜色
    lightning: true,        // 远雷闪光
    vignetteStrength: 0.35,
  },
};
```

## 接入步骤

1. 把 `level_xxx.js` 放进此目录
2. 在 `demo-3c.html` `<head>` 加：
   ```html
   <script src="levels/level_xxx.js"></script>
   ```
3. 改造 `map_atlas.js` 的 `loadAtlas/finishMap` 接收 level 配置：
   ```js
   const LEVELS = { hell_arena: LEVEL_HELL_ARENA, ice_cavern: LEVEL_ICE_CAVERN };
   let currentLevel = LEVELS.hell_arena;
   ```
4. 加一个切换关卡函数 `switchLevel(name)`：清场 → 重建 mapCanvas → 重新摆装饰

## 当前 PROP_DEFS 复用

`map_atlas.js` 里的 `PROP_DEFS` 是全局共享的 prop 类型表（柱子/雕像等基于 stones/）。
不同关卡共享同一套 stone sprite，只是 anchorProps 摆放位置不同。

如果新关卡有专属装饰（如冰晶/血祭坛），扩展 `PROP_DEFS` 加新 type 即可。
