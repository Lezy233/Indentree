"use strict";

// 单一数据模型：{ id, text, children[] }，根节点为不可见虚拟根（id 为 "root"）
const Model = (() => {
  let counter = 0;

  function createNode(text = "") {
    counter += 1;
    return { id: "n" + counter, text, children: [] };
  }

  function createRoot() {
    return { id: "root", text: "", children: [] };
  }

  // 返回 { node, parent, index, depth }（顶层节点 depth 为 1），未找到返回 null
  function find(root, id) {
    let result = null;
    (function dfs(node, depth) {
      if (result) return;
      const idx = node.children.findIndex((c) => c.id === id);
      if (idx !== -1) {
        result = { node: node.children[idx], parent: node, index: idx, depth: depth + 1 };
        return;
      }
      node.children.forEach((c) => dfs(c, depth + 1));
    })(root, 0);
    return result;
  }

  // ancestorId 是否是 nodeId 的祖先（或同一节点）
  function isAncestor(root, ancestorId, nodeId) {
    if (ancestorId === nodeId) return true;
    const loc = find(root, ancestorId);
    if (!loc) return false;
    return !!find(loc.node, nodeId);
  }

  function remove(root, id) {
    const loc = find(root, id);
    if (!loc) return null;
    loc.parent.children.splice(loc.index, 1);
    return loc.node;
  }

  function insert(root, parentId, index, node) {
    const parent = parentId === "root" ? root : (find(root, parentId) || {}).node;
    if (!parent) return false;
    parent.children.splice(Math.max(0, Math.min(index, parent.children.length)), 0, node);
    return true;
  }

  // 移动节点到 newParentId 的 index 处；禁止移入自己或自己的后代
  function move(root, id, newParentId, index) {
    if (id === newParentId) return false;
    if (isAncestor(root, id, newParentId)) return false;
    const loc = find(root, id);
    if (!loc) return false;
    const parent = newParentId === "root" ? root : (find(root, newParentId) || {}).node;
    if (!parent) return false;
    const node = loc.node;
    loc.parent.children.splice(loc.index, 1);
    let idx = index;
    if (parent === loc.parent && idx > loc.index) idx -= 1;
    parent.children.splice(Math.max(0, Math.min(idx, parent.children.length)), 0, node);
    return true;
  }

  return { createNode, createRoot, find, remove, insert, move, isAncestor };
})();
