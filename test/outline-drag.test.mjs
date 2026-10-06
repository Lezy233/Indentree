import { test } from 'node:test';
import assert from 'node:assert/strict';

import { dropZone, dragPaths, ZONE_RATIO } from '../src/outline-drag.mjs';

const rect = (top, height) => ({ top, height });

test('dropZone：上 25% above、中间 inside、下 25% below', () => {
  const r = rect(100, 40); // 100..140
  assert.equal(dropZone(r, 100), 'above');
  assert.equal(dropZone(r, 100 + 40 * ZONE_RATIO - 1), 'above');
  assert.equal(dropZone(r, 100 + 40 * ZONE_RATIO), 'inside');
  assert.equal(dropZone(r, 120), 'inside');
  assert.equal(dropZone(r, 100 + 40 * (1 - ZONE_RATIO)), 'inside');
  assert.equal(dropZone(r, 100 + 40 * (1 - ZONE_RATIO) + 1), 'below');
  assert.equal(dropZone(r, 140), 'below');
});

test('dropZone：指针越界时按最近一侧归类', () => {
  const r = rect(100, 40);
  assert.equal(dropZone(r, 0), 'above');
  assert.equal(dropZone(r, 9999), 'below');
});

test('dropZone：零高度矩形退化为 inside', () => {
  assert.equal(dropZone(rect(100, 0), 100), 'inside');
});

test('dragPaths：拖的是选中项时整组一起搬（文档顺序）', () => {
  const rows = [{ path: [0] }, { path: [0, 0] }, { path: [1] }, { path: [2] }];
  assert.deepEqual(dragPaths(rows, [[0], [2]], [2]), [[0], [2]]);
  assert.deepEqual(dragPaths(rows, [[2], [0]], [0]), [[0], [2]]);
});

test('dragPaths：拖的不是选中项时只搬它自己', () => {
  const rows = [{ path: [0] }, { path: [1] }, { path: [2] }];
  assert.deepEqual(dragPaths(rows, [[0]], [2]), [[2]]);
  assert.deepEqual(dragPaths(rows, [], [1]), [[1]]);
});

test('dragPaths：选中项里已失效的路径被过滤掉', () => {
  const rows = [{ path: [0] }, { path: [1] }];
  assert.deepEqual(dragPaths(rows, [[0], [9]], [0]), [[0]]);
});
