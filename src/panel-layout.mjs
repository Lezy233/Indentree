/**
 * 三栏工作台面板布局：拖拽调宽、推到底收起、宽度持久化。
 * 全部为纯函数，页面负责 DOM 与存储接线。
 *
 * 布局模型：{ left: PanelState, right: PanelState }
 * PanelState = { collapsed: boolean, width: number }
 * width 恒为「恢复后的展开宽度」——收起时面板显示为 0，但 width 记上次展开值。
 */

export const MIN_PANEL_WIDTH = 64; // 低于此宽度推到底即自动收起
export const MAX_PANEL_RATIO = 0.55; // 单侧栏宽不超过视口的 55%
export const NARROW_BREAKPOINT = 720; // 视口窄于此值切单栏聚焦
export const DEFAULT_PANEL_WIDTHS = Object.freeze({ left: 240, right: 280 });

/** 拖拽中的目标宽度：左栏向右拖增宽，右栏向右拖变窄 */
export function dragTargetWidth(side, startWidth, dx) {
  return side === 'left' ? startWidth + dx : startWidth - dx;
}

/**
 * 拖拽落点判定：低于最小展开宽 → 收起；否则按视口钳制宽度。
 * 返回 { collapsed, width }，width 为应应用到面板的展开宽度。
 */
export function snapPanel(rawWidth, viewportWidth) {
  if (rawWidth < MIN_PANEL_WIDTH) return { collapsed: true, width: 0 };
  return { collapsed: false, width: Math.min(rawWidth, viewportWidth * MAX_PANEL_RATIO) };
}

/**
 * 拖动结束时的提交策略：拖动全程只改视觉，松手才提交。
 * 收于展开态 → 恢复宽度更新为落点宽度；
 * 收于收起态 → 恢复宽度保留拖动前的值（点恢复图标时回到原宽，而非 64px 细缝）。
 */
export function commitDrag(widthBeforeDrag, snap) {
  return {
    collapsed: snap.collapsed,
    width: snap.collapsed ? widthBeforeDrag : snap.width,
  };
}

const validWidth = (v) =>
  typeof v === 'number' && Number.isFinite(v) && v >= MIN_PANEL_WIDTH;

function sanitizeSide(stored, side) {
  const fallback = {
    collapsed: false,
    width: DEFAULT_PANEL_WIDTHS[side],
  };
  if (!stored || typeof stored !== 'object') return fallback;
  return {
    collapsed: stored.collapsed === true,
    width: validWidth(stored.width) ? stored.width : fallback.width,
  };
}

/** localStorage 读出的原始值 → 合法布局（非法字段回退默认） */
export function resolveLayout(stored) {
  const root = stored && typeof stored === 'object' ? stored : {};
  return {
    left: sanitizeSide(root.left, 'left'),
    right: sanitizeSide(root.right, 'right'),
  };
}

/** 布局 → 可 JSON 序列化的存值形状 */
export function serializeLayout(layout) {
  return {
    left: { collapsed: layout.left.collapsed, width: layout.left.width },
    right: { collapsed: layout.right.collapsed, width: layout.right.width },
  };
}
