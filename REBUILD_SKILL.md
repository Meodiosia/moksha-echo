# Moksha Echo · 解脱回声 — 重构 Skill 文档

精准复现当下完成度。给 AI/工程师**严格按规范重建**用，含每一项参数、键位、行为、边界条件、坐标系。

---

## 0. 项目铁律

1. **canvas 内部分辨率固定 800×560**。所有逻辑坐标基于此（CW=800, CH=560）。
2. **等距视角**：`ISO_Y_SCALE = 0.62`（哈迪斯式 3/4 俯视，非严格等距）。
3. **tile 系统**：TILE=24, 关卡 3 是 72×48 tiles。
4. **坐标系**：世界坐标 (wx, wy) → 屏幕 (sx, sy) = `(wx - ox(), (wy - oy()) * ISO_Y_SCALE)`。
5. **渲染顺序**：地面 → boss/角色（按 y 排序）→ 飞剑/血弹/锁链 → 粒子 → fxShapesPool（共享月牙等）→ HUD/血条 → 屏幕 overlay。
6. **物理**：马里奥式（高加速度 + 强摩擦），dt 每帧 `Math.min((ts-lastT)/1000, 0.05)` 截断。
7. **HP 数值已 ×100**：玩家 10000 / Lucia 满血 150000，全场每秒回血 800 HP（`healRate = 800`）。
8. **中心引力**：HOME = (36*24, 24*24)，半径 180，pull 力 `1.95 * mvSpd`（boss）/ `2.1`（玩家 AI），偏离半径外被拉回中心。

---

## 1. 文件结构（必须保留）

```
game/
├── demo-3c.html         # 主游戏文件（主循环 + 物理 + 渲染 + 玩家技能体系入口）
├── mobile_ui.js         # 移动端 UI（摇杆 + 技能盘 + AI/BOSS_AI 按钮 + cover 缩放）
├── player_ai.js         # 玩家 AI 行为树（虚拟输入 _AI_IX/_AI_IY 注入主循环）
├── role3/
│   ├── role3_loader.js  # 帧加载器（ROLE3_IMG[key][i]）
│   ├── role3_swords.js  # 飞剑系统（API + update + draw）
│   ├── role3_skills.js  # 飞剑使技能（doAtk1/doAtk4/doSwordOrbit/...）
│   └── role3_config.js  # （已注释，不再生效）
├── role3_src.js         # ROLE3_FRAME_COUNT 配置
├── role3_swords.png     # 飞剑贴图
├── role3_frames/        # 帧序列（idle/walk/run/atk1/atk2/atk4/atk5/hurt）
├── bosses/
│   ├── lucia_src.js     # Lucia 帧配置
│   └── lucia_boss.js    # Lucia 全部逻辑（≈4400 行）
├── levels/
│   └── level_3.js       # 十字祭坛地图 mapData
├── ground3_clean.png    # 关卡3 地面贴图（1728×1152，map3.png 处理后）
└── ...                  # 其他角色/敌人/编辑器
```

加载顺序（demo-3c.html）：
```
ground_mask → level_3 → map_atlas → lucia_src → lucia_boss
→ knight_src → role3_src → role3_loader → role3_swords → role3_skills
→ player_ai → mobile_ui
```

---

## 2. 玩家：飞剑使（role3）

### 2.1 全局对象 `window.role3`（role3_skills.js）

```js
window.role3 = {
  // CD 计时
  cdAtk1:0, cdAtk4:0, cdL:0, cdU:0, cdN:0, cdM:0, cdB:0, cdV:0,
  // 状态
  orbitStormT: 0,            // M 风暴剩余时长
  chargingO: 0, chargingL: 0, // 蓄力计时（仅 O/L 用）
  combo1T:0, combo2T:0, combo4T:0, // combo buff 计时
  jChainCount:0, jChainTimer:0,    // J 普攻链（3 段攒一次飞剑）
  sanctuaryT: 0,             // V 已废弃改剑阵；保留但永远 0
  MAX_SWORDS: 8,
  jAnimVariant: 0,           // J 三段动画轮换
};
```

### 2.2 飞剑系统（role3_swords.js）

**全局**：`window.role3Swords = []`，`window.role3SwordsAPI = { addOrbit, shoot, drop, getOrbits, count }`。

**飞剑结构**（`_makeSword`）：
```js
{ x, y, vx, vy, angle, spinSpd, state, orbitPhase, orbitR:38, orbitH:-38,
  age:0, life:99, dmg:18, hitDone:false, trail:[],
  shootSpd:380, shootAngle, returnTo, hoverY, hoverT:0.5, dropTarget, dropSpd:0 }
```

**state 枚举**：`orbit` / `shoot` / `return` / `hover` / `dead` / 临时 `_temp:true`（drop 飞剑不算永久数）

**update 逻辑**（updateRole3Swords）：
- `orbit`: orbitPhase += dt*2.2，绕 player 半径 orbitR，y 偏 orbitH + sin(phase)*6，lerp 跟进 dt*8
- `shoot`: 直线飞行 shootSpd，每 50ms `_r3HitTry(x, y, 26, dmg, sword)`，trail 追加并保留 5 段
- `return`: 460/s 朝 player 飞，<14px 切回 orbit + bounceR 微弹
- `hover` / drop: 静悬 hoverT 后下落 dropSpd，命中范围 28，对 boss 22 伤害

**draw 逻辑**（drawRole3Swords）：
- `heavy = mobile || count>=5` → 简化（一次 stroke trail，无 lighter）
- 否则 trail 多段 lighter 渐隐 + 飞剑贴图 + lighter 强化
- 飞剑贴图 `ROLE3_SWORDS_IMG`（role3_swords.png）

**初始化**：切角色 / 加载关卡时推 3 把 orbit 飞剑（`role3SwordsAPI.addOrbit({phase: i/3*PI*2, r:40, h:-36})`）。

**被动**：每 1.0 秒 `role3.gainSword()`（受 MAX_SWORDS=8 限制）。

### 2.3 玩家技能完整列表

| 键 | 名称 | CD | 条件 | 表现 / 数值 |
|---|---|---|---|---|
| **J** | 普攻 / 飞剑射击 | 0.28s | swordCount≥1 | 三段动画轮换（jAnimVariant），消耗 1 把飞剑朝 boss 射出，shootSpd=520（buffed 720），dmg=22（33），3 连击 +1 飞剑（gainSword）+ camShake；空挥时 _emptySlash() |
| **K** | 冲刺 | 3s | 主循环 doDash | 冲刺中消耗一把非主飞剑（onDashConsume），命中加成 50% 概率 +1 剑（onDashHit） |
| **I** | 防御 | — | doDefend | 短暂格挡，配合 defendBlock 系统 |
| **L** | 蓄力剑阵（长按）| 10s | swordCount≥1 | 长按蓄力（chargingL 累加 dt），松开 _releaseL：剑阵 R=95 圆形包围 boss，所有飞剑（除最后 1）朝心射，单剑 dmg=18+charge*20+n*4，AOE +40+n*4 boss 直伤；后摇 0.45s |
| **O** | 蓄力光波（长按）| — | swordCount≥1 | 长按蓄力 chargingO，松开 _releaseO：飞剑朝瞄准方向射，CD 比 L 短 |
| **U** | 大招 | 25s | — | doUltimate：剑数越多伤害越高，全屏剑雨 + 振屏 + 时停 |
| **P** | 天落剑雨 | 12s | — | doAtk4：N = `min(9, 4 + swordCount + (combo2T>0 ? 2 : 0))` 把飞剑从天而降，悬停 0.30s 后落，单剑 26 伤；**N 上限 9（性能限制）** |
| **N** | 召剑爆发 | 12s | — | doSwordCall：剑数 n 决定 cuts=5+n，dmg=32+n*6，多段时停斩 |
| **M** | 飞剑风暴 | 12s | swordCount≥1 | doSwordOrbit：orbitStormT=1.5s，期间所有 orbit 剑半径**直接写 = 原 R × 2.0**（绕过 swords.js lerp，立刻显大），9rad/s 高速旋转，每 50ms `_r3HitTryStorm(s.x, s.y, 28, 12)` 命中，每 50ms 吐 1 颗白/青粒子；结束恢复原 R + crescent 收束圈 |
| **B** | 千机突刺 | 8s | swordCount≥2 | doBladeStep：瞬移到 boss 背后 50px（player.x = bossX + dirX*50），所有 orbit 剑同时朝 boss 刺出形成剑墙（横向偏移每 14px），shootSpd=600 dmg=18，命中点 X 斩 + crescent + 28 直伤 boss |
| **V** | 剑阵齐射 | 15s | swordCount≥1 | doSanctuary（保留方法名）：阶段1（0~0.45s）所有 orbit 剑紧缩到 r=22 高速旋转（14rad/s）+ 持续吐光粒；阶段2（0.45s 起每 80ms 一把）依次朝 boss 飞射 shootSpd=720 dmg=26；后摇结束 crescent + 振屏 |

### 2.4 isBusy 规则（关键）

```js
isBusy(){
  // 普攻收尾期最后 35% 可被技能打断（移动端响应灵敏）
  if(player.state === 'attack' && !chargingO && !chargingL){
    if(player.stateTimer > player.attackDur * 0.35) return true;
  }
  if(defend.active) return true;
  return false;
}
```

### 2.5 按键绑定（demo-3c.html）

KeyJ → doAttack()（其中 currentChar===3 调 role3.doAtk1）
KeyK → doDash()
KeyI → doDefend()
KeyL → 长按 startChargeL() / 松开 _releaseL()
KeyO → 长按 startChargeO() / 松开 _releaseO()
KeyP → role3.doAtk4()
KeyN → role3.doSwordCall()
KeyM → role3.doSwordOrbit()
KeyU → role3.doUltimate()
KeyB → role3.doBladeStep()
KeyV → role3.doSanctuary()  ；Shift+V 切 BOSS_INVINCIBLE 调试
Tab → PlayerAI.toggle()
\\ → 出生点编辑模式
Y → 调试召唤 Lucia / Shift+Y 直接 P3
Shift+V → BOSS_INVINCIBLE 调试

### 2.6 PlayerAI（player_ai.js）

```js
const AI_HOME = { x: 36*24, y: 24*24, pullRadius: 180, maxPull: 2.1 };
TICK = 0.08
```

**默认关闭**（demo-3c.html load 时 `PlayerAI.enabled = false`），由用户点击 AI 按钮 / Tab 启用。

**输入注入**：通过 `window._AI_IX/_AI_IY`，主循环 update 优先级：
```
if(PlayerAI.enabled) ix/iy = _AI_IX/_AI_IY
else if(IS_MOBILE && (_JOY_IX || _JOY_IY)) ix/iy = _JOY_IX/_JOY_IY
else ix/iy = K[KeyW/A/S/D/Arrow*]
```

**决策（_doAttack 优先级）**：
```
1. V (cdV<=0 且 boss 在蓄招中段 0.1<atkPhaseT<0.4 && dist<180) → 圣域反弹（已改剑阵）
2. B (cdB<=0 且 sw>=2 && 130<dist<320) → 千机突刺
3. M (cdM<=0 && dist<120) → 风暴反制
4. U (sw>=6 && cdU<=0) → 大招
5. N (sw>=4 && cdN<=0 && dist<200) → 召剑
6. L (sw>=3 && cdL<=0 && dist<260) → 蓄力 800-1100ms 后释放
7. O (sw>=2 && dist<280) → 蓄力 600-800ms 后释放
8. P (cdAtk4<=0 && dist<250) → 天落
9. J (cdAtk1<=0 && dist<200 && (idle 或 sw>0)) → 普攻
```

**移动**：strafeFlipT 2.8±1.4s 翻转 strafeDir，nearLimit 110/135（aggressive），farLimit 180/230，靠近撤退/远离接近的循环；Y 轴 1px 容差对齐。

---

## 3. Boss：Lucia（lucia_boss.js）

### 3.1 配置常量

```js
LUCIA_PHASES = { 1:{speed:1.0}, 2:{speed:1.15}, 3:{speed:1.45} }
hp 阈值：P1→P2 在 70%，P2→P3 在 28%
window.LUCIA_START_PHASE = 3  // 默认直接 P3
window.BOSS_INVINCIBLE = false  // 调试用
window.BOSS_AI         = true   // 关闭则 boss 站桩，特效继续更新
```

### 3.2 LUCIA_MOVES（招式表）

| Key | anim | dur | hitWin | range | dmg | move | fx | telegraph | 备注 |
|---|---|---|---|---|---|---|---|---|---|
| atk_a | atk_a | 0.95 | 0.30~0.55 | 62 | 12 | 30 | fxLight | (none) | 三段近战 |
| atk_b | atk_b | 1.05 | 0.30~0.55 | 66 | 14 | 35 | fxLight | (none) | |
| atk_c | atk_c | 1.40 | 0.45~0.65 | 72 | 18 | 50 | fxHeavyWhite | (none) | |
| atk2a | atk2a | 1.30 | 0.55~0.72 | 80 | 22 | 50 | fxGroundCrack | red | 高举重劈 |
| atk2b | atk2b | 1.05 | 0.35~0.60 | 78 | 24 | 0 | fxSpinSweep | white | 360 旋斩 AOE（已改红） |
| atk3 | atk3_ghost | 2.00 | 0.40~0.55 | 0 | 18 | 0 | fxRangedBlade | red | 远程 3 剑气，ranged |
| atk4 | atk4 | 2.50 | 多段 | 90 | 18 | 80 | fxBerserkLunge | red | 狂暴突进 multiHit |
| atk4b | atk4b | 1.55 | 0.30~0.65 | 92 | 24 | 55 | fxBerserk | red | 反击斩 |
| atk4c | atk4c | 1.80 | 0.55~0.72 | 130 | 32 | 0 | fxEruption | red_big | 站桩地裂大招 unblockable |
| ult | ult | 3.20 | 0.50~0.70 | 160 | 40 | 0 | fxRangedBlade | red_big | 终极一击 |
| charge | walk → atk_b | 1.85 | — | — | — | — | fxBerserkLunge | red | 突进 |
| pillar_fire | atk2b | 1.85 | 0.45~0.55 | 0 | 0 | 0 | fxPillarCast | red | rangedType:pillar，召火柱 |
| ring_rush | ult | 3.50 | 0.30~0.85 | 0 | 0 | 0 | fxRingSummon | red_big | rangedType:ring_clones，4 分身轮冲 |
| blood_seek | atk3_ghost | 1.85 | 0.45~0.60 | 0 | 0 | 0 | fxRangedBlade | red | rangedType:blood_seek，3 颗追踪弹 |
| blood_chain | atk4c | 2.20 | 0.30~0.45 | 0 | 0 | 0 | fxEruption | red_big | rangedType:blood_chain（已从池移除）|
| shadow_cross | atk3_ghost | 2.10 | 0.45~0.60 | 0 | 0 | 0 | fxRangedBlade | red | rangedType:shadow_cross，分身投剑 |

### 3.3 阶段权重池 LUCIA_PHASE_SKILLS

```js
{
  1: ['atk_a','atk_b','atk_c','atk2a','atk2b','atk3','charge','charge'],
  2: ['atk_a','atk_b','atk_c','atk2a','atk2b','atk3','charge','charge','charge','atk2b','pillar_fire','blood_seek','shadow_cross'],
  3: ['atk_a','atk_b','atk_c','atk2a','atk2b','atk3','charge','charge','charge','charge','atk4','atk4b','atk4c','ult','pillar_fire','pillar_fire','ring_rush','blood_seek','blood_seek','shadow_cross','shadow_cross'],
}
```

**注意**：`blood_chain` spawn/update/draw 函数仍在源码内，但**不在阶段池**（用户认为 UI 太丑）。

### 3.4 _luciaPickAttack 决策

P3 模式：
- ult 仅当 hp/maxHp < 0.5 才允许
- dist<120 强制选近战（`atk_a/b/c/atk2a/atk2b/charge`）；其他 30% 概率
- dist<150 近战技能权重 ×2

P1/P2：
- atk_a/b 仅当 dist<=130
- ult 仅当 hp/maxHp < 0.4

最近 3 个 _skillUsage 中选最少使用的随机一个（cycleIdx 递增）。

### 3.5 fx 函数（LUCIA_FX）

主要：
- `fxLight`: 普通刀光月牙
- `fxHeavyWhite`: 重击月牙 + spike
- `fxSpinSweep`: 4 个红色月牙环绕（**已从白改红**）
- `fxGroundCrack`: 地裂 abyssrift + 红粒子
- `fxBerserkLunge`: 突进 abyssrift 长裂
- `fxRangedBlade`: 远程剑气
- `fxEruption`: 大招地裂喷发
- `fxPillarCast`: 火柱召唤
- `fxRingSummon`: 分身环召

### 3.6 telegraph FX（_luciaTelegraphFX）

**完全使用稳定 FX（crescent + shockwaves + addParticle），禁用 abyssrift/xslash/speedline 单独调用避免 NaN**。

**red_big**（大招预警）：
- shockwaves 双层：r=mv.range*0.3 → maxR*1.1 红，r=mv.range*0.15 → maxR*0.8 白
- crescent 上方 ty-50 大反向月（r=mv.range*0.85, sweep=PI*1.4, spinSpd=6, palette:red）
- crescent 内圈 ty+4 反向月（r=mv.range*0.4, sweep=PI*1.95, spinSpd=-10）
- 22 颗向心红雾粒子
- camShake(0.18, 7)

**white**（旋斩预警，**已改红色调**）：
- shockwaves r=4 → maxR=mv.range*0.95 c=#CC2020
- crescent ×2（r=mv.range, sweep=PI*1.95, spinSpd=10/-14, palette:red）
- 16 颗 #FF6060/#660000 散粒

**red 普通起手**：
- shockwaves r=3 → maxR=mv.range*0.85 c=#CC2020 朝向 facing
- crescent 朝向弯月（r=mv.range*0.55, sweep=PI*0.95, spinSpd=10*facing）
- crescent 脚下小月（r=22, sweep=PI*1.95, spinSpd=-16）
- 8 颗朝向 dirX 红粒子

### 3.7 specialty spawn 函数（关键）

**_luciaSpawnPillars** — 火柱（pillar_fire）：随玩家位置生成 3 火柱预警 → 喷发命中。

**_luciaSpawnRingClones** — 4 分身环冲（ring_rush）：玩家四周生成 4 个 boss 分身，依次冲撞玩家。

**_luciaSpawnBloodSeek** — 血噬（blood_seek）：
- 3 颗血色追踪弹（间隔 0.12s 错峰）
- 缓速追猎 4s，acc=380, vmax=280
- 撞地 80px AOE 爆炸 60 伤
- 命中检测距离 < r+22，爆炸时 22 颗粒子

**_luciaSpawnShadowCross** — 血影双煞（shadow_cross）：
- 锁定玩家位置，左右 SIDE=130 各召 1 个分身（高度 -28）
- **阶段1（0.0s）召唤**：每分身脚下双 shockwave + 22 颗血雾向心 + 头顶 2 反向旋月（r=32 thickness=4 spinSpd=±8 / r=18 thickness=2 spinSpd=±14, palette:red, life=0.85）
- **阶段2（0.5s）蓄力**：crescent 蓄势 ×2 + 8 颗内圈红粒
- **阶段3（0.9s）投剑**：每分身**朝玩家当前位置**投 3 把（±12°），共 6 把 lucia.blades，shootSpd=360, dmg=22, life=1.6, r=14；分身位置 crescent 爆光 + 12 颗血粒
- **阶段4（1.4s）消散**：14 颗暗红粒子四散
- 全程使用 setTimeout 链；**所有 FX 用 crescent**（不用 abyssrift/xslash/speedline）

**_luciaSpawnBloodChain** — 血锁（已从池移除，但函数保留）：
- 锁定玩家位置画 70px 红圈
- 1.2s 预警后 4 条血锁同时收紧
- 玩家可冲刺挣脱（dashDur > 0 免疫）
- 命中 70 伤；strikeT=0.35s, fadeT=0.5s

### 3.8 BOSS_AI 关闭分支

```js
if(window.BOSS_AI === false){
  // boss 站桩 + 不出招，但所有特效系统仍 update
  vx/vy 摩擦衰减 → 0
  state = 'idle'
  调用所有 _luciaUpdate*（Blades, Pillars, Clone, ChargeGhost, RingClones, BloodSeeks, BloodChains, LowHpRage, SkillTexts, DeathPillars）
  return
}
```

### 3.9 主动格挡 _luciaDoParry

P3 每 0.5s 55% 概率主动格挡，闪 + crescent + 弹反提示文字。

### 3.10 中心引力 + Y 轴对齐

HOME = (36*24, 24*24)，半径 180，超过 0.4 倍半径开始拉回，maxPull = `1.95 * mvSpd`（×3 倍原值）。

Y 轴：玩家与 boss yMag<=1px 视为对齐，否则 boss 优先纠正 Y 距离。

---

## 4. 关卡 3（level_3.js）

- 72×48 tile（mapData 二维数组），TILE=24，世界 1728×1152
- **十字祭坛**布局，walkable 为 1（中心十字 + 四角小区），其他为墙
- 玩家出生：tile(6, 24) → 世界 (144, 576)
- Boss 出生：tile(66, 24) → 世界 (1584, 576)
- 关卡进入时：
  - `currentChar = 3`
  - `_activeGroundUrl = 'ground3_clean.png'`（替代 ground/ground2）
  - 禁用 fog / darkness / hellAtmosphere / ambientLights / detailCanvas
  - 不生成小怪
  - boss 直接 P3 起手（hp = 150000 * 0.28）

---

## 5. 移动端 UI（mobile_ui.js + demo-3c.html CSS）

### 5.1 检测

```js
IS_MOBILE = uaMob || (touch && (innerWidth<900 || innerHeight<700))
```

加 `body.mobile` class 激活移动 CSS。

### 5.2 fitCanvas（cover 模式）

```js
const W=innerWidth, H=innerHeight
scaleW = W/800, scaleH = H/560
s = Math.max(scaleW, scaleH)  // cover：填满，超出方向裁切
fitW=floor(800*s), fitH=floor(560*s)
left=floor((W-fitW)/2), top=floor((H-fitH)/2)
设置 wrap.style.left/top/width/height + canvas.style.width/height
```

**不旋转 body**（Safari/微信内核会闪屏，已撤销 force-rotate）。

### 5.3 摇杆（左下）

- area: 38vw（max 220px），fixed left:0 bottom:0
- base: 108px 圆，黑透明 + 金线
- stick: 46px 球形高光
- RADIUS=65, DEAD=0.18
- 触摸点为动态摇杆中心（按下时移 base 到触摸点）
- 输出 `window._JOY_IX/_JOY_IY`

### 5.4 技能盘布局（屏幕右下）

J 中心 (right=49, bottom=47)（J right=10 bottom=8 width=78 height=78）。

**第 1 排** — 主攻 J（独立 fixed）

**第 2 排内圈**（半径 95，间距 25°）：
| 键 | θ | right | bottom |
|---|---|---|---|
| K | 95° | 36 | 121 |
| I | 120° | 76 | 108 |
| O | 145° | 106 | 81 |
| N | 170° | 122 | 42 |
| M | 195° | 120 | 1 |

**第 3 排外圈**（半径 150，间距 22°）：
| 键 | θ | right | bottom |
|---|---|---|---|
| P | 98° | 49 | 175 |
| L | 120° | 103 | 156 |
| U | 142° | 146 | 118 |
| V | 164° | 172 | 67 |
| B | 186° | 177 | 10 |

按钮 42px 直径（U 加大 48px）。

### 5.5 按钮事件

- `touchstart` → 立即 keydown，非长按 50ms 后自动 keyup（视觉 .pressed 保持到 touchend）
- `touchend` → 强制 keyup + 移除 .pressed
- 长按（O/L data-hold=1）：按住期间不自动 keyup，松手才 keyup

### 5.6 CD 显示

`conic-gradient` 圆锥遮罩 `--cd: 0%~100%`，每 80ms 刷新：
```js
CD_MAP = {
  J:{cur:'cdAtk1', max:0.28}, P:{cur:'cdAtk4', max:12}, L:{cur:'cdL', max:10},
  O:null, U:{cur:'cdU', max:25}, N:{cur:'cdN', max:12}, M:{cur:'cdM', max:12},
  B:{cur:'cdB', max:8}, V:{cur:'cdV', max:15}
}
```

### 5.7 AI / BOSS 按钮（顶部）

- 左上 #btn-ai：点切 PlayerAI.toggle()
- 右上 #btn-boss-ai：点切 window.BOSS_AI（默认 true）

### 5.8 性能降级

`IS_MOBILE` 时：
- PARTICLE_MAX 220 → 90
- _addFxShape 上限 35 → 14
- Lucia P3 残影采样跳过
- _luciaDrawAmbience 用纯色椭圆替代 radialGradient
- _luciaDrawScreenOverlay vignette 用纯色 fillRect 替代 radialGradient
- drawRole3Swords heavy=true（无 lighter trail）
- canvas mask-image / box-shadow 媒体查询关闭

### 5.9 触摸阻止

```js
document.addEventListener('touchend', preventDouble)  // 防双击放大
gesturestart/change/end → preventDefault
contextmenu → preventDefault
```

---

## 6. 共享 FX 系统

### 6.1 fxShapesPool（lucia_boss.js 提供）

`window.fxShapesPool = []`
`window._addFxShape(type, x, y, params)`：上限 14（mobile）/ 35（desktop），超出 shift 旧的。

支持 type：
- `crescent`: r, startAng, sweep, thickness, palette('red'/'white'), spinSpd, life
- `slashgash`: 类似 crescent
- `speedline`: angle, len, thickness, palette, life
- `abyssrift`: facing, len, thickness, palette, life **必须传 facing+len，否则 NaN**
- `xslash`: len, thickness, palette, spinSpd, life
- `spike`: count, len, thickness, color, life
- `crackline`: 地裂线
- `spiral`: 螺旋
- `darkring`: 暗环

### 6.2 共享池（玩家/boss）

`particles[]` (PARTICLE_MAX 220/90), `shockwaves[]`, `afterTrail[]`, `camShakeT/Mag`, `hitStopTimer`, `slowMoTimer`。

### 6.3 触发函数

`addParticle(x, y, {n, c, spd, r, life, spread, angle, gravity})`
`shockwaves.push({x, y, r, maxR, life, age:0, c})`
`camShake(magnitude, duration)` ；`triggerHitStop(t)` ；`triggerSlowMo(scale, t)`

---

## 7. 项目名 / 入口

- title: `Moksha Echo · 解脱回声`
- 入口：`demo-3c.html`
- 必须本地 HTTP 服务（非 file://）：`py -3 -m http.server 8765`
- 公网测试：`cloudflared tunnel --url http://localhost:8765`

---

## 8. 已知 caveat（坑）

1. `_strokeAbyssPath` 渲染 `abyssrift/xslash` 时若 `s.len` undefined → NaN 路径污染 canvas。**必须传 len/facing**。
2. body `transform: rotate(90deg)` 在 Safari/微信 X5 内核闪屏 → 不要用，撤销 force-rotate。
3. `K[e.code]` 在 keydown listener 头部 `if(K[code]) return` 会过滤 keyrepeat，**不要在 fireKey 前预设 K**（会被过滤）。
4. role3 切角色时 `role3Swords = []` 后必须 `addOrbit` 3 把，否则普攻空挥死循环。
5. `setTimeout` 链在 boss 死亡/换关卡后仍执行，需 `if(!lucia || lucia.state === 'dead') return` 守卫。
6. 移动端 PARTICLE_MAX 已减半，新加 FX 不要爆量。
7. weapon trail 在 `mobile || count>=5` 时走 heavy 简化分支，不要依赖 lighter 模式效果。
