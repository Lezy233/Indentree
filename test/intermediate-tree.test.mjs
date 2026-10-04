import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseMarkdown, renderTreeText } from '../src/intermediate-tree.mjs';

// 辅助：把中间树压成 [缩进, kind, text] 三元组，便于断言结构
function flatten(node, depth = 0) {
  if (node.kind !== 'root') {
    return [[depth, node.kind, node.text], ...node.children.flatMap((c) => flatten(c, depth + 1))];
  }
  return node.children.flatMap((c) => flatten(c, depth));
}

test('标题映射：标题深度折叠为父子嵌套', () => {
  const tree = parseMarkdown(['# A', '## B', '### C', '## D', '# E'].join('\n'));
  assert.deepEqual(flatten(tree), [
    [0, 'heading', 'A'],
    [1, 'heading', 'B'],
    [2, 'heading', 'C'],
    [1, 'heading', 'D'],
    [0, 'heading', 'E'],
  ]);
});

test('标题映射：跳级（# 直接到 ###）按出现顺序嵌套', () => {
  const tree = parseMarkdown(['# A', '### B', '# C'].join('\n'));
  assert.deepEqual(flatten(tree), [
    [0, 'heading', 'A'],
    [1, 'heading', 'B'],
    [0, 'heading', 'C'],
  ]);
});

test('列表嵌套映射：无序列表缩进折叠为父子嵌套', () => {
  const tree = parseMarkdown(['- a', '- b', '  - c', '  - d', '- e'].join('\n'));
  assert.deepEqual(flatten(tree), [
    [0, 'list-item', 'a'],
    [0, 'list-item', 'b'],
    [1, 'list-item', 'c'],
    [1, 'list-item', 'd'],
    [0, 'list-item', 'e'],
  ]);
});

test('列表嵌套映射：有序列表同样折叠', () => {
  const tree = parseMarkdown(['1. a', '2. b', '   1. c'].join('\n'));
  assert.deepEqual(flatten(tree), [
    [0, 'list-item', 'a'],
    [0, 'list-item', 'b'],
    [1, 'list-item', 'c'],
  ]);
});

test('混合写法：标题下的列表挂在标题节点下', () => {
  const tree = parseMarkdown(
    ['# 题单', '', '- 第一章', '  - 1.1', '  - 1.2', '', '## 小节', '', '- 第二章'].join('\n'),
  );
  assert.deepEqual(flatten(tree), [
    [0, 'heading', '题单'],
    [1, 'list-item', '第一章'],
    [2, 'list-item', '1.1'],
    [2, 'list-item', '1.2'],
    [1, 'heading', '小节'],
    [2, 'list-item', '第二章'],
  ]);
});

test('混合写法：顶层段落作为 paragraph 节点保留', () => {
  const tree = parseMarkdown(['# A', '', '一段说明文字', '', '- item'].join('\n'));
  assert.deepEqual(flatten(tree), [
    [0, 'heading', 'A'],
    [1, 'paragraph', '一段说明文字'],
    [1, 'list-item', 'item'],
  ]);
});

test('行内保真：节点文本原样保留行内 Markdown', () => {
  const tree = parseMarkdown(['# 带 **粗体** 的标题', '', '- 一个 [链接](https://example.com) 和 `代码`'].join('\n'));
  assert.deepEqual(flatten(tree), [
    [0, 'heading', '带 **粗体** 的标题'],
    [1, 'list-item', '一个 [链接](https://example.com) 和 `代码`'],
  ]);
});

test('叶子块挂载：代码块作为 leaf-block 挂在当前层级', () => {
  const tree = parseMarkdown(['# A', '', '```js', 'const x = 1;', '```', '', '- item'].join('\n'));
  const [heading] = tree.children;
  const leaf = heading.children.find((n) => n.kind === 'leaf-block');
  assert.ok(leaf, '应存在 leaf-block 节点');
  assert.match(leaf.text, /const x = 1;/);
});

test('树形图文本渲染：默认 ├──/└──/│/─ 符号', () => {
  const tree = parseMarkdown(['# A', '## B', '## C', '# D'].join('\n'));
  assert.equal(
    renderTreeText(tree),
    ['├── A', '│   ├── B', '│   └── C', '└── D'].join('\n'),
  );
});

test('树形图文本渲染：列表写法渲染同样的树', () => {
  const tree = parseMarkdown(['- a', '  - b', '  - c', '- d'].join('\n'));
  assert.equal(
    renderTreeText(tree),
    ['├── a', '│   ├── b', '│   └── c', '└── d'].join('\n'),
  );
});

test('树形图文本渲染：空树渲染为空字符串', () => {
  assert.equal(renderTreeText(parseMarkdown('')), '');
});
