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

  const SETTINGS_KEY = "indentree-settings";
  const DEFAULTS = {
    layout: "horizontal", // horizontal | vertical
    theme: "light", // light | dark
    mdMode: "heading", // heading | list
    marker: "-", // - | 1.
    vim: false,
    treeIndent: 4,
    treeGap: 0,
    splits: [1 / 3, 1 / 3, 1 / 3], // 三个面板在主轴上的尺寸占比
  };

  const settings = { ...DEFAULTS };
  try {
    Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"));
  } catch (err) { /* 忽略损坏的本地设置 */ }
  if (
    !Array.isArray(settings.splits) ||
    settings.splits.length !== 3 ||
    settings.splits.some((x) => typeof x !== "number" || !(x > 0))
  ) {
    settings.splits = [...DEFAULTS.splits];
  }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (err) { /* 隐私模式等场景下静默失败 */ }
  }

  let root = Markdown.parse(SAMPLE_MD);

  const editors = {
    markdown: document.getElementById("markdown-editor"),
    tree: document.getElementById("tree-editor"),
    outline: document.getElementById("outline-editor"),
  };
  const panes = document.getElementById("panes");
  const layoutBtn = document.getElementById("layout-toggle");
  const themeBtn = document.getElementById("theme-toggle");
  const vimToggle = document.getElementById("vim-toggle");
  const vimMode = document.getElementById("vim-mode");
  const mdModeSeg = document.getElementById("md-mode");
  const mdMarker = document.getElementById("md-marker");
  const indentInput = document.getElementById("tree-indent");
  const gapInput = document.getElementById("tree-gap");

  // ---- 三视图实时同步 ----
  function serializeMarkdown() {
    return Markdown.serialize(root, { mode: settings.mdMode, marker: settings.marker });
  }

  function serializeTree() {
    return Tree.serialize(root, { indent: settings.treeIndent, gap: settings.treeGap });
  }

  // 以 source 视图的内容为准解析回模型，并刷新另外两个视图
  function syncFrom(source) {
    if (source === "markdown") root = Markdown.parse(editors.markdown.value);
    else if (source === "tree") root = Tree.parse(editors.tree.value);
    // source === "outline" 时模型已由 Outline 直接维护
    if (source !== "markdown") editors.markdown.value = serializeMarkdown();
    if (source !== "tree") editors.tree.value = serializeTree();
    if (source !== "outline") {
      Outline.setRoot(root);
      Outline.render();
    }
  }

  const syncTimers = {};
  function syncSoon(source) {
    clearTimeout(syncTimers[source]);
    syncTimers[source] = setTimeout(() => syncFrom(source), 300);
  }

  // 以当前模型全量重写三个视图（用于设置开关切换时，源视图自身也需要重渲染）
  function refreshAll() {
    editors.markdown.value = serializeMarkdown();
    editors.tree.value = serializeTree();
    Outline.setRoot(root);
    Outline.render();
  }

  editors.markdown.addEventListener("input", () => syncSoon("markdown"));
  editors.tree.addEventListener("input", () => syncSoon("tree"));
  Outline.init(root, editors.outline, () => syncSoon("outline"));

  // ---- 布局切换 ----
  function applyLayout() {
    panes.classList.toggle("horizontal", settings.layout === "horizontal");
    panes.classList.toggle("vertical", settings.layout === "vertical");
    layoutBtn.textContent = settings.layout === "horizontal" ? "纵向布局" : "横向布局";
    applySplits();
  }
  layoutBtn.addEventListener("click", () => {
    settings.layout = settings.layout === "horizontal" ? "vertical" : "horizontal";
    applyLayout();
    saveSettings();
  });

  // ---- 面板尺寸：默认三等分，可拖拽分隔条调整 ----
  const splitters = [...document.querySelectorAll(".splitter")];
  const SPLITTER_PX = 6;
  const MIN_SPLIT = 0.08;

  function applySplits() {
    const horizontal = settings.layout === "horizontal";
    const total = splitters.length * SPLITTER_PX;
    [...panes.querySelectorAll(".pane")].forEach((el, i) => {
      const pct = settings.splits[i] * 100;
      const sub = settings.splits[i] * total;
      el.style.width = horizontal ? `calc(${pct}% - ${sub}px)` : "";
      el.style.height = horizontal ? "" : `calc(${pct}% - ${sub}px)`;
    });
  }

  splitters.forEach((sp, i) => {
    sp.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      try { sp.setPointerCapture(e.pointerId); } catch (err) { /* 合成事件无活动指针 */ }
      sp.classList.add("active");
      const horizontal = settings.layout === "horizontal";
      // 百分比按内容盒解析，容器尺寸需扣除 padding
      const cs = getComputedStyle(panes);
      const pad = horizontal
        ? parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
        : parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const containerSize = (horizontal ? panes.clientWidth : panes.clientHeight) - pad;
      const startPos = horizontal ? e.clientX : e.clientY;
      const orig = [...settings.splits];

      function onMove(ev) {
        const cur = horizontal ? ev.clientX : ev.clientY;
        let delta = (cur - startPos) / containerSize;
        delta = Math.max(MIN_SPLIT - orig[i], Math.min(orig[i + 1] - MIN_SPLIT, delta));
        settings.splits[i] = orig[i] + delta;
        settings.splits[i + 1] = orig[i + 1] - delta;
        applySplits();
      }
      function onUp() {
        sp.classList.remove("active");
        sp.removeEventListener("pointermove", onMove);
        sp.removeEventListener("pointerup", onUp);
        saveSettings();
      }
      sp.addEventListener("pointermove", onMove);
      sp.addEventListener("pointerup", onUp);
    });
  });

  // ---- 明暗主题切换 ----
  function applyTheme() {
    document.documentElement.dataset.theme = settings.theme;
    themeBtn.textContent = settings.theme === "dark" ? "浅色模式" : "深色模式";
  }
  themeBtn.addEventListener("click", () => {
    settings.theme = settings.theme === "dark" ? "light" : "dark";
    applyTheme();
    saveSettings();
  });

  // ---- markdown 表示方式（# 标题 / 列表）与列表符号 ----
  function applyMdMode() {
    mdModeSeg.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.mode === settings.mdMode));
    mdMarker.hidden = settings.mdMode !== "list";
    mdMarker.value = settings.marker;
  }
  mdModeSeg.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-mode]");
    if (!btn || btn.dataset.mode === settings.mdMode) return;
    settings.mdMode = btn.dataset.mode;
    applyMdMode();
    saveSettings();
    root = Markdown.parse(editors.markdown.value); // 保留当前编辑
    refreshAll();
  });
  mdMarker.addEventListener("change", () => {
    settings.marker = mdMarker.value;
    saveSettings();
    root = Markdown.parse(editors.markdown.value);
    refreshAll();
  });

  // ---- vim 模式 ----
  Vim.attach(editors.markdown, vimMode);
  vimToggle.addEventListener("change", () => {
    settings.vim = vimToggle.checked;
    if (settings.vim) Vim.enable();
    else Vim.disable();
    saveSettings();
    editors.markdown.focus();
  });

  // ---- 树形图设置 ----
  function applyTreeOpts() {
    settings.treeIndent = Math.max(2, Math.min(12, Number(indentInput.value) || Tree.DEFAULTS.indent));
    settings.treeGap = Math.max(0, Math.min(5, Number(gapInput.value) || 0));
    saveSettings();
    root = Tree.parse(editors.tree.value); // 保留当前编辑
    refreshAll();
  }
  indentInput.addEventListener("input", applyTreeOpts);
  gapInput.addEventListener("input", applyTreeOpts);

  // ---- 复制按钮 ----
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
      else text = serializeMarkdown(); // 图形化视图复制为 markdown
      copyText(text, btn);
    });
  });

  // ---- 初始化 ----
  applyLayout();
  applyTheme();
  applyMdMode();
  vimToggle.checked = settings.vim;
  if (settings.vim) Vim.enable();
  indentInput.value = settings.treeIndent;
  gapInput.value = settings.treeGap;

  editors.markdown.value = serializeMarkdown();
  editors.tree.value = serializeTree();
  Outline.setRoot(root);
  Outline.render();
})();
