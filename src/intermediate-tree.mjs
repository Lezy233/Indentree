import MarkdownIt from '../vendor/markdown-it.mjs';

const md = new MarkdownIt();

function createRoot() {
  return { kind: 'root', text: '', children: [] };
}

/**
 * Markdown → 中间树（纯函数）。
 * 节点 = { text, kind, children }；kind ∈ root / heading / list-item / paragraph / leaf-block。
 * 标题深度与列表缩进统一折叠为父子嵌套。
 */
export function parseMarkdown(src) {
  const root = createRoot();
  const tokens = md.parse(src, {});
  const lines = src.split('\n');

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
          const node = { kind: 'heading', text, children: [] };
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
      case 'code_block':
      case 'html_block': {
        attach({ kind: 'leaf-block', text: rawSlice(lines, token), children: [] });
        break;
      }
      case 'table_open': {
        attach({ kind: 'leaf-block', text: rawSlice(lines, token), children: [] });
        skipUntil = 'table_close';
        break;
      }
      case 'hr': {
        attach({ kind: 'leaf-block', text: rawSlice(lines, token), children: [] });
        break;
      }
      default:
        break;
    }
  }

  return root;
}

// 用 token 的行区间从原文切出叶子块的原始 Markdown
function rawSlice(lines, token) {
  if (!token.map) return token.content ?? '';
  return lines.slice(token.map[0], token.map[1]).join('\n');
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
