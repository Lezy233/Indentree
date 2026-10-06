import { comparePaths, pathKey, samePath } from './outline.mjs';

/**
 * 大纲多选模型（纯函数）。规则见 ADR-0001：
 * - **同父约束**：选中集必须共享同一父节点；跨父级的点选会把选择改为该项并提示。
 * - **选中父节点即等效选中整棵子树**：后代不单独勾选，但计入操作范围与视觉（implied）。
 * - **Shift 连选只取同级**：越界部分截断到锚点所在父级，并在状态条提示。
 * - **全选 = 所有顶级节点**（同父，后代跟随）。
 *
 * 选择状态：{ paths: 路径数组（文档顺序）, anchor: 最后一次点选的路径 | null }
 */

export function emptySelection() {
  return { paths: [], anchor: null };
}

/**
 * checkbox 点选切换。若点选项与当前选中集不同父级，改为只选该项（同父约束）。
 * 返回 { selection, hint }；hint 为提示码，交给 describeSelectionHint。
 */
export function toggleSelection(selection, path) {
  if (isSelected(selection, path)) {
    const paths = selection.paths.filter((p) => !samePath(p, path));
    const anchor =
      selection.anchor && paths.some((p) => samePath(p, selection.anchor))
        ? selection.anchor
        : (paths[paths.length - 1] ?? null);
    return { selection: { paths, anchor }, hint: null };
  }
  if (selection.paths.length > 0 && !isSameParent(selection.paths[0], path)) {
    return { selection: { paths: [path], anchor: path }, hint: 'parent-switched' };
  }
  return {
    selection: { paths: [...selection.paths, path].sort(comparePaths), anchor: path },
    hint: null,
  };
}

/**
 * Shift 连选：从 anchor 到 path 的文档顺序区间，只保留锚点所在父级的节点，
 * 于是跨父级的越界部分被自动截断；目标没被纳入（说明截断了）时给提示。
 */
export function extendSelection(rows, selection, path) {
  const anchor = selection.anchor;
  if (!anchor) return { selection: { paths: [path], anchor: path }, hint: null };

  const anchorIndex = rows.findIndex((r) => samePath(r.path, anchor));
  const targetIndex = rows.findIndex((r) => samePath(r.path, path));
  if (anchorIndex === -1 || targetIndex === -1) {
    return { selection: { paths: [path], anchor: path }, hint: null };
  }

  const lo = Math.min(anchorIndex, targetIndex);
  const hi = Math.max(anchorIndex, targetIndex);
  const anchorParent = anchor.slice(0, -1);
  const paths = rows
    .slice(lo, hi + 1)
    .filter((r) => samePath(r.path.slice(0, -1), anchorParent))
    .map((r) => r.path);
  const clipped = !paths.some((p) => samePath(p, path));
  return { selection: { paths, anchor }, hint: clipped ? 'range-clipped' : null };
}

/** 全选：所有顶级节点（顶级节点天然同父；后代跟随） */
export function selectAllTopLevel(rows) {
  const paths = rows.filter((r) => r.depth === 0).map((r) => r.path);
  return { selection: { paths, anchor: paths[0] ?? null }, hint: null };
}

/** 路径是否被显式选中 */
export function isSelected(selection, path) {
  return selection.paths.some((p) => samePath(p, path));
}

/** 被选中节点的后代（跟随选中），不含选中项自身 */
export function impliedSelection(rows, selection) {
  const keys = new Set(selection.paths.map(pathKey));
  if (keys.size === 0) return [];
  return rows
    .filter((row) => !keys.has(pathKey(row.path)) && hasSelectedAncestor(row.path, keys))
    .map((row) => row.path);
}

/** 树被替换 / 重渲染后清理失效的选择（路径不存在，或不再同父） */
export function pruneSelection(rows, selection) {
  const alive = new Set(rows.map((r) => pathKey(r.path)));
  const paths = selection.paths.filter((p) => alive.has(pathKey(p)));
  const parent = paths.length > 0 ? paths[0].slice(0, -1) : null;
  const kept = paths.filter((p) => samePath(p.slice(0, -1), parent));
  const anchor =
    selection.anchor && kept.some((p) => samePath(p, selection.anchor))
      ? selection.anchor
      : (kept[kept.length - 1] ?? null);
  return { paths: kept, anchor };
}

const HINT_TEXT = Object.freeze({
  'parent-switched': '多选仅限同一父级，已改为选中该项',
  'range-clipped': '连选越界，已截断到同一父级范围',
});

export function describeSelectionHint(hint) {
  return HINT_TEXT[hint] ?? '';
}

function isSameParent(a, b) {
  return samePath(a.slice(0, -1), b.slice(0, -1));
}

function hasSelectedAncestor(path, keys) {
  for (let i = 1; i < path.length; i += 1) {
    if (keys.has(pathKey(path.slice(0, i)))) return true;
  }
  return false;
}
