/**
 * 大纲撤销栈：每次大纲侧改动前压入一份不可变快照。
 * 我们的结构操作都返回新树（结构共享），所以快照成本≈两个指针。
 * 纯函数，页面负责在改动前压栈、Cmd+Z 时出栈。
 *
 * 快照形状由调用方决定（当前是 { tree, selection }），本模块只当它是不可变值。
 */

export const HISTORY_LIMIT = 50;

export function emptyHistory() {
  return { entries: [] };
}

export function canUndo(history) {
  return history.entries.length > 0;
}

/** 压入快照；超过上限时丢最旧的 */
export function pushHistory(history, snapshot) {
  const entries = [...history.entries, snapshot];
  return { entries: entries.slice(Math.max(0, entries.length - HISTORY_LIMIT)) };
}

/** 出栈：返回 { history, snapshot }；栈空时 snapshot 为 null、history 原样返回 */
export function undoHistory(history) {
  if (history.entries.length === 0) return { history, snapshot: null };
  return {
    history: { entries: history.entries.slice(0, -1) },
    snapshot: history.entries[history.entries.length - 1],
  };
}
