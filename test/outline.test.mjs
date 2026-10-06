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
  describeOutlineReason,
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
  assert.deepEqual(res.path, [1]);
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
  assert.deepEqual(res.path, [0, 0]);
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
  assert.deepEqual(res.path, [1]);
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
  assert.deepEqual(res.path, [0, 1]);
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

test('removeNode：删除节点并给出后继焦点路径', () => {
  const tree = treeOf(['- a', '- b', '- c']);
  const res = removeNode(tree, [1]);
  assert.equal(res.applied, true);
  assert.deepEqual(res.path, [0]);
  assert.equal(serializeMarkdown(res.tree), ['- a', '- c'].join('\n'));
});

test('removeNode：删除唯一节点后无焦点路径', () => {
  const tree = treeOf(['- a']);
  const res = removeNode(tree, [0]);
  assert.equal(res.applied, true);
  assert.equal(res.path, null);
  assert.equal(serializeMarkdown(res.tree), '');
});

test('结构操作：缩进 / 取消缩进 / 新建后 markdown 按 kind 正确重生成', () => {
  const tree = treeOf(['# 题单', '', '- 第一章', '  - 1.1', '- 第二章']);
  const indented = indentNode(tree, [0, 1]); // 第二章 缩进到 第一章 下
  assert.equal(
    serializeMarkdown(indented.tree),
    ['# 题单', '', '- 第一章', '  - 1.1', '  - 第二章'].join('\n'),
  );
  const outdented = outdentNode(indented.tree, indented.path); // 再取消缩进
  assert.equal(serializeMarkdown(outdented.tree), serializeMarkdown(tree));
  assertStable(outdented.tree);
});

test('describeOutlineReason：覆盖全部拒绝原因', () => {
  for (const reason of [
    'first-sibling',
    'unrepresentable',
    'heading-depth-limit',
    'already-top-level',
  ]) {
    assert.equal(typeof describeOutlineReason(reason), 'string');
    assert.ok(describeOutlineReason(reason).length > 0);
  }
});
