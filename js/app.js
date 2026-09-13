"use strict";

(function () {
  const SAMPLE_MD = [
    "# 项目规划",
    "## 需求分析",
    "## 系统设计",
    "### 前端",
    "### 后端",
    "# 开发计划",
    "## 第一阶段",
    "- 搭建框架",
    "- 实现数据模型",
    "  - 节点结构",
    "  - 树操作",
    "## 第二阶段",
    "",
  ].join("\n");

  let root = Markdown.parse(SAMPLE_MD);
  let currentView = "markdown";
  const treeOpts = { indent: Tree.DEFAULTS.indent, gap: Tree.DEFAULTS.gap };

  const editors = {
    markdown: document.getElementById("markdown-editor"),
    tree: document.getElementById("tree-editor"),
    outline: document.getElementById("outline-editor"),
  };

  // 把当前视图的内容解析回模型（图形化视图直接操作模型，无需解析）
  function syncFromView(view) {
    if (view === "markdown") root = Markdown.parse(editors.markdown.value);
    else if (view === "tree") root = Tree.parse(editors.tree.value);
  }

  function renderView(view) {
    if (view === "markdown") {
      editors.markdown.value = Markdown.serialize(root);
    } else if (view === "tree") {
      editors.tree.value = Tree.serialize(root, treeOpts);
    } else {
      Outline.setRoot(root);
      Outline.render();
    }
  }

  function switchView(view) {
    if (view === currentView) return;
    syncFromView(currentView);
    currentView = view;
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === view));
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + view));
    renderView(view);
  }

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });

  // 文本视图编辑防抖同步回模型
  let syncTimer = null;
  function debouncedSync(view) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => syncFromView(view), 300);
  }
  editors.markdown.addEventListener("input", () => debouncedSync("markdown"));
  editors.tree.addEventListener("input", () => debouncedSync("tree"));

  // 树形图设置：即时重渲染
  const indentInput = document.getElementById("tree-indent");
  const gapInput = document.getElementById("tree-gap");
  function applyTreeOpts() {
    treeOpts.indent = Math.max(2, Math.min(12, Number(indentInput.value) || Tree.DEFAULTS.indent));
    treeOpts.gap = Math.max(0, Math.min(5, Number(gapInput.value) || 0));
    syncFromView("tree"); // 保留用户未同步的编辑
    editors.tree.value = Tree.serialize(root, treeOpts);
  }
  indentInput.addEventListener("input", applyTreeOpts);
  gapInput.addEventListener("input", applyTreeOpts);

  // 复制按钮
  function copyText(text, btn) {
    const done = () => {
      const old = btn.textContent;
      btn.textContent = "已复制";
      btn.classList.add("copied");
      setTimeout(() => {
        btn.textContent = old;
        btn.classList.remove("copied");
      }, 1200);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, done) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch (err) { /* 忽略 */ }
    document.body.removeChild(ta);
    done();
  }

  document.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kind = btn.dataset.copy;
      let text;
      if (kind === "markdown") text = editors.markdown.value;
      else if (kind === "tree") text = editors.tree.value;
      else text = Markdown.serialize(root); // 图形化视图复制为 markdown
      copyText(text, btn);
    });
  });

  Outline.init(root, editors.outline, null);
  renderView("markdown");
})();
