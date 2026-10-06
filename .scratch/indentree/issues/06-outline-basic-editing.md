# 06 — 大纲视图基础渲染 + 行内编辑

**What to build:** 左栏占位变为真大纲视图——按中间树渲染 Notion 式大纲列表：行首拖拽手柄（⠿）、缩进视觉、checkbox；行内直接编辑（双击或 Enter 进入，Esc/失焦保存，Enter 新建同级节点，Tab/Shift+Tab 缩进/取消缩进）；任何结构修改经防抖回流中间树，Markdown 栏与树形图栏跟随刷新。至此宽屏三视图同屏互转闭环成形。

**Blocked by:** 05 — 三栏工作台布局 + VSCode 式面板收放 + 响应式切换

**Status:** ready-for-agent

- [x] 大纲列表按中间树渲染：层级缩进、手柄、checkbox；初始内容与 Markdown 栏一致
- [x] 双击进入行内编辑，修改保存后回流中间树，其余两视图 300ms 内刷新
- [x] Enter 新建同级节点、Tab/Shift+Tab 缩进/取消缩进，行为符合 outline 品类习惯
- [x] 大纲侧结构操作后，markdown 文本按 kind 正确重生成（标题仍 #、列表仍 -）
- [x] 手动验收：只在大纲栏操作，完成建结构→改文本→调层级全流程，另两栏同步正确

## Comments

- 2026-10-08 实现完成：
  - 新增纯函数模块 `src/outline.mjs`（`outlineRows` / `locateNode` / `setNodeText` /
    `insertSibling` / `indentNode` / `outdentNode` / `removeNode` / `describeOutlineReason`），
    全部返回 `{ tree, applied, path, reason }`；24 个单测（`test/outline.test.mjs`），全套 65 个测试全绿。
  - `index.html`：中间树从「每次渲染重新 parse」改为**单一数据源** `tree`；左栏占位换成真大纲
    （深度缩进 `--depth`、⠿ 手柄、checkbox、叶子块只读预览），双击/焦点行 Enter 进入行内编辑，
    Esc/失焦保存，Enter 新建同级（沿用 kind，标题沿用 level），Tab/Shift+Tab 缩进/取消缩进，
    空节点 Backspace 删除，被拒操作在状态条出提示。大纲改动 300ms 防抖经 `serializeMarkdown`
    写回 Markdown 栏并刷新树形图。
  - 结构操作的可表达性判定：①标题层级必须落在 1–6（7 级会重解析成段落，0 级会让序列化抛错）；
    ②**被改动区域的锥体**（祖先链 + 被改动节点的整棵子树）序列化再解析后结构必须不变，否则拒绝并提示。
    这版判定的由来：手工规则会漏掉「`# A` 之后的 `- b` 取消缩进到顶层」——markdown 里 `- b`
    仍会被标题小节吞掉，中间树与 Markdown 静默分叉；只看锥体是为了让区域外既有的破损
    （用户在段落里手打块级标记）不牵连整篇文档，带上祖先链是因为列表项上下文会改变标题/块的归属。
    结构比较只看 kind/level/children（忽略文本）并忽略空段落（Enter 暂态）。
  - 复核补漏：round-trip 判定改为锥体后，又按复审复现的输入补掉了三个逃生舱假阴性——
    不忠实基线下把标题缩到 7 级、取消缩进把层级压成负数（序列化抛 RangeError）、
    以及缩进效果在写回时被标题吞掉；三条都已固化为单测。
  - 同步竞态两处修复：①`lastOutlineText` 识别「编辑器改动来自大纲写回」，避免把大纲的新改动
    误当外部编辑回滚；②`flushEditorSync` 在进入行内编辑前先落地挂起的 Markdown 防抖，
    避免旧文本稍后覆盖刚提交的大纲改动。
  - 手动验收经 Edge headless + CDP 驱动（`python3 -m http.server` 起服务，页面 reload 隔离每个场景），
    25 项全通过：初始一致/层级缩进/手柄与 checkbox、双击→改文本→Enter 新建→两栏 300ms 内刷新、
    Esc 保存、行聚焦 Enter 进入编辑、Tab 缩进保持编辑、Shift+Tab 复原、标题缩进重定级、
    被拒缩进状态条（首个同级 / 无法在 markdown 还原）、空节点删除与焦点、
    两条竞态回归、Markdown→大纲回流、叶子块只读。
- 已知取舍：①叶子块（代码块/表格/hr）只在大纲里只读预览（首行 + 行数），行内编辑留给 Markdown 栏，
  单行输入无法无损编辑多行块；②空节点 Backspace 删除超出本票 checklist（删除的批量语义属 07），
  但它是 Enter 误建空节点的唯一顺手退路，故保留；③Enter 在空节点上仍会继续新建空同级
  （Notion 式「空项回车先取消缩进」未做）；④checkbox 仍为视觉占位，选中语义见 ticket 07。

