# 07 — 大纲多选 + 浮动工具栏（同父约束）

**What to build:** vendor SortableJS 并落地多选模型——checkbox 点选切换；Shift 连选仅限同级（同父约束），越界部分自动截断到同父范围并在状态条提示；工具栏「全选」选中所有顶级节点（等效整棵树）；选中父节点时其后代自动跟随；选中 ≥1 项时顶部浮出「n selected」工具栏，提供缩进/取消缩进/删除操作，全部满足同父约束语义（见 ADR-0001）。

**Blocked by:** 06 — 大纲视图基础渲染 + 行内编辑

**Status:** ready-for-agent

- [x] SortableJS vendor 引入；checkbox 多选/取消，选中态视觉清晰
- [x] 同父约束生效：跨父节点不可同时处于选中态；选中父节点即等效选中整棵子树
- [x] Shift 连选越界时截断到同父范围，状态条给出一句提示
- [x] 全选 = 选中所有顶级节点（后代跟随）
- [x] 「n selected」浮动工具栏：缩进/取消缩进/删除对选中集生效，结果回流中间树并刷新其余视图
- [x] 手动验收：参考用户提供的 Notion 截图形态逐项对比（多选、浮动栏、批量删除）

## Comments

- 2026-10-08 实现完成：
  - **vendor**：`vendor/sortablejs/`（SortableJS 1.15.7 的 complete build，一次性 esbuild 压成 46 KB 单文件 ESM，
    MultiDrag / Swap / OnSpill / AutoScroll 已 `Sortable.mount`；附 LICENSE 与 README 记录来源、体积与重跑命令）。
    本票只 vendor 不 import：验收里用浏览器 `import()` 实测产物可加载、`new Sortable(el).multiDrag` 存在，
    但页面不引入，避免为还没有拖拽交互的版本白下载 46 KB（MultiDrag 接线见 ticket 08）。
  - **多选模型**（纯函数 `src/outline-selection.mjs`，14 个单测）：`toggleSelection`（点选切换；
    跨父级点选改为只选新项并提示）、`extendSelection`（Shift 连选取锚点所在父级的同级范围，
    目标越界时截断并提示）、`selectAllTopLevel`（所有顶级节点）、`impliedSelection`（后代跟随）、
    `pruneSelection`（树变化后清理失效选择）。
  - **批量结构操作**（`src/outline.mjs`）：`indentNodes` / `outdentNodes` 要求同父 + 连续
    （整段移动语义良定义的前提），`removeNodes` 只要求同父——删除不要求连续，任何同父选中集都能删；
    单节点键盘操作是同一实现的一元包装，共用一条可表达性判定（round-trip 锥体）。
    新增 `non-contiguous` / `not-siblings` 拒绝原因与文案；结果统一为 `{ tree, applied, paths, reason }`。14 个批量单测。
  - **页面接线**：checkbox 点选 / Shift 连选；`.selected`（显式）与 `.implied`（后代跟随，
    checkbox 变灰不可点）两级视觉；选中 ≥1 时浮出「n selected」工具栏（缩进 / 取消缩进 / 删除 / ✕）；
    面板标题栏「全选」（工具栏 0 选中时不出现，全选需要常驻入口）；状态条提示 Shift 截断与同父约束；
    行聚焦时 Esc 清除选择；批量操作后选中项跟随到新位置，删除后清空选择。
  - **验收**：`node --test` 96 个全绿（本票新增 28 个）；Edge headless + CDP 27 项全通过——
    vendor 产物可 import 且 MultiDrag 已挂载、点选与取消、选中态与后代跟随、Shift 同级连选、
    Shift 越界截断 + 提示、跨父级改选 + 提示、全选、批量缩进（回流 Markdown、选中项跟随）、
    批量取消缩进、批量删除、非连续多选删除、含子树删除、非连续多选缩进被拒 + 提示、
    全选后首个同级被拒 + 提示、清除选择、运行期无异常；
    并留浅色/深色截图各一张对照 Notion 形态（多选高亮 + 浮动栏 + 批量删除）。
    另复跑 ticket 06 的 25 项验收，无回归。
- 已知取舍：①「n selected」计的是显式勾选数，跟随的后代用淡色行表达、不计入数字；
  ②工具栏的缩进/取消缩进要求选中项同父且连续（整段移动），非连续会提示；删除只要求同父、
  非连续也能删；③「全选」常驻在面板标题栏，而不是浮动工具栏（选中 ≥1 才浮出的工具栏在 0 选中时点不到它）；
  ④后代 checkbox 在父节点被选中期间不可点（点它等于换到另一个父级），需先取消父节点。

