import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseMarkdown, serializeMarkdown } from '../src/intermediate-tree.mjs';
import {
  outlineRows,
  locateNode,
  setNodeText,
  insertSibling,
  indentNode,
  outdentNode,
  removeNode,
  removeNodes,
  appendItem,
  moveNodes,
  describeOutlineReason,
  pathKey,
  comparePaths,
} from '../src/outline.mjs';

// 结构等价比较：忽略对象身份，递归比对 kind / text / level / children
function normalize(node) {
  const out = { kind: node.kind, text: node.text, children: node.children.map(normalize) };
  if (node.kind === 'heading') out.level = node.level;
  return out;
}

// 结构操作的结果树必须能原样序列化并重新解析（round-trip 稳定）
function assertStable(tree) {
  assert.deepEqual(
    normalize(parseMarkdown(serializeMarkdown(tree))),
    normalize(tree),
    '结果树应变回同一结构',
  );
}

const treeOf = (lines) => parseMarkdown(lines.join('\n'));

test('outlineRows：深度优先投影，携带 path / depth / kind / text', () => {
  const tree = treeOf(['# A', '', '- b', '  - c', '', '```js', 'x', '```']);
  assert.deepEqual(
    outlineRows(tree).map((r) => [r.path, r.depth, r.kind, r.text]),
    [
      [[0], 0, 'heading', 'A'],
      [[0, 0], 1, 'list-item', 'b'],
      [[0, 0, 0], 2, 'list-item', 'c'],
      [[0, 1], 1, 'leaf-block', '```js\nx\n```'],
    ],
  );
});

test('outlineRows：空树投影为空列表', () => {
  assert.deepEqual(outlineRows(parseMarkdown('')), []);
});

test('locateNode：按下标路径取回节点与其父级', () => {
  const tree = treeOf(['- a', '  - b']);
  const loc = locateNode(tree, [0, 0]);
  assert.equal(loc.node.text, 'b');
  assert.equal(loc.parent.text, 'a');
  assert.equal(loc.index, 0);
  assert.equal(locateNode(tree, [9]), null);
  assert.equal(locateNode(tree, []), null);
});

test('setNodeText：行内 Markdown 原样保真，写入后 markdown 重生成', () => {
  const tree = treeOf(['# A', '', '- b']);
  const res = setNodeText(tree, [0, 0], '带 **粗体** 的 b');
  assert.equal(res.applied, true);
  assert.equal(serializeMarkdown(res.tree), ['# A', '', '- 带 **粗体** 的 b'].join('\n'));
});

test('setNodeText：非法路径被拒且返回原树', () => {
  const tree = treeOf(['- a']);
  const res = setNodeText(tree, [3], 'x');
  assert.equal(res.applied, false);
  assert.equal(res.tree, tree);
});

test('insertSibling：列表项后新建空同级并返回新路径', () => {
  const tree = treeOf(['- a', '- b']);
  const res = insertSibling(tree, [0]);
  assert.equal(res.applied, true);
  assert.deepEqual(res.paths, [[1]]);
  assert.equal(serializeMarkdown(res.tree), ['- a', '- ', '- b'].join('\n'));
});

test('insertSibling：标题沿用原 level（标题仍是 #）', () => {
  const tree = treeOf(['## A']);
  const res = insertSibling(tree, [0]);
  assert.equal(serializeMarkdown(res.tree), ['## A', '', '## '].join('\n'));
  assertStable(res.tree);
});

test('indentNode：成为前一个同级节点的子级', () => {
  const tree = treeOf(['- a', '- b']);
  const res = indentNode(tree, [1]);
  assert.equal(res.applied, true);
  assert.deepEqual(res.paths, [[0, 0]]);
  assert.equal(serializeMarkdown(res.tree), ['- a', '  - b'].join('\n'));
  assertStable(res.tree);
});

test('indentNode：首个同级节点无法缩进', () => {
  const tree = treeOf(['- a', '- b']);
  const res = indentNode(tree, [0]);
  assert.equal(res.applied, false);
  assert.equal(res.reason, 'first-sibling');
  assert.equal(res.tree, tree);
});

test('indentNode：段落不能作为父级（markdown 无法表达）', () => {
  const tree = treeOf(['# A', '', '一段文字', '', '## B']);
  const res = indentNode(tree, [0, 1]);
  assert.equal(res.applied, false);
  assert.equal(res.reason, 'unrepresentable');
});

test('indentNode：标题缩进后按父标题重定级', () => {
  const tree = treeOf(['# A', '', '## B', '', '## C']);
  const res = indentNode(tree, [0, 1]);
  assert.equal(res.applied, true);
  assert.equal(serializeMarkdown(res.tree), ['# A', '', '## B', '', '### C'].join('\n'));
  assertStable(res.tree);
});

test('indentNode：标题层级超过 6 级时拒绝', () => {
  const tree = treeOf(['# A', '', '###### B', '', '###### C']);
  const res = indentNode(tree, [0, 1]);
  assert.equal(res.applied, false);
  assert.equal(res.reason, 'heading-depth-limit');
});

test('indentNode：列表项内的标题不能再有子标题，拒绝', () => {
  // `# N` 想成为列表项内 `# P` 的子节点——重新解析时 N 会被列表项接管成 P 的兄弟
  const tree = treeOf(['- L', '', '  # P', '', '  # N']);
  const res = indentNode(tree, [0, 1]);
  assert.equal(res.applied, false);
  assert.equal(res.reason, 'unrepresentable');
});

test('outdentNode：移到祖父级、紧随原父级之后', () => {
  const tree = treeOf(['- a', '  - b']);
  const res = outdentNode(tree, [0, 0]);
  assert.equal(res.applied, true);
  assert.deepEqual(res.paths, [[1]]);
  assert.equal(serializeMarkdown(res.tree), ['- a', '- b'].join('\n'));
  assertStable(res.tree);
});

test('outdentNode：顶层节点无法取消缩进', () => {
  const tree = treeOf(['- a']);
  const res = outdentNode(tree, [0]);
  assert.equal(res.applied, false);
  assert.equal(res.reason, 'already-top-level');
});

test('outdentNode：标题取消缩进到顶层时降为一级标题', () => {
  const tree = treeOf(['# A', '', '## B']);
  const res = outdentNode(tree, [0, 0]);
  assert.equal(res.applied, true);
  assert.equal(serializeMarkdown(res.tree), ['# A', '', '# B'].join('\n'));
  assertStable(res.tree);
});

test('outdentNode：标题取消缩进到二级标题下时跟着降级', () => {
  const tree = treeOf(['# A', '', '## B', '', '### C']);
  const res = outdentNode(tree, [0, 0, 0]);
  assert.equal(res.applied, true);
  assert.deepEqual(res.paths, [[0, 1]]);
  assert.equal(serializeMarkdown(res.tree), ['# A', '', '## B', '', '## C'].join('\n'));
  assertStable(res.tree);
});

test('outdentNode：标题小节之后的同级块会被标题吞掉，拒绝', () => {
  // `# A` 之后的 `- b` 在 markdown 里仍属于 A 的小节，
  // 取消缩进到顶层无法表达——拒绝比让中间树与 Markdown 分叉更好
  const tree = treeOf(['# A', '', '- a', '- b']);
  const res = outdentNode(tree, [0, 1]);
  assert.equal(res.applied, false);
  assert.equal(res.reason, 'unrepresentable');
  assert.equal(res.tree, tree);
});

test('outdentNode：列表项子树里带标题时，移到标题小节外无法表达', () => {
  const tree = treeOf(['- L', '', '  # H', '', '  N']);
  const res = outdentNode(tree, [0, 1]); // N 的父级是列表项 L
  assert.equal(res.applied, false);
  assert.equal(res.reason, 'unrepresentable');
});

test('结构操作：基线本身还原不了时 best-effort 放行', () => {
  // 段落文本手打成块级标记后，这棵树序列化再解析会变成标题，
  // 此时不应连带禁止所有结构操作
  const tree = treeOf(['# A', '', '一段文字', '', '- a', '- b']);
  const broken = setNodeText(tree, [0, 0], '# 变成标题').tree;
  const res = indentNode(broken, [0, 2]); // b 缩进到 a 之下
  assert.equal(res.applied, true);
  assert.equal(res.reason, null);
});

test('结构操作：不忠实基线下，标题层级越界仍然拒绝', () => {
  const tree = treeOf(['# A', '', '一段', '', '###### B', '', '###### C']);
  const broken = setNodeText(tree, [0, 0], '# 破').tree;
  const res = indentNode(broken, [0, 2]); // C 缩进到 6 级 B 之下 → 7 级
  assert.equal(res.applied, false);
  assert.equal(res.reason, 'heading-depth-limit');
});

test('结构操作：不忠实基线下，标题层级被压出 1-6 级仍然拒绝', () => {
  const tree = treeOf(['# A', '', '一段', '', '###### H', '', '- L', '', '  # X']);
  const broken = setNodeText(tree, [0, 0], '# 破').tree;
  const res = outdentNode(broken, [0, 1]); // H 取消缩进 → X 的层级被压到负数
  assert.equal(res.applied, false);
  assert.equal(res.reason, 'heading-depth-limit');
});

test('结构操作：不忠实基线下，被改动区域结构分叉仍然拒绝', () => {
  // 缩进后 `- b` 会被「二段2」上方的标题吞成兄弟，缩进效果在写回时丢失
  const tree = treeOf(['# A', '', '一段1', '', '二段2', '', '- b']);
  const broken = setNodeText(tree, [0, 0], '# 破').tree;
  const res = indentNode(broken, [0, 2]);
  assert.equal(res.applied, false);
  assert.equal(res.reason, 'unrepresentable');
});

test('removeNode：删除节点并给出后继焦点路径', () => {
  const tree = treeOf(['- a', '- b', '- c']);
  const res = removeNode(tree, [1]);
  assert.equal(res.applied, true);
  assert.deepEqual(res.paths, [[0]]);
  assert.equal(serializeMarkdown(res.tree), ['- a', '- c'].join('\n'));
});

test('removeNode：删除唯一节点后无焦点路径', () => {
  const tree = treeOf(['- a']);
  const res = removeNode(tree, [0]);
  assert.equal(res.applied, true);
  assert.deepEqual(res.paths, []);
  assert.equal(serializeMarkdown(res.tree), '');
});

test('结构操作：缩进 / 取消缩进 / 新建后 markdown 按 kind 正确重生成', () => {
  const tree = treeOf(['# 题单', '', '- 第一章', '  - 1.1', '- 第二章']);
  const indented = indentNode(tree, [0, 1]); // 第二章 缩进到 第一章 下
  assert.equal(
    serializeMarkdown(indented.tree),
    ['# 题单', '', '- 第一章', '  - 1.1', '  - 第二章'].join('\n'),
  );
  const outdented = outdentNode(indented.tree, indented.paths[0]); // 再取消缩进
  assert.equal(serializeMarkdown(outdented.tree), serializeMarkdown(tree));
  assertStable(outdented.tree);
});

test('describeOutlineReason：覆盖全部拒绝原因', () => {
  for (const reason of [
    'first-sibling',
    'not-siblings',
    'unrepresentable',
    'heading-depth-limit',
    'already-top-level',
  ]) {
    assert.equal(typeof describeOutlineReason(reason), 'string');
    assert.ok(describeOutlineReason(reason).length > 0);
  }
});

test('pathKey / comparePaths：路径的规范字符串与文档顺序', () => {
  assert.equal(pathKey([0, 2, 1]), '0.2.1');
  const paths = [[1], [0, 2], [0], [0, 1]];
  assert.deepEqual([...paths].sort(comparePaths), [[0], [0, 1], [0, 2], [1]]);
});

// ---- 多选批量删除：只要求同父（见 ADR-0001） ----

test('removeNodes：批量删除整段并给出落点', () => {
  const tree = treeOf(['- a', '- b', '- c', '- d']);
  const res = removeNodes(tree, [[1], [2]]);
  assert.equal(res.applied, true);
  assert.deepEqual(res.paths, [[0]]);
  assert.equal(serializeMarkdown(res.tree), ['- a', '- d'].join('\n'));
  assertStable(res.tree);
});

test('removeNodes：非连续同父多选也能删（删除不要求连续）', () => {
  const tree = treeOf(['- a', '- b', '- c', '- d']);
  const res = removeNodes(tree, [[0], [2]]);
  assert.equal(res.applied, true);
  assert.deepEqual(res.paths, [[0]]);
  assert.equal(serializeMarkdown(res.tree), ['- b', '- d'].join('\n'));
  assertStable(res.tree);
});

test('removeNodes：删除含子树的节点时后代一起走', () => {
  const tree = treeOf(['- a', '- b', '  - b1', '- c']);
  const res = removeNodes(tree, [[1]]);
  assert.equal(res.applied, true);
  assert.equal(serializeMarkdown(res.tree), ['- a', '- c'].join('\n'));
  assertStable(res.tree);
});

test('removeNodes：跨父级多选被拒', () => {
  const tree = treeOf(['- a', '  - b', '- c']);
  const res = removeNodes(tree, [[0, 0], [1]]);
  assert.equal(res.applied, false);
  assert.equal(res.reason, 'not-siblings');
});

// ---- 拖拽落点：moveNodes（above / inside / below）----

test('moveNodes：below 同级排序（搬到目标之后）', () => {
  const tree = treeOf(['- a', '- b', '- c']);
  const res = moveNodes(tree, [[0]], [2], 'below');
  assert.equal(res.applied, true);
  assert.deepEqual(res.paths, [[2]]);
  assert.equal(serializeMarkdown(res.tree), ['- b', '- c', '- a'].join('\n'));
  assertStable(res.tree);
});

test('moveNodes：above 同级排序（搬到目标之前）', () => {
  const tree = treeOf(['- a', '- b', '- c']);
  const res = moveNodes(tree, [[2]], [0], 'above');
  assert.equal(res.applied, true);
  assert.deepEqual(res.paths, [[0]]);
  assert.equal(serializeMarkdown(res.tree), ['- c', '- a', '- b'].join('\n'));
  assertStable(res.tree);
});

test('moveNodes：inside 成为目标的最后一个子级（拖入式嵌套）', () => {
  const tree = treeOf(['- a', '- b', '- c']);
  const res = moveNodes(tree, [[2]], [0], 'inside');
  assert.equal(res.applied, true);
  assert.deepEqual(res.paths, [[0, 0]]);
  assert.equal(serializeMarkdown(res.tree), ['- a', '  - c', '- b'].join('\n'));
  assertStable(res.tree);
});

test('moveNodes：整组多选一起搬，相对顺序保持', () => {
  const tree = treeOf(['- a', '- b', '- c', '- d']);
  const res = moveNodes(tree, [[1], [2]], [0], 'above'); // b、c 搬到 a 之前
  assert.equal(res.applied, true);
  assert.deepEqual(res.paths, [[0], [1]]);
  assert.equal(serializeMarkdown(res.tree), ['- b', '- c', '- a', '- d'].join('\n'));
  assertStable(res.tree);
});

test('moveNodes：拖到自身或后代上被拒（循环防护）', () => {
  const tree = treeOf(['- a', '  - a1', '- b']);
  const self = moveNodes(tree, [[0]], [0], 'inside');
  assert.equal(self.applied, false);
  assert.equal(self.reason, 'invalid-target');
  const descendant = moveNodes(tree, [[0]], [0, 0], 'above');
  assert.equal(descendant.applied, false);
  assert.equal(descendant.reason, 'invalid-target');
});

test('moveNodes：不相邻的同父多选也整组搬（拖拽不要求连续）', () => {
  const tree = treeOf(['- a', '- b', '- c', '- d']);
  const res = moveNodes(tree, [[0], [2]], [3], 'below'); // a、c 搬到 d 之后
  assert.equal(res.applied, true);
  assert.equal(serializeMarkdown(res.tree), ['- b', '- d', '- a', '- c'].join('\n'));
  assertStable(res.tree);
});

test('moveNodes：跨父级拖拽（inside 别的分支）', () => {
  const tree = treeOf(['- a', '  - a1', '- b']);
  const res = moveNodes(tree, [[0, 0]], [1], 'inside');
  assert.equal(res.applied, true);
  assert.equal(serializeMarkdown(res.tree), ['- a', '- b', '  - a1'].join('\n'));
  assertStable(res.tree);
});

test('moveNodes：无法在 markdown 还原的落点被拒', () => {
  // 段落不能有子节点：拖进段落必然无法还原
  const tree = treeOf(['- a', '', '一段文字', '', '- b']);
  const res = moveNodes(tree, [[0]], [1], 'inside');
  assert.equal(res.applied, false);
  assert.equal(res.reason, 'unrepresentable');
});

// ---- 末尾新建条目（规则 A：与最后一个条目同级同 kind）----

test('appendItem：扁平列表里加在末尾，成为顶级同级条目', () => {
  const tree = treeOf(['- a', '- b']);
  const res = appendItem(tree);
  assert.equal(res.applied, true);
  assert.deepEqual(res.paths, [[2]]);
  assert.equal(serializeMarkdown(res.tree), ['- a', '- b', '- 新条目'].join('\n'));
  assertStable(res.tree);
});

test('appendItem：文档结尾是嵌套项时加在同一层', () => {
  const tree = treeOf(['# 题单', '', '- 第一章', '  - 1.1']);
  const res = appendItem(tree);
  assert.equal(res.applied, true);
  assert.deepEqual(res.paths, [[0, 0, 1]]);
  assert.equal(
    serializeMarkdown(res.tree),
    ['# 题单', '', '- 第一章', '  - 1.1', '  - 新条目'].join('\n'),
  );
  assertStable(res.tree);
});

test('appendItem：空文档建一个顶级列表项', () => {
  const res = appendItem(parseMarkdown(''));
  assert.equal(res.applied, true);
  assert.equal(serializeMarkdown(res.tree), '- 新条目');
  assertStable(res.tree);
});

test('appendItem：结尾是标题时沿用同一级标题', () => {
  const tree = treeOf(['# A', '', '## B']);
  const res = appendItem(tree);
  assert.equal(res.applied, true);
  assert.equal(serializeMarkdown(res.tree), ['# A', '', '## B', '', '## 新条目'].join('\n'));
  assertStable(res.tree);
});

test('appendItem：结尾是叶子块时退回列表项', () => {
  const tree = treeOf(['- a', '', '```js', 'const x = 1;', '```']);
  const res = appendItem(tree);
  assert.equal(res.applied, true);
  assert.equal(
    serializeMarkdown(res.tree),
    ['- a', '', '```js', 'const x = 1;', '```', '', '- 新条目'].join('\n'),
  );
  assertStable(res.tree);
});

test('appendItem：结尾是列表项内的叶子块时加在列表项里', () => {
  const tree = treeOf(['- item', '', '  ```', '  code', '  ```']);
  const res = appendItem(tree);
  assert.equal(res.applied, true);
  assert.deepEqual(res.paths, [[0, 1]]);
  assert.equal(
    serializeMarkdown(res.tree),
    ['- item', '', '  ```', '  code', '  ```', '', '  - 新条目'].join('\n'),
  );
  assertStable(res.tree);
});
