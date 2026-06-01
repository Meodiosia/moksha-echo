# 生产管线总览

```
f:\project\
├── map\                           源美术（设计稿/图集源文件）
│   ├── ground.png                 关卡地面
│   ├── back.png                   背景层
│   ├── stone.png                  装饰图集
│   └── stones\                    切分输出（Python 自动生成）
│
├── slice_stone.py                 【工具】图集切分
├── gen_ground_mask.py             【工具】生成 mask + 抠透明
│
└── game\                          运行时（直接被 HTML 加载）
    ├── demo-3c.html               主程序
    ├── map_atlas.js               关卡系统
    ├── ground_clean.png / back.png / stones/   美术资源
    ├── ground_mask.js             可走 mask 数据
    ├── mask_editor.html           【工具】手工修 mask
    │
    ├── bosses/                    Boss 帧资源（看 README）
    ├── enemies/                   小怪帧资源（看 README）
    └── levels/                    关卡布局配置（看 README）
```

---

## 添加资源工作流

### 添加新地图

1. 美术放 `map/ground_xx.png`（白底+熔岩+石板平台）
2. 改 `gen_ground_mask.py` 顶部 `SRC` 路径
3. 跑 `py -3 gen_ground_mask.py`
4. 输出会到 `game/ground_mask_xx.js` + `ground_clean_xx.png`
5. 写 `game/levels/level_xx.js` 配置 anchorProps 等
6. 在 `demo-3c.html` 引入新 level，调 `switchLevel('xx')`

### 添加新装饰

1. 把新装饰加到 `map/stone.png`（同一图集）
2. 跑 `py -3 slice_stone.py`
3. 把 `map/stones/*.png` 复制到 `game/stones/`
4. 在 `map_atlas.js` 的 `PROP_DEFS` 加新 type，引用对应 `id:NN`

### 添加新 Boss

1. 帧资源 → `game/bosses/xx_src.js`
2. 在 `demo-3c.html` 引入
3. 写 `_loadXxFrames` 加载逻辑
4. 在 `_execBossAttack` 加新攻击 case

### 添加新小怪

1. 帧资源 → `game/enemies/xx_src.js`
2. 在 `demo-3c.html` 引入
3. 写 `ENEMY_TYPES.xx = {...}` 配置
4. `spawnEnemy(x,y,'xx')` 即可生成

---

## 工具速查

| 命令 | 作用 |
|------|------|
| `py -3 slice_stone.py` | 切 stone.png → 独立 PNG |
| `py -3 gen_ground_mask.py` | 生成可走 mask + 抠透明 |
| 浏览器打开 `mask_editor.html` | 手工精修 mask（绿/红涂改） |

---

## 常用调参位置

| 内容 | 文件 | 关键字 |
|------|------|--------|
| 玩家速度 | `demo-3c.html` | `SPEED = (player.sprinting ? 80 : 45)` |
| Boss 速度 | `demo-3c.html` | `mvSpd=36` / `chSpd=315` |
| 小怪速度 | `demo-3c.html` | `ENEMY_PATROL_SPD / ENEMY_CHASE_SPD` |
| 角色尺寸 | `demo-3c.html` | `CHAR_H=28` / `BOSS_H=88` |
| 地图尺寸 | `demo-3c.html` | `MAP_W=72, MAP_H=48` |
| 装饰布局 | `map_atlas.js` | `ANCHOR_PROPS = [...]` |
| 装饰类型 | `map_atlas.js` | `PROP_DEFS = {...}` |
| 氛围效果 | `map_atlas.js` | `drawHellAtmosphere` |
