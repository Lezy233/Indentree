import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseMarkdown } from '../src/intermediate-tree.mjs';
import { outlineRows, pathKey } from '../src/outline.mjs';
import {
  emptySelection,
  toggleSelection,
  extendSelection,
  isSelected,
  impliedSelection,
  pruneSelection,
  describeSelectionHint,
} from '../src/outline-selection.mjs';

const rowsOf = (lines) => outlineRows(parseMarkdown(lines.join('\n')));
const keys = (paths) => paths.map(pathKey);

// 文档：a > (a1, a2), b, c —— 用于同父/跨父与范围截断
const fixture = () => rowsOf(['- a', '  - a1', '  - a2', '- b', '- c']);

test('toggleSelection：点选与取消，结果按文档顺序', () => {
  const rows = fixture();
  let { selection, hint } = toggleSelection(emptySelection(), [1]);
  assert.equal(hint, null);
  assert.deepEqual(keys(selection.paths), ['1']);
  assert.deepEqual(selection.anchor, [1]);

  ({ selection } = toggleSelection(selection, [0])); // 先点 b 再点 a → 排序
  assert.deepEqual(keys(selection.paths), ['0', '1']);
  assert.deepEqual(selection.anchor, [0]);
  assert.equal(isSelected(selection, [0]), true);

  ({ selection, hint } = toggleSelection(selection, [1])); // 取消 b
  assert.equal(hint, null);
  assert.deepEqual(keys(selection.paths), ['0']);
  assert.deepEqual(selection.anchor, [0]);
});

test('toggleSelection：取消最后一个选中项后清空', () => {
  const { selection } = toggleSelection(emptySelection(), [2]);
  const res = toggleSelection(selection, [2]);
  assert.deepEqual(res.selection.paths, []);
  assert.equal(res.selection.anchor, null);
});

test('toggleSelection：跨父级点选改为只选新项并提示（同父约束）', () => {
  const first = toggleSelection(emptySelection(), [0, 0]); // a1
  const { selection, hint } = toggleSelection(first.selection, [1]); // b：不同父级
  assert.equal(hint, 'parent-switched');
  assert.deepEqual(keys(selection.paths), ['1']);
  assert.deepEqual(selection.anchor, [1]);
});

test('extendSelection：同一父级内连选，跳过中间节点的后代', () => {
  const rows = fixture();
  const base = { paths: [[0]], anchor: [0] }; // 锚点 a
  const { selection, hint } = extendSelection(rows, base, [2]); // a → c
  assert.equal(hint, null);
  assert.deepEqual(keys(selection.paths), ['0', '1', '2']); // a, b, c
  assert.deepEqual(selection.anchor, [0]); // 锚点保持
});

test('extendSelection：反向连选同样成立', () => {
  const rows = fixture();
  const base = { paths: [[2]], anchor: [2] };
  const { selection, hint } = extendSelection(rows, base, [0]);
  assert.equal(hint, null);
  assert.deepEqual(keys(selection.paths), ['0', '1', '2']);
});

test('extendSelection：目标在后代里时截断到同父并提示', () => {
  const rows = fixture();
  const base = { paths: [[0]], anchor: [0] }; // 锚点 a（root 级）
  const { selection, hint } = extendSelection(rows, base, [0, 1]); // a2 在 a 里面
  assert.equal(hint, 'range-clipped');
  assert.deepEqual(keys(selection.paths), ['0']); // 只剩锚点
});

test('extendSelection：目标在别的分支时截断到锚点父级并提示', () => {
  const rows = fixture();
  const base = { paths: [[0, 0]], anchor: [0, 0] }; // 锚点 a1（父级是 a）
  const { selection, hint } = extendSelection(rows, base, [1]); // b 是 root 级
  assert.equal(hint, 'range-clipped');
  // 区间 a1..b 里属于 a 的子节点是 a1、a2；b 越界被截掉
  assert.deepEqual(keys(selection.paths), ['0.0', '0.1']);
});

test('extendSelection：没有锚点时等价于点选', () => {
  const rows = fixture();
  const { selection, hint } = extendSelection(rows, emptySelection(), [1]);
  assert.equal(hint, null);
  assert.deepEqual(keys(selection.paths), ['1']);
  assert.deepEqual(selection.anchor, [1]);
});

test('impliedSelection：后代跟随（含多级），不含选中项自身', () => {
  const rows = rowsOf(['- a', '  - a1', '    - a1x', '- b']);
  const selection = { paths: [[0]], anchor: [0] };
  assert.deepEqual(keys(impliedSelection(rows, selection)), ['0.0', '0.0.0']);
  assert.deepEqual(impliedSelection(rows, emptySelection()), []);
});

test('pruneSelection：丢掉已不存在的路径', () => {
  const rows = fixture();
  const pruned = pruneSelection(rows, { paths: [[0], [9]], anchor: [9] });
  assert.deepEqual(keys(pruned.paths), ['0']);
  assert.deepEqual(pruned.anchor, [0]);
});

test('pruneSelection：跨父级的残留只保留第一个父级', () => {
  const rows = fixture();
  const pruned = pruneSelection(rows, { paths: [[0, 0], [1]], anchor: [1] });
  assert.deepEqual(keys(pruned.paths), ['0.0']);
  assert.deepEqual(pruned.anchor, [0, 0]);
});

test('describeSelectionHint：两类提示都有文案', () => {
  assert.ok(describeSelectionHint('parent-switched').length > 0);
  assert.ok(describeSelectionHint('range-clipped').length > 0);
  assert.equal(describeSelectionHint('unknown'), '');
});
