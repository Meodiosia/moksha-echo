// role3_skills.js 损坏恢复说明
//
// 请按照以下步骤恢复：
// 1. 打开 http://localhost:8765/skill_editor.html
// 2. 点击左侧 "飞剑使 (玩家)" 展开所有技能
// 3. 查看参数值是否是你想要的
// 4. 配置完后，你需要从备份恢复原始 role3_skills.js
//
// 如果你没有备份，请联系开发者恢复原始文件
// 原始文件位置：game/role3/role3_skills.js
//
// 临时方案：
// 1. 禁用下面的配置注入代码
// 2. 直接在 role3_skills.js 里手动修改数字：
//    - cdL = 15.5
//    - cdAtk2 = 12
//    - cdAtk4 = 16
//    - cdM = 10.5
//    - cdU = 18
//    - cdN = 11
//    - cdAtk1 = 0.25

// 配置块（暂时禁用）
const ROLE3_SKILL_CONFIG = {
  Atk1:  { cdBase: 0.25 },
  L:     { cdBase: 15.5 },
  O:     { cdBase: 12 },
  Atk4:  { cdBase: 16 },
  M:     { cdBase: 10.5 },
  U:     { cdBase: 18 },
  N:     { cdBase: 11 },
};

// 简单覆盖方法：在 DOMContentLoaded 后修改 role3 对象的 cd 属性
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const r3 = window.role3;
    if(!r3) return;
    
    // 直接设置基础 CD（如果 skills.js 使用 this._cd(x) 赋值）
    // 这里我们通过修改 _cd 函数来拦截
    const origCd = r3._cd;
    if(typeof origCd === 'function'){
      r3._cd = function(base){
        // 0.28/0.25/0.35 -> 0.25 (Atk1)
        if(base === 0.28 || base === 0.25 || base === 0.35) return 0.25;
        // 6.0 -> 15.5 (L)
        if(base === 6.0) return 15.5;
        // 4.0 -> 12 (O)
        if(base === 4.0) return 12;
        // 8.0 -> 16 (Atk4)
        if(base === 8.0) return 16;
        // 6.0 -> 10.5 (M)
        if(base === 6.0) return 10.5;
        // 25.0 -> 18 (U)
        if(base === 25.0) return 18;
        // 12.0 -> 11 (N)
        if(base === 12.0) return 11;
        return origCd(base);
      };
      console.log('[role3] CD 配置覆盖生效');
    }
  }, 500);
});
