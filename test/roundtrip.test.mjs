import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseMarkdown,
  serializeMarkdown,
  MarkdownParseError,
} from '../src/intermediate-tree.mjs';

// 结构等价比较：忽略对象身份，递归比对 kind / text / level / children
function normalize(node) {
  const out = { kind: node.kind, text: node.text, children: node.children.map(normalize) };
  if (node.kind === 'heading') out.level = node.level;
  return out;
}

function assertRoundTripStable(src) {
  const once = parseMarkdown(src);
  const twice = parseMarkdown(serializeMarkdown(once));
  assert.deepEqual(normalize(twice), normalize(once));
}

test('round-trip：标题写法的文档转树再转回仍是标题写法', () => {
  const src = ['# A', '', '## B', '', '### C', '', '## D', '', '# E'].join('\n');
  assert.equal(serializeMarkdown(parseMarkdown(src)), src);
});

test('round-trip：列表写法的文档转树再转回仍是列表写法', () => {
  const src = ['- a', '- b', '  - c', '  - d', '- e'].join('\n');
  assert.equal(serializeMarkdown(parseMarkdown(src)), src);
});

test('round-trip：混合写法按 kind 各自还原', () => {
  const src = [
    '# 题单',
    '',
    '- 第一章',
    '  - 1.1',
    '  - 1.2',
    '',
    '## 小节',
    '',
    '- 第二章',
  ].join('\n');
  assert.equal(serializeMarkdown(parseMarkdown(src)), src);
});

test('round-trip：行内 Markdown（粗体 / 链接 / 行内代码）往返无损', () => {
  const src = [
    '# 带 **粗体** 的标题',
    '',
    '- 一个 [链接](https://example.com) 和 `代码`',
    '  - 嵌套的 *斜体* 与 ~~删除线~~',
  ].join('\n');
  assert.equal(serializeMarkdown(parseMarkdown(src)), src);
});

test('round-trip：表格与围栏代码块作为叶子块不丢内容', () => {
  const src = [
    '# A',
    '',
    '| x | y |',
    '| --- | --- |',
    '| 1 | 2 |',
    '',
    '```js',
    'const x = 1;',
    '',
    'const y = 2;',
    '```',
    '',
    '- tail',
  ].join('\n');
  assert.equal(serializeMarkdown(parseMarkdown(src)), src);
});

test('round-trip：叶子块挂在列表项下时缩进还原', () => {
  const src = ['- item', '', '  ```', '  code inside item', '  ```'].join('\n');
  assertRoundTripStable(src);
});

test('round-trip：松散真实文档结构等价（标题跳级 + 混排 + 段落）', () => {
  const src = [
    '# 顶层',
    '',
    '一段说明',
    '',
    '### 跳级标题',
    '',
    '- 甲',
    '- 乙',
    '  - 乙一',
    '',
    '## 回到二级',
    '',
    '> 引用里的',
    '> 多行内容',
  ].join('\n');
  assertRoundTripStable(src);
});

test('解析失败：抛出携带行号的 MarkdownParseError', () => {
  const failingParser = {
    parse() {
      throw new Error('boom');
    },
  };
  assert.throws(() => parseMarkdown('# x', failingParser), (err) => {
    assert.ok(err instanceof MarkdownParseError);
    assert.equal(typeof err.line, 'number');
    assert.ok(err.line >= 1);
    return true;
  });
});

test('解析失败：行号定位到正在处理的源行', () => {
  // 解析器在吐出两个 token 后爆炸：行号应指向第二个 token 所在行（第 3 行）
  const tokens = [
    { type: 'paragraph_open', map: [0, 1] },
    { type: 'paragraph_open', map: [2, 3] },
  ];
  const explodingParser = { parse: () => tokens };
  // paragraph_open 后缺少 inline/close 不会炸——用一个会在 walker 中触发异常的形状：
  tokens.push({
    type: 'inline',
    map: [2, 3],
    get content() {
      throw new Error('walker boom');
    },
  });
  assert.throws(() => parseMarkdown('a\n\nb', explodingParser), (err) => {
    assert.ok(err instanceof MarkdownParseError);
    assert.equal(err.line, 3);
    return true;
  });
});
