# 03 — 树形图自定义（四符号 + 预设 + 抽屉 + localStorage/URL）

**What to build:** gtree 式分支符号自定义——树形图面板的 ⚙ 按钮打开二级抽屉，提供中间分支、末分支、竖线、横线四个输入框（可改样式与长度）及三组预设（经典 ├── / 单线 ├─ / 无框）；修改即刻重渲染当前树；自定义值存 localStorage，并以 URL 参数形式可分享。

**Blocked by:** 01 — 转换核心 + 最小双栏页面

**Status:** ready-for-agent

- [x] 树→树形图文本的渲染参数化：四符号可独立传入，测试覆盖自定义符号与横线长度
- [x] 抽屉二级界面：打开/关闭，四个输入框 + 预设按钮，不遮挡主工作区
- [x] 自定义值变更即重渲染树形图；预设一键切换
- [x] 自定义值持久化到 localStorage，刷新后恢复；URL 参数可载入并覆盖
- [x] 手动验收：改横线长度为长横线，树形图即时变化；刷新后仍在；带参数打开 URL 生效

## Comments

- 2026-10-04 实现完成：新增 `src/tree-symbols.mjs`（纯函数：DEFAULT_SYMBOLS、三组预设、resolveSymbols 合并（默认 < localStorage < URL）、symbolsFromSearch/symbolsToSearch）；`renderTreeText` 子级前缀改为按实际连接线宽度计算，多字符符号（如 `├╌`）子级依然对齐；页面右栏加面板标题栏 + ⚙ 抽屉（四符号输入 + 横线长度 1-8 + 三预设 + 复制分享链接），抽屉推开渲染区而非遮挡。新增 8 个测试（共 28 个全绿）。浏览器手动验收：hlen 2→6 即时生效；刷新后恢复；「单线」预设一键切换；`?branch=+&last=\`&vertical=|&horizontal=-&hlen=3` 打开即生效并写穿 localStorage。
- 已知取舍：URL 参数语义为「最后来源胜出」——带参打开即写穿 localStorage（刷新不丢）；宽字符（CJK）符号按 UTF-16 长度对齐，等宽字体下可能视觉错位，预设均为标准制表符不受影响。
