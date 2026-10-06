# 07 — 大纲多选 + 浮动工具栏（同父约束）

**What to build:** vendor SortableJS 并落地多选模型——checkbox 点选切换；Shift 连选仅限同级（同父约束），越界部分自动截断到同父范围并在状态条提示；工具栏「全选」选中所有顶级节点（等效整棵树）；选中父节点时其后代自动跟随；选中 ≥1 项时顶部浮出「n selected」工具栏，提供缩进/取消缩进/删除操作，全部满足同父约束语义（见 ADR-0001）。

**Blocked by:** 06 — 大纲视图基础渲染 + 行内编辑

**Status:** ready-for-agent

- [x] SortableJS vendor 引入；checkbox 多选/取消，选中态视觉清晰
- [x] 同父约束生效：跨父节点不可同时处于选中态；选中父节点即等效选中整棵子树
- [x] Shift 连选越界时截断到同父范围，状态条给出一句提示
- [x] ~~全选 = 选中所有顶级节点（后代跟随）~~（2026-10-08 按用户反馈移除，见下）
- [x] ~~「n selected」浮动工具栏：缩进/取消缩进/删除对选中集生效~~（2026-10-08 按用户反馈移除，多选只服务批量删除与拖拽）
- [x] 手动验收：多选 → 批量删除（含子树）在真实页面走通

## Comments

- 2026-10-08 修订（用户反馈，**以此为准**）：多选范围收窄为「批量删除 + ticket 08 拖拽的入口」。
  - 移除浮动工具栏（「n selected」/ 缩进 / 取消缩进 / 删除按钮）与「全选」；标题栏改为「取消选择」，
    只在有选中项时出现，且用绝对定位——选中的那一刻不能把大纲内容整体下移（用户明确不接受这种偏移，
    验收里加了「选中不引起大纲内容偏移」的回归断言）。
  - 新增键盘：焦点在大纲行（含 checkbox）上时，Esc 取消选择、Delete 删除选中项；
    删除只要求同父、不要求连续，后代随子树一起走，删除后焦点落在前一个同级。
    **删除手势同时认 `Delete`（PC 键盘 / Mac 的 Fn+Delete）与 `Cmd+Backspace`**——macOS 上标着 delete
    的键（⌫）在浏览器里发的是 `Backspace`，Finder 的「移到废纸篓」正是 Cmd+⌫，只认 `Delete` 会没反应；
    单独的 Backspace 不删（防误删）。按键挂在 document 上（行 DOM 重渲染后焦点未必还在大纲里），
    但输入框（含行内编辑、抽屉里的符号输入）与 Ace 编辑器的按键一律不接管。
  - 纯函数随之收窄：删除 `indentNodes` / `outdentNodes` 与 `non-contiguous` 原因（缩进/取消缩进回到单节点实现，
    只服务 Tab / Shift+Tab 键盘路径）；`removeNodes` 保留（任意同父选中集）；选择模型删掉 `selectAllTopLevel`。
  - 文档：`CONTEXT.md` 的「大纲视图」词条与 `docs/adr/0001`（新增「修订 2026-10-08」一节）已同步。
  - 验收：`node --test` 85 全绿；Edge headless + CDP 24 项全通过（含偏移回归、Esc / Delete /
    Cmd+Backspace / Ctrl+Backspace、单独 Backspace 不误删、焦点在 Ace 或行内编辑框时不抢按键、
    行重渲染后焦点丢失仍可用、非连续删除、无选择时 Delete 无副作用）；复跑 ticket 06 的 25 项无回归；
    浅色/深色截图各一张留档。

- 2026-10-08 首次实现完成（其中工具栏与全选部分已被上面的修订取代）：
  - **vendor**：`vendor/sortablejs/`（SortableJS 1.15.7 的 complete build，一次性 esbuild 压成 46 KB 单文件 ESM，
    MultiDrag / Swap / OnSpill / AutoScroll 已 `Sortable.mount`；附 LICENSE 与 README 记录来源、体积与重跑命令）。
    本票只 vendor 不 import：验收里用浏览器 `import()` 实测产物可加载、`new Sortable(el).multiDrag` 存在，
    但页面不引入，避免为还没有拖拽交互的版本白下载 46 KB（MultiDrag 接线见 ticket 08）。
  - **多选模型**（纯函数 `src/outline-selection.mjs`）：`toggleSelection`（点选切换；跨父级点选改为只选新项并提示）、
    `extendSelection`（Shift 连选取锚点所在父级的同级范围，目标越界时截断并提示）、
    `impliedSelection`（后代跟随）、`pruneSelection`（树变化后清理失效选择）。
  - **批量删除**（`src/outline.mjs` 的 `removeNodes`）：只要求同父，任何同父选中集都能删；
    结果统一为 `{ tree, applied, paths, reason }`，`not-siblings` 为拒绝原因。
  - **页面接线**：checkbox 点选 / Shift 连选；`.selected`（显式）与 `.implied`（后代跟随，
    checkbox 变灰不可点）两级视觉；状态条提示 Shift 截断与同父约束。
- 已知取舍：①后代 checkbox 在父节点被选中期间不可点（点它等于换到另一个父级），需先取消父节点；
  ②多选不再提供缩进 / 取消缩进入口（退回 Tab / Shift+Tab 单节点操作），删除走 Delete 键或后续拖拽交互。

