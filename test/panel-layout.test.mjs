import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_PANEL_WIDTH,
  DEFAULT_PANEL_WIDTHS,
  dragTargetWidth,
  snapPanel,
  resolveLayout,
  serializeLayout,
} from '../src/panel-layout.mjs';

test('dragTargetWidth：左栏随 dx 增宽，右栏随 dx 变窄', () => {
  assert.equal(dragTargetWidth('left', 240, 30), 270);
  assert.equal(dragTargetWidth('left', 240, -30), 210);
  assert.equal(dragTargetWidth('right', 280, 30), 250);
  assert.equal(dragTargetWidth('right', 280, -30), 310);
});

test('snapPanel：低于最小展开宽推到底即收起', () => {
  assert.deepEqual(snapPanel(63, 1000), { collapsed: true, width: 0 });
  assert.deepEqual(snapPanel(0, 1000), { collapsed: true, width: 0 });
  assert.deepEqual(snapPanel(-50, 1000), { collapsed: true, width: 0 });
});

test('snapPanel：恰好等于最小展开宽时保持展开', () => {
  assert.deepEqual(snapPanel(MIN_PANEL_WIDTH, 1000), {
    collapsed: false,
    width: MIN_PANEL_WIDTH,
  });
});

test('snapPanel：超过视口 55% 时被钳制', () => {
  assert.deepEqual(snapPanel(600, 1000), { collapsed: false, width: 550 });
  assert.deepEqual(snapPanel(300, 1000), { collapsed: false, width: 300 });
});

test('resolveLayout：空存值 / 非对象 → 默认展开 + 默认宽度', () => {
  const expected = {
    left: { collapsed: false, width: DEFAULT_PANEL_WIDTHS.left },
    right: { collapsed: false, width: DEFAULT_PANEL_WIDTHS.right },
  };
  assert.deepEqual(resolveLayout(null), expected);
  assert.deepEqual(resolveLayout(undefined), expected);
  assert.deepEqual(resolveLayout('garbage'), expected);
  assert.deepEqual(resolveLayout({}), expected);
});

test('resolveLayout：合法存值保留，非法字段回退默认', () => {
  const layout = resolveLayout({
    left: { collapsed: true, width: 320 },
    right: { collapsed: false, width: 'wide' },
  });
  assert.deepEqual(layout.left, { collapsed: true, width: 320 });
  assert.deepEqual(layout.right, { collapsed: false, width: DEFAULT_PANEL_WIDTHS.right });
});

test('resolveLayout：小于最小展开宽的存值宽度回退默认', () => {
  const layout = resolveLayout({ left: { collapsed: false, width: 10 } });
  assert.equal(layout.left.width, DEFAULT_PANEL_WIDTHS.left);
});

test('serializeLayout → resolveLayout 往返一致', () => {
  const layout = {
    left: { collapsed: true, width: 300 },
    right: { collapsed: false, width: 260 },
  };
  assert.deepEqual(resolveLayout(JSON.parse(JSON.stringify(serializeLayout(layout)))), layout);
});
