# 08 — 大纲拖拽：MultiDrag 整体拖拽 + 拖入式三区落点

**What to build:** 大纲交互收官——启用 SortableJS MultiDrag 插件：选中多项后整体拖拽，保持相对顺序一次落位；落点分 above / inside / below 三区：inside 使选中项成为目标节点的子节点（拖入式嵌套），above/below 为同级排序；拖拽悬停到任一选中项自身或其后代上时显示禁止样式、松手无效（循环防护）。多选的两个出口是「整体拖拽」与「Delete 批量删除」（浮动工具栏与全选已按 07 的修订移除），见 ADR-0001。

**Blocked by:** 07 — 大纲多选 + 批量删除（同父约束）

**Status:** ready-for-agent

- [x] MultiDrag：选中多项整体拖拽，落点后顺序保持，回流中间树并刷新其余视图
- [x] 三区落点反馈：above/below 显示插入线，inside 高亮目标节点；inside 生效后选中项成为其子节点
- [x] 非法落点（任一选中项自身或其后代）：悬停即禁止样式，松手无效
- [x] 拖拽与批量删除（Delete 键）互不冲突（拖拽过程中不触发删除）
- [x] 手动验收：多选整体拖拽排序、拖入成为子节点、拖到子孙上被拒，三种路径全部正确

## Comments

- 2026-10-08 实现完成：
  - **纯函数**：`src/outline.mjs` 新增 `moveNodes(root, paths, targetPath, zone)`——inside 成为目标的最后一个子级、
    above/below 成为目标的同级（前 / 后）；整组一起搬且保持相对顺序；落点是任一被拖节点自身或其后代时
    返回 `invalid-target`（循环防护）；可表达性仍走 round-trip 锥体判定。`src/outline-drag.mjs` 新增
    `dropZone(rect, clientY)`（上 / 下各 25% 为同级排序、中间 50% 为拖入成为子级）与
    `dragPaths(rows, selectedPaths, draggedPath)`（拖的是选中项 → 整组，否则只搬被拖的那一个）。
    新增 14 个单测（全套 99 个全绿）。
  - **页面**：`Sortable.create(outlineBody, …)` 启用 MultiDrag（`handle: '.grip'` 只从手柄起拖、
    `selectedClass: 'md-selected'` 作插件内部记账、`avoidImplicitDeselect: true` 防鼠标抬起清多选、
    `forceFallback: true` + fallback ghost：关掉 native HTML5 DnD，改用指针事件驱动，
    桌面与触屏行为一致、也便于自动化验收）。**层级语义完全由中间树决定**：`onMove` 一律返回 false
    （不让 Sortable 改 DOM），三区反馈自己画（自己听 `pointermove` + `elementFromPoint`，
    与松手判定同源），松手后把整段搬到落点再重渲染。MultiDrag 的拖拽集通过
    `Sortable.utils.select/deselect` 与我们的多选模型双向对齐（重渲染前先释放旧行引用，
    避免插件里留下游离元素），并中和插件自带的「点选」。
  - **拖拽与删除互不冲突**：拖拽进行中（`Sortable.active`）键盘 Delete / Esc 不响应
    （验收里真按住拖着按 Delete / Esc 验证）。
  - **实装踩到的两个坑（已修）**：① hover 期间最后一次 mousemove 不保证触发 Sortable 的 `onMove`，
    用它的回调画反馈会在「先滑过目标中部、再停到边缘」时滞后成 inside → 反馈与松手落点统一改为
    按指针位置（`elementFromPoint` + 行矩形）判定；② `moveNodes` 早期按下标推导新父级路径，
    被拖节点原本排在目标之前时下标会错位（锥体判定与返回路径都跟着错）→ 改为按节点身份反查路径。
  - **结构变更后不留下错选**：路径是下标形式，结构一变旧选择可能指到别的节点——键盘结构操作
    与「拖未选中的行」都会清空选择，拖选中项则把选择跟到新位置。
  - **验收**：Edge headless + CDP **23 项全通过**（真实鼠标拖拽：above / below 同级排序、
    inside 拖入成为子级、跨分支拖入、多选整组拖拽保持相对顺序且选择跟随、三区反馈类、
    非法落点禁止样式 + 松手无效（含「拖到另一选中项的后代」）、拖自身无效、拖拽中按 Delete / Esc
    不生效、拖拽影像是被拖的那一行、无法用 markdown 表达的落点结构不变、拖未选中行后选择被清空）；
    复跑 ticket 06 的 25 项、ticket 07 的 24 项验收无回归；留 above / inside / invalid 三张拖拽中截图。
- 已知取舍：①落点试算在 hover 时按「目标行 + 区」缓存，只在目标或区变化时重算，避免每次移动都克隆整棵树；
  ②少数「方向正确但 markdown 表达不了」的落点（例如把标题拖到层级更深的标题之上）会被 round-trip 判定拒绝并提示，
  这是 markdown 的表达边界，不是拖拽 bug；③拖拽期间不提供「拖拽中滚动」以外的额外反馈（如落点序号）。
- 2026-10-08（受 ticket 07 修订影响）：浮动工具栏（n selected / 缩进 / 取消缩进 / 删除）与全选已按用户反馈移除，
  多选现在只有「MultiDrag 整体拖拽」与「批量删除（Delete 键）」两个出口；本票 checklist 最后一条里
  「与工具栏缩进/删除互不冲突」只剩「不与 Delete 键冲突」这一层含义。落点语义、三区反馈、循环防护不变。
  详见 `.scratch/indentree/issues/07-outline-multiselect-toolbar.md` 的修订评论与 `docs/adr/0001` 的「修订 2026-10-08」一节。
- 2026-10-08 后续修订：本票落地后的交互调整（空白手势、选择/编辑互斥、⌘Z 撤销、拖到删除区、「＋」动作菜单）记在 `.scratch/indentree/issues/10-outline-ux-followups.md`。
