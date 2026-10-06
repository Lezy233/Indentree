import { pathKey, samePath } from './outline.mjs';

/**
 * 拖拽视图层的纯计算：落点三区几何 + 「这次拖拽要搬哪些节点」。
 * 页面只负责把 mouse/touch 坐标与选中状态喂进来。
 *
 * 三区语义（见 ADR-0001）：above / below 是同级排序（显示插入线），
 * inside 成为目标的最后一个子级（整行高亮，即「拖入式嵌套」）。
 */

/** 落点三区阈值：上/下各 25% 为同级排序，中间 50% 为拖入成为子级 */
export const ZONE_RATIO = 0.25;

/**
 * 行矩形 + 指针纵坐标 → 'above' | 'inside' | 'below'
 * 指针越界（高于顶边 / 低于底边）时也按最近的一侧归类。
 */
export function dropZone(rect, clientY) {
  if (rect.height <= 0) return 'inside';
  const ratio = (clientY - rect.top) / rect.height;
  if (ratio < ZONE_RATIO) return 'above';
  if (ratio > 1 - ZONE_RATIO) return 'below';
  return 'inside';
}

/**
 * 这次拖拽要搬的节点：拖的若是选中项，整组选中项一起搬（保持相对顺序）；
 * 否则只搬被拖的那一个。返回文档顺序的路径数组。
 */
export function dragPaths(rows, selectedPaths, draggedPath) {
  const selected = selectedPaths.some((path) => samePath(path, draggedPath));
  if (!selected) return [draggedPath];
  const keys = new Set(selectedPaths.map(pathKey));
  return rows.filter((row) => keys.has(pathKey(row.path))).map((row) => row.path);
}
