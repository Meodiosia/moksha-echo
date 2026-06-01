# enemies/

存放小怪帧资源 JS 文件。

## 文件命名

```
{name}_src.js          # 帧的 base64
```

例：
```
monster_src.js         # 已存在的小怪（暂在 game/ 根目录）
slime_src.js           # 新怪
ghost_src.js
```

## 资源内容

```js
const SLIME_FRAMES = {
  idle: ['data:image/png;base64,...', '...'],   // 2-4 帧
  walk: ['...', '...', '...', '...'],           // 4-6 帧
  atk:  ['...', '...'],                          // 2-4 帧（可选）
  hurt: ['...'],                                 // 1-2 帧
  dead: ['...', '...', '...'],                   // 3-5 帧
};

// 配置（可选，建议附带）
const SLIME_CONFIG = {
  hp: 30,
  speed: 30,
  attackRange: 24,
  attackDmg: 8,
  attackCD: 1.5,
};
```

## 接入步骤

1. 把 `slime_src.js` 放进此目录
2. 在 `demo-3c.html` `<head>` 加：
   ```html
   <script src="enemies/slime_src.js"></script>
   ```
3. 改造 `spawnEnemy(x,y,type)` 接收 type 参数
4. 添加 ENEMY_TYPES 配置表：
   ```js
   const ENEMY_TYPES = {
     basic: { frames: MONSTER_FRAMES, ...MONSTER_CONFIG },
     slime: { frames: SLIME_FRAMES,   ...SLIME_CONFIG   },
   };
   ```

## AI 行为

简单怪可复用现有 `updateEnemies(dt)` 的巡逻+追击逻辑。
特殊行为（远程攻击/分裂/隐身）需要在怪物 update 里加 type 分支。
