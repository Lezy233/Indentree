/**
 * 树形图分支符号设置：默认值、预设、localStorage/URL 参数的解析与合并。
 * 全部为纯函数，页面负责 DOM 与存储接线。
 *
 * 符号模型：{ branch, branchLast, vertical, horizontal, horizontalLength }
 * 中间分支 = branch + horizontal×horizontalLength（├──）
 * 末分支   = branchLast + horizontal×horizontalLength（└──）
 * 竖线     = 非末级祖先的纵向连接线（│）
 */

export const DEFAULT_SYMBOLS = Object.freeze({
  branch: '├',
  branchLast: '└',
  vertical: '│',
  horizontal: '─',
  horizontalLength: 2,
});

export const PRESETS = Object.freeze({
  classic: { label: '经典 ├──', symbols: { ...DEFAULT_SYMBOLS } },
  single: {
    label: '单线 ├─',
    symbols: { ...DEFAULT_SYMBOLS, horizontalLength: 1 },
  },
  none: {
    label: '无框',
    symbols: { branch: ' ', branchLast: ' ', vertical: ' ', horizontal: ' ', horizontalLength: 2 },
  },
});

const MIN_HLEN = 1;
const MAX_HLEN = 8;

const validSymbol = (v) => typeof v === 'string' && v.length > 0;
const validHlen = (v) => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return Number.isInteger(n) && n >= MIN_HLEN && n <= MAX_HLEN ? n : null;
};

// 只保留合法字段的浅拷贝；非法字段丢弃
function sanitize(partial) {
  if (!partial || typeof partial !== 'object') return {};
  const out = {};
  if (validSymbol(partial.branch)) out.branch = partial.branch;
  if (validSymbol(partial.branchLast)) out.branchLast = partial.branchLast;
  if (validSymbol(partial.vertical)) out.vertical = partial.vertical;
  if (validSymbol(partial.horizontal)) out.horizontal = partial.horizontal;
  const hlen = validHlen(partial.horizontalLength ?? partial.hlen);
  if (hlen !== null) out.horizontalLength = hlen;
  return out;
}

/** URL query string → 符号部分值（只含出现且合法的键） */
export function symbolsFromSearch(search) {
  const params = new URLSearchParams((search ?? '').replace(/^\?/, ''));
  const raw = {};
  if (params.has('branch')) raw.branch = params.get('branch');
  if (params.has('last')) raw.branchLast = params.get('last');
  if (params.has('vertical')) raw.vertical = params.get('vertical');
  if (params.has('horizontal')) raw.horizontal = params.get('horizontal');
  if (params.has('hlen')) raw.hlen = params.get('hlen');
  return sanitize(raw);
}

/** 符号 → URL query string（用于分享链接） */
export function symbolsToSearch(symbols) {
  const params = new URLSearchParams({
    branch: symbols.branch,
    last: symbols.branchLast,
    vertical: symbols.vertical,
    horizontal: symbols.horizontal,
    hlen: String(symbols.horizontalLength),
  });
  return `?${params.toString()}`;
}

/** 合并符号设置：默认 < localStorage 存值 < URL 参数 */
export function resolveSymbols({ stored, urlSearch } = {}) {
  return {
    ...DEFAULT_SYMBOLS,
    ...sanitize(stored),
    ...symbolsFromSearch(urlSearch),
  };
}
