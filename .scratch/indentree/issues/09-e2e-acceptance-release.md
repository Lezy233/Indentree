# 09 — 端到端手动验收 + 发布

**What to build:** 全站收官——按 spec 的 Seam 2 手动验收清单完整走查三视图互转链路：vim 编辑、防抖同步、行内保真、错误标红、树形图自定义、面板收放、主题联动、大纲多选/拖拽、窄屏单栏；修复验收中发现的全部问题；确定 github.io 发布源分支并完成部署，线上 URL 验证通过。

**Blocked by:** 02 — Round-trip 序列化 + 行内保真 + 叶子块 + 错误行号；03 — 树形图自定义；04 — Ace 编辑器 + vim 模式；05 — 三栏工作台布局；08 — 大纲拖拽

**Status:** ready-for-agent

- [x] 验收清单逐项走查并记录结果（发现的问题在本票 Comments 追加并修复）
- [x] 主题三态（跟随/明/暗）与 Ace 联动全链路正确
- [x] 窄屏单栏可完成基本互转操作；宽屏三栏三视图同步无脏刷新
- [x] 发布源分支确定（main vs rewrite），站点部署至 github.io 并在线上验证核心流程
- [x] README 功能说明更新

## Comments

- 2026-10-08 端到端验收走查（用 Edge headless + CDP 真实鼠标/键盘事件驱动页面，脚本在 `/tmp/indentree-cdp*.mjs`）：

  | 验收面（本票 What to build 列出的链路） | 覆盖脚本 | 结果 |
  | --- | --- | --- |
  | 三视图实时互转（中间树 → 大纲 / 树形图 / Ace） | `indentree-cdp.mjs` | 25/25 |
  | 大纲多选 + 批量删除（同父约束、Shift 连选、越界截断） | `indentree-cdp07.mjs` | 24/24 |
  | MultiDrag 整体拖拽 + above/inside/below 三区落点 + 循环防护 | `indentree-cdp08.mjs` | 23/23 |
  | 空白手势 / 选择编辑互斥 / ⌘Z 撤销 / 拖到删除区 / ＋菜单 | `indentree-cdp-ux.mjs` | 43/43 |
  | vim 编辑链路、行内保真、防脏刷新、错误标红、树形图自定义、面板收放、主题三态、窄屏单栏 | `indentree-cdp09.mjs` | 31/31 |
  | 转换核心纯函数（round-trip / 行内保真 / 叶子块 / 树操作 / 选择 / 拖拽几何 / 撤销栈 / 布局几何） | `node --test` | 110/110 |

  合计 **146 项浏览器验收 + 110 项单测全绿**。逐项要点：
  - **vim 编辑**：状态条 NORMAL → `i` → INSERT → `Esc` → NORMAL；普通模式按键不改文本；`yy` + `p` 复制整行；
    插入后 ~300ms 防抖回流，大纲与树形图同步跟上。
    记录一条验收方法：CDP 里字符键必须用 `Input.dispatchKeyEvent({type:'keyDown', text:'i'})`，
    `rawKeyDown` 到不了 vim 的插入模式判定（只有命名键如 Escape 用 `rawKeyDown`）。
  - **防抖同步 / 不脏刷新**：行内编辑期间不重建行 DOM（输入框节点身份不变、行数不变），
    未提交的编辑不写回 Markdown；提交后防抖写回并刷新其余视图。
  - **行内保真**：行内写 `**粗体** 与 \`代码\` 和 [链接](url)`，写回后再解析仍是同一行文本（round-trip 稳定）。
  - **错误标红**：`showError(3)` → 状态条「第 3 行无法解析」+ `.error` + Ace marker；`clearError()` 回到基线
    （Ace 本身有 2 个内部 marker，断言回到基线而不是 0）。
  - **树形图自定义**：抽屉开关、符号与长度即时生效、三套预设、写入 `localStorage["indentree:tree-symbols"]`、
    刷新保留、URL 参数（`?branch=…&last=…&vertical=…&horizontal=…&hlen=…`）载入即生效并写穿。
  - **面板收放**：拖 gutter 240→320 且写入 `indentree:layout`；推到底收起并出现恢复按钮；
    点恢复回到拖动前的宽度（不被 64px 细缝吃掉，回归 ticket 05 的修复）；刷新保留。
  - **主题三态 × Ace**：auto 跟随系统（浅→`ace/theme/github`，系统切深→`github_dark` 全链路跟随）、
    手动浅 / 深、`indentree:theme` 持久化、刷新保留偏好。
  - **窄屏单栏**：600px 下 `body.narrow`、默认 Markdown、gutter 隐藏、分段切换生效；
    切到大纲 / 树形图正常，Markdown 改动仍同步到树形图，窄屏下大纲行内编辑写回 Markdown。
- 2026-10-08 发布准备：
  - **路径可移植性已验证**：把仓库挂到子路径（`/tmp/site/Indentree` 符号链接 + 父目录 http 服务）后
    用 `INDENTREE_BASE=http://127.0.0.1:8766/Indentree/index.html` 复跑 09 验收 **31/31 通过**——
    全部资源引用都是相对路径（唯一显式 basePath 是 `./vendor/ace`），github.io 项目页 `/Indentree/` 可用。
  - **现状**：远端 `origin` = `Lezy233/Indentree`；`main`（tip `25f0a57`）里是 v0 旧站（`css/` `js/`），
    github.io 现在服务的正是它（线上 `https://lezy233.github.io/Indentree/` 返回 200，页面是旧版结构）；
    本地 `main` 是 `rewrite` 的祖先（可快进），`rewrite` 领先 21 个 commit。仓库里没有 CNAME，
    也没有 Pages 配置文件（源分支在 GitHub 仓库设置里）。
  - **README 已更新**：功能、快捷键表、本地运行、开发结构、已知边界；替换掉原来的空占位段落。
  - **发布（2026-10-08，用户拍板走方案 A）**：发布源分支确定为 **`main`**——`git branch -f main rewrite`
    快进（`main` 原本就是 `rewrite` 的祖先，纯快进、无重写历史）后 `git push origin main`
    （`25f0a57..915a932`）。github.io 仍服务同一 URL `https://lezy233.github.io/Indentree/`，
    站点从 v0 换成新版。
  - **线上确认**：首页 200（63927 字节，旧版约 2.7KB），新版标记（`outline-menu-toggle`、
    `./src/outline-history.mjs`、`./vendor/sortablejs`、「拖到此处删除」）全部命中，旧版标记 `js/app.js` 已消失；
    关键资源 `src/*.mjs`、`vendor/ace/ace.js`、`vendor/sortablejs/sortablejs.mjs` 均 200。
    交互流程的线上复跑按用户要求跳过（由用户自行在浏览器确认）。
  - 发布前检查：站点文件不含 Liquid 语法（`{{` / `{%`）也没有下划线开头的路径，
    因此 Pages 默认的 Jekyll 构建不会改动或吞掉资源，无需 `.nojekyll`。
