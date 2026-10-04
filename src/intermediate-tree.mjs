import MarkdownIt from '../vendor/markdown-it.mjs';

const md = new MarkdownIt();

/** 解析失败错误：携带源行号（1-based），供页面行级标红与状态条提示 */
export class MarkdownParseError extends Error {
  constructor(message, line, cause) {
    super(message, { cause });
    this.name = 'MarkdownParseError';
    this.line = line;
  }
}

function createRoot() {
  return { kind: 'root', text: '', children: [] };
}

/**
 * Markdown → 中间树（纯函数）。
 * 节点 = { text, kind, children }；kind ∈ root / heading / list-item / paragraph / leaf-block。
 * 标题节点额外携带 level（1-6），供序列化时按 kind 还原写法。
 * 标题深度与列表缩进统一折叠为父子嵌套。
 * CommonMark 本身无语法错误；任何底层异常包装为携带行号的 MarkdownParseError。
 */
export function parseMarkdown(src, parser = md) {
  const root = createRoot();
  let currentLine = 1;
  try {
    const tokens = parser.parse(src, {});
    const lines = String(src).split('\n');

  const headingStack = []; // [{ level, node }]
  const listStack = []; // [{ parent, currentItem }]

  const currentParent = () => {
    const topList = listStack[listStack.length - 1];
    if (topList?.currentItem) return topList.currentItem;
    if (headingStack.length > 0) return headingStack[headingStack.length - 1].node;
    return root;
  };

  const attach = (node) => {
    currentParent().children.push(node);
    return node;
  };

  let pendingHeadingLevel = null;
  let paragraphMode = null; // 'standalone' | 'item'
  let skipUntil = null; // e.g. 'table_close'

  for (const token of tokens) {
    if (token.map) currentLine = token.map[0] + 1;
    if (skipUntil) {
      if (token.type === skipUntil) skipUntil = null;
      continue;
    }

    switch (token.type) {
      case 'heading_open': {
        pendingHeadingLevel = Number(token.tag.slice(1));
        break;
      }
      case 'heading_close': {
        pendingHeadingLevel = null;
        break;
      }
      case 'bullet_list_open':
      case 'ordered_list_open': {
        listStack.push({ parent: currentParent(), currentItem: null });
        break;
      }
      case 'bullet_list_close':
      case 'ordered_list_close': {
        listStack.pop();
        break;
      }
      case 'list_item_open': {
        const top = listStack[listStack.length - 1];
        const node = { kind: 'list-item', text: '', children: [] };
        top.parent.children.push(node);
        top.currentItem = node;
        break;
      }
      case 'paragraph_open': {
        const top = listStack[listStack.length - 1];
        paragraphMode = top?.currentItem ? 'item' : 'standalone';
        break;
      }
      case 'paragraph_close': {
        paragraphMode = null;
        break;
      }
      case 'inline': {
        const text = token.content;
        if (pendingHeadingLevel !== null) {
          const node = { kind: 'heading', text, level: pendingHeadingLevel, children: [] };
          while (
            headingStack.length > 0 &&
            headingStack[headingStack.length - 1].level >= pendingHeadingLevel
          ) {
            headingStack.pop();
          }
          attach(node);
          headingStack.push({ level: pendingHeadingLevel, node });
          break;
        }
        if (paragraphMode === 'item') {
          const item = listStack[listStack.length - 1].currentItem;
          if (item.text === '') {
            item.text = text;
          } else {
            item.children.push({ kind: 'paragraph', text, children: [] });
          }
          break;
        }
        if (paragraphMode === 'standalone') {
          attach({ kind: 'paragraph', text, children: [] });
        }
        break;
      }
      case 'fence':
      case 'html_block': {
        attach({ kind: 'leaf-block', text: rawSlice(lines, token, 0), children: [] });
        break;
      }
      case 'code_block': {
        // 缩进代码块的 4 空格是语义缩进，去容器缩进时保留
        attach({ kind: 'leaf-block', text: rawSlice(lines, token, 4), children: [] });
        break;
      }
      case 'table_open': {
        attach({ kind: 'leaf-block', text: rawSlice(lines, token, 0), children: [] });
        skipUntil = 'table_close';
        break;
      }
      case 'hr': {
        attach({ kind: 'leaf-block', text: rawSlice(lines, token, 0), children: [] });
        break;
      }
      default:
        break;
    }
  }

    return root;
  } catch (err) {
    if (err instanceof MarkdownParseError) throw err;
    throw new MarkdownParseError(`第 ${currentLine} 行无法解析`, currentLine, err);
  }
}

// 用 token 的行区间从原文切出叶子块的原始 Markdown，并去掉容器缩进
// （reserve 列保留给块自身的语义缩进，如缩进代码块的 4 空格）；
// 序列化时再按所在层级重新缩进，保证 round-trip 稳定
function rawSlice(lines, token, reserve) {
  if (!token.map) return token.content ?? '';
  const text = lines.slice(token.map[0], token.map[1]).join('\n');
  let min = Infinity;
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    min = Math.min(min, line.match(/^ */)[0].length);
  }
  if (min === Infinity) return text;
  const strip = Math.max(0, min - reserve);
  if (strip === 0) return text;
  return text
    .split('\n')
    .map((line) => line.replace(new RegExp(`^ {0,${strip}}`), ''))
    .join('\n');
}

/**
 * 中间树 → Markdown（纯函数）。按 kind 还原写法：
 * 标题仍是 #（用节点携带的 level）、列表项仍是 -、段落与叶子块原样输出。
 * 相邻列表项之间不空行（保持紧凑列表），其余块之间空一行。
 */
export function serializeMarkdown(root) {
  const top = root.kind === 'root' ? root.children : [root];
  return emitBlocks(top, 0);
}

function emitBlocks(nodes, indent) {
  let out = '';
  nodes.forEach((node, i) => {
    if (i > 0) {
      const tight = nodes[i - 1].kind === 'list-item' && node.kind === 'list-item';
      out += tight ? '\n' : '\n\n';
    }
    out += emitNode(node, indent);
  });
  return out;
}

function emitNode(node, indent) {
  const pad = ' '.repeat(indent);
  switch (node.kind) {
    case 'heading': {
      const own = `${pad}${'#'.repeat(node.level)} ${node.text}`;
      return node.children.length > 0 ? `${own}\n\n${emitBlocks(node.children, indent)}` : own;
    }
    case 'list-item': {
      const own = `${pad}- ${node.text}`;
      if (node.children.length === 0) return own;
      const sep = node.children[0].kind === 'list-item' ? '\n' : '\n\n';
      return own + sep + emitBlocks(node.children, indent + 2);
    }
    case 'paragraph': {
      const own = pad + node.text;
      return node.children.length > 0 ? `${own}\n\n${emitBlocks(node.children, indent)}` : own;
    }
    case 'leaf-block':
    default: {
      return node.text
        .split('\n')
        .map((line) => (line === '' ? '' : pad + line))
        .join('\n');
    }
  }
}

const DEFAULT_SYMBOLS = {
  branch: '├', // 中间分支
  branchLast: '└', // 末分支
  vertical: '│', // 竖线
  horizontal: '─', // 横线
  horizontalLength: 2,
};

/**
 * 中间树 → 树形图文本（纯函数）。root 自身不渲染，只渲染其子树。
 */
export function renderTreeText(root, options = {}) {
  const symbols = { ...DEFAULT_SYMBOLS, ...options };
  const h = symbols.horizontal.repeat(symbols.horizontalLength);
  const midConnector = `${symbols.branch}${h} `;
  const lastConnector = `${symbols.branchLast}${h} `;
  const pipePrefix = `${symbols.vertical}${' '.repeat(h.length + 1)}`;
  const blankPrefix = ' '.repeat(h.length + 2);

  const lines = [];
  const walk = (node, prefix, isLast) => {
    const connector = isLast ? lastConnector : midConnector;
    const textLines = node.text.split('\n');
    lines.push(prefix + connector + textLines[0]);
    const childPrefix = prefix + (isLast ? blankPrefix : pipePrefix);
    for (const extra of textLines.slice(1)) {
      lines.push(childPrefix + extra);
    }
    node.children.forEach((child, i) => {
      walk(child, childPrefix, i === node.children.length - 1);
    });
  };

  const top = root.kind === 'root' ? root.children : [root];
  top.forEach((node, i) => walk(node, '', i === top.length - 1));
  return lines.join('\n');
}
