# 前端静态工具站选型调研（Markdown ↔ 树形结构互转）

调研日期：2026-10-04
项目约束：纯前端静态站，无构建、无框架、原生 JS/TS
调研方式：4 路并行调研，对照 primary sources（GitHub API / 官方文档 / MDN / 各工具官网实测），不确定项一律标注「待核验」。

---

## Q1：Markdown 标题/列表 ↔ 树形结构互转的现成库 / 开源项目

| 名称 | GitHub 地址 | 一句话功能 | 许可证 | 最近提交 | 打包体积 | TypeScript 支持 |
|---|---|---|---|---|---|---|
| mdast-util-from-markdown | github.com/syntax-tree/mdast-util-from-markdown | Markdown → mdast 语法树（标题/列表天然是树结构） | MIT | 2026-10-03（活跃） | npm 解包 103 KB；bundle 体积待核验 | 是 |
| mdast-util-to-markdown | github.com/syntax-tree/mdast-util-to-markdown | mdast 语法树 → Markdown（与上者配对即双向） | MIT | 2026-10-03（活跃） | gzip ≈ 28 KB（bundlephobia） | 是 |
| remark | github.com/remarkjs/remark | 插件化 Markdown 处理器（unified 封装） | MIT | 2026-09-27（活跃） | gzip ≈ 86 KB（bundlephobia） | 是 |
| unified | github.com/unifiedjs/unified | 解析→转换→序列化管线框架（remark 底座） | MIT | 2026-10-03（活跃） | npm 解包 142 KB | 是 |
| markdown-it | github.com/markdown-it/markdown-it | 100% CommonMark 解析器，token 流 + AST，浏览器可直接 script 引入 | MIT | 2026-09-12（活跃） | ESM gzip -9 实测 ≈ 26 KB | 是 |
| marked | github.com/markedjs/marked | 轻量快速解析器，Lexer 输出 token 流；本表体积最小 | MIT* | 2026-10-02（活跃） | UMD gzip -9 实测 ≈ 13 KB | 是（v18 源码即 TS） |
| markmap / markmap-lib | github.com/markmap/markmap | Markdown 标题+列表 → 可交互思维导图（树方向最成熟项目） | MIT | 2026-09-12（活跃） | 全量 gzip ≈ 583 KB；浏览器单文件实测 ≈ 166 KB | 是（全 TS monorepo） |
| dundalek/markmap（原版） | github.com/dundalek/markmap | markmap 灵感来源，基本停更 | MIT | 2024-05-22（停滞） | 待核验 | 否 |
| scripting/opmlPackage | github.com/scripting/opmlPackage | OPML 官方工具包，含 markdownToOutline / outlineToMarkdown 双向 API | MIT | 2025-12-08（活跃） | 待核验 | 待核验 |
| azu/opml-to-markdown | github.com/azu/opml-to-markdown | OPML → Markdown 单向 CLI（幕布导出场景常用） | MIT | 2015-04-11（已停更） | 极小（核心 ≈ 1 KB） | 否 |
| mdast-util-toc | github.com/syntax-tree/mdast-util-toc | 从 mdast 生成目录树（「标题 → 树」代表 util） | MIT | 2024-06-02（放缓） | npm 解包 31 KB | 是 |
| markdown-tree-parser | github.com/ksylvan/markdown-tree-parser | Markdown 当树解析，支持 CSS 式选择器与章节提取 | MIT | 2025-08-22（小众） | npm 解包 33 KB | 部分（待核验） |
| gtree (ddddddO/gtree) | github.com/ddddddO/gtree | Go 写的「Markdown 列表 → ASCII tree」，官方提供 WebAssembly 版可跑在浏览器 | BSD-2-Clause | 2026-09-25（活跃） | 不适用（Go/WASM，体积待核验） | 不适用 |

\* marked：npm registry 标注 MIT；GitHub API license 返回 NOASSERTION，以 npm/LICENSE 文件为准。

### Q1 备注

- **remark / unified 生态**是「Markdown ↔ 树」事实标准：mdast 中 heading 的 `depth` 与 list 的嵌套 `children` 本身就是树，双向转换只需写变换层。全部 ESM-only，可 `<script type="module">` + esm.sh/jsdelivr 直接用，无构建要求。
- **markdown-it**：零依赖单文件、CommonMark 100%、gzip ≈ 26 KB，「丢进静态站」体验最好之一。
- **markmap**：树方向最有名，但全量 583 KB 偏重；若只需「Markdown → 树数据」可只用 markmap-lib 的 transform 部分。其源码和 gtree 的 WASM 演示站是最值得参考的两个「树方向」实现。
- **scripting/opmlPackage**：最接近「现成双向转换函数」，但绑定 LogSeq 风格大纲 Markdown（列表即层级），不是 ATX 标题层级。
- **结论**：没有发现一个零依赖、成熟、直接给 Markdown ↔ tree 双向 API 的 JS 库；现成双向方案都绑定特定大纲语义。务实路线：markdown-it 或 mdast-util-from/to-markdown 做解析与回写，自己维护中间树结构。

---

## Q2：轻量代码/文本编辑器组件选型

> 约束提醒：CodeMirror 6 / Monaco 基于 npm 包，无构建工具时需预打包产物或 ESM CDN + importmap；textarea 与 CodeJar 类单文件库可直接内嵌。

| 名称 | GitHub 地址 | 一句话功能 | 许可证 | 最近提交 | 体积 | TypeScript | vim 支持 |
|---|---|---|---|---|---|---|---|
| CodeMirror 6 | github.com/codemirror/dev（已归档迁移，见备注） | 模块化可组合编辑器工具集 | MIT | GitHub 侧 2026-04-15（归档日；项目迁至自建 Forgejo，仍活跃） | 官方文档：basic setup ≈ 135 kB gz；最小配置 75 kB gz | ✅ 原生 TS | 社区插件 `replit/codemirror-vim`（MIT，2026-07 仍在更新） |
| Monaco Editor | github.com/microsoft/monaco-editor | VS Code 同款浏览器编辑器，功能最全 | MIT | 2026-10-03（活跃） | 官方无单一体积声明；issue #5154 实测核心 3–4 MB 量级（精确值待核验） | ✅ 官方 monaco.d.ts | 社区插件 `brijeshb42/monaco-vim`（MIT，2026-10 仍在更新） |
| Ace Editor | github.com/ajaxorg/ace | 独立嵌入式编辑器，120+ 语言高亮，内置多键盘模式 | BSD-3-Clause（LICENSE 文件；API 识别为 NOASSERTION） | 2026-09-23（活跃） | 待核验（src-min + 懒加载结构） | ✅ 官方 ace.d.ts | ✅ **官方内置** vim/Emacs/Sublime/vscode 模式 |
| CodeJar | github.com/antonmedv/codejar | 微型 contenteditable 编辑核心（缩进/括号/undo），高亮自配 | MIT | 2025-10-14（维护较慢） | README 官方声称 2.45 kB（min+gzip） | 有 .d.ts | ❌ 无 |
| 原生 textarea | —（浏览器内置） | 纯文本 baseline | N/A | N/A | 0 B | N/A | ❌ 只能手写极简子集 |
| highlight.js + textarea | github.com/highlightjs/highlight.js | 纯高亮库：textarea + 背后 pre/code overlay 方案 | BSD-3-Clause | 待核验 | 核心常用语言子集约数十 kB gz（待核验精确值） | ✅ | ❌ |

### Q2 备注

- **CodeMirror 6 重要状态变化**：codemirror 组织在 GitHub 的全部仓库于 2026-04-15 被作者归档为只读——不是停更，而是 Marijn Haverbeke 把代码迁到自建 Forgejo（2026-04-02 官方论坛公告）。npm 包正常发布。影响：查 issue/提 bug 要去新平台。结论：项目仍活跃，但已退出 GitHub。
- **Monaco**：功能最强但量级完全不同（核心 3–4 MB + worker），为 vim 模式付 MB 级加载代价不成比例，除非站点要做「在线 IDE」。
- **Ace 是被低估的选项**：vim 模式官方内置（非第三方插件）、ace-builds src-min 单 script 标签即可嵌入（契合无构建约束）、2026-09 仍在积极维护。
- **CodeJar / textarea**：「只需要比 textarea 好一点」场景的 fallback。

---

## Q3：可拖拽排序的树/列表 —— 原生 HTML5 DnD vs 现成库

| 名称 | 地址 | 一句话功能 | 许可证 | 最近提交 | 体积 | TypeScript | 框架依赖 |
|---|---|---|---|---|---|---|---|
| 原生 HTML5 Drag and Drop API | MDN: HTML_Drag_and_Drop_API | 浏览器内置拖拽事件 + DataTransfer | N/A（Web 标准） | N/A | 0 | 原生 DOM 类型 | vanilla |
| SortableJS | github.com/SortableJS/Sortable | 面向现代浏览器和触屏的可排序列表拖拽库 | MIT | 2026-03-24 | 约 18.3 kB gzip（bundlephobia） | 有官方类型 | vanilla（另提供 React/Vue 可选包装） |
| dnd-kit（新版 @dnd-kit/dom） | github.com/clauderic/dnd-kit | 分层 DnD 工具包：abstract 核心框架无关，DOM 层支持原生 JS | MIT | 2026-09-12 | @dnd-kit/core 约 14.2 kB gzip；@dnd-kit/dom 体积待核验 | ✅ 主语言 TS | core：React；新版 dom：vanilla + 各框架适配器 |
| react-beautiful-dnd | github.com/atlassian/react-beautiful-dnd | 美观可访问的 React 拖拽排序（已弃用并归档） | Apache-2.0（API 识别为 NOASSERTION，LICENSE 文件已核验） | 2025-08-18（已 archived） | 约 31.3 kB gzip | 有类型 | React（硬依赖） |
| Pragmatic drag and drop | github.com/atlassian/pragmatic-drag-and-drop | Atlassian 官方继任者，基于原生 HTML5 DnD 的框架无关封装 | Apache-2.0（待核验 LICENSE 文件） | 2026-10-03 | 核心包约 174 B gzip；配套包另计 | ✅ 主语言 TS | vanilla（官方供 React/Vue/Svelte 绑定） |
| he-tree | github.com/phphe/he-tree | 开箱即用的可拖拽树组件（嵌套/占位/虚拟列表/表格树） | MIT（README 声明；API 为 null，待核验） | 2026-04-15 | 待核验（bundlephobia 限流） | ✅ | Vue 2/3 或 React（硬依赖） |

### 原生 HTML5 DnD 的主要坑（来源：MDN）

1. **触摸/移动端是最大坑**：MDN 明确 drag 事件「继承自 mouse events」；iOS Safari 等对 HTML5 DnD 支持长期不完整，触屏上通常无法触发 dragstart。要么用 Pointer/Touch Events 重写，要么用 SortableJS 这类内置触摸支持的库，要么引入 polyfill（如 mobile-drag-drop）。
2. **拖拽元素内文本无法再选中**：MDN 明确元素 draggable 后内部文本需按住 Alt 才能选。
3. **DataTransfer 读写限制**：数据只能在 dragstart 写入、drop 读取，dragover 等事件拿不到拖入数据，位置高亮逻辑需另存全局状态。
4. **放置目标需手动 enable**：必须对 dragover 调 preventDefault()，否则拖拽失败并出现浏览器自带「飞回」动画。
5. **可访问性**：API 完全基于鼠标/指针事件，原生无键盘路径，需自行实现（dnd-kit 这类内建 keyboard sensor 的库可省掉这部分）。

### Q3 初步结论

- 首选 **SortableJS**：vanilla、触摸支持内置、18 kB gzip、MIT、活跃维护，最贴合无框架约束。
- 要更好的 a11y/嵌套树语义可评估 **dnd-kit 新版 @dnd-kit/dom**（vanilla + 键盘/触摸传感器，但树形嵌套需自写）。
- **Pragmatic drag and drop** 体积极小但偏底层，且继承原生 API 的触摸短板。

---

## Q4：同类工具的 UI 布局范式

### 工具清单

| 工具 | URL | 布局范式 | 对「文本 ↔ 树互转」的适配 |
|---|---|---|---|
| JSON Crack | jsoncrack.com | 双栏实时对照：左 JSON 编辑，右树/图画布，顶部工具栏 | **最适合参考**。本质就是「文本 ⇄ 树图」双向实时同步，纯前端 |
| tree.nathanfriend.io | tree.nathanfriend.io | 顶部选项工具栏 + 下方双栏（输入 textarea / 树输出） | **最适合参考**。本身就是「缩进文本 → 目录树」实时转换，无框架、极简 |
| Mermaid Live Editor | mermaid.live | 双栏实时对照：左代码右渲染，顶部操作栏 | 适合。同步刷新机制与「文本 → 树」方向一致 |
| markmap repl | markmap.js.org/repl | 双栏实时对照：左 Markdown 右思维导图 | **最适合参考**。「Markdown ⇄ 思维导图树」正是本项目场景的子集 |
| regex101 | regex101.com | 顶部输入条 + 左右分栏（测试文本 / 信息面板） | 适合借鉴「错误定位 + 行级高亮反馈」 |
| Textik | textik.com | 单画布 + 顶部工具栏（canvas 应用） | 不适合互转，缺少文本侧 |
| Workflowy | workflowy.com | 单栏 outliner：整页嵌套 bullet，聚焦编辑 | 适合参考「树 → 文本」编辑体验（缩进即层级），但无互转 |
| Dynalist | dynalist.io | 多栏 outliner（左文档列表 + 右大纲，应用内布局待核验） | 同 Workflowy |
| Heynote | heynote.com | 单栏块编辑器：持久化缓冲区，Ctrl-Enter 分块，块可设语言 | 适合参考「单栏即全部」的极简哲学 |
| it-tools | it-tools.tech | 卡片式工具集合门户：首页可搜索卡片网格，单工具页上下分栏 | 适合「多工具集合站」门户形态参考 |

### 布局范式归纳

1. **双栏实时对照（左输入 / 右输出）——互转工具主流**：JSON Crack、mermaid.live、markmap repl、tree.nathanfriend.io 四者殊途同归。左栏天然是文本，右栏天然是树，实时同步让「互转」变成「同一数据的两个视图」。
2. **顶部输入条 + 左右分栏**：regex101 式。适合借鉴其错误反馈——解析失败时在文本侧行级标红 + 状态条，而非阻塞弹窗。
3. **单栏结构化编辑（outliner / 块编辑器）**：Workflowy / Dynalist / Heynote。放弃输入/输出分栏，整页即一个可编辑结构体；无法同时看两种形态，需配合视图切换。
4. **单画布 + 工具栏**：Textik 式，仅当树渲染采用 canvas 方案时有参考价值。
5. **（变体）卡片式工具集合门户**：it-tools 式，适合未来扩展为多工具站的首页形态。

### 对本项目的直接启示

1. 核心互转界面优先采用**范式 1（左文本右树，实时同步）**，四款同类工具交叉印证，这是该品类的用户预期。
2. 双栏之上叠加 tree.nathanfriend.io 式**顶部选项工具栏**（输出风格、根节点符号等开关），成本最低。
3. 错误反馈借鉴 regex101：文本侧行级标红 + 状态条。
4. 窄屏时双栏退化为上下堆叠或 Tab 切换。

---

## 排除掉的方案及排除理由

| 方案 | 排除理由 |
|---|---|
| Monaco Editor | 核心 3–4 MB 级加载量，与轻量静态工具站场景不成比例；vim 仅社区插件，为 vim 付 MB 级代价不划算 |
| react-beautiful-dnd | 官方已 deprecated 并归档（issue #2672）；React 硬依赖，与无框架约束冲突 |
| he-tree | 开箱即用但 Vue/React 硬依赖；仅作「将来换框架」的备选记录 |
| @dnd-kit/core（经典版） | React 专用；新版 @dnd-kit/dom 虽支持 vanilla 但树形嵌套需自写，优先级低于 SortableJS |
| Pragmatic drag and drop | 体积极小但 API 偏底层、文档分散；刻意构建在原生 HTML5 DnD 之上，继承其触摸短板，移动端需求下不如 SortableJS |
| dundalek/markmap（原版） | 基本停更（最后 release 2019-10），无官方类型 |
| azu/opml-to-markdown | 单向转换且 2015 年后停更，仅可作算法参考，不作依赖 |
| CodeJar | 无 vim 支持、无高亮，仅适合「比 textarea 好一点」的 fallback，不是主力编辑器选项 |
| markmap 全量引入 | 583 KB gzip 过重；如参考其实现，只取 markmap-lib 的 transform 部分 |
| gtree (Go/WASM) | 非 JS 生态，不可作为依赖引入；其官方演示站是纯前端 WASM 运行的架构参考样本 |

---

## 推荐组合（供 grilling / spec 阶段决策）

1. **解析层**：markdown-it（单文件 ≈ 26 KB gzip）或 mdast-util-from/to-markdown（ESM via CDN），自维护中间树结构。
2. **编辑层**：Ace Editor（官方内置 vim + src-min 单标签嵌入 + 活跃维护）是约束下的最优解；CodeMirror 6 质量更高但需 CDN importmap 接入且 GitHub 生态刚迁移。
3. **拖拽层**：SortableJS（vanilla + 触摸内置 + 18 kB）。
4. **UI 层**：左文本右树双栏实时同步 + 顶部选项工具栏 + regex101 式行级错误标红。

## 待核验清单（汇总）

1. Monaco 核心 min 精确体积；Ace ace-builds src-min 各文件体积。
2. Pragmatic drag and drop 与 he-tree 的 LICENSE 文件逐条核对（API 返回 NOASSERTION/null）。
3. scripting/opmlPackage 的 npm 类型与体积。
4. markdown-tree-parser 的 TypeScript 支持程度。
5. dnd-kit 新版 @dnd-kit/dom 的 bundle 体积。
6. highlight.js 的最近提交时间（未单独核验）。
7. Dynalist 应用内布局；regex101 右栏 Tab 组；jsoncrack 图侧是否可直接编辑节点。

## 引用来源

- GitHub 各仓库与 GitHub API（pushed_at / license 核验）：syntax-tree/*、remarkjs/remark、unifiedjs/unified、markdown-it/markdown-it、markedjs/marked、markmap/markmap、scripting/opmlPackage、azu/opml-to-markdown、ksylvan/markdown-tree-parser、ddddddO/gtree、codemirror/*、microsoft/monaco-editor、ajaxorg/ace、antonmedv/codejar、highlightjs/highlight.js、SortableJS/Sortable、clauderic/dnd-kit、atlassian/react-beautiful-dnd、atlassian/pragmatic-drag-and-drop、phphe/he-tree、replit/codemirror-vim、brijeshb42/monaco-vim
- CodeMirror 迁移公告：https://discuss.codemirror.net/t/codemirrors-migration-to-forgejo/9706
- Monaco 体积实测 issue：https://github.com/microsoft/monaco-editor/issues/5154
- MDN HTML Drag and Drop API：https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API
- bundlephobia / npm registry（体积、types、license 字段）
- 同类工具实测：jsoncrack.com、tree.nathanfriend.io、mermaid.live、markmap.js.org/repl、regex101.com、textik.com、workflowy.com、dynalist.io、heynote.com、it-tools.tech
