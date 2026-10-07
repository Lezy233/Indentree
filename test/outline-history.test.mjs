import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  HISTORY_LIMIT,
  emptyHistory,
  canUndo,
  pushHistory,
  undoHistory,
} from '../src/outline-history.mjs';

const push = (history, value) => pushHistory(history, { value });

test('emptyHistory：空栈不能撤销', () => {
  const history = emptyHistory();
  assert.deepEqual(history.entries, []);
  assert.equal(canUndo(history), false);
  assert.equal(undoHistory(history).snapshot, null);
  assert.equal(undoHistory(history).history, history);
});

test('pushHistory / undoHistory：后进先出', () => {
  let history = push(push(push(emptyHistory(), 1), 2), 3);
  assert.equal(canUndo(history), true);

  let undone = undoHistory(history);
  assert.deepEqual(undone.snapshot, { value: 3 });
  assert.deepEqual(undone.history.entries.length, 2);

  undone = undoHistory(undone.history);
  assert.deepEqual(undone.snapshot, { value: 2 });

  undone = undoHistory(undone.history);
  assert.deepEqual(undone.snapshot, { value: 1 });
  assert.equal(canUndo(undone.history), false);
});

test('pushHistory：快照按引用保存（不可变值）', () => {
  const tree = { kind: 'root', text: '', children: [] };
  const snapshot = { tree, selection: { paths: [[0]], anchor: [0] } };
  const history = pushHistory(emptyHistory(), snapshot);
  assert.equal(undoHistory(history).snapshot, snapshot);
  assert.equal(undoHistory(history).snapshot.tree, tree);
});

test('pushHistory：超过上限丢最旧的', () => {
  let history = emptyHistory();
  for (let i = 0; i < HISTORY_LIMIT + 10; i += 1) history = push(history, i);
  assert.equal(history.entries.length, HISTORY_LIMIT);
  assert.deepEqual(history.entries[0], { value: 10 }); // 0..9 被丢掉
  assert.deepEqual(history.entries[history.entries.length - 1], { value: HISTORY_LIMIT + 9 });
});

test('pushHistory：不修改传入的 history（纯函数）', () => {
  const before = push(emptyHistory(), 1);
  const after = push(before, 2);
  assert.equal(before.entries.length, 1);
  assert.equal(after.entries.length, 2);
});
