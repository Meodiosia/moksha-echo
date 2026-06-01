# bosses/

存放 Boss 帧资源 JS 文件。

## 文件命名

```
{name}_src.js          # 主资源（帧的 base64 字符串）
{name}_frames.js       # 动画分组配置（可选，简单 boss 可合并到 _src.js）
```

例：
```
knight_src.js          # 已存在的骑士 Boss（暂在 game/ 根目录，未来挪进来）
dragon_src.js          # 新 Boss
```

## 资源内容（参考 knight_src.js）

每个 Boss 必须导出一个全局对象：

```js
const DRAGON_FRAMES = {
  idle:  ['data:image/png;base64,...', '...', '...'],   // 4-6 帧
  walk:  ['...', '...', '...', '...'],                  // 6-8 帧
  atk1:  [...],                                         // 5-8 帧（普攻）
  atk2:  [...],                                         // 6-10 帧
  atk3:  [...],                                         // 6-10 帧
  hurt:  [...],                                         // 2-3 帧
  dead:  [...],                                         // 6-8 帧
};
```

## 接入步骤

1. 把 `dragon_src.js` 放进此目录
2. 在 `demo-3c.html` `<head>` 加：
   ```html
   <script src="bosses/dragon_src.js"></script>
   ```
3. 在 `_loadKnightFrames` 附近写 `_loadDragonFrames`
4. 在 `_execBossAttack(type)` 添加新攻击 case
5. （未来）改成 `BOSSES[]` 配置表，支持多 Boss 切换
