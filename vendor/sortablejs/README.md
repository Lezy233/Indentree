# vendor/sortablejs

SortableJS 1.15.7（MIT），一次性用 esbuild 压成单文件 ESM 后 vendor 进 repo——
和 `vendor/markdown-it.mjs` 同一条路线：repo 本身无构建、无 package.json。

产物：`sortablejs.mjs`（ESM，默认导出 `Sortable`），是 npm 包的
**complete build**（`modular/sortable.complete.esm.js`），已 `Sortable.mount` 了
MultiDrag / Swap / OnSpill(Remove, Revert) / AutoScroll——spec 要求「SortableJS 含 MultiDrag」。

来源与生成命令（版本升级时重跑）：

```sh
V=1.15.7
curl -sS -o /tmp/sortable.complete.esm.js \
  "https://cdn.jsdelivr.net/npm/sortablejs@$V/modular/sortable.complete.esm.js"
curl -sS -o vendor/sortablejs/LICENSE \
  "https://cdn.jsdelivr.net/npm/sortablejs@$V/LICENSE"
npm_config_cache=/tmp/npm-cache npx --yes esbuild@0.25.0 \
  /tmp/sortable.complete.esm.js --minify --format=esm \
  --outfile=vendor/sortablejs/sortablejs.mjs
```

体积：46 KB（已 minify 的单文件 ESM，未 gzip）。npm 里的 `Sortable.min.js` 是 45 KB 但**不含**
MultiDrag 插件，所以走 complete build。选型依据见 `docs/research/2026-10-04-frontend-tooling-research.md` Q3。

使用：`import Sortable from './vendor/sortablejs/sortablejs.mjs'`。
issue 07 只做 vendor：产物已用浏览器 `import()` 实测可加载、`new Sortable(el).multiDrag` 存在
（MultiDrag 确已挂载），但页面尚未 import——避免在没有拖拽交互的版本里白下载 46 KB。
MultiDrag 整体拖拽 + above/inside/below 三区落点的接线见 issue 08。
