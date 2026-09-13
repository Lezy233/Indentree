"use strict";

// Markdown <-> 模型
// 序列化有两种表示方式（opts.mode）：
// - "heading"（默认）：第 1~6 层用 # ~ ###### 标题，更深层用 "- " 列表（每深一层缩进 2 空格）。
// - "list"：所有层级一律用列表项 + 缩进表示；opts.marker 为 "-"（无序）或 "1."（有序编号）。
// 解析：# 数量即层级；无序（- * +）与有序（1. 1)）列表项用缩进栈规整层级（兼容 2/4 空格）；
// 列表层级 = 最近一个标题的层级 + 1 + 缩进层级，无标题时顶层列表项即第 1 层。
const Markdown = (() => {
  const HEADING_MAX = 6;

  function serialize(root, opts = {}) {
    const mode = opts.mode || "heading";
    const marker = opts.marker || "-";
    if (mode === "list") {
      // 列表模式：所有层级一律用列表项 + 缩进表示，marker 为 "-" 或有序编号
      const lines = [];
      (function dfs(node, depth) {
        node.children.forEach((child, i) => {
          const m = marker === "1." ? i + 1 + "." : marker;
          lines.push("  ".repeat(depth - 1) + m + " " + child.text);
          dfs(child, depth + 1);
        });
      })(root, 1);
      return lines.join("\n");
    }
    // 标题模式（默认）：第 1~6 层一律序列化为标题，更深层用列表
    const lines = [];
    (function dfs(node, depth) {
      for (const child of node.children) {
        if (depth <= HEADING_MAX) {
          lines.push("#".repeat(depth) + " " + child.text);
        } else {
          lines.push("  ".repeat(depth - HEADING_MAX - 1) + "- " + child.text);
        }
        dfs(child, depth + 1);
      }
    })(root, 1);
    return lines.join("\n");
  }

  function parse(text) {
    const root = Model.createRoot();
    const stack = [{ depth: 0, node: root }];
    const listIndents = []; // 无序列表出现过的缩进宽度栈
    let lastDepth = 1;
    let lastHeadingDepth = 0;

    for (const rawLine of text.split(/\r?\n/)) {
      if (!rawLine.trim()) continue;
      let depth;
      let content;
      const heading = rawLine.match(/^\s*(#{1,6})\s+(.*)$/);
      const item = rawLine.match(/^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$/);
      if (heading) {
        depth = heading[1].length;
        content = heading[2].trim();
        lastHeadingDepth = depth;
      } else if (item) {
        const indent = item[1].replace(/\t/g, "  ").length;
        while (listIndents.length && indent < listIndents[listIndents.length - 1]) listIndents.pop();
        if (!listIndents.length || indent > listIndents[listIndents.length - 1]) listIndents.push(indent);
        depth = lastHeadingDepth + 1 + (listIndents.length - 1);
        content = item[2].trim();
      } else {
        // 无法识别的行：作为上一条目的同级保留
        depth = lastDepth;
        content = rawLine.trim();
      }
      const node = Model.createNode(content);
      while (stack.length > 1 && stack[stack.length - 1].depth >= depth) stack.pop();
      stack[stack.length - 1].node.children.push(node);
      stack.push({ depth, node });
      lastDepth = depth;
    }
    return root;
  }

  return { serialize, parse };
})();
