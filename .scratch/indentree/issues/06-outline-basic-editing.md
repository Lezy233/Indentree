# 06 — 大纲视图基础渲染 + 行内编辑

**What to build:** 左栏占位变为真大纲视图——按中间树渲染 Notion 式大纲列表：行首拖拽手柄（⠿）、缩进视觉、checkbox；行内直接编辑（双击或 Enter 进入，Esc/失焦保存，Enter 新建同级节点，Tab/Shift+Tab 缩进/取消缩进）；任何结构修改经防抖回流中间树，Markdown 栏与树形图栏跟随刷新。至此宽屏三视图同屏互转闭环成形。

**Blocked by:** 05 — 三栏工作台布局 + VSCode 式面板收放 + 响应式切换

**Status:** ready-for-agent

- [ ] 大纲列表按中间树渲染：层级缩进、手柄、checkbox；初始内容与 Markdown 栏一致
- [ ] 双击进入行内编辑，修改保存后回流中间树，其余两视图 300ms 内刷新
- [ ] Enter 新建同级节点、Tab/Shift+Tab 缩进/取消缩进，行为符合 outline 品类习惯
- [ ] 大纲侧结构操作后，markdown 文本按 kind 正确重生成（标题仍 #、列表仍 -）
- [ ] 手动验收：只在大纲栏操作，完成建结构→改文本→调层级全流程，另两栏同步正确

## Comments
