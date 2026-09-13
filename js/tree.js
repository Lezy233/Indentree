"use strict";

// 树形图（连接线风格）<-> 模型
// 序列化支持自定义缩进空格数 N（每层宽度，默认 4）与级间空行数 M（默认 0）。
// 解析时自动检测缩进宽度；对不含连接线的纯缩进文本做降级解析，保证外部粘贴可用。
const Tree = (() => {
  const DEFAULTS = { indent: 4, gap: 0 };

  function serialize(root, opts = {}) {
    const indent = Math.max(2, Number(opts.indent) || DEFAULTS.indent);
    const gap = Math.max(0, Number(opts.gap) || 0);
    const cont = "│" + " ".repeat(indent - 1); // 未结束分支的祖先引导
    const blank = " ".repeat(indent); // 已结束分支的祖先引导
    const mid = "├" + "─".repeat(indent - 2) + " ";
    const last = "└" + "─".repeat(indent - 2) + " ";

    const lines = [];
    (function emit(node, prefix, isRoot) {
      node.children.forEach((child, i) => {
        const isLast = i === node.children.length - 1;
        lines.push(isRoot ? child.text : prefix + (isLast ? last : mid) + child.text);
        if (child.children.length) {
          for (let g = 0; g < gap; g++) lines.push("");
          emit(child, isRoot ? "" : prefix + (isLast ? blank : cont), false);
        }
      });
    })(root, "", true);
    return lines.join("\n");
  }

  function parse(text) {
    const rawLines = text.split(/\r?\n/).filter((l) => l.trim());
    const root = Model.createRoot();
    if (!rawLines.length) return root;

    const hasConnectors = rawLines.some((l) => /[├└]/.test(l));
    const pairs = hasConnectors ? parseConnectorLines(rawLines) : parsePlainIndent(rawLines);

    const stack = [{ depth: 0, node: root }];
    for (const { depth, text: content } of pairs) {
      const node = Model.createNode(content);
      const d = Math.max(1, depth);
      while (stack.length > 1 && stack[stack.length - 1].depth >= d) stack.pop();
      stack[stack.length - 1].node.children.push(node);
      stack.push({ depth: d, node });
    }
    return root;
  }

  // 按连接线所在列推断层级：自动检测每层宽度 N = 最小的正连接线索引
  function parseConnectorLines(lines) {
    let unit = 0;
    for (const l of lines) {
      const col = l.search(/[├└]/);
      if (col > 0 && (unit === 0 || col < unit)) unit = col;
    }
    if (!unit) unit = DEFAULTS.indent;
    return lines.map((l) => {
      const col = l.search(/[├└]/);
      if (col === -1) return { depth: 1, text: l.trim() };
      // 顶层条目无连接线；其子级的连接线位于列 0，故层级从 2 起算
      const depth = Math.round(col / unit) + 2;
      const content = l.slice(col).replace(/^[├└]─*\s?/, "").trim();
      return { depth, text: content };
    });
  }

  // 降级解析：纯空格缩进文本（兼容 "- " 列表符）
  function parsePlainIndent(lines) {
    const indents = [];
    return lines.map((l) => {
      const m = l.match(/^(\s*)(.*)$/);
      const indent = m[1].replace(/\t/g, "  ").length;
      while (indents.length && indent < indents[indents.length - 1]) indents.pop();
      if (!indents.length || indent > indents[indents.length - 1]) indents.push(indent);
      return { depth: indents.length, text: m[2].trim().replace(/^[-*+]\s+/, "") };
    });
  }

  return { serialize, parse, DEFAULTS };
})();
