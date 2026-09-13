"use strict";

// 极简 vim 模式（仅用于 markdown 编辑区）：NORMAL / INSERT 两态
// 支持：h j k l w b 0 $ gg G（含数字前缀）、i a A I o O、x dd yy p、u、Esc
const Vim = (() => {
  let ta = null;
  let indicator = null;
  let enabled = false;
  let mode = "insert";
  let pending = null; // "d" | "y" | "g"
  let count = "";
  let register = { text: "", linewise: false };

  const PASS_THROUGH = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"];

  function attach(textarea, indicatorEl) {
    ta = textarea;
    indicator = indicatorEl;
  }

  function enable() {
    if (enabled) return;
    enabled = true;
    mode = "normal";
    ta.addEventListener("keydown", onKey, true);
    updateIndicator();
  }

  function disable() {
    if (!enabled) return;
    enabled = false;
    ta.removeEventListener("keydown", onKey, true);
    updateIndicator();
  }

  function isEnabled() {
    return enabled;
  }

  function updateIndicator() {
    if (!indicator) return;
    indicator.hidden = !enabled;
    if (enabled) {
      indicator.textContent = mode.toUpperCase();
      indicator.dataset.mode = mode;
    }
  }

  function setInsert() {
    mode = "insert";
    pending = null;
    count = "";
    updateIndicator();
  }

  function setNormal() {
    mode = "normal";
    pending = null;
    count = "";
    updateIndicator();
  }

  // ---- 光标与文本工具 ----
  const val = () => ta.value;
  const pos = () => ta.selectionStart;

  function setPos(p) {
    p = Math.max(0, Math.min(p, val().length));
    ta.selectionStart = ta.selectionEnd = p;
  }

  function lineBounds(p) {
    const v = val();
    const s = v.lastIndexOf("\n", p - 1) + 1;
    let e = v.indexOf("\n", p);
    if (e === -1) e = v.length;
    return { s, e };
  }

  const lines = () => val().split("\n");
  const lineIndex = (p) => val().slice(0, p).split("\n").length - 1;

  function gotoLineCol(n, col) {
    const ls = lines();
    n = Math.max(0, Math.min(n, ls.length - 1));
    let start = 0;
    for (let i = 0; i < n; i++) start += ls[i].length + 1;
    const maxCol = mode === "normal" ? Math.max(0, ls[n].length - 1) : ls[n].length;
    setPos(start + Math.min(col, maxCol));
  }

  function notifyChange() {
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function nextWord() {
    const v = val();
    for (let i = pos() + 1; i < v.length; i++) {
      if (/\w/.test(v[i]) && !/\w/.test(v[i - 1])) { setPos(i); return; }
    }
    setPos(v.length);
  }

  function prevWord() {
    const v = val();
    for (let i = pos() - 1; i > 0; i--) {
      if (/\w/.test(v[i]) && !/\w/.test(v[i - 1])) { setPos(i); return; }
    }
    setPos(0);
  }

  function deleteChars(n) {
    const { e } = lineBounds(pos());
    const end = Math.min(pos() + n, e);
    register = { text: val().slice(pos(), end), linewise: false };
    ta.setRangeText("", pos(), end, "start");
    notifyChange();
  }

  function deleteLines(n) {
    const idx = lineIndex(pos());
    const ls = lines();
    register = { text: ls.slice(idx, idx + n).join("\n"), linewise: true };
    const v = val();
    let s = 0;
    for (let i = 0; i < idx; i++) s += ls[i].length + 1;
    let e;
    if (idx + n < ls.length) {
      e = s;
      for (let i = idx; i < idx + n; i++) e += ls[i].length + 1;
    } else {
      e = v.length;
      if (s > 0) s -= 1; // 删除末尾行时连同前置换行
    }
    ta.setRangeText("", s, e, "start");
    notifyChange();
    gotoLineCol(Math.min(idx, lines().length - 1), 0);
  }

  function yankLines(n) {
    const idx = lineIndex(pos());
    register = { text: lines().slice(idx, idx + n).join("\n"), linewise: true };
  }

  function pasteAfter() {
    if (!register.text) return;
    if (register.linewise) {
      const { e } = lineBounds(pos());
      const idx = lineIndex(pos());
      ta.setRangeText("\n" + register.text, e, e, "start");
      notifyChange();
      gotoLineCol(idx + 1, 0);
    } else {
      const at = Math.min(pos() + 1, val().length);
      ta.setRangeText(register.text, at, at, "end");
      notifyChange();
    }
  }

  function openLine(above) {
    const { s, e } = lineBounds(pos());
    if (above) {
      ta.setRangeText("\n", s, s, "start");
      setPos(s);
    } else {
      ta.setRangeText("\n", e, e, "end");
    }
    notifyChange();
    setInsert();
  }

  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return; // 放过系统快捷键
    if (PASS_THROUGH.includes(e.key)) return;

    if (mode === "insert") {
      if (e.key === "Escape") {
        e.preventDefault();
        const { s } = lineBounds(pos());
        if (pos() > s) setPos(pos() - 1);
        setNormal();
      }
      return;
    }

    e.preventDefault();
    const key = e.key;
    if (key === "Escape") { pending = null; count = ""; return; }

    // 数字前缀（0 单独按时是行首移动）
    if (/^[0-9]$/.test(key) && !(key === "0" && count === "")) { count += key; return; }
    const hadCount = count !== "";
    const n = Math.max(1, parseInt(count || "1", 10));
    count = "";

    if (pending) {
      const p = pending;
      pending = null;
      if (p === "g" && key === "g") gotoLineCol(hadCount ? n - 1 : 0, 0);
      else if (p === "d" && key === "d") deleteLines(n);
      else if (p === "y" && key === "y") yankLines(n);
      return;
    }

    const { s, e: le } = lineBounds(pos());
    switch (key) {
      case "h": setPos(Math.max(s, pos() - n)); break;
      case "l": setPos(Math.min(Math.max(s, le - 1), pos() + n)); break;
      case "j": gotoLineCol(lineIndex(pos()) + n, pos() - s); break;
      case "k": gotoLineCol(lineIndex(pos()) - n, pos() - s); break;
      case "0": setPos(s); break;
      case "$": setPos(Math.max(s, le - 1)); break;
      case "w": for (let i = 0; i < n; i++) nextWord(); break;
      case "b": for (let i = 0; i < n; i++) prevWord(); break;
      case "G": gotoLineCol(hadCount ? n - 1 : lines().length - 1, 0); break;
      case "i": setInsert(); break;
      case "a": setPos(Math.min(pos() + 1, le)); setInsert(); break;
      case "A": setPos(le); setInsert(); break;
      case "I": setPos(s); setInsert(); break;
      case "o": openLine(false); break;
      case "O": openLine(true); break;
      case "x": deleteChars(n); break;
      case "d": pending = "d"; break;
      case "y": pending = "y"; break;
      case "g": pending = "g"; break;
      case "p": for (let i = 0; i < n; i++) pasteAfter(); break;
      case "u": document.execCommand("undo"); notifyChange(); break;
    }
  }

  return { attach, enable, disable, isEnabled };
})();
