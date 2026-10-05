export const MESSAGE_MAX = 4000;

const ALLOWED = new Set(['P', 'BR', 'UL', 'OL', 'LI', 'STRONG', 'EM', 'B', 'I', 'U', 'BLOCKQUOTE']);
const BLOCK = new Set(['P', 'DIV', 'LI', 'TR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE']);
const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'META', 'LINK', 'IMG', 'SVG', 'IFRAME', 'OBJECT']);
const BULLET_MARK = '[-*•●○◦▪■‣·⁃–]';
const BULLET_PREFIX = new RegExp(`^\\s*(?:${BULLET_MARK}\\s*|\\d+[.)]\\s+)`);
const ORDERED_PREFIX = /^\s*\d+[.)]\s+/;

function clampText(raw) {
  return String(raw || '').replace(/\u00a0/g, ' ').trim().slice(0, MESSAGE_MAX);
}

function escapeHtml(raw) {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function tidyLine(line) {
  return String(line || '').replace(/\u00a0/g, ' ');
}

function isBulletLine(line) {
  return BULLET_PREFIX.test(tidyLine(line));
}

function isOrderedLine(line) {
  return ORDERED_PREFIX.test(tidyLine(line));
}

function stripBullet(line) {
  return tidyLine(line).replace(BULLET_PREFIX, '').trim();
}

function stripBulletHtml(inner) {
  const raw = String(inner || '');
  const next = raw.replace(new RegExp(`^\\s*(?:${BULLET_MARK}\\s*|\\d+[.)]\\s+)`), '');
  if (next !== raw) return next.trim();
  return stripBullet(htmlToText(`<p>${raw}</p>`) || raw.replace(/<[^>]+>/g, ' '));
}

function linesHaveList(raw) {
  return String(raw || '').split(/\r\n|\n/).some((line) => isBulletLine(line));
}

function lineIndent(line) {
  const expanded = String(line || '').replace(/\t/g, '  ').replace(/\u00a0/g, ' ');
  const match = expanded.match(/^( *)/);
  return Math.min(6, Math.floor((match ? match[1].length : 0) / 2));
}

function closeListsTo(stack, out, level) {
  while (stack.length && stack[stack.length - 1].level >= level) {
    const closed = stack.pop();
    const html = `<${closed.ordered ? 'ol' : 'ul'}>${closed.items.join('')}</${closed.ordered ? 'ol' : 'ul'}>`;
    if (stack.length) {
      const parent = stack[stack.length - 1];
      const last = parent.items.length - 1;
      if (last >= 0) parent.items[last] = parent.items[last].replace(/<\/li>$/, `${html}</li>`);
      else parent.items.push(`<li>${html}</li>`);
    } else {
      out.push(html);
    }
  }
}

function addListItem(stack, out, level, ordered, content) {
  if (stack.length && stack[stack.length - 1].level === level && stack[stack.length - 1].ordered !== ordered) {
    closeListsTo(stack, out, level);
  }
  closeListsTo(stack, out, level + 1);
  while (!stack.length || stack[stack.length - 1].level < level) {
    const nextLevel = stack.length ? stack[stack.length - 1].level + 1 : 0;
    stack.push({ level: nextLevel, ordered, items: [] });
  }
  stack[stack.length - 1].items.push(`<li>${escapeHtml(content)}</li>`);
}

export function plainToHtml(raw) {
  const text = String(raw || '').replace(/\r\n/g, '\n').replace(/\u00a0/g, ' ');
  const lines = text.split('\n');
  const out = [];
  const stack = [];
  let pending = null;
  const flushLists = () => closeListsTo(stack, out, 0);

  lines.forEach((line) => {
    if (pending) {
      const trimmed = line.trim();
      if (!trimmed) return;
      if (!isBulletLine(line.trimStart())) {
        addListItem(stack, out, pending.level, pending.ordered, trimmed);
        pending = null;
        return;
      }
      pending = null;
    }
    const indent = lineIndent(line);
    const rest = line.trimStart();
    if (isBulletLine(rest)) {
      const item = stripBullet(rest);
      if (!item) {
        pending = { level: indent, ordered: isOrderedLine(rest) };
        return;
      }
      addListItem(stack, out, indent, isOrderedLine(rest), item);
      return;
    }
    if (!rest && stack.length) return;
    flushLists();
    if (!rest) {
      out.push('<br>');
      return;
    }
    out.push(`<p>${escapeHtml(rest)}</p>`);
  });
  flushLists();
  return out.join('');
}

export function htmlToText(html) {
  const raw = String(html || '');
  if (!raw) return '';
  if (typeof DOMParser === 'undefined') {
    return clampText(raw.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|div|h[1-6]|blockquote)>/gi, '\n').replace(/<[^>]+>/g, ''));
  }
  const doc = new DOMParser().parseFromString(`<div>${raw}</div>`, 'text/html');
  const walk = (node, acc, ctx) => {
    if (!node) return;
    if (node.nodeType === 3) {
      acc.push(node.nodeValue || '');
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName;
    if (SKIP.has(tag)) return;
    if (tag === 'BR') {
      acc.push('\n');
      return;
    }
    if (tag === 'UL' || tag === 'OL') {
      const next = { ordered: tag === 'OL', index: 0, depth: ctx?.depth || 0 };
      Array.from(node.childNodes).forEach((child) => walk(child, acc, next));
      if (node.parentElement?.tagName !== 'LI' && acc.length && !String(acc[acc.length - 1]).endsWith('\n')) acc.push('\n');
      return;
    }
    if (tag === 'LI') {
      acc.push('\n');
      acc.push('  '.repeat(ctx?.depth || 0));
      if (ctx?.ordered) {
        ctx.index = (ctx.index || 0) + 1;
        acc.push(`${ctx.index}. `);
      } else {
        acc.push('• ');
      }
      Array.from(node.childNodes).forEach((child) => walk(child, acc, {
        ordered: false,
        index: 0,
        depth: (ctx?.depth || 0) + 1,
      }));
      return;
    }
    if (tag === 'BLOCKQUOTE') {
      Array.from(node.childNodes).forEach((child) => walk(child, acc, {
        ...ctx,
        depth: (ctx?.depth || 0) + 1,
      }));
      if (acc.length && !String(acc[acc.length - 1]).endsWith('\n')) acc.push('\n');
      return;
    }
    const parentTag = node.parentElement?.tagName;
    const skipBreak = (tag === 'P' || tag === 'DIV') && parentTag === 'LI';
    if (BLOCK.has(tag) && tag !== 'P' && !skipBreak && acc.length && !String(acc[acc.length - 1]).endsWith('\n')) acc.push('\n');
    Array.from(node.childNodes).forEach((child) => walk(child, acc, ctx));
    if (BLOCK.has(tag) && tag !== 'LI' && !skipBreak) acc.push('\n');
  };
  const acc = [];
  Array.from(doc.body.childNodes).forEach((child) => walk(child, acc, { ordered: false, index: 0, depth: 0 }));
  return clampText(
    acc.join('')
      .replace(/\n([ \t]*• )\n+/g, '\n$1')
      .replace(/\n([ \t]*\d+\. )\n+/g, '\n$1')
      .replace(/\n{3,}/g, '\n\n'),
  );
}

function attrStyle(node) {
  return String(node?.getAttribute?.('style') || '');
}

function styleMarks(node) {
  const tag = node.tagName;
  const style = attrStyle(node);
  const weightOff = /font-weight\s*:\s*(normal|400|300|200|100)\b/i.test(style);
  const boldTag = tag === 'STRONG' || tag === 'B';
  const italicTag = tag === 'EM' || tag === 'I';
  const underlineTag = tag === 'U' || tag === 'INS';
  const boldStyle = /font-weight\s*:\s*(bold|bolder|[6-9]00)\b/i.test(style);
  const italicStyle = /font-style\s*:\s*(italic|oblique)\b/i.test(style);
  const underlineStyle = /text-decoration(?:-line)?\s*:\s*[^;]*underline/i.test(style);
  return {
    bold: (boldTag && !weightOff) || boldStyle,
    italic: italicTag || italicStyle,
    underline: underlineTag || underlineStyle,
  };
}

function inListContext(tag) {
  return tag === 'LI' || tag === 'UL' || tag === 'OL';
}

function serialize(node, out, parentTag = '') {
  if (!node) return;
  if (node.nodeType === 3) {
    const text = node.nodeValue || '';
    if (text) out.push(escapeHtml(text));
    return;
  }
  if (node.nodeType !== 1) return;
  const tag = node.tagName;
  if (SKIP.has(tag)) return;
  if (tag === 'BR') {
    out.push('<br>');
    return;
  }

  const marks = styleMarks(node);
  const wrap = [];
  if (marks.bold && tag !== 'STRONG' && tag !== 'B') wrap.push('strong');
  if (marks.italic && tag !== 'EM' && tag !== 'I') wrap.push('em');
  if (marks.underline && tag !== 'U') wrap.push('u');
  wrap.forEach((open) => out.push(`<${open}>`));

  if (ALLOWED.has(tag)) {
    const keep = (tag === 'B' || tag === 'STRONG')
      ? marks.bold
      : (tag === 'I' || tag === 'EM')
        ? marks.italic
        : (tag === 'U')
          ? marks.underline
          : true;
    if (keep) {
      const open = tag.toLowerCase();
      out.push(`<${open}>`);
      Array.from(node.childNodes).forEach((child) => serialize(child, out, tag));
      out.push(`</${open}>`);
      wrap.slice().reverse().forEach((openTag) => out.push(`</${openTag}>`));
      return;
    }
  }

  Array.from(node.childNodes).forEach((child) => serialize(child, out, tag));
  if (BLOCK.has(tag) && tag !== 'LI' && tag !== 'BLOCKQUOTE' && !inListContext(parentTag) && tag !== 'DIV') {
    out.push('<br>');
  } else if (tag === 'DIV' && !inListContext(parentTag) && !inListContext(tag)) {
    const last = out[out.length - 1];
    if (last && last !== '<br>' && !/<\/(ul|ol|li)>$/i.test(last)) out.push('<br>');
  }
  wrap.slice().reverse().forEach((openTag) => out.push(`</${openTag}>`));
}

function innerHtml(node) {
  const out = [];
  Array.from(node.childNodes).forEach((child) => serialize(child, out, node.tagName));
  return out.join('');
}

function paragraphLevel(el) {
  const style = attrStyle(el);
  const mso = /mso-list:[^;'"]*level(\d+)/i.exec(style);
  if (mso) return Math.max(0, Math.min(6, Number(mso[1]) - 1));
  const pad = /(?:margin|padding)-left:\s*([\d.]+)(pt|px|in|em|cm)/i.exec(style);
  if (pad) {
    const n = parseFloat(pad[1]);
    const unit = pad[2];
    const pt = unit === 'pt' ? n : unit === 'px' ? n * 0.75 : unit === 'in' ? n * 72 : unit === 'cm' ? n * 28.35 : n * 12;
    return Math.max(0, Math.min(6, Math.floor((pt + 12) / 36)));
  }
  return 0;
}

function looksLikeListItem(el) {
  if (!el || el.nodeType !== 1) return false;
  const tag = el.tagName;
  if (tag !== 'P' && tag !== 'DIV' && tag !== 'H1' && tag !== 'H2' && tag !== 'H3') return false;
  if ([...el.children].some((child) => BLOCK.has(child.tagName) || child.tagName === 'UL' || child.tagName === 'OL')) {
    return false;
  }
  if (/mso-list/i.test(attrStyle(el))) return true;
  const text = (el.textContent || '').replace(/\u00a0/g, ' ');
  return isBulletLine(text.trim());
}

function nestIndentedBlocks(root, doc) {
  const nodes = [...root.childNodes];
  let i = 0;
  while (i < nodes.length) {
    const node = nodes[i];
    if (!looksLikeListItem(node)) {
      i += 1;
      continue;
    }
    const start = i;
    i += 1;
    while (i < nodes.length && looksLikeListItem(nodes[i])) i += 1;
    const group = nodes.slice(start, i);
    const stack = [];
    let rootList = null;
    group.forEach((item) => {
      const text = (item.textContent || '').replace(/\u00a0/g, ' ');
      const ordered = isOrderedLine(text.trim());
      const level = paragraphLevel(item);
      const content = stripBulletHtml(innerHtml(item)) || stripBullet(text) || innerHtml(item);
      while (stack.length && stack[stack.length - 1].level > level) stack.pop();
      if (stack.length && stack[stack.length - 1].level === level && stack[stack.length - 1].ordered !== ordered) {
        stack.pop();
      }
      if (!stack.length || stack[stack.length - 1].level < level) {
        const list = doc.createElement(ordered ? 'ol' : 'ul');
        if (stack.length) stack[stack.length - 1].li.appendChild(list);
        else rootList = list;
        stack.push({ level, ordered, list, li: null });
      }
      const li = doc.createElement('li');
      li.innerHTML = content;
      stack[stack.length - 1].list.appendChild(li);
      stack[stack.length - 1].li = li;
    });
    if (rootList) root.insertBefore(rootList, group[0]);
    group.forEach((item) => item.remove());
  }
  [...root.children].forEach((child) => {
    if (child.tagName === 'LI' || child.tagName === 'UL' || child.tagName === 'OL') return;
    if (child.children.length) nestIndentedBlocks(child, doc);
  });
}

function unwrapLiParagraphsDom(root) {
  [...root.querySelectorAll('li')].reverse().forEach((li) => {
    [...li.children].filter((child) => child.tagName === 'P' || child.tagName === 'DIV').forEach((block) => {
      while (block.firstChild) li.insertBefore(block.firstChild, block);
      block.remove();
    });
    const html = li.innerHTML
      .replace(new RegExp(`^(?:${BULLET_MARK})\\s*(?:<br\\s*\\/?>\\s*)+`, 'i'), '')
      .replace(/^(<br\s*\/?>)+|(<br\s*\/?>)+$/gi, '')
      .replace(/(?:<br\s*\/?>)+\s*(<(?:ul|ol)\b)/gi, '$1')
      .replace(/(<\/(?:ul|ol)>)\s*(?:<br\s*\/?>)+/gi, '$1')
      .trim();
    if (!html || /^(?:[-*•●○◦▪■‣·⁃–])$/.test(html)) {
      li.remove();
      return;
    }
    li.innerHTML = html;
  });
  [...root.querySelectorAll('ul,ol')].forEach((list) => {
    if (!list.querySelector('li')) list.remove();
  });
}

function tidyListHtml(html) {
  return String(html || '')
    .replace(/<li>\s*(?:<br\s*\/?>\s*)+/gi, '<li>')
    .replace(/(?:<br\s*\/?>\s*)+<\/li>/gi, '</li>')
    .replace(/(?:<br\s*\/?>\s*)+(<(?:ul|ol)\b)/gi, '$1')
    .replace(/(<\/(?:ul|ol)>)\s*(?:<br\s*\/?>)+/gi, '$1')
    .replace(/<(ul|ol)>\s*(?:<br\s*\/?>)+/gi, '<$1>')
    .replace(/(?:<br\s*\/?>)+\s*<\/(ul|ol)>/gi, '</$1>');
}

function promoteTopLevelBullets(root, doc) {
  const nodes = [...root.childNodes];
  let i = 0;
  while (i < nodes.length) {
    const node = nodes[i];
    const html = node.nodeType === 1 ? innerHtml(node) : (node.nodeValue || '');
    const text = htmlToText(node.nodeType === 1 ? `<p>${html}</p>` : html);
    const isP = node.nodeType === 1 && (node.tagName === 'P' || node.tagName === 'DIV');
    if (!(isP && isBulletLine(text))) {
      i += 1;
      continue;
    }
    const start = i;
    i += 1;
    while (i < nodes.length) {
      const next = nodes[i];
      const nextHtml = next.nodeType === 1 ? innerHtml(next) : (next.nodeValue || '');
      const nextText = htmlToText(next.nodeType === 1 && (next.tagName === 'P' || next.tagName === 'DIV') ? `<p>${nextHtml}</p>` : nextHtml);
      if (next.nodeType === 1 && (next.tagName === 'P' || next.tagName === 'DIV') && isBulletLine(nextText)) {
        i += 1;
        continue;
      }
      break;
    }
    const group = nodes.slice(start, i);
    const list = doc.createElement(isOrderedLine(text) ? 'ol' : 'ul');
    group.forEach((item) => {
      const itemHtml = item.nodeType === 1 ? innerHtml(item) : escapeHtml(item.nodeValue || '');
      const itemText = htmlToText(`<p>${itemHtml}</p>`);
      const li = doc.createElement('li');
      li.innerHTML = stripBulletHtml(itemHtml) || stripBullet(itemText);
      list.appendChild(li);
    });
    root.insertBefore(list, group[0]);
    group.forEach((item) => item.remove());
  }
}

export function sanitizeStageMessageHtml(rawHtml, fallbackText = '') {
  const html = String(rawHtml || '');
  if (!html.trim()) return plainToHtml(fallbackText);
  if (typeof DOMParser === 'undefined') return plainToHtml(fallbackText || htmlToText(html));
  const looksDocument = /<(?:html|body|meta)\b/i.test(html);
  const parsed = new DOMParser().parseFromString(looksDocument ? html : `<div>${html}</div>`, 'text/html');
  nestIndentedBlocks(parsed.body, parsed);
  const out = [];
  Array.from(parsed.body.childNodes).forEach((child) => serialize(child, out));
  let next = out.join('')
    .replace(/(<br>)+/g, '<br>')
    .replace(/^(<br>)+|(<br>)+$/g, '');
  const wrap = new DOMParser().parseFromString(`<div id="root">${next}</div>`, 'text/html');
  const root = wrap.getElementById('root') || wrap.body;
  unwrapLiParagraphsDom(root);
  promoteTopLevelBullets(root, wrap);
  [...root.querySelectorAll('ul > ul, ol > ol, ul > ol, ol > ul')].forEach((inner) => {
    const li = wrap.createElement('li');
    inner.parentNode.insertBefore(li, inner);
    li.appendChild(inner);
  });
  next = tidyListHtml(root.innerHTML
    .replace(/<\/ul><ul>/gi, '')
    .replace(/<\/ol><ol>/gi, '')
    .replace(/<(ul|ol)>\s*<\/\1>/gi, ''));
  if (!next.trim()) return plainToHtml(fallbackText);
  const text = htmlToText(next);
  if (text.length > MESSAGE_MAX) {
    return plainToHtml(text.slice(0, MESSAGE_MAX));
  }
  return next;
}

export function messageFromClipboard(html, plain) {
  const pastedHtml = String(html || '').trim();
  const pastedText = String(plain || '');
  if (pastedHtml && /<[a-z][\s\S]*>/i.test(pastedHtml)) {
    const clean = sanitizeStageMessageHtml(pastedHtml, pastedText);
    if (linesHaveList(pastedText) && !messageHasBlocks(clean)) {
      const fromPlain = normalizeStageMessage(pastedText);
      if (fromPlain) return fromPlain;
    }
    const text = htmlToText(clean) || clampText(pastedText);
    if (!text) return '';
    return { html: clean, text };
  }
  const text = clampText(pastedText);
  if (!text) return '';
  return normalizeStageMessage(text);
}

export function messageHasBlocks(html) {
  return /<(ul|ol|li|blockquote)\b/i.test(String(html || ''));
}

export function messageHasRichMarkup(html) {
  const s = String(html || '');
  if (/<(ul|ol|li|strong|em|b|i|u|br|blockquote)\b/i.test(s)) return true;
  return (s.match(/<p\b/gi) || []).length > 1;
}

export function messageUsesBodyType(value) {
  const html = stageMessageHtml(value);
  const text = stageMessageText(value);
  if (messageHasRichMarkup(html) || messageHasBlocks(html)) return true;
  if (text.length > 80) return true;
  if (text.split(/\n/).filter(Boolean).length > 2) return true;
  return false;
}

export function stageMessageText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') return String(value.text || '').trim();
  return String(value).trim();
}

export function stageMessageHtml(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return String(value.html || '').trim();
  }
  return '';
}

export function editorHtmlFromMessage(value) {
  const html = stageMessageHtml(value);
  if (html) return html;
  const text = stageMessageText(value);
  if (!text) return '';
  if (text.includes('\n') || isBulletLine(text)) return plainToHtml(text);
  return `<p>${escapeHtml(text)}</p>`;
}

export function normalizeStageMessage(raw) {
  if (raw == null || raw === '') return '';
  if (typeof raw === 'string') {
    const text = clampText(raw);
    if (!text) return '';
    if (text.includes('\n') || isBulletLine(text)) {
      return { html: plainToHtml(text), text };
    }
    return text;
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const html = sanitizeStageMessageHtml(raw.html || '', raw.text || '');
    const text = clampText(raw.text || htmlToText(html));
    if (!text) return '';
    if (!html || !messageHasRichMarkup(html)) return text;
    return { html, text };
  }
  return '';
}
