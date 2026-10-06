import { parseMarkdown, serializeMarkdown } from './intermediate-tree.mjs';

/**
 * 大纲视图的结构操作：把中间树投影成可渲染的行列表，并提供
 * 行内编辑 / 新建同级 / 缩进 / 取消缩进 / 删除等纯函数操作。
 * 全部为纯函数（返回新树），页面负责 DOM、焦点与防抖接线。
 *
 * 路径（path）：从虚拟根出发的子节点下标数组，如 [0, 2, 1]。
 *
 * 结构操作只在 markdown 能原样还原时生效：操作结果序列化再解析后结构必须不变，
 * 否则返回 applied: false 与 reason，由页面在状态条提示——silent 的层级漂移比
 * 拒绝操作更糟（大纲与 Markdown 会各说各话）。这天然覆盖了 markdown 的表达边界：
 * 段落不能有子节点、列表项内的标题不能有子节点、标题层级最多 6 级、
 * 标题小节之后的同级块会被标题重新吞掉，等等。
 */

/** 深度优先把中间树投影为行列表：{ path, depth, kind, text }（不含虚拟根） */
export function outlineRows(root) {
  const rows = [];
  const walk = (nodes, depth, prefix) => {
    nodes.forEach((node, index) => {
      const path = [...prefix, index];
      rows.push({ path, depth, kind: node.kind, text: node.text });
      walk(node.children, depth + 1, path);
    });
  };
  walk(root.children, 0, []);
  return rows;
}

/** 按下标路径定位节点，返回 { parent, index, node }；空路径或越界返回 null */
export function locateNode(root, path) {
  if (!Array.isArray(path) || path.length === 0) return null;
  let parent = root;
  for (const index of path.slice(0, -1)) {
    parent = parent?.children?.[index];
    if (!parent) return null;
  }
  const index = path[path.length - 1];
  const node = parent?.children?.[index];
  return node ? { parent, index, node } : null;
}

/** 行内编辑保存：把节点文本换成输入框里的内容（保留行内 Markdown） */
export function setNodeText(root, path, text) {
  if (!locateNode(root, path)) return blocked(root, 'invalid-path');
  const tree = cloneTree(root);
  locateNode(tree, path).node.text = text;
  return { tree, applied: true, path, reason: null };
}

/** 新建同级节点：沿用原节点的 kind（标题连 level 一起沿用） */
export function insertSibling(root, path) {
  const loc = locateNode(root, path);
  if (!loc) return blocked(root, 'invalid-path');
  const tree = cloneTree(root);
  const target = locateNode(tree, path);
  const created = { kind: target.node.kind, text: '', children: [] };
  if (target.node.kind === 'heading') created.level = target.node.level;
  target.parent.children.splice(target.index + 1, 0, created);
  return {
    tree,
    applied: true,
    path: [...path.slice(0, -1), target.index + 1],
    reason: null,
  };
}

/** 缩进：成为前一个同级节点的最后一个子级（品类习惯：只向右缩一级） */
export function indentNode(root, path) {
  const loc = locateNode(root, path);
  if (!loc) return blocked(root, 'invalid-path');
  if (loc.index === 0) return blocked(root, 'first-sibling');

  const tree = cloneTree(root);
  const target = locateNode(tree, path);
  const prev = target.parent.children[target.index - 1];
  const prevPath = [...path.slice(0, -1), loc.index - 1];
  target.parent.children.splice(target.index, 1);
  prev.children.push(target.node);
  if (target.node.kind === 'heading') {
    const level = prev.kind === 'heading' ? prev.level + 1 : target.node.level;
    shiftHeadingLevels(target.node, level - target.node.level);
  }
  const reason = unrepresentable(root, tree, prevPath);
  if (reason) return blocked(root, reason);
  return {
    tree,
    applied: true,
    path: [...prevPath, prev.children.length - 1],
    reason: null,
  };
}

/** 取消缩进：移到祖父级、紧随原父级之后 */
export function outdentNode(root, path) {
  if (path.length <= 1) return blocked(root, 'already-top-level');
  const loc = locateNode(root, path);
  if (!loc) return blocked(root, 'invalid-path');

  const newParentPath = path.slice(0, -2);
  const tree = cloneTree(root);
  const target = locateNode(tree, path);
  const oldParent = locateNode(tree, path.slice(0, -1)); // { parent: 新父级, index, node: 原父级 }
  const newParent = oldParent.parent;
  const insertIndex = oldParent.index + 1;
  target.parent.children.splice(target.index, 1);
  newParent.children.splice(insertIndex, 0, target.node);

  if (target.node.kind === 'heading') {
    const parent = parentAt(tree, newParentPath);
    // 顶层标题降为一级；标题父级下跟到父级 +1；列表项里层级不再约束，保持不变
    const level =
      parent.kind === 'heading' ? parent.level + 1 : parent.kind === 'root' ? 1 : target.node.level;
    if (level !== target.node.level) shiftHeadingLevels(target.node, level - target.node.level);
  }
  const reason = unrepresentable(root, tree, newParentPath);
  if (reason) return blocked(root, reason);
  return { tree, applied: true, path: [...newParentPath, insertIndex], reason: null };
}

/** 删除节点，返回操作后应聚焦的路径（优先前一个同级，其次占位的下一个） */
export function removeNode(root, path) {
  const loc = locateNode(root, path);
  if (!loc) return blocked(root, 'invalid-path');
  const tree = cloneTree(root);
  const target = locateNode(tree, path);
  target.parent.children.splice(target.index, 1);
  const parentPath = path.slice(0, -1);
  const parent = parentAt(tree, parentPath);
  const focusIndex = target.index > 0 ? target.index - 1 : parent.children.length > 0 ? 0 : null;
  return {
    tree,
    applied: true,
    path: focusIndex === null ? null : [...parentPath, focusIndex],
    reason: null,
  };
}

/** 拒绝原因 → 状态条文案 */
const REASON_TEXT = Object.freeze({
  'first-sibling': '首个同级节点没有可缩进的目标',
  unrepresentable: '该位置无法在 Markdown 中还原，操作已取消',
  'heading-depth-limit': '标题层级超出 1–6 级，无法还原',
  'already-top-level': '已在顶层，无法取消缩进',
});

export function describeOutlineReason(reason) {
  return REASON_TEXT[reason] ?? '操作无法完成';
}

// ---- 内部工具 ----

const blocked = (tree, reason) => ({ tree, applied: false, path: null, reason });

const cloneTree = (node) => ({ ...node, children: node.children.map(cloneTree) });

/** 父节点路径 → 节点；空路径表示虚拟根 */
function parentAt(root, path) {
  if (path.length === 0) return root;
  return locateNode(root, path)?.node ?? null;
}

function maxHeadingLevel(node) {
  let max = node.kind === 'heading' ? node.level : 0;
  for (const child of node.children) max = Math.max(max, maxHeadingLevel(child));
  return max;
}

function minHeadingLevel(node) {
  let min = node.kind === 'heading' ? node.level : Infinity;
  for (const child of node.children) min = Math.min(min, minHeadingLevel(child));
  return min;
}

function shiftHeadingLevels(node, delta) {
  if (node.kind === 'heading') node.level += delta;
  node.children.forEach((child) => shiftHeadingLevels(child, delta));
}

/**
 * 操作结果能否原样还原成 markdown。
 * - 标题层级必须落在 1-6：越界一定还原不了（7 级会重解析成段落、0 级序列化直接抛错），
 *   与基线是否忠实无关，所以先判这一条；
 * - 被改动区域的「锥体」（祖先链 + 被改动节点的整棵子树）序列化再解析后结构必须不变。
 *   只看锥体：区域外既有的破损（用户在段落里手打了块级标记）不牵连，否则一行文本
 *   就会让整篇文档无法操作；带上祖先链是因为列表项上下文会改变标题/块的归属。
 */
function unrepresentable(before, after, regionPath) {
  if (minHeadingLevel(after) < 1 || maxHeadingLevel(after) > 6) return 'heading-depth-limit';
  if (regionRoundTrips(after, regionPath)) return null;
  if (!regionRoundTrips(before, regionPath)) return null;
  return 'unrepresentable';
}

function regionRoundTrips(root, path) {
  const region = cone(root, path);
  if (!region) return false;
  const wrapped =
    region.kind === 'root' ? region : { kind: 'root', text: '', children: [region] };
  try {
    const reparsed = parseMarkdown(serializeMarkdown(wrapped));
    return JSON.stringify(structure(reparsed)) === JSON.stringify(structure(wrapped));
  } catch {
    return false;
  }
}

/** 祖先链 + path 所指节点的整棵子树，丢掉其它兄弟；空路径即整棵树 */
function cone(root, path) {
  if (path.length === 0) return root;
  const child = root.children[path[0]];
  if (!child) return null;
  if (path.length === 1) return child;
  const inner = cone(child, path.slice(1));
  return inner ? { ...child, children: [inner] } : null;
}

// 结构指纹：只看 kind / level / children。文本保真是行内编辑的事，
// 这里不因用户手打的文本不忠实地连带拒绝结构操作。
function structure(node) {
  const out = { kind: node.kind };
  if (node.kind === 'heading') out.level = node.level;
  out.children = node.children.filter(isVisible).map(structure);
  return out;
}

// 空段落序列化后会被 Markdown 吞掉（Enter 新建的空节点是暂态），比较时两边都忽略
const isVisible = (node) =>
  !(node.kind === 'paragraph' && node.text === '' && node.children.length === 0);
