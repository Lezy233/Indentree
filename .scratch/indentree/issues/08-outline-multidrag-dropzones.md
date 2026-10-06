# 08 — 大纲拖拽：MultiDrag 整体拖拽 + 拖入式三区落点

**What to build:** 大纲交互收官——启用 SortableJS MultiDrag 插件：选中多项后整体拖拽，保持相对顺序一次落位；落点分 above / inside / below 三区：inside 使选中项成为目标节点的子节点（拖入式嵌套），above/below 为同级排序；拖拽悬停到任一选中项自身或其后代上时显示禁止样式、松手无效（循环防护）。语义与工具栏缩进操作共存，见 ADR-0001。

**Blocked by:** 07 — 大纲多选 + 浮动工具栏（同父约束）

**Status:** ready-for-agent

- [ ] MultiDrag：选中多项整体拖拽，落点后顺序保持，回流中间树并刷新其余视图
- [ ] 三区落点反馈：above/below 显示插入线，inside 高亮目标节点；inside 生效后选中项成为其子节点
- [ ] 非法落点（任一选中项自身或其后代）：悬停即禁止样式，松手无效
- [ ] 拖拽与批量删除（Delete 键）互不冲突（拖拽过程中不触发删除）

## Comments

- 2026-10-08（受 ticket 07 修订影响）：浮动工具栏（n selected / 缩进 / 取消缩进 / 删除）与全选已按用户反馈移除，
  多选现在只有「MultiDrag 整体拖拽」与「批量删除（Delete 键）」两个出口。本票 checklist 最后一条里
  「与工具栏缩进/删除互不冲突」只剩「不与 Delete 键冲突」这一层含义；落点语义、三区反馈、循环防护不变。
  详见 `.scratch/indentree/issues/07-outline-multiselect-toolbar.md` 的修订评论与 `docs/adr/0001` 的「修订 2026-10-08」一节。
- [ ] 手动验收：多选整体拖拽排序、拖入成为子节点、拖到子孙上被拒，三种路径全部正确

## Comments
