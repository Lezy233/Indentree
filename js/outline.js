"use strict";

// 图形化大纲：嵌套可编辑列表，支持拖拽排序与跨层级拖动
const Outline = (() => {
  let root = null;
  let container = null;
  let onChange = null;
  let dragId = null;
  let dropIndicator = null; // { row, zone }

  function init(rootModel, mountEl, changeCb) {
    root = rootModel;
    container = mountEl;
    onChange = changeCb || null;
    bindEvents();
  }

  function setRoot(rootModel) {
    root = rootModel;
  }

  function render(focusId) {
    container.innerHTML = "";
    if (!root.children.length) root.children.push(Model.createNode(""));
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

  function renderNode(node) {
    const wrap = document.createElement("div");
    wrap.className = "node";
    wrap.dataset.id = node.id;

    const row = document.createElement("div");
    row.className = "node-row";
    row.dataset.id = node.id;

    const handle = document.createElement("span");
    handle.className = "drag-handle";
    handle.textContent = "⠿";
    handle.title = "拖拽排序";
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

    row.append(handle, input, del);
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

  function bindEvents() {
    // 文本编辑：直接写回模型，不重渲染
    container.addEventListener("input", (e) => {
      const input = e.target.closest("input[data-id]");
      if (!input) return;
      const loc = Model.find(root, input.dataset.id);
      if (loc) loc.node.text = input.value;
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
      const btn = e.target.closest(".del-btn");
      if (!btn) return;
      const row = btn.closest(".node-row");
      removeNode(row.dataset.id);
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
      // 禁止拖到自身或自己的后代上
      if (Model.isAncestor(root, dragId, targetId)) return;
      e.preventDefault();
      const rect = row.getBoundingClientRect();
      const ratio = (e.clientY - rect.top) / rect.height;
      let zone;
      if (ratio < 0.25) zone = "before";
      else if (ratio > 0.75) zone = "after";
      else zone = "into";
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

    container.addEventListener("dragend", () => {
      endDrag();
    });
  }

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

  // Tab：成为前一个兄弟的最后一个子级
  function indent(id) {
    const loc = Model.find(root, id);
    if (!loc || loc.index === 0) return;
    const prev = loc.parent.children[loc.index - 1];
    Model.move(root, id, prev.id, prev.children.length);
    changed(id);
  }

  // Shift+Tab：移到祖父级，跟在父级之后
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
    Model.remove(root, id);
    changed(prevId);
  }

  return { init, setRoot, render };
})();
