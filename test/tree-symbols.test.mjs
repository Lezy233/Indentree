import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseMarkdown, renderTreeText } from '../src/intermediate-tree.mjs';
import {
  DEFAULT_SYMBOLS,
  PRESETS,
  resolveSymbols,
  symbolsFromSearch,
  symbolsToSearch,
} from '../src/tree-symbols.mjs';

const fixture = () => parseMarkdown(['- a', '  - b', '  - c', '- d'].join('\n'));

test('自定义符号：四符号独立替换', () => {
  const out = renderTreeText(fixture(), {
    branch: '+',
    branchLast: '`',
    vertical: '|',
    horizontal: '-',
    horizontalLength: 2,
  });
  // connector '+-- ' 宽 4，子级前缀 '|' + 3 空格与连接线等宽对齐
  assert.equal(out, ['+-- a', '|   +-- b', '|   `-- c', '`-- d'].join('\n'));
});

test('自定义符号：横线长度参数生效', () => {
  const out = renderTreeText(fixture(), { horizontalLength: 5 });
  assert.equal(
    out,
    ['├───── a', '│      ├───── b', '│      └───── c', '└───── d'].join('\n'),
  );
});

test('自定义符号：多字符符号保持子级对齐', () => {
  const out = renderTreeText(fixture(), {
    branch: '├╌',
    branchLast: '└╌',
    vertical: '│',
    horizontal: '─',
    horizontalLength: 1,
  });
  const lines = out.split('\n');
  // connector '├╌─ ' 宽 4；b、c 同为 a 的子级，连接线起点必须同列
  assert.equal(lines[1].indexOf('├'), 4);
  assert.equal(lines[2].indexOf('└'), 4);
  // 竖线前缀在两级子级行中同列
  assert.equal(lines[1][0], '│');
  assert.equal(lines[2][0], '│');
});

test('预设：三组预设形状正确', () => {
  assert.equal(Object.keys(PRESETS).length, 3);
  assert.deepEqual(PRESETS.classic.symbols, DEFAULT_SYMBOLS);
  assert.deepEqual(PRESETS.single.symbols, { ...DEFAULT_SYMBOLS, horizontalLength: 1 });
  const none = renderTreeText(fixture(), PRESETS.none.symbols);
  assert.ok(!none.includes('├') && !none.includes('└') && !none.includes('│'));
});

test('resolveSymbols：默认 < localStorage < URL 参数 的覆盖顺序', () => {
  const stored = { horizontal: '─', horizontalLength: 4 };
  const merged = resolveSymbols({ stored, urlSearch: `branch=${encodeURIComponent('+')}` });
  assert.equal(merged.branch, '+'); // URL 覆盖
  assert.equal(merged.horizontalLength, 4); // stored 保留
  assert.equal(merged.vertical, DEFAULT_SYMBOLS.vertical); // 默认兜底
});

test('resolveSymbols：非法输入回退默认', () => {
  const merged = resolveSymbols({
    stored: { horizontalLength: 'abc', branch: 123 },
    urlSearch: 'hlen=-5',
  });
  assert.equal(merged.horizontalLength, DEFAULT_SYMBOLS.horizontalLength);
  assert.equal(merged.branch, DEFAULT_SYMBOLS.branch);
});

test('symbolsFromSearch / symbolsToSearch：URL 参数往返', () => {
  const symbols = { branch: '+', branchLast: '`', vertical: '|', horizontal: '-', horizontalLength: 3 };
  const search = symbolsToSearch(symbols);
  assert.deepEqual(symbolsFromSearch(search), symbols);
});

test('symbolsFromSearch：空串与缺参返回空对象', () => {
  assert.deepEqual(symbolsFromSearch(''), {});
  assert.deepEqual(symbolsFromSearch('?other=1'), {});
});
