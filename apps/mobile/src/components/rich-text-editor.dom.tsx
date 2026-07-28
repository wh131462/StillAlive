'use dom';

import { useEffect, useMemo, useRef } from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import type { DOMProps } from 'expo/dom';
import type { EditorAudio, EditorCommand, EditorImage, EditorMediaSource } from './rich-text-editor.types';
import { createAudioEmbed, formatAudioDuration } from '../domain/embedded-media';

interface RichTextEditorProps {
  initialMarkdown: string;
  placeholder: string;
  command: EditorCommand | null;
  audioSaving: boolean;
  media: EditorMediaSource[];
  recordingDurationMs: number | null;
  onChange(markdown: string): void;
  onFormatsChange(formats: string[]): void;
  onMention(): void;
  onReplaceImage(mediaId: string): void;
  onStopRecording(): void;
  dom?: DOMProps;
}

const MEDIA_ORIGIN = 'https://still-alive.local/media/';
const AUDIO_ORIGIN = 'https://still-alive.local/audio/';

export default function RichTextEditor({
  initialMarkdown,
  placeholder,
  command,
  audioSaving,
  media,
  recordingDurationMs,
  onChange,
  onFormatsChange,
  onMention,
  onReplaceImage,
  onStopRecording,
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
    const frame = editorRef.current?.querySelector<HTMLElement>('.audio-recording-frame');
    if (!frame) return;
    frame.classList.toggle('is-saving', audioSaving);
    const title = frame.querySelector<HTMLElement>('.audio-recording-title');
    const meta = frame.querySelector<HTMLElement>('.audio-recording-meta');
    if (title) title.textContent = audioSaving ? '正在保存语音' : '正在录音';
    if (meta) meta.textContent = audioSaving ? '完成后会插入当前位置' : `${formatAudioDuration(recordingDurationMs)} · 轻声说下此刻`;
  }, [audioSaving, recordingDurationMs]);

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

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    const audioFrame = target?.closest<HTMLElement>('.audio-frame');
    if (audioFrame && target?.closest('.audio-remove')) {
      event.preventDefault();
      audioFrame.remove();
      ensureTrailingParagraph(event.currentTarget);
      emitMarkdown(event.currentTarget, onChange);
      return;
    }
    if (audioFrame && target?.closest('.audio-play')) {
      event.preventDefault();
      const audio = audioFrame.querySelector('audio');
      if (!audio) return;
      if (audio.paused) void audio.play().catch(() => audioFrame.classList.add('is-audio-error'));
      else audio.pause();
      return;
    }
    if (target?.closest('.audio-recording-stop')) {
      event.preventDefault();
      onStopRecording();
      return;
    }
    const mediaId = target?.closest<HTMLElement>('.media-frame')?.dataset.mediaId;
    if (mediaId) onReplaceImage(mediaId);
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

    const taskItem = anchor.closest('li.task-list-item') as HTMLLIElement | null;
    if (taskItem) {
      event.preventDefault();
      if (!taskItem.textContent?.trim()) {
        exitBlock(taskItem.closest('ul') ?? taskItem, taskItem);
      } else {
        insertTaskListItem(taskItem, selection);
      }
      decorateEditor(editor, mediaRef.current);
      saveSelection(editor, savedRangeRef);
      emitMarkdown(editor, onChange);
      return;
    }

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
          onClick={handleClick}
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

const WAVE_HEIGHTS = [10, 16, 24, 15, 30, 19, 12, 27, 17, 32, 21, 14, 25, 18, 11, 22, 29, 16];

function markdownToHtml(markdown: string): string {
  const audioSafeMarkdown = markdown.replace(
    /!\[语音\]\(audio:\/\/([^)?]+)(?:\?duration=(\d+))?\)/g,
    (_match, id: string, duration: string | undefined) => `![语音](${AUDIO_ORIGIN}${encodeURIComponent(id)}?duration=${Number(duration ?? 0)})`,
  );
  const mediaSafeMarkdown = audioSafeMarkdown.replace(
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
  service.addRule('localAudio', {
    filter: (node) => node.nodeName === 'FIGURE' && Boolean(node.getAttribute('data-audio-id')),
    replacement: (_content, node) => createAudioEmbed(node.getAttribute('data-audio-id') ?? '', Number(node.getAttribute('data-duration-ms') ?? 0)),
  });
  service.addRule('pendingAudio', {
    filter: (node) => node.nodeName === 'FIGURE' && node.classList.contains('audio-recording-frame'),
    replacement: () => '',
  });
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
    if (image.src.startsWith(AUDIO_ORIGIN)) {
      const url = new URL(image.src);
      const id = decodeURIComponent(url.pathname.slice(url.pathname.lastIndexOf('/') + 1));
      const frame = createAudioFrame({ durationMs: Number(url.searchParams.get('duration') ?? 0), id, uri: mediaById.get(id) ?? '' });
      const paragraph = image.parentElement?.tagName === 'P' && image.parentElement.childNodes.length === 1 ? image.parentElement : null;
      if (paragraph) paragraph.replaceWith(frame);
      else image.replaceWith(frame);
      return;
    }
    const encodedId = image.src.startsWith(MEDIA_ORIGIN) ? image.src.slice(MEDIA_ORIGIN.length) : null;
    const id = image.dataset.mediaId ?? (encodedId ? decodeURIComponent(encodedId) : null);
    if (!id) return;
    image.dataset.mediaId = id;
    let frame = image.closest<HTMLElement>('.media-frame');
    if (!frame) {
      if (image.parentElement?.tagName === 'FIGURE') {
        frame = image.parentElement;
      } else {
        frame = document.createElement('span');
        image.before(frame);
        frame.append(image);
      }
      frame.classList.add('media-frame');
    }
    frame.dataset.mediaId = id;
    image.onload = () => frame?.classList.remove('is-media-error');
    image.onerror = () => frame?.classList.add('is-media-error');
    const uri = mediaById.get(id);
    if (uri && image.getAttribute('src') !== uri) image.setAttribute('src', uri);
    else if (!uri) frame?.classList.add('is-media-error');
  });
  editor.querySelectorAll<HTMLElement>('.audio-frame').forEach((frame) => decorateAudioFrame(frame, mediaById));
  ensureTrailingParagraph(editor);
}

function createAudioFrame(audio: EditorAudio): HTMLElement {
  const frame = document.createElement('figure');
  frame.className = 'audio-frame';
  frame.contentEditable = 'false';
  frame.dataset.audioId = audio.id;
  frame.dataset.durationMs = String(Math.max(0, Math.round(audio.durationMs)));
  frame.innerHTML = `
    <button aria-label="播放语音" class="audio-play" type="button"><span aria-hidden="true" class="audio-play-icon"></span></button>
    <span class="audio-content">
      <span aria-hidden="true" class="audio-wave">${WAVE_HEIGHTS.map((height) => `<i style="height:${height}px"></i>`).join('')}</span>
      <span class="audio-meta"><small>语音记录</small><small class="audio-duration">${formatAudioDuration(audio.durationMs)}</small></span>
    </span>
    <button aria-label="删除语音" class="audio-remove" type="button">
      <svg aria-hidden="true" class="audio-trash" viewBox="0 0 20 20" fill="none">
        <path d="M5.5 6.5v8.1c0 .77.62 1.4 1.4 1.4h6.2c.78 0 1.4-.63 1.4-1.4V6.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.45" />
        <path d="M4 5.5h12M8 5.5V4.2c0-.39.31-.7.7-.7h2.6c.39 0 .7.31.7.7v1.3M8.2 8.5v4.8M11.8 8.5v4.8" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.45" />
      </svg>
    </button>
    <audio preload="metadata"></audio>
  `;
  if (audio.uri) frame.querySelector('audio')?.setAttribute('src', audio.uri);
  return frame;
}

function decorateAudioFrame(frame: HTMLElement, mediaById: Map<string, string>) {
  const id = frame.dataset.audioId ?? '';
  if (!frame.querySelector('audio')) {
    const replacement = createAudioFrame({ durationMs: Number(frame.dataset.durationMs ?? 0), id, uri: mediaById.get(id) ?? '' });
    frame.replaceChildren(...replacement.childNodes);
  }
  const audio = frame.querySelector('audio');
  if (!audio) return;
  const uri = mediaById.get(id);
  if (uri && audio.getAttribute('src') !== uri) audio.setAttribute('src', uri);
  frame.classList.toggle('is-audio-error', !uri);
  const update = () => updateAudioFrame(frame, audio);
  audio.onended = update;
  audio.onerror = () => frame.classList.add('is-audio-error');
  audio.onloadedmetadata = () => {
    if (Number.isFinite(audio.duration)) frame.dataset.durationMs = String(Math.round(audio.duration * 1000));
    update();
  };
  audio.onpause = update;
  audio.onplay = update;
  audio.ontimeupdate = update;
  update();
}

function updateAudioFrame(frame: HTMLElement, audio: HTMLAudioElement) {
  const fallbackDuration = Number(frame.dataset.durationMs ?? 0) / 1000;
  const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : fallbackDuration;
  const progress = duration > 0 ? Math.min(1, audio.currentTime / duration) : 0;
  frame.classList.toggle('is-playing', !audio.paused);
  const button = frame.querySelector<HTMLElement>('.audio-play');
  const label = frame.querySelector<HTMLElement>('.audio-meta small');
  const durationLabel = frame.querySelector<HTMLElement>('.audio-duration');
  if (button) {
    button.classList.toggle('is-playing', !audio.paused);
    button.setAttribute('aria-label', audio.paused ? '播放语音' : '暂停语音');
  }
  if (label) label.textContent = audio.paused ? '语音记录' : '正在播放';
  if (durationLabel) durationLabel.textContent = formatAudioDuration(duration * 1000);
  frame.querySelectorAll<HTMLElement>('.audio-wave i').forEach((bar, index) => bar.classList.toggle('played', index / WAVE_HEIGHTS.length <= progress));
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
    case 'codeBlock': {
      const selection = window.getSelection();
      const anchor = selection?.anchorNode instanceof Element ? selection.anchorNode : selection?.anchorNode?.parentElement;
      if (!anchor?.closest('pre')) document.execCommand('formatBlock', false, 'pre');
      break;
    }
    case 'link':
      if (typeof command.value === 'string') insertLink(command.value);
      break;
    case 'horizontalRule': document.execCommand('insertHorizontalRule'); break;
    case 'table': insertTable(); break;
    case 'images':
      if (Array.isArray(command.value)) insertImages(command.value);
      break;
    case 'audio':
      if (command.value && !Array.isArray(command.value) && typeof command.value === 'object' && 'id' in command.value) insertAudio(editor, command.value);
      break;
    case 'recordingStart': insertRecordingFrame(); break;
    case 'recordingCancel': editor.querySelector('.audio-recording-frame')?.remove(); break;
    case 'mention':
      if (typeof command.value === 'string') insertMention(command.value);
      break;
  }
}

function wrapSelection(tagName: 'code') {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  const anchor = range.commonAncestorContainer instanceof Element
    ? range.commonAncestorContainer
    : range.commonAncestorContainer.parentElement;
  if (anchor?.closest(tagName)) return;
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

function insertTaskListItem(taskItem: HTMLLIElement, selection: Selection) {
  const range = selection.getRangeAt(0).cloneRange();
  const trailingContent = range.cloneRange();
  trailingContent.selectNodeContents(taskItem);
  trailingContent.setStart(range.endContainer, range.endOffset);
  const tail = trailingContent.extractContents();

  const nextItem = document.createElement('li');
  nextItem.className = 'task-list-item';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.contentEditable = 'false';
  nextItem.append(checkbox, document.createTextNode(' '), tail);
  taskItem.parentElement?.insertBefore(nextItem, taskItem.nextSibling);

  const cursorText = nextItem.childNodes[1];
  const cursor = document.createRange();
  cursor.setStart(cursorText, cursorText.textContent?.length ?? 0);
  cursor.collapse(true);
  selection.removeAllRanges();
  selection.addRange(cursor);
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

function insertAudio(editor: HTMLDivElement, audio: EditorAudio) {
  const frame = createAudioFrame(audio);
  const recordingFrame = editor.querySelector('.audio-recording-frame');
  if (recordingFrame) {
    recordingFrame.replaceWith(frame);
  } else {
    insertBlockAtSelection(frame);
  }
  placeCursorAfterBlock(editor, frame);
}

function insertRecordingFrame() {
  const frame = document.createElement('figure');
  frame.className = 'audio-recording-frame';
  frame.contentEditable = 'false';
  frame.innerHTML = `
    <span aria-hidden="true" class="recording-dot"></span>
    <span class="audio-recording-copy"><strong class="audio-recording-title">正在录音</strong><small class="audio-recording-meta">0:00 &middot; 轻声说下此刻</small></span>
    <button aria-label="停止录音" class="audio-recording-stop" type="button"><span></span></button>
  `;
  insertBlockAtSelection(frame);
}

function insertBlockAtSelection(element: HTMLElement) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  const paragraph = document.createElement('p');
  paragraph.append(document.createElement('br'));
  const fragment = document.createDocumentFragment();
  fragment.append(element, paragraph);
  range.deleteContents();
  range.insertNode(fragment);
  placeCursorAtEnd(paragraph);
}

function placeCursorAfterBlock(editor: HTMLDivElement, block: HTMLElement) {
  let paragraph = block.nextElementSibling as HTMLElement | null;
  if (paragraph?.tagName !== 'P') {
    paragraph = document.createElement('p');
    paragraph.append(document.createElement('br'));
    block.after(paragraph);
  }
  ensureTrailingParagraph(editor);
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
  return !editor.textContent?.trim() && !editor.querySelector('img, table, hr, input, .audio-frame');
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
  .editor-shell { width: 100%; min-height: 100%; padding: 10px 22px 44px; }
  .editor { position: relative; width: 100%; min-height: calc(100vh - 54px); outline: none; font-size: 19px; line-height: 1.85; caret-color: #1d6b49; }
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
  .media-frame { display: block; position: relative; overflow: hidden; margin: 1.2em 0; border-radius: 4px 22px 4px 22px; cursor: pointer; }
  .media-frame::after { position: absolute; top: 10px; right: 10px; content: "轻触替换"; padding: 5px 8px; border-radius: 11px; background: rgba(32, 35, 31, 0.58); color: #f4f6ef; font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, sans-serif; font-size: 10px; line-height: 1.2; pointer-events: none; }
  .media-frame.is-media-error { min-height: 220px; border: 1px solid rgba(32, 35, 31, 0.13); background: #eef0e8; }
  .media-frame.is-media-error::before { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; content: "图片暂时无法显示 轻触替换"; color: #656b62; font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, sans-serif; font-size: 13px; pointer-events: none; }
  .media-frame.is-media-error::after { display: none; }
  .media-frame.is-media-error img { visibility: hidden; }
  img { display: block; width: 100%; max-height: 520px; border-radius: 4px 22px 4px 22px; background: #d8e8dc; object-fit: cover; }
  .mention { padding: 0.08em 0.22em; border-radius: 5px; background: #d8e8dc; color: #1d6b49; }
  .audio-frame, .audio-recording-frame { min-height: 72px; display: flex; align-items: center; margin: 1.25em 0; padding: 14px; border-radius: 4px 22px 4px 22px; font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, sans-serif; }
  .audio-frame { background: #d8e8dc; }
  .audio-recording-frame { background: #f8e7de; }
  .audio-recording-frame.is-saving { background: #eef0e8; }
  .audio-recording-copy { min-width: 0; display: flex; flex: 1; flex-direction: column; margin-left: 13px; }
  .audio-recording-copy strong { color: #8f3d31; font-family: ui-serif, Georgia, "Noto Serif SC", serif; font-size: 15px; }
  .audio-recording-copy small { margin-top: 4px; color: #a66558; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 9px; }
  .recording-dot { width: 12px; height: 12px; border-radius: 50%; background: #b84d3b; box-shadow: 0 0 0 0 rgba(184, 77, 59, 0.3); animation: recording-pulse 1.5s ease-out infinite; }
  .audio-recording-stop, .audio-play { flex: 0 0 auto; display: grid; place-items: center; width: 42px; height: 42px; padding: 0; border: 0; border-radius: 50%; cursor: pointer; transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease; }
  .audio-recording-stop { background: #b84d3b; }
  .audio-recording-stop span { width: 14px; height: 14px; border-radius: 2px; background: #fff8f2; }
  .audio-play { background: #1d6b49; color: #f4f6ef; box-shadow: 0 5px 12px rgba(29, 107, 73, 0.18); }
  .audio-play:hover { background: #185c3e; box-shadow: 0 7px 16px rgba(29, 107, 73, 0.24); transform: translateY(-1px); }
  .audio-play:active { transform: translateY(0) scale(0.96); }
  .audio-play-icon { display: block; width: 0; height: 0; margin-left: 2px; border-top: 7px solid transparent; border-bottom: 7px solid transparent; border-left: 10px solid currentColor; }
  .audio-play.is-playing .audio-play-icon { position: relative; width: 12px; height: 14px; margin-left: 0; border: 0; }
  .audio-play.is-playing .audio-play-icon::before, .audio-play.is-playing .audio-play-icon::after { position: absolute; top: 0; width: 4px; height: 14px; border-radius: 2px; background: currentColor; content: ""; }
  .audio-play.is-playing .audio-play-icon::before { left: 0; }
  .audio-play.is-playing .audio-play-icon::after { right: 0; }
  .audio-content { min-width: 0; display: flex; flex: 1; flex-direction: column; margin-left: 13px; }
  .audio-wave { height: 32px; display: flex; align-items: center; gap: 3px; overflow: hidden; }
  .audio-wave i { flex: 0 0 3px; border-radius: 2px; background: rgba(29, 107, 73, 0.22); }
  .audio-wave i.played { background: #1d6b49; }
  .audio-meta { display: flex; justify-content: space-between; margin-top: 3px; color: #656b62; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 9px; letter-spacing: 0.04em; }
  .audio-meta small { font: inherit; }
  .audio-frame audio { display: none; }
  .audio-remove { display: grid; place-items: center; width: 34px; height: 34px; flex: 0 0 auto; margin-left: 8px; padding: 0; border: 1px solid rgba(155, 73, 63, 0.18); border-radius: 50%; background: rgba(255, 248, 242, 0.46); color: #9b493f; cursor: pointer; transition: transform 160ms ease, border-color 160ms ease, background 160ms ease; }
  .audio-remove:hover { border-color: rgba(155, 73, 63, 0.34); background: rgba(155, 73, 63, 0.1); transform: translateY(-1px); }
  .audio-remove:active { background: rgba(155, 73, 63, 0.16); transform: scale(0.94); }
  .audio-trash { display: block; width: 18px; height: 18px; }
  .audio-frame.is-audio-error .audio-content { opacity: 0.45; }
  .audio-frame.is-audio-error .audio-play { pointer-events: none; opacity: 0.45; }
  @keyframes recording-pulse { 70% { box-shadow: 0 0 0 9px rgba(184, 77, 59, 0); } 100% { box-shadow: 0 0 0 0 rgba(184, 77, 59, 0); } }
`;
