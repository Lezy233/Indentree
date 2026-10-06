# Indentree：Markdown / 大纲 / 树形图三视图互转工具站 — Spec

Status: ready-for-agent
Seams: ①转换核心纯函数（node:test 自动化）②视图交互层（浏览器手动验收清单）

## Problem Statement

用户经常需要在 Markdown、大纲列表、树形图三种形态之间整理同一份层级内容（题单、知识结构、目录）。市面上的工具每种只覆盖一段：markmap 只做 Markdown→思维导图，tree.nathanfriend.io 只做文本→目录树，Workflowy 类大纲工具不暴露纯文本视图。没有工具做到三者实时互转，更没有「带 vim 模式的 Markdown 编辑 + 可拖拽结构编辑」的组合。用户需要一个打开即用、数据不出本机的纯前端工具站。

## Solution

一个无构建、无框架、原生 JS 的静态站（托管于 github.io）。**中间树**为唯一数据源，三视图皆为它的投影，任一视图编辑后经防抖同步刷新其余视图：

- **Markdown 视图**：Ace 编辑器（内置 vim 模式）编辑原始 Markdown
- **大纲视图**：Notion 式大纲列表——checkbox 多选（Shift 连选、同父约束）、MultiDrag 整体拖拽、拖入式嵌套、Delete 批量删除、行内直接编辑
- **树形图视图**：文本目录树渲染，分支符号（中间分支/末分支/竖线/横线）逐项自定义，入口在二级抽屉

布局：宽屏（≥720px）三栏工作台，三视图同屏，VSCode 式面板（⋮ 分隔条拖拽调宽、推到底自动收起、侧边图标或反向拖拽恢复）；窄屏自动切换为单栏聚焦。主题默认跟随系统、可手动切换明暗。

## User Stories

1. As a 用户，I want to 在 Markdown 视图中用 vim 键位编辑文本，so that 我的编辑效率不被网页工具拖慢
2. As a 用户，I want to 左侧编辑 Markdown 时右侧树形图实时跟随，so that 我能立即看到结构效果
3. As a 用户，I want to 粘贴任意 Markdown（标题层级或列表嵌套写法）并得到正确的树，so that 我不需要预先调整文本格式
4. As a 用户，I want to 标题写法的文档转树后再转回标题写法，so that 我的原始写法（kind）被还原而非被统一改写
5. As a 用户，I want to 节点文本中的行内 Markdown（`**粗体**`、链接）原样保留，so that 往返编辑不丢格式（行内保真）
6. As a 用户，I want to 表格、代码块等块级内容作为叶子块挂在层级下，so that 粘贴真实文档时内容不丢失
7. As a 用户，I want to 解析失败时在文本侧看到行级标红和状态条提示，so that 我能定位并修复问题行
8. As a 用户，I want to 在大纲视图中用 checkbox 选中多个同级节点并整体拖拽，so that 批量结构调整一次完成
9. As a 用户，I want to 选中父节点时其全部后代自动跟随，so that 子树作为一个整体移动/删除，语义符合直觉
10. As a 用户，I want to Shift 连选同级节点、越界时自动截断到同父范围并给出提示，so that 误操作不打断心流且我能学到规则
11. ~~As a 用户，I want to 全选按钮选中所有顶级节点（等效整棵树且满足同父约束），so that 一键全选不引入特例~~（2026-10-08 修订：全选移除）
12. As a 用户，I want to 拖拽落点分 above / inside / below 三区（拖入式嵌套），so that 排序和变子节点用一个手势完成
13. As a 用户，I want to 拖到自身或后代上时显示禁止样式且松手无效，so that 不可能造出循环结构
14. ~~As a 用户，I want to 选中后顶部浮出「n selected」工具栏提供缩进/取消缩进/删除，so that 批量结构操作有明确入口~~（2026-10-08 修订：工具栏移除；多选只服务拖拽与 Delete 批量删除）
15. As a 用户，I want to 双击节点行进入文本编辑、Enter 新建同级、Tab/Shift+Tab 缩进，so that 大纲编辑符合品类肌肉记忆
16. As a 用户，I want to 自定义树形图的分支符号（中间分支/末分支/竖线/横线样式与长度），so that 输出风格适配不同审美/场景
17. As a 用户，I want to 分支符号有几组预设可一键切换，so that 常用风格不需要逐项输入
18. As a 用户，I want to 自定义项存在 localStorage 并可通过 URL 参数分享，so that 刷新不丢且能把风格发给他人
19. As a 用户，I want to 树形图自定义入口藏在二级抽屉里，so that 主界面保持简洁
20. As a 用户，I want to 主题默认跟随浏览器、一键手动切换明暗，so that 白天黑夜都舒适且尊重系统设置
21. As a 用户，I want to 宽屏时三栏同屏、窄屏时自动变单栏分段切换，so that 同一网址在手机浏览器也可用
22. As a 用户，I want to 拖动分栏间的分隔条调整宽度、推到底自动收起、点边缘图标恢复，so that 布局可按任务重心自由调配（VSCode 式面板）
23. As a 用户，I want to 面板宽度和收起状态刷新后保留，so that 我不必每次重新摆布局
24. As a 用户，I want to 编辑任一视图只重渲染其它视图，so that 我正在编辑的视图（含 vim 撤销栈）不被打断

## Implementation Decisions

- 纯前端静态站：无构建、无框架、原生 JS；第三方库全部 vendor 进 repo（markdown-it ESM、ace-builds src-min 含 keybinding-vim、SortableJS 含 MultiDrag），选型依据见 `docs/research/2026-10-04-frontend-tooling-research.md`
- **中间树**为单一数据源：节点 = 原始文本（保留行内 Markdown）+ 子节点列表 + kind（heading / list-item / paragraph / leaf-block）；标题深度与列表缩进统一折叠为父子嵌套，序列化时按 kind 还原写法
- 转换核心为纯函数模块：markdown→中间树（基于 markdown-it token 流）、中间树→markdown、中间树→树形图文本（四符号 + 横线长度参数）；解析失败携带行号
- 同步：激活视图编辑防抖 ≈300ms 落中间树，仅重渲染非激活视图；跨视图编辑后 Ace 重建（按行号恢复光标；vim 撤销栈清空为已接受代价，增量 diff 补丁列为后续优化）
- 布局：≥720px 三栏工作台（大纲 240 / 树 280 默认宽，分隔条拖拽，推到底收起，侧边恢复图标）；<720px 单栏聚焦（分段切换 + 右侧快速切换条）；面板宽度与收起状态持久化 localStorage；交互模型以 `prototype/layout-mock` 分支为 primary source（已浏览器验证）
- 大纲视图：SortableJS MultiDrag；**同父约束** + 选中父节点后代自动跟随；Shift 连选越界截断 + 状态条提示；拖入式嵌套 above/inside/below 三区；非法落点（自身/后代）禁止样式；双击编辑、Enter 新建同级、Tab 缩进（交互决策见 ADR-0001；2026-10-08 修订：多选只服务整体拖拽与 Delete 批量删除，浮动工具栏与全选已移除）
- 树形图自定义：中间分支/末分支/竖线/横线四个输入 + 预设（经典 ├── / 单线 ├─ / 无框）；抽屉二级界面；localStorage + URL 参数分享
- 主题：CSS 自定义属性 + `prefers-color-scheme` 跟随 + `data-theme` 手动覆盖；Ace `github` / `github_dark` 主题联动切换
- 错误反馈：regex101 式——文本侧行级标红 + 底部状态条，不用阻塞弹窗
- 测试与源码同仓零依赖：Node 内置 `node:test` + `node:assert`，直接 import vendor 的 ESM 产物，`node --test` 运行

## Testing Decisions

- **Seam 1（自动化）**：只测转换核心的外部行为（输入文本/树 → 输出），不测内部实现细节；覆盖：标题与列表两种层级映射、kind 还原、行内保真、叶子块挂载、markdown→树→markdown round-trip、四符号自定义渲染、解析错误行号；测试文件放 `test/` 目录，与 `node --test` 约定兼容
- **Seam 2（手动验收）**：视图交互层（防抖同步、面板收放、MultiDrag 同父约束、拖入式落点、主题联动）每个 ticket 附带浏览器手动验收清单；prior art：`prototype/layout-mock` 已用内置浏览器验证过面板收放全流程，验收清单沿用其交互路径
- 好测试的标准：给定输入断言可观察输出（文本、树结构、渲染串），不断言中间步骤

## Out of Scope

- 移动端深度优化（v1 仅保证单栏布局可用，不针对触屏优化大纲拖拽）
- 激活视图增量补丁（保光标/vim 撤销栈）——已记录的后续优化
- markmap 式思维导图 / JSON Crack 式画布渲染（树形图仅文本目录树）
- JSON/YAML/TOML 导入导出（gtree 的 xtree 方向）
- 协作、云端同步、后端存储（纯静态，数据只留本机）
- PWA / 离线缓存、多语言 UI、富文本所见即所得

## Further Notes

- 2026-10-08 修订：多选范围收窄为「MultiDrag 整体拖拽 + Delete 批量删除」，移除浮动工具栏与全选（原因见 `docs/adr/0001` 的「修订 2026-10-08」）；本 spec 其余部分不变
- 720px 布局切换阈值为暂定值，spec 定稿；面板默认宽度 240/280 与最小展开宽 64px 同源
- 部署目标 github.io，发布源分支（main vs rewrite）在首个 ticket 前确定
- 领域词汇以 `CONTEXT.md` 为准；交互语义决策见 ADR-0001；布局 visual 以 `prototype/layout-mock` 分支为准
- 本 spec 消费完毕（tickets 全部 resolved）后可关闭；长存知识已在 CONTEXT.md / ADR / 调研文档中
