// ── levels/level_index.js ─────────────────────────────────────
// 关卡注册表 + 查询接口
//
// 加载顺序（HTML）：
//   <script src="levels/level_1.js"></script>   // 若存在
//   <script src="levels/level_2.js"></script>
//   <script src="levels/level_index.js"></script>
//
// 暴露：window.LEVEL_INDEX
// ──────────────────────────────────────────────────────────────
(function () {
  // 收集已注册的关卡（按 id 升序）。
  // 不强依赖 LEVEL_1 是否已实现 — 若缺失自动跳过。
  function collect() {
    const candidates = [
      typeof window !== 'undefined' ? window.LEVEL_1 : null,
      typeof window !== 'undefined' ? window.LEVEL_2 : null,
    ];
    return candidates
      .filter(function (l) { return l && typeof l.id === 'number'; })
      .sort(function (a, b) { return a.id - b.id; });
  }

  const LEVEL_INDEX = {
    list: collect(),

    // 按 id 取关卡配置；未找到返回 null
    get: function (id) {
      for (let i = 0; i < this.list.length; i++)
        if (this.list[i].id === id) return this.list[i];
      return null;
    },

    // 取下一关；末关或未找到返回 null
    next: function (currentId) {
      const idx = this.list.findIndex(function (l) { return l.id === currentId; });
      if (idx < 0 || idx >= this.list.length - 1) return null;
      return this.list[idx + 1];
    },

    // 重新扫描 window.LEVEL_* （脚本异步注入时使用）
    refresh: function () {
      this.list = collect();
      return this.list;
    },
  };

  if (typeof window !== 'undefined') window.LEVEL_INDEX = LEVEL_INDEX;
  if (typeof module !== 'undefined' && module.exports) module.exports = LEVEL_INDEX;
})();
