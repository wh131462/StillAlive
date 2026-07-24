'use dom';

import { useEffect, useMemo, useRef } from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import type { DOMProps } from 'expo/dom';
import type { EditorCommand, EditorImage, EditorMediaSource } from './rich-text-editor.types';

interface RichTextEditorProps {
  initialMarkdown: string;
  placeholder: string;
  command: EditorCommand | null;
  media: EditorMediaSource[];
  onChange(markdown: string): void;
  onFormatsChange(formats: string[]): void;
  onMention(): void;
  dom?: DOMProps;
}

const MEDIA_ORIGIN = 'https://still-alive.local/media/';

export default function RichTextEditor({
  initialMarkdown,
  placeholder,
  command,
  media,
  onChange,
  onFormatsChange,
  onMention,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const pendingEmptyBlockRef = useRef<HTMLElement | null>(null);
  const lastCommandRef = useRef(0);
  const mediaRef = useRef(media);
  mediaRef.current = media;

  const initialHtml = useMemo(() => markdownToHtml(initialMarkdown), [initialMarkdown]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.innerHTML = initialHtml;
    decorateEditor(editor, mediaRef.current);
    editor.focus();
    if (initialHtml) placeCursorAtEnd(editor);
    else placeCursorAtStart(editor);
  }, [initialHtml]);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor) decorateEditor(editor, media);
  }, [media]);

  useEffect(() => {
    if (!command || command.id === lastCommandRef.current) return;
    lastCommandRef.current = command.id;
    const editor = editorRef.current;
    if (!editor) return;
    restoreSelection(editor, savedRangeRef.current);
    runCommand(editor, command);
    decorateEditor(editor, mediaRef.current);
    saveSelection(editor, savedRangeRef);
    emitMarkdown(editor, onChange);
    emitFormats(editor, onFormatsChange);
  }, [command, onChange, onFormatsChange]);

  useEffect(() => {
    const handleSelectionChange = () => {
      const editor = editorRef.current;
      if (!editor) return;
      const anchor = window.getSelection()?.anchorNode;
      if (pendingEmptyBlockRef.current && (!anchor || !pendingEmptyBlockRef.current.contains(anchor))) pendingEmptyBlockRef.current = null;
      saveSelection(editor, savedRangeRef);
      emitFormats(editor, onFormatsChange);
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [onFormatsChange]);

  const handleInput = (event: React.FormEvent<HTMLDivElement>) => {
    const editor = editorRef.current;
    if (!editor) return;
    const nativeEvent = event.nativeEvent as InputEvent;
    if (nativeEvent.inputType !== 'insertParagraph' && nativeEvent.inputType !== 'insertLineBreak') pendingEmptyBlockRef.current = null;
    if (isEditorVisuallyEmpty(editor)) {
      editor.innerHTML = '';
      placeCursorAtStart(editor);
    }
    decorateEditor(editor, mediaRef.current);
    saveSelection(editor, savedRangeRef);
    emitMarkdown(editor, onChange);
    if (nativeEvent.inputType === 'insertText' && nativeEvent.data === '@') onMention();
  };

  const handleCheckboxChange = () => {
    const editor = editorRef.current;
    if (editor) emitMarkdown(editor, onChange);
    pendingEmptyBlockRef.current = null;
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const html = event.clipboardData.getData('text/html');
    const text = event.clipboardData.getData('text/plain');
    if (html) document.execCommand('insertHTML', false, DOMPurify.sanitize(html, { USE_PROFILES: { html: true } }));
    else document.execCommand('insertText', false, text);
    const editor = editorRef.current;
    if (!editor) return;
    pendingEmptyBlockRef.current = null;
    decorateEditor(editor, mediaRef.current);
    saveSelection(editor, savedRangeRef);
    emitMarkdown(editor, onChange);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount || !selection.isCollapsed) return;
    const anchor = selection.anchorNode instanceof Element ? selection.anchorNode : selection.anchorNode?.parentElement;
    if (!anchor || !editor.contains(anchor)) return;

    const tableCell = anchor.closest('td, th') as HTMLTableCellElement | null;
    const table = tableCell?.closest('table') as HTMLTableElement | null;
    const lastRow = table?.rows[table.rows.length - 1];
    const lastCell = lastRow?.cells[lastRow.cells.length - 1];
    if (table && tableCell === lastCell && !tableCell.textContent?.trim()) {
      if (pendingEmptyBlockRef.current === tableCell) {
        event.preventDefault();
        pendingEmptyBlockRef.current = null;
        tableCell.innerHTML = '';
        exitBlock(table, null, true);
        emitMarkdown(editor, onChange);
      } else {
        pendingEmptyBlockRef.current = tableCell;
      }
      return;
    }

    const quote = anchor.closest('blockquote');
    const quoteLine = anchor.closest('p, div') as HTMLElement | null;
    const quoteLineIsEmpty = quote && quoteLine && quoteLine !== editor
      ? !quoteLine.textContent?.trim()
      : Boolean(quote && (!quote.textContent?.trim() || textBeforeCaret(quote, selection).endsWith('\n')));
    if (quote && quoteLineIsEmpty) {
      event.preventDefault();
      exitBlock(quote, quoteLine && quoteLine !== editor ? quoteLine : null);
      emitMarkdown(editor, onChange);
      return;
    }

    const listItem = anchor.closest('li');
    const list = listItem?.closest('ul, ol') as HTMLElement | null;
    if (listItem && list && listItem === list.lastElementChild && !listItem.textContent?.trim()) {
      event.preventDefault();
      exitBlock(list, listItem);
      emitMarkdown(editor, onChange);
      return;
    }

    const pre = anchor.closest('pre');
    if (pre && textBeforeCaret(pre, selection).endsWith('\n')) {
      event.preventDefault();
      pre.textContent = pre.textContent?.replace(/\n+$/, '') ?? '';
      exitBlock(pre);
      emitMarkdown(editor, onChange);
    }
  };

  return (
    <>
      <style>{EDITOR_CSS}</style>
      <main className="editor-shell">
        <div
          ref={editorRef}
          aria-label="正文编辑器"
          className="editor"
          contentEditable
          data-placeholder={placeholder}
          onChange={handleCheckboxChange}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          role="textbox"
          suppressContentEditableWarning
        />
      </main>
    </>
  );
}

function markdownToHtml(markdown: string): string {
  const mediaSafeMarkdown = markdown.replace(
    /!\[([^\]]*)\]\(media:\/\/([^)]+)\)/g,
    (_match, alt: string, id: string) => `![${alt}](${MEDIA_ORIGIN}${encodeURIComponent(id)})`,
  );
  const html = marked.parse(mediaSafeMarkdown, { async: false, breaks: true, gfm: true }) as string;
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

function createTurndownService(): TurndownService {
  const service = new TurndownService({
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    headingStyle: 'atx',
    strongDelimiter: '**',
  });
  service.use(gfm);
  service.addRule('localMedia', {
    filter: (node) => node.nodeName === 'IMG' && Boolean(node.getAttribute('data-media-id')),
    replacement: (_content, node) => {
      const id = node.getAttribute('data-media-id') ?? '';
      const alt = (node.getAttribute('alt') ?? '照片').replaceAll('[', '\\[').replaceAll(']', '\\]');
      return `\n\n![${alt}](media://${id})\n\n`;
    },
  });
  return service;
}

const turndownService = createTurndownService();

function emitMarkdown(editor: HTMLDivElement, onChange: (markdown: string) => void) {
  const markdown = turndownService.turndown(editor).replace(/\n{3,}/g, '\n\n').trim();
  onChange(markdown);
}

function decorateEditor(editor: HTMLDivElement, media: EditorMediaSource[]) {
  const mediaById = new Map(media.map((item) => [item.id, item.uri]));
  editor.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.disabled = false;
    checkbox.contentEditable = 'false';
    checkbox.parentElement?.classList.add('task-list-item');
    checkbox.closest('ul')?.classList.add('task-list');
  });
  editor.querySelectorAll<HTMLImageElement>('img').forEach((image) => {
    const encodedId = image.src.startsWith(MEDIA_ORIGIN) ? image.src.slice(MEDIA_ORIGIN.length) : null;
    const id = image.dataset.mediaId ?? (encodedId ? decodeURIComponent(encodedId) : null);
    if (!id) return;
    image.dataset.mediaId = id;
    const uri = mediaById.get(id);
    if (uri && image.getAttribute('src') !== uri) image.setAttribute('src', uri);
  });
  ensureTrailingParagraph(editor);
}

function ensureTrailingParagraph(editor: HTMLDivElement) {
  const last = editor.lastElementChild;
  const isImageOnlyParagraph = last?.tagName === 'P' && Boolean(last.querySelector('img')) && !last.textContent?.trim();
  if (!last || (!last.matches('table, blockquote, ul, ol, pre, figure, hr') && !isImageOnlyParagraph)) return;
  const paragraph = document.createElement('p');
  paragraph.append(document.createElement('br'));
  editor.append(paragraph);
}

function runCommand(editor: HTMLDivElement, command: EditorCommand) {
  editor.focus();
  switch (command.type) {
    case 'undo': document.execCommand('undo'); break;
    case 'redo': document.execCommand('redo'); break;
    case 'paragraph': document.execCommand('formatBlock', false, 'p'); break;
    case 'heading1': document.execCommand('formatBlock', false, 'h1'); break;
    case 'heading2': document.execCommand('formatBlock', false, 'h2'); break;
    case 'heading3': document.execCommand('formatBlock', false, 'h3'); break;
    case 'heading4': document.execCommand('formatBlock', false, 'h4'); break;
    case 'heading5': document.execCommand('formatBlock', false, 'h5'); break;
    case 'heading6': document.execCommand('formatBlock', false, 'h6'); break;
    case 'bold': document.execCommand('bold'); break;
    case 'italic': document.execCommand('italic'); break;
    case 'strikethrough': document.execCommand('strikeThrough'); break;
    case 'inlineCode': wrapSelection('code'); break;
    case 'quote': document.execCommand('formatBlock', false, 'blockquote'); break;
    case 'bulletList': document.execCommand('insertUnorderedList'); break;
    case 'orderedList': document.execCommand('insertOrderedList'); break;
    case 'taskList': insertHtml('<ul class="task-list"><li class="task-list-item"><input type="checkbox"> 待办事项</li></ul><p><br></p>'); break;
    case 'codeBlock': document.execCommand('formatBlock', false, 'pre'); break;
    case 'link':
      if (typeof command.value === 'string') insertLink(command.value);
      break;
    case 'horizontalRule': document.execCommand('insertHorizontalRule'); break;
    case 'table': insertTable(); break;
    case 'images':
      if (Array.isArray(command.value)) insertImages(command.value);
      break;
    case 'mention':
      if (typeof command.value === 'string') insertMention(command.value);
      break;
  }
}

function wrapSelection(tagName: 'code') {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  const element = document.createElement(tagName);
  if (range.collapsed) element.textContent = '代码';
  else element.append(range.extractContents());
  range.insertNode(element);
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);
}

function insertHtml(html: string) {
  document.execCommand('insertHTML', false, html);
}

function insertLink(url: string) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (!range.collapsed) {
    document.execCommand('createLink', false, url);
    return;
  }
  const link = document.createElement('a');
  link.href = url;
  link.textContent = '链接文字';
  range.insertNode(link);
  range.setStartAfter(link);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function insertTable() {
  insertHtml('<table><thead><tr><th>标题</th><th>标题</th><th>标题</th></tr></thead><tbody><tr><td>内容</td><td>内容</td><td>内容</td></tr><tr><td>内容</td><td>内容</td><td>内容</td></tr></tbody></table><p><br></p>');
}

function insertImages(images: EditorImage[]) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  const fragment = document.createDocumentFragment();
  images.forEach((item) => {
    const figure = document.createElement('figure');
    const image = document.createElement('img');
    image.src = item.uri;
    image.alt = item.alt;
    image.dataset.mediaId = item.id;
    figure.append(image);
    fragment.append(figure);
  });
  const paragraph = document.createElement('p');
  paragraph.append(document.createElement('br'));
  fragment.append(paragraph);
  range.deleteContents();
  range.insertNode(fragment);
  placeCursorAtEnd(paragraph);
}

function insertMention(name: string) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (range.collapsed && range.startContainer.nodeType === Node.TEXT_NODE && range.startOffset > 0) {
    const text = range.startContainer.textContent ?? '';
    if (text[range.startOffset - 1] === '@') {
      range.startContainer.textContent = `${text.slice(0, range.startOffset - 1)}${text.slice(range.startOffset)}`;
      range.setStart(range.startContainer, range.startOffset - 1);
      range.collapse(true);
    }
  }
  const mention = document.createElement('span');
  mention.className = 'mention';
  mention.textContent = `@${name}`;
  mention.contentEditable = 'false';
  const spacer = document.createTextNode(' ');
  range.insertNode(spacer);
  range.insertNode(mention);
  range.setStartAfter(spacer);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function saveSelection(editor: HTMLDivElement, rangeRef: React.MutableRefObject<Range | null>) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (editor.contains(range.commonAncestorContainer)) rangeRef.current = range.cloneRange();
}

function restoreSelection(editor: HTMLDivElement, range: Range | null) {
  const selection = window.getSelection();
  if (!selection) return;
  selection.removeAllRanges();
  if (range && editor.contains(range.commonAncestorContainer)) selection.addRange(range);
  else placeCursorAtEnd(editor);
}

function placeCursorAtEnd(element: Node) {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function placeCursorAtStart(element: Node) {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function isEditorVisuallyEmpty(editor: HTMLDivElement): boolean {
  return !editor.textContent?.trim() && !editor.querySelector('img, table, hr, input');
}

function textBeforeCaret(container: HTMLElement, selection: Selection): string {
  const range = document.createRange();
  range.selectNodeContents(container);
  range.setEnd(selection.anchorNode!, selection.anchorOffset);
  return range.toString();
}

function exitBlock(container: HTMLElement, emptyLine: HTMLElement | null = null, keepContainer = false) {
  const parent = container.parentElement;
  if (!parent) return;
  const nextSibling = container.nextSibling;
  const existingParagraph = container.nextElementSibling as HTMLElement | null;
  const paragraph = existingParagraph?.tagName === 'P' && !existingParagraph.textContent?.trim()
    ? existingParagraph
    : document.createElement('p');
  if (!paragraph.hasChildNodes()) paragraph.append(document.createElement('br'));
  if (emptyLine && emptyLine !== container) emptyLine.remove();
  if (!keepContainer && !container.textContent?.trim()) container.remove();
  if (!paragraph.parentElement) parent.insertBefore(paragraph, nextSibling);
  placeCursorAtEnd(paragraph);
}

function emitFormats(editor: HTMLDivElement, onFormatsChange: (formats: string[]) => void) {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !editor.contains(selection.anchorNode)) return;
  const formats: string[] = [];
  if (document.queryCommandState('bold')) formats.push('bold');
  if (document.queryCommandState('italic')) formats.push('italic');
  if (document.queryCommandState('strikeThrough')) formats.push('strikethrough');
  if (document.queryCommandState('insertUnorderedList')) formats.push('bulletList');
  if (document.queryCommandState('insertOrderedList')) formats.push('orderedList');
  const element = selection.anchorNode instanceof Element ? selection.anchorNode : selection.anchorNode?.parentElement;
  if (element?.closest('code')) formats.push('inlineCode');
  if (element?.closest('blockquote')) formats.push('quote');
  onFormatsChange(formats);
}

const EDITOR_CSS = `
  :root { color-scheme: light; font-family: ui-serif, Georgia, "Noto Serif SC", serif; }
  * { box-sizing: border-box; }
  html, body, #root { min-height: 100%; margin: 0; background: transparent; }
  body { overflow-y: auto; color: #20231f; -webkit-font-smoothing: antialiased; }
  .editor-shell { min-height: 100%; padding: 10px 22px 44px; }
  .editor { position: relative; min-height: calc(100vh - 54px); outline: none; font-size: 19px; line-height: 1.85; caret-color: #1d6b49; }
  .editor:empty::before { position: absolute; inset: 0 auto auto 0; content: attr(data-placeholder); color: #979d93; line-height: inherit; white-space: pre-line; pointer-events: none; }
  p { margin: 0 0 0.85em; }
  h1, h2, h3, h4, h5, h6 { margin: 1.15em 0 0.55em; line-height: 1.3; letter-spacing: -0.02em; }
  h1:first-child, h2:first-child, h3:first-child { margin-top: 0; }
  h1 { font-size: 2em; } h2 { font-size: 1.62em; } h3 { font-size: 1.34em; }
  h4 { font-size: 1.16em; } h5 { font-size: 1em; } h6 { color: #656b62; font-size: 0.9em; letter-spacing: 0.04em; }
  strong { font-weight: 760; } em { font-style: italic; } del { color: #7d837a; }
  a { color: #1d6b49; text-decoration-color: #a9c9b5; text-underline-offset: 3px; }
  blockquote { margin: 1.2em 0; padding: 0.15em 0 0.15em 16px; border-left: 3px solid #d4a84f; color: #656b62; }
  blockquote p:last-child { margin-bottom: 0; }
  ul, ol { margin: 0.7em 0 1em; padding-left: 1.45em; }
  li { margin: 0.34em 0; padding-left: 0.2em; }
  .task-list { padding-left: 0.25em; list-style: none; }
  .task-list-item { list-style: none; }
  input[type="checkbox"] { width: 18px; height: 18px; margin: 0 9px 0 0; vertical-align: -3px; accent-color: #1d6b49; }
  code { padding: 0.15em 0.36em; border-radius: 5px; background: #e6ece5; color: #1d6b49; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.82em; }
  pre { overflow-x: auto; margin: 1.2em 0; padding: 15px 16px; border-radius: 14px; background: #252b27; color: #eef0e8; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.78em; line-height: 1.65; white-space: pre-wrap; }
  pre code { padding: 0; background: transparent; color: inherit; font-size: inherit; }
  hr { width: 46px; height: 2px; margin: 2em auto; border: 0; background: #d4a84f; }
  table { display: block; width: 100%; margin: 1.2em 0; overflow-x: auto; border-collapse: collapse; font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, sans-serif; font-size: 0.78em; }
  th, td { min-width: 110px; padding: 9px 10px; border: 1px solid rgba(32,35,31,0.16); text-align: left; }
  th { background: #eef0e8; font-weight: 700; }
  figure { margin: 1.2em 0; }
  img { display: block; width: 100%; max-height: 520px; border-radius: 4px 22px 4px 22px; background: #d8e8dc; object-fit: cover; }
  .mention { padding: 0.08em 0.22em; border-radius: 5px; background: #d8e8dc; color: #1d6b49; }
`;
