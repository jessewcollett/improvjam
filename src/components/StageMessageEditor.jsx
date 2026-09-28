import { useEffect, useRef, useState } from 'react';
import { Bold, IndentDecrease, IndentIncrease, Italic, List, ListOrdered, Underline } from 'lucide-react';
import {
  MESSAGE_MAX,
  editorHtmlFromMessage,
  htmlToText,
  messageFromClipboard,
  normalizeStageMessage,
  sanitizeStageMessageHtml,
  stageMessageHtml,
  stageMessageText,
} from '../lib/stageMessage.js';

const TOOLS = [
  { cmd: 'bold', label: 'Bold', Icon: Bold },
  { cmd: 'italic', label: 'Italic', Icon: Italic },
  { cmd: 'underline', label: 'Underline', Icon: Underline },
  { cmd: 'insertUnorderedList', label: 'Bullets', Icon: List },
  { cmd: 'insertOrderedList', label: 'Numbers', Icon: ListOrdered },
  { cmd: 'indent', label: 'Indent', Icon: IndentIncrease },
  { cmd: 'outdent', label: 'Outdent', Icon: IndentDecrease },
];

function emptyMarks() {
  return {
    bold: false,
    italic: false,
    underline: false,
    insertUnorderedList: false,
    insertOrderedList: false,
  };
}

export default function StageMessageEditor({ value, onChange }) {
  const editorRef = useRef(null);
  const focusedRef = useRef(false);
  const [marks, setMarks] = useState(emptyMarks);
  const html = stageMessageHtml(value);
  const text = html ? (htmlToText(html) || stageMessageText(value)) : stageMessageText(value);
  const display = editorHtmlFromMessage(value);

  const readMarks = () => {
    if (typeof document === 'undefined' || !editorRef.current) return;
    try {
      setMarks({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        insertUnorderedList: document.queryCommandState('insertUnorderedList'),
        insertOrderedList: document.queryCommandState('insertOrderedList'),
      });
    } catch {
      setMarks(emptyMarks());
    }
  };

  const commit = (rawHtml) => {
    const node = editorRef.current;
    const source = rawHtml == null ? (node?.innerHTML || '') : rawHtml;
    const next = normalizeStageMessage({
      html: sanitizeStageMessageHtml(source, htmlToText(source)),
      text: htmlToText(source),
    });
    onChange(next);
    return next;
  };

  useEffect(() => {
    const node = editorRef.current;
    if (!node) return;
    if (focusedRef.current) return;
    if (node.innerHTML !== display) node.innerHTML = display;
  }, [display]);

  useEffect(() => {
    const onSel = () => {
      if (focusedRef.current) readMarks();
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, []);

  const run = (cmd) => {
    const node = editorRef.current;
    if (!node) return;
    node.focus();
    try {
      document.execCommand(cmd, false);
    } catch {
      /* ignore */
    }
    commit();
    readMarks();
  };

  return (
    <div className="rounded-xl border border-gray-800 bg-[#1A1A1A] mb-1 overflow-hidden">
      <div className="flex flex-wrap gap-0.5 p-1 border-b border-gray-800">
        {TOOLS.map(({ cmd, label, Icon }) => (
          <button
            key={cmd}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={Boolean(marks[cmd])}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => run(cmd)}
            className={`min-w-11 min-h-11 rounded-lg inline-flex items-center justify-center ${
              marks[cmd] ? 'bg-lime-700 text-white' : 'text-gray-300 hover:bg-white/10'
            }`}
          >
            <Icon className="w-4 h-4" />
          </button>
        ))}
      </div>
      <div
        ref={editorRef}
        role="textbox"
        aria-multiline="true"
        aria-label="Board message"
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Welcome, class norms, questions… Paste bullets from Docs."
        data-empty={text ? 'false' : 'true'}
        className="stage-message stage-message-editor px-3 py-2.5 text-sm text-gray-100"
        onFocus={() => {
          focusedRef.current = true;
          readMarks();
        }}
        onBlur={() => {
          focusedRef.current = false;
          const next = commit();
          const node = editorRef.current;
          const clean = editorHtmlFromMessage(next);
          if (node && node.innerHTML !== clean) node.innerHTML = clean;
        }}
        onInput={() => {
          const node = editorRef.current;
          if (!node) return;
          if (htmlToText(node.innerHTML).length > MESSAGE_MAX) {
            node.innerHTML = display;
            return;
          }
          commit();
        }}
        onPaste={(event) => {
          const pastedHtml = event.clipboardData?.getData('text/html') || '';
          const plain = event.clipboardData?.getData('text/plain') || '';
          if (!pastedHtml && !plain) return;
          event.preventDefault();
          const next = messageFromClipboard(pastedHtml, plain);
          const insert = editorHtmlFromMessage(next);
          if (!insert) return;
          try {
            document.execCommand('insertHTML', false, insert);
          } catch {
            const node = editorRef.current;
            if (node) node.innerHTML = insert;
          }
          commit();
        }}
      />
    </div>
  );
}
