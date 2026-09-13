"use strict";

// Markdown <-> 模型
// 解析时为每个节点记录 style："h"（标题）或 "li"（无序列表项）。
// - 标题：# 的数量即层级（1~6）。
// - 列表项：层级 = 最近一个标题的层级 + 1 + 缩进层级（用缩进栈兼容 2/4 空格等任意缩进）；
//   若文档中没有标题，顶层列表项即第 1 层。
// 序列化时优先按节点记录的 style 还原；无 style 的节点（其他视图新建）按层级 1~6 为标题、更深为列表。
const Markdown = (() => {
  const HEADING_MAX = 6;

  function serialize(root) {
    const lines = [];
    (function dfs(node, depth, headingBase) {
      for (const child of node.children) {
        const style = child.style || (depth <= HEADING_MAX ? "h" : "li");
        if (style === "h" && depth <= HEADING_MAX) {
          lines.push("#".repeat(depth) + " " + child.text);
          dfs(child, depth + 1, depth);
        } else {
          lines.push("  ".repeat(depth - headingBase - 1) + "- " + child.text);
          dfs(child, depth + 1, headingBase);
        }
      }
    })(root, 1, 0);
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
      let style;
      const heading = rawLine.match(/^\s*(#{1,6})\s+(.*)$/);
      const item = rawLine.match(/^(\s*)[-*+]\s+(.*)$/);
      if (heading) {
        depth = heading[1].length;
        content = heading[2].trim();
        style = "h";
        lastHeadingDepth = depth;
      } else if (item) {
        const indent = item[1].replace(/\t/g, "  ").length;
        while (listIndents.length && indent < listIndents[listIndents.length - 1]) listIndents.pop();
        if (!listIndents.length || indent > listIndents[listIndents.length - 1]) listIndents.push(indent);
        depth = lastHeadingDepth + 1 + (listIndents.length - 1);
        content = item[2].trim();
        style = "li";
      } else {
        // 无法识别的行：作为上一条目的同级保留
        depth = lastDepth;
        content = rawLine.trim();
      }
      const node = Model.createNode(content);
      if (style) node.style = style;
      while (stack.length > 1 && stack[stack.length - 1].depth >= depth) stack.pop();
      stack[stack.length - 1].node.children.push(node);
      stack.push({ depth, node });
      lastDepth = depth;
    }
    return root;
  }

  return { serialize, parse };
})();
