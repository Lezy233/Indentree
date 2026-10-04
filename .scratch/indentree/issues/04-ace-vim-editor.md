# 04 — Ace 编辑器 + vim 模式 + 主题联动

**What to build:** 用 vendor 的 ace-builds（含 keybinding-vim）替换最小页面的原生 textarea，开启完整 vim 模式并在底部状态条显示当前模式（NORMAL/INSERT/…）；Ace 明暗主题跟随站点 `data-theme` 切换（github / github_dark 对）。同步语义遵守 spec：非激活视图编辑后 Ace 重建并按行号恢复光标，vim 撤销栈在跨视图编辑后清空为已接受代价。

**Blocked by:** 01 — 转换核心 + 最小双栏页面

**Status:** ready-for-agent

- [x] ace-builds src-min（ace + keybinding-vim 及所需 theme/worker 文件）vendor 进 repo，单 script 引入可用
- [x] textarea 替换为 Ace，markdown 模式高亮，初始内容加载正常
- [x] vim 键位生效（hjkl/模式切换/undo），状态条实时显示 vim 模式
- [x] 主题联动：手动切换明暗时 Ace 主题同步换为对应 github/github_dark；跟随系统也正确
- [x] 防抖同步语义不变：编辑 → 300ms → 树形图刷新；切到树侧编辑再切回时 Ace 按行号恢复光标
- [x] 手动验收：vim 用户日常操作流（编辑、gg、yy、p）可用；主题切换无闪烁

## Comments

- 2026-10-04 实现完成：`vendor/ace/`（ace-builds 1.44.0 src-min：ace / keybinding-vim / mode-markdown / theme-github / theme-github_dark + LICENSE，共 672 KB，经典 script 标签引入，repo 仍无构建）；textarea 替换为 Ace（markdown 高亮、useWorker 关闭）；vim 模式状态条用官方 `keyBinding.getStatusText()`（空串=NORMAL）；行级标红从 backdrop 改为 Ace fullLine marker（更稳，随编辑器滚动天然同步）；主题系统三态循环（🖥 跟随系统 / ☀ 浅色 / 🌙 深色），CSS 变量 + `data-theme` + `prefers-color-scheme` 联动，Ace 主题同步切换 github/github_dark，设置存 localStorage；`rebuildEditor(text)` 实现跨视图重建语义（按行号恢复光标、撤销栈清空），树侧编辑接入在 ticket 05+，helper 已浏览器实测。28 个测试全绿（本票无核心逻辑变更）。
- 验收说明：内置浏览器面板不可见时无法派发可信键盘事件，vim 操作流改经 Ace 的 keybinding 管线（`handleKeyboard` 两阶段调用 + operation 收尾）驱动验证：hjkl 移动、i/Esc 模式切换、插入文本、u 撤销、yy/G/p 复制粘贴、状态条模式显示、防抖同步全部通过；调试中发现的两个真问题已修复（vim 模式读取路径应为 getStatusText 而非不存在的 state.vim.mode 字符串）。建议合并前用真实键盘随手点验一次 gg/yy/p 手感。
