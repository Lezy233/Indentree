import { parseMarkdown, serializeMarkdown } from './intermediate-tree.mjs';

/**
 * 大纲视图的结构操作：把中间树投影成可渲染的行列表，并提供
 * 行内编辑 / 新建同级 / 缩进 / 取消缩进 / 删除（含多选批量删除）等纯函数操作。
 * 全部为纯函数（返回新树），页面负责 DOM、焦点与防抖接线。
 *
 * 多选只服务批量拖拽（ticket 08）与批量删除：同父约束见 ADR-0001，
 * `removeNodes` 接受任意同父选中集（不要求连续），后代随子树一起走。
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
  return { tree, applied: true, paths: [path], reason: null };
}

/** 新建同级节点：沿用原节点的 kind（标题连 level 一起沿用） */
export function insertSibling(root, path) {
  const loc = locateNode(root, path);
  if (!loc) return blocked(root, 'invalid-path');
  const tree = cloneTree(root);
  const target = locateNode(tree, path);
  target.parent.children.splice(target.index + 1, 0, makeNode(target.node.kind, '', target.node.level));
  return { tree, applied: true, paths: [[...path.slice(0, -1), target.index + 1]], reason: null };
}

/**
 * 缩进：成为前一个同级节点的最后一个子级（品类习惯：只向右缩一级）
 */
export function indentNode(root, path) {
  const loc = locateNode(root, path);
  if (!loc) return blocked(root, 'invalid-path');
  if (loc.index === 0) return blocked(root, 'first-sibling');

  const tree = cloneTree(root);
  const target = locateNode(tree, path);
  const prevPath = [...path.slice(0, -1), loc.index - 1];
  const prev = parentAt(tree, prevPath);
  target.parent.children.splice(target.index, 1);
  prev.children.push(target.node);
  adjustHeadingLevels([target.node], prev);
  const reason = unrepresentable(root, tree, prevPath);
  if (reason) return blocked(root, reason);
  return { tree, applied: true, paths: [[...prevPath, prev.children.length - 1]], reason: null };
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
  const insertIndex = oldParent.index + 1;
  target.parent.children.splice(target.index, 1);
  oldParent.parent.children.splice(insertIndex, 0, target.node);
  adjustHeadingLevels([target.node], oldParent.parent);
  const reason = unrepresentable(root, tree, newParentPath);
  if (reason) return blocked(root, reason);
  return { tree, applied: true, paths: [[...newParentPath, insertIndex]], reason: null };
}

/** 删除一组同父节点（不要求连续）：整棵子树跟着走。多选删除的入口 */
export function removeNodes(root, paths) {
  const tree = cloneTree(root);
  const siblings = resolveSiblings(tree, paths);
  if (siblings.reason) return blocked(root, siblings.reason);
  // 从后往前删，前面的下标不失效
  for (const index of [...siblings.indices].reverse()) {
    siblings.parent.children.splice(index, 1);
  }
  const first = siblings.indices[0];
  const rest = siblings.parent.children.length;
  const focusIndex = first > 0 ? first - 1 : rest > 0 ? 0 : null;
  return {
    tree,
    applied: true,
    paths: focusIndex === null ? [] : [[...siblings.parentPath, focusIndex]],
    reason: null,
  };
}

export const removeNode = (root, path) => removeNodes(root, [path]);

/**
 * 末尾新建条目（规则 A）：与文档最后一个条目同级同 kind，追加在它后面——
 * 扁平列表里就是顶级新条目；文档结尾是嵌套项时加在同一层，才能被 markdown 原样还原。
 * 叶子块没有「名称」的概念，退回列表项。空文档则建一个顶级列表项。
 */
export function appendItem(root, text = '新条目') {
  const rows = outlineRows(root);
  const tree = cloneTree(root);
  if (rows.length === 0) {
    tree.children.push({ kind: 'list-item', text, children: [] });
    return { tree, applied: true, paths: [[0]], reason: null };
  }
  const lastPath = rows[rows.length - 1].path;
  const target = locateNode(tree, lastPath);
  const kind = target.node.kind === 'leaf-block' ? 'list-item' : target.node.kind;
  target.parent.children.splice(target.index + 1, 0, makeNode(kind, text, target.node.level));
  const reason = unrepresentable(root, tree, lastPath.slice(0, -1));
  if (reason) return blocked(root, reason);
  return { tree, applied: true, paths: [[...lastPath.slice(0, -1), target.index + 1]], reason: null };
}

/**
 * 拖拽落点：把一组同父节点搬到 targetPath 处。
 * zone：inside → 成为目标的最后一个子级；above / below → 成为目标的同级（前 / 后）。
 * 落点是任一被拖节点自身或其后代时拒绝（循环防护）；其余可表达性交给 round-trip 锥体判定。
 */
export function moveNodes(root, paths, targetPath, zone) {
  const tree = cloneTree(root);
  const siblings = resolveSiblings(tree, paths);
  if (siblings.reason) return blocked(root, siblings.reason);
  const target = locateNode(tree, targetPath);
  if (!target) return blocked(root, 'invalid-path');
  if (paths.some((path) => isSelfOrAncestor(path, targetPath))) return blocked(root, 'invalid-target');

  const newParent = zone === 'inside' ? target.node : target.parent;
  // inside 是「成为目标的最后一个子级」；above / below 是插到目标前 / 后
  const insertIndex =
    zone === 'inside' ? null : zone === 'below' ? target.index + 1 : target.index;

  // 先整段摘出（从后往前，下标不失效）
  const moved = [];
  for (const index of [...siblings.indices].reverse()) {
    moved.unshift(siblings.parent.children.splice(index, 1)[0]);
  }
  if (insertIndex === null) {
    newParent.children.push(...moved);
  } else {
    // 同一父级内搬家时，被摘掉的、位于落点之前的节点会让下标前移
    const shift =
      newParent === siblings.parent
        ? siblings.indices.filter((index) => index < insertIndex).length
        : 0;
    const at = Math.max(0, Math.min(insertIndex - shift, newParent.children.length));
    newParent.children.splice(at, 0, ...moved);
  }
  adjustHeadingLevels(moved, newParent);

  // 搬家会改变下标（摘掉的节点可能排在目标之前），所以路径按节点身份反查
  const newParentPath = pathOfNode(tree, newParent);
  if (!newParentPath) return blocked(root, 'invalid-path');
  const reason = unrepresentable(root, tree, newParentPath);
  if (reason) return blocked(root, reason);
  return {
    tree,
    applied: true,
    paths: moved.map((node) => pathOfNode(tree, node)),
    reason: null,
  };
}

/** 拒绝原因 → 状态条文案 */
const REASON_TEXT = Object.freeze({
  'first-sibling': '首个同级节点没有可缩进的目标',
  'not-siblings': '多选需同一父级（同父约束）',
  'invalid-target': '不能拖到自身或自己的后代上',
  unrepresentable: '该位置无法在 Markdown 中还原，操作已取消',
  'heading-depth-limit': '标题层级超出 1–6 级，无法还原',
  'already-top-level': '已在顶层，无法取消缩进',
});

export function describeOutlineReason(reason) {
  return REASON_TEXT[reason] ?? '操作无法完成';
}

// ---- 内部工具 ----

const blocked = (tree, reason) => ({ tree, applied: false, paths: [], reason });

const cloneTree = (node) => ({ ...node, children: node.children.map(cloneTree) });

/** 造一个同级节点：标题带上 level，其余只要 kind */
function makeNode(kind, text, level) {
  const node = { kind, text, children: [] };
  if (kind === 'heading') node.level = level;
  return node;
}

/** 路径的规范字符串形式（DOM data-path / 集合键都用它） */
export const pathKey = (path) => path.join('.');

/** pathKey 的逆：'0.2.1' → [0, 2, 1]（空串 → []） */
export const parsePath = (key) => (key === '' ? [] : key.split('.').map(Number));

/** 文档顺序比较两条路径 */
export function comparePaths(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}

export const samePath = (a, b) => pathKey(a) === pathKey(b);

/** 父节点路径 → 节点；空路径表示虚拟根 */
function parentAt(root, path) {
  if (path.length === 0) return root;
  return locateNode(root, path)?.node ?? null;
}

/** path 是否等于 ancestor 或是它的后代（拖拽循环防护用） */
function isSelfOrAncestor(ancestor, path) {
  return (
    path.length >= ancestor.length && ancestor.every((index, i) => path[i] === index)
  );
}

/** 按节点身份反查路径（搬动/删除后下标会变，身份是稳的）；找不到返回 null */
function pathOfNode(root, node) {
  const walk = (parent, prefix) => {
    for (let i = 0; i < parent.children.length; i += 1) {
      const child = parent.children[i];
      if (child === node) return [...prefix, i];
      const found = walk(child, [...prefix, i]);
      if (found) return found;
    }
    return null;
  };
  return root === node ? [] : walk(root, []);
}

/**
 * 同父选中集（不要求连续）：{ parentPath, parent, indices } 或 { reason }
 */
function resolveSiblings(tree, paths) {
  if (!Array.isArray(paths) || paths.length === 0) return { reason: 'invalid-path' };
  const sorted = [...paths].sort(comparePaths);
  const parentPath = sorted[0].slice(0, -1);
  const indices = [];
  for (const path of sorted) {
    const loc = locateNode(tree, path);
    if (!loc) return { reason: 'invalid-path' };
    if (!samePath(path.slice(0, -1), parentPath)) return { reason: 'not-siblings' };
    indices.push(loc.index);
  }
  return { parentPath, parent: parentAt(tree, parentPath), indices };
}

/** 整块换到新父级后，标题按新父级重定级（顶层降为一级；列表项里层级不再约束） */
function adjustHeadingLevels(nodes, newParent) {
  for (const node of nodes) {
    if (node.kind !== 'heading') continue;
    const level =
      newParent.kind === 'heading' ? newParent.level + 1 : newParent.kind === 'root' ? 1 : node.level;
    if (level !== node.level) shiftHeadingLevels(node, level - node.level);
  }
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
