export const MESSAGE_MAX = 4000;

const ALLOWED = new Set(['P', 'BR', 'UL', 'OL', 'LI', 'STRONG', 'EM', 'B', 'I']);
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

export function plainToHtml(raw) {
  const text = String(raw || '').replace(/\r\n/g, '\n').replace(/\u00a0/g, ' ');
  const lines = text.split('\n');
  const out = [];
  let list = [];
  let ordered = false;
  let pending = null;
  const flushList = () => {
    if (!list.length) return;
    const tag = ordered ? 'ol' : 'ul';
    out.push(`<${tag}>${list.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</${tag}>`);
    list = [];
    ordered = false;
  };
  lines.forEach((line) => {
    if (pending !== null) {
      const trimmed = line.trim();
      if (!trimmed) return;
      if (!isBulletLine(line)) {
        if (list.length && pending !== ordered) flushList();
        ordered = pending;
        list.push(trimmed);
        pending = null;
        return;
      }
      pending = null;
    }
    if (isBulletLine(line)) {
      const nextOrdered = isOrderedLine(line);
      const item = stripBullet(line);
      if (!item) {
        pending = nextOrdered;
        return;
      }
      if (list.length && nextOrdered !== ordered) flushList();
      ordered = nextOrdered;
      list.push(item);
      return;
    }
    if (!line.trim() && list.length) return;
    flushList();
    const trimmed = line.trim();
    if (!trimmed) {
      out.push('<br>');
      return;
    }
    out.push(`<p>${escapeHtml(trimmed)}</p>`);
  });
  flushList();
  return out.join('');
}

export function htmlToText(html) {
  const raw = String(html || '');
  if (!raw) return '';
  if (typeof DOMParser === 'undefined') {
    return clampText(raw.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|div|h[1-6])>/gi, '\n').replace(/<[^>]+>/g, ''));
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
      const next = { ordered: tag === 'OL', index: 0 };
      Array.from(node.childNodes).forEach((child) => walk(child, acc, next));
      if (acc.length && !String(acc[acc.length - 1]).endsWith('\n')) acc.push('\n');
      return;
    }
    if (tag === 'LI') {
      acc.push('\n');
      if (ctx?.ordered) {
        ctx.index = (ctx.index || 0) + 1;
        acc.push(`${ctx.index}. `);
      } else {
        acc.push('• ');
      }
      Array.from(node.childNodes).forEach((child) => walk(child, acc, { ordered: false, index: 0 }));
      return;
    }
    const parentTag = node.parentElement?.tagName;
    if (BLOCK.has(tag) && tag !== 'P' && acc.length && !String(acc[acc.length - 1]).endsWith('\n')) acc.push('\n');
    Array.from(node.childNodes).forEach((child) => walk(child, acc, ctx));
    if (BLOCK.has(tag) && tag !== 'LI' && !(tag === 'P' && parentTag === 'LI')) acc.push('\n');
  };
  const acc = [];
  Array.from(doc.body.childNodes).forEach((child) => walk(child, acc, { ordered: false, index: 0 }));
  return clampText(
    acc.join('')
      .replace(/\n• \n+/g, '\n• ')
      .replace(/\n(\d+\. )\n+/g, '\n$1')
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
  const boldStyle = /font-weight\s*:\s*(bold|bolder|[6-9]00)\b/i.test(style);
  const italicStyle = /font-style\s*:\s*(italic|oblique)\b/i.test(style);
  return {
    bold: (boldTag && !weightOff) || boldStyle,
    italic: italicTag || italicStyle,
  };
}

function serialize(node, out) {
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
  wrap.forEach((open) => out.push(`<${open}>`));

  if (ALLOWED.has(tag)) {
    const keep = (tag === 'B' || tag === 'STRONG') ? marks.bold : (tag === 'I' || tag === 'EM') ? marks.italic : true;
    if (keep) {
      const open = tag.toLowerCase();
      out.push(`<${open}>`);
      Array.from(node.childNodes).forEach((child) => serialize(child, out));
      out.push(`</${open}>`);
      wrap.slice().reverse().forEach((openTag) => out.push(`</${openTag}>`));
      return;
    }
  }

  Array.from(node.childNodes).forEach((child) => serialize(child, out));
  if (BLOCK.has(tag) && tag !== 'LI') out.push('<br>');
  wrap.slice().reverse().forEach((openTag) => out.push(`</${openTag}>`));
}

function unwrapLiParagraphs(html) {
  return String(html || '').replace(/<li>([\s\S]*?)<\/li>/gi, (_, inner) => {
    let unwrapped = String(inner || '')
      .replace(/<p>\s*<\/p>/gi, '')
      .replace(/^\s*<p>([\s\S]*?)<\/p>\s*$/i, '$1')
      .replace(/<p>([\s\S]*?)<\/p>/gi, '$1<br>')
      .replace(/^(<br>)+|(<br>)+$/g, '')
      .trim();
    unwrapped = unwrapped.replace(new RegExp(`^(?:${BULLET_MARK})\\s*(?:<br>\\s*)+`), '');
    if (!unwrapped || /^(?:[-*•●○◦▪■‣·⁃–])$/.test(unwrapped)) return '';
    return `<li>${unwrapped}</li>`;
  }).replace(/<li>\s*<\/li>/gi, '');
}

function promoteLooseLists(html) {
  const parts = String(html || '').split(/(<ul[\s\S]*?<\/ul>|<ol[\s\S]*?<\/ol>)/i);
  return parts.map((part) => {
    if (/^<(ul|ol)\b/i.test(part)) return part;
    const tokens = part.split(/(<p>[\s\S]*?<\/p>|<br\s*\/?>)/i);
    const out = [];
    let bullets = [];
    let ordered = false;
    let pending = null;
    const flush = () => {
      if (!bullets.length) return;
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${bullets.map((item) => `<li>${item}</li>`).join('')}</${tag}>`);
      bullets = [];
    };
    const consider = (inner, fallbackToken) => {
      const text = htmlToText(`<p>${inner}</p>`) || String(inner || '').replace(/<[^>]+>/g, ' ');
      const item = isBulletLine(text) ? (stripBulletHtml(inner) || stripBullet(text)) : '';
      if (pending) {
        const follow = (item || String(inner || '').replace(/<[^>]+>/g, ' ')).trim();
        if (follow && !isBulletLine(text)) {
          const nextOrdered = pending.ordered;
          if (bullets.length && nextOrdered !== ordered) flush();
          ordered = nextOrdered;
          bullets.push(inner.trim() || follow);
          pending = null;
          return;
        }
        pending = null;
      }
      if (!isBulletLine(text)) {
        flush();
        if (fallbackToken != null && fallbackToken !== '') out.push(fallbackToken);
        return;
      }
      const nextOrdered = isOrderedLine(text);
      if (!item) {
        pending = { ordered: nextOrdered };
        return;
      }
      if (bullets.length && nextOrdered !== ordered) flush();
      ordered = nextOrdered;
      bullets.push(item);
    };
    tokens.forEach((token) => {
      if (!token) return;
      const match = token.match(/^<p>([\s\S]*?)<\/p>$/i);
      if (match) {
        consider(match[1], token);
        return;
      }
      if (/^<br\s*\/?>$/i.test(token)) {
        if (pending) return;
        if (!bullets.length) out.push(token);
        return;
      }
      const lines = token.split('\n');
      if (lines.length > 1) {
        lines.forEach((line) => consider(line, line));
        return;
      }
      consider(token, token);
    });
    flush();
    return out.join('');
  }).join('');
}

export function sanitizeStageMessageHtml(rawHtml, fallbackText = '') {
  const html = String(rawHtml || '');
  if (!html.trim()) return plainToHtml(fallbackText);
  if (typeof DOMParser === 'undefined') return plainToHtml(fallbackText || htmlToText(html));
  const looksDocument = /<(?:html|body|meta)\b/i.test(html);
  const doc = new DOMParser().parseFromString(looksDocument ? html : `<div>${html}</div>`, 'text/html');
  const out = [];
  Array.from(doc.body.childNodes).forEach((child) => serialize(child, out));
  let next = out.join('')
    .replace(/(<br>)+/g, '<br>')
    .replace(/^(<br>)+|(<br>)+$/g, '');
  next = unwrapLiParagraphs(promoteLooseLists(next))
    .replace(/<\/ul><ul>/gi, '')
    .replace(/<\/ol><ol>/gi, '')
    .replace(/<(ul|ol)>\s*<\/\1>/gi, '');
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
  return /<(ul|ol|li)\b/i.test(String(html || ''));
}

export function messageHasRichMarkup(html) {
  const s = String(html || '');
  if (/<(ul|ol|li|strong|em|b|i|br)\b/i.test(s)) return true;
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
