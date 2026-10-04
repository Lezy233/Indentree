# 04 — Ace 编辑器 + vim 模式 + 主题联动

**What to build:** 用 vendor 的 ace-builds（含 keybinding-vim）替换最小页面的原生 textarea，开启完整 vim 模式并在底部状态条显示当前模式（NORMAL/INSERT/…）；Ace 明暗主题跟随站点 `data-theme` 切换（github / github_dark 对）。同步语义遵守 spec：非激活视图编辑后 Ace 重建并按行号恢复光标，vim 撤销栈在跨视图编辑后清空为已接受代价。

**Blocked by:** 01 — 转换核心 + 最小双栏页面

**Status:** ready-for-agent

- [ ] ace-builds src-min（ace + keybinding-vim 及所需 theme/worker 文件）vendor 进 repo，单 script 引入可用
- [ ] textarea 替换为 Ace，markdown 模式高亮，初始内容加载正常
- [ ] vim 键位生效（hjkl/模式切换/undo），状态条实时显示 vim 模式
- [ ] 主题联动：手动切换明暗时 Ace 主题同步换为对应 github/github_dark；跟随系统也正确
- [ ] 防抖同步语义不变：编辑 → 300ms → 树形图刷新；切到树侧编辑再切回时 Ace 按行号恢复光标
- [ ] 手动验收：vim 用户日常操作流（编辑、gg、yy、p）可用；主题切换无闪烁

## Comments
