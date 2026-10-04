# 01 — 转换核心 + 最小双栏页面（tracer bullet）

**What to build:** 打通全站最危险的路径——vendor markdown-it，实现中间树纯函数核心（markdown→中间树、中间树→树形图文本）及 node:test 用例，并用最简 index.html（左原生 textarea、右树形图面板）让用户粘贴 markdown 后约 300ms 内看到目录树。三视图同步循环的骨架在此成形。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] markdown-it 以单文件 ESM 形式 vendor 进 repo，页面与测试均可直接 import
- [ ] 中间树节点模型落地：节点 = 原始文本（保留行内 Markdown）+ 子节点列表 + kind（heading / list-item / paragraph / leaf-block）；标题深度与列表嵌套统一折叠为父子嵌套
- [ ] `node --test` 可运行，核心用例通过：标题映射、列表嵌套映射、混合写法、树形图文本渲染（默认 ├──/└──/│/─）
- [ ] 静态页面双栏：左侧 textarea 输入，右侧 pre 渲染树形图；300ms 防抖同步；粘贴 spec 中的示例 markdown 得到正确目录树
- [ ] 手动验收：浏览器打开页面，粘贴示例 markdown，树形图与预期一致

## Comments
