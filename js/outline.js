"use strict";

// 图形化大纲：嵌套可编辑列表
// - 拖拽 ⠿ 手柄：同级排序、跨层级（上沿/下沿插入线 = 同级，整行高亮 = 成为子级）
// - 多选：每行勾选框，或在空白处按住鼠标拖出矩形框选（Ctrl/Shift 按下时为追加选择）
// - 批量操作：整体右移 / 整体左移 / 统一成一个层级（以选中项中最靠上的层级为准）
const Outline = (() => {
  let root = null;
  let container = null;
  let onChange = null;
  let dragId = null;
  let dropIndicator = null; // { row, zone, targetId }
  const selection = new Set();

  function init(rootModel, mountEl, changeCb) {
    root = rootModel;
    container = mountEl;
    onChange = changeCb || null;
    bindEvents();
  }

  function setRoot(rootModel) {
    if (rootModel !== root) selection.clear(); // 外部重新解析后 id 全部失效
    root = rootModel;
  }

  // ---- 渲染 ----
  function render(focusId) {
    container.innerHTML = "";
    if (!root.children.length) root.children.push(Model.createNode(""));

    // 清理已不存在的选择项
    const alive = new Set();
    (function dfs(node) { node.children.forEach((c) => { alive.add(c.id); dfs(c); }); })(root);
    [...selection].forEach((id) => { if (!alive.has(id)) selection.delete(id); });

    if (selection.size) container.appendChild(renderBatchBar());
    for (const child of root.children) container.appendChild(renderNode(child));

    const addBtn = document.createElement("button");
    addBtn.className = "add-root-btn";
    addBtn.textContent = "+ 添加条目";
    addBtn.addEventListener("click", () => {
      const node = Model.createNode("");
      root.children.push(node);
      changed(node.id);
    });
    container.appendChild(addBtn);

    if (focusId) focusInput(focusId);
  }

  function renderBatchBar() {
    const bar = document.createElement("div");
    bar.className = "batch-bar";
    const label = document.createElement("span");
    label.textContent = `已选 ${selection.size} 项`;
    bar.appendChild(label);
    const acts = [
      ["indent", "整体右移"],
      ["outdent", "整体左移"],
      ["unify", "统一层级"],
      ["clear", "清除选择"],
    ];
    for (const [act, text] of acts) {
      const btn = document.createElement("button");
      btn.textContent = text;
      btn.dataset.act = act;
      bar.appendChild(btn);
    }
    return bar;
  }

  function renderNode(node) {
    const wrap = document.createElement("div");
    wrap.className = "node";
    wrap.dataset.id = node.id;

    const row = document.createElement("div");
    row.className = "node-row";
    row.dataset.id = node.id;
    if (selection.has(node.id)) row.classList.add("selected");

    const box = document.createElement("input");
    box.type = "checkbox";
    box.className = "sel-box";
    box.checked = selection.has(node.id);
    box.title = "选择";

    const handle = document.createElement("span");
    handle.className = "drag-handle";
    handle.textContent = "⠿";
    handle.title = "拖拽排序 / 调整层级";
    handle.draggable = true;

    const input = document.createElement("input");
    input.type = "text";
    input.value = node.text;
    input.dataset.id = node.id;
    input.placeholder = "输入内容…";

    const del = document.createElement("button");
    del.className = "del-btn";
    del.textContent = "×";
    del.title = "删除";

    row.append(box, handle, input, del);
    wrap.appendChild(row);

    if (node.children.length) {
      const kids = document.createElement("div");
      kids.className = "node-children";
      for (const c of node.children) kids.appendChild(renderNode(c));
      wrap.appendChild(kids);
    }
    return wrap;
  }

  function focusInput(id) {
    const input = container.querySelector(`input[data-id="${id}"]`);
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }

  function changed(focusId) {
    render(focusId);
    if (onChange) onChange();
  }

  // ---- 事件 ----
  function bindEvents() {
    // 文本编辑：直接写回模型，不重渲染
    container.addEventListener("input", (e) => {
      const input = e.target.closest("input[data-id]");
      if (!input) return;
      const loc = Model.find(root, input.dataset.id);
      if (loc) {
        loc.node.text = input.value;
        if (onChange) onChange();
      }
    });

    container.addEventListener("keydown", (e) => {
      const input = e.target.closest("input[data-id]");
      if (!input) return;
      const id = input.dataset.id;
      if (e.key === "Enter") {
        e.preventDefault();
        const loc = Model.find(root, id);
        if (!loc) return;
        const node = Model.createNode("");
        loc.parent.children.splice(loc.index + 1, 0, node);
        changed(node.id);
      } else if (e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) outdent(id);
        else indent(id);
      } else if (e.key === "Backspace" && input.value === "") {
        e.preventDefault();
        removeNode(id);
      }
    });

    container.addEventListener("click", (e) => {
      const batchBtn = e.target.closest(".batch-bar button");
      if (batchBtn) {
        runBatchAction(batchBtn.dataset.act);
        return;
      }
      const box = e.target.closest(".sel-box");
      if (box) {
        const id = box.closest(".node-row").dataset.id;
        if (box.checked) selection.add(id);
        else selection.delete(id);
        render();
        return;
      }
      const btn = e.target.closest(".del-btn");
      if (btn) {
        removeNode(btn.closest(".node-row").dataset.id);
      }
    });

    // 多行粘贴：拆分为多个同级条目
    container.addEventListener("paste", (e) => {
      const input = e.target.closest("input[data-id]");
      if (!input) return;
      const text = (e.clipboardData || window.clipboardData).getData("text");
      if (!text || !text.includes("\n")) return;
      e.preventDefault();
      const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      if (!lines.length) return;
      const loc = Model.find(root, input.dataset.id);
      if (!loc) return;
      loc.node.text = (loc.node.text + lines[0]).trim();
      lines.slice(1).forEach((t, i) => {
        loc.parent.children.splice(loc.index + 1 + i, 0, Model.createNode(t));
      });
      changed(input.dataset.id);
    });

    // ---- 框选：在空白处按住拖动出矩形 ----
    container.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      if (e.target.closest(".node-row, button, input")) return;
      e.preventDefault();
      startRubberBand(e);
    });

    // ---- 拖拽 ----
    container.addEventListener("dragstart", (e) => {
      const handle = e.target.closest(".drag-handle");
      if (!handle) return;
      const row = handle.closest(".node-row");
      dragId = row.dataset.id;
      row.closest(".node").classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", dragId);
    });

    container.addEventListener("dragover", (e) => {
      if (!dragId) return;
      const row = e.target.closest(".node-row");
      clearIndicator();
      if (!row) return;
      const targetId = row.dataset.id;
      if (Model.isAncestor(root, dragId, targetId)) return; // 禁止拖入自身或后代
      e.preventDefault();
      const rect = row.getBoundingClientRect();
      const ratio = (e.clientY - rect.top) / rect.height;
      let zone;
      if (ratio < 0.25) zone = "before";
      else if (ratio > 0.75) zone = "after";
      else zone = "into"; // 整行高亮：成为其子级（跨层级）
      row.classList.add("drag-" + zone);
      dropIndicator = { row, zone, targetId };
      e.dataTransfer.dropEffect = "move";
    });

    container.addEventListener("drop", (e) => {
      if (!dragId || !dropIndicator) return;
      e.preventDefault();
      const { zone, targetId } = dropIndicator;
      if (zone === "into") {
        const loc = Model.find(root, targetId);
        Model.move(root, dragId, targetId, loc.node.children.length);
      } else {
        const loc = Model.find(root, targetId);
        const index = zone === "before" ? loc.index : loc.index + 1;
        Model.move(root, dragId, loc.parent.id, index);
      }
      endDrag();
      changed(dragId);
    });

    container.addEventListener("dragend", () => endDrag());
  }

  // ---- 框选实现 ----
  function startRubberBand(e) {
    const startX = e.clientX;
    const startY = e.clientY;
    const additive = e.ctrlKey || e.metaKey || e.shiftKey;
    const base = additive ? new Set(selection) : new Set();

    const div = document.createElement("div");
    div.className = "rubber-band";
    document.body.appendChild(div);

    function onMove(ev) {
      const x1 = Math.min(startX, ev.clientX);
      const y1 = Math.min(startY, ev.clientY);
      const x2 = Math.max(startX, ev.clientX);
      const y2 = Math.max(startY, ev.clientY);
      Object.assign(div.style, {
        left: x1 + "px",
        top: y1 + "px",
        width: x2 - x1 + "px",
        height: y2 - y1 + "px",
      });
      selection.clear();
      base.forEach((id) => selection.add(id));
      container.querySelectorAll(".node-row").forEach((row) => {
        const r = row.getBoundingClientRect();
        const hit = r.left < x2 && r.right > x1 && r.top < y2 && r.bottom > y1;
        if (hit) selection.add(row.dataset.id);
        row.classList.toggle("selected", selection.has(row.dataset.id));
        const box = row.querySelector(".sel-box");
        if (box) box.checked = selection.has(row.dataset.id);
      });
    }

    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      div.remove();
      render(); // 刷新批量工具栏
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  // ---- 批量层级操作 ----
  function selectedEntries() {
    const out = [];
    (function dfs(node, depth) {
      node.children.forEach((c) => {
        if (selection.has(c.id)) out.push({ node: c, depth: depth + 1 });
        dfs(c, depth + 1);
      });
    })(root, 0);
    return out; // 文档顺序
  }

  function runBatchAction(act) {
    if (act === "clear") {
      selection.clear();
      render();
      return;
    }
    if (act === "indent") batchIndent();
    else if (act === "outdent") batchOutdent();
    else if (act === "unify") batchUnify();
    changed();
  }

  // 整体右移：前一个兄弟未被选中时，成为其最后一个子级（已选兄弟会一起右移，保持相对结构）
  function batchIndent() {
    for (const { node } of selectedEntries()) {
      const loc = Model.find(root, node.id);
      if (!loc || loc.index === 0) continue;
      const prev = loc.parent.children[loc.index - 1];
      if (selection.has(prev.id)) continue;
      Model.move(root, node.id, prev.id, prev.children.length);
    }
  }

  // 整体左移：父级未被选中时，移到祖父级中父级之后（父级已选则由父级带着走）
  // 逆序处理，保证同级选中项移动后顺序不变
  function batchOutdent() {
    for (const { node } of selectedEntries().reverse()) {
      const loc = Model.find(root, node.id);
      if (!loc || loc.parent.id === "root") continue;
      if (selection.has(loc.parent.id)) continue;
      const ploc = Model.find(root, loc.parent.id);
      Model.move(root, node.id, ploc.parent.id, ploc.index + 1);
    }
  }

  // 统一层级：以文档顺序第一个选中项的层级为目标，逐级缩进/提升到位
  function batchUnify() {
    const entries = selectedEntries();
    if (!entries.length) return;
    const target = entries[0].depth;
    for (const { node } of entries) {
      for (let guard = 0; guard < 100; guard++) {
        const loc = Model.find(root, node.id);
        if (!loc || loc.depth === target) break;
        if (loc.depth > target) {
          if (loc.parent.id === "root") break;
          const ploc = Model.find(root, loc.parent.id);
          if (!Model.move(root, node.id, ploc.parent.id, ploc.index + 1)) break;
        } else {
          if (loc.index === 0) break;
          const prev = loc.parent.children[loc.index - 1];
          if (!Model.move(root, node.id, prev.id, prev.children.length)) break;
        }
      }
    }
  }

  // ---- 拖拽辅助 ----
  function clearIndicator() {
    if (dropIndicator) {
      dropIndicator.row.classList.remove("drag-before", "drag-after", "drag-into");
      dropIndicator = null;
    }
  }

  function endDrag() {
    clearIndicator();
    const el = container.querySelector(".node.dragging");
    if (el) el.classList.remove("dragging");
    dragId = null;
  }

  // ---- 单条目键盘操作 ----
  function indent(id) {
    const loc = Model.find(root, id);
    if (!loc || loc.index === 0) return;
    const prev = loc.parent.children[loc.index - 1];
    Model.move(root, id, prev.id, prev.children.length);
    changed(id);
  }

  function outdent(id) {
    const loc = Model.find(root, id);
    if (!loc || loc.parent.id === "root") return;
    const parentLoc = Model.find(root, loc.parent.id);
    Model.move(root, id, parentLoc.parent.id, parentLoc.index + 1);
    changed(id);
  }

  function removeNode(id) {
    const inputs = [...container.querySelectorAll("input[data-id]")];
    const idx = inputs.findIndex((i) => i.dataset.id === id);
    const prevId = idx > 0 ? inputs[idx - 1].dataset.id : null;
    selection.delete(id);
    Model.remove(root, id);
    changed(prevId);
  }

  return { init, setRoot, render };
})();
