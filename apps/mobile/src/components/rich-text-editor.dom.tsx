'use dom';

import { useEffect, useMemo, useRef } from 'react';
import DOMPurify from 'dompurify';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import type { DOMProps } from 'expo/dom';
import type { EditorAudio, EditorCommand, EditorImage, EditorImageReplacement, EditorMediaSource, EditorTheme } from './rich-text-editor.types';
import { richTextSurfaceCss } from './rich-text-content-css';
import { decorateRichTextContent, renderRichTextMarkdown, RICH_TEXT_AUDIO_ORIGIN, RICH_TEXT_MEDIA_ORIGIN } from './rich-text-markdown';
import { createAudioEmbed, formatAudioDuration } from '../domain/embedded-media';

interface RichTextEditorProps {
  initialMarkdown: string;
  placeholder: string;
  command: EditorCommand | null;
  audioSaving: boolean;
  disabled: boolean;
  media: EditorMediaSource[];
  recordingDurationMs: number | null;
  theme: EditorTheme;
  onChange(markdown: string): void;
  onFormatsChange(formats: string[]): void;
  onMention(): void;
  onReplaceImage(mediaId: string): void;
  onStopRecording(): void;
  readLocalFile(uri: string): Promise<string>;
  dom?: DOMProps;
}

export default function RichTextEditor({
  initialMarkdown,
  placeholder,
  command,
  audioSaving,
  disabled,
  media,
  recordingDurationMs,
  theme,
  onChange,
  onFormatsChange,
  onMention,
  onReplaceImage,
  onStopRecording,
  readLocalFile,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const pendingEmptyBlockRef = useRef<HTMLElement | null>(null);
  const lastCommandRef = useRef(0);
  const mediaRef = useRef<EditorMediaSource[]>([]);
  const mediaDataUrlCacheRef = useRef(new Map<string, string>());
  const historyRef = useRef({ current: initialMarkdown, redo: [] as string[], undo: [] as string[] });

  const initialHtml = useMemo(() => renderRichTextMarkdown(initialMarkdown), [initialMarkdown]);

  const commitEditorChange = (editor: HTMLDivElement) => {
    const markdown = serializeMarkdown(editor);
    const history = historyRef.current;
    if (markdown !== history.current) {
      history.undo.push(history.current);
      if (history.undo.length > 100) history.undo.shift();
      history.current = markdown;
      history.redo = [];
    }
    onChange(markdown);
  };

  const restoreHistory = (editor: HTMLDivElement, direction: 'redo' | 'undo') => {
    const history = historyRef.current;
    const source = direction === 'undo' ? history.undo : history.redo;
    const target = source.pop();
    if (target === undefined) return;
    const destination = direction === 'undo' ? history.redo : history.undo;
    destination.push(history.current);
    history.current = target;
    editor.innerHTML = renderRichTextMarkdown(target);
    decorateEditor(editor, mediaRef.current);
    placeCursorAtEnd(editor);
    onChange(target);
  };

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.innerHTML = initialHtml;
    historyRef.current = { current: initialMarkdown, redo: [], undo: [] };
    decorateEditor(editor, mediaRef.current);
    editor.focus();
    if (initialHtml) placeCursorAtEnd(editor);
    else placeCursorAtStart(editor);
  }, [initialHtml]);

  useEffect(() => {
    let cancelled = false;
    const resolveMedia = async () => {
      const resolved = await Promise.all(media.map(async (item) => {
        if (!item.uri.startsWith('file://') || (!item.mimeType?.startsWith('image/') && !item.mimeType?.startsWith('audio/'))) return item;
        const cached = mediaDataUrlCacheRef.current.get(item.uri);
        if (cached) return { ...item, uri: cached };
        try {
          const uri = `data:${item.mimeType};base64,${await readLocalFile(item.uri)}`;
          mediaDataUrlCacheRef.current.set(item.uri, uri);
          return { ...item, uri };
        } catch {
          return item;
        }
      }));
      if (cancelled) return;
      mediaRef.current = resolved;
      const editor = editorRef.current;
      if (editor) decorateEditor(editor, resolved);
    };
    void resolveMedia();
    return () => { cancelled = true; };
  }, [media, readLocalFile]);

  useEffect(() => {
    if (!command || command.id === lastCommandRef.current) return;
    lastCommandRef.current = command.id;
    const editor = editorRef.current;
    if (!editor) return;
    restoreSelection(editor, savedRangeRef.current);
    if (command.type === 'undo' || command.type === 'redo') restoreHistory(editor, command.type);
    else runCommand(editor, command);
    decorateEditor(editor, mediaRef.current);
    saveSelection(editor, savedRangeRef);
    if (command.type !== 'undo' && command.type !== 'redo') commitEditorChange(editor);
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
    commitEditorChange(editor);
    if (nativeEvent.inputType === 'insertText' && nativeEvent.data === '@') onMention();
  };

  const handleCheckboxChange = () => {
    const editor = editorRef.current;
    if (editor) commitEditorChange(editor);
    pendingEmptyBlockRef.current = null;
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    const target = event.target instanceof Element ? event.target : null;
    const audioFrame = target?.closest<HTMLElement>('.audio-frame');
    if (audioFrame && target?.closest('.audio-remove')) {
      event.preventDefault();
      audioFrame.remove();
      ensureTrailingParagraph(event.currentTarget);
      commitEditorChange(event.currentTarget);
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
    const mediaFrame = target?.closest<HTMLElement>('.media-frame');
    if (mediaFrame && target?.closest('.media-remove')) {
      event.preventDefault();
      mediaFrame.remove();
      ensureTrailingParagraph(event.currentTarget);
      commitEditorChange(event.currentTarget);
      return;
    }
    const mediaId = mediaFrame?.dataset.mediaId;
    if (mediaId && target?.closest('.media-replace')) onReplaceImage(mediaId);
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
    commitEditorChange(editor);
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
      commitEditorChange(editor);
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
        commitEditorChange(editor);
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
      commitEditorChange(editor);
      return;
    }

    const listItem = anchor.closest('li');
    const list = listItem?.closest('ul, ol') as HTMLElement | null;
    if (listItem && list && listItem === list.lastElementChild && !listItem.textContent?.trim()) {
      event.preventDefault();
      exitBlock(list, listItem);
      commitEditorChange(editor);
      return;
    }

    const pre = anchor.closest('pre');
    if (pre && textBeforeCaret(pre, selection).endsWith('\n')) {
      event.preventDefault();
      pre.textContent = pre.textContent?.replace(/\n+$/, '') ?? '';
      exitBlock(pre);
      commitEditorChange(editor);
    }
  };

  return (
    <>
      <style>{editorCss(theme)}</style>
      <main className="editor-shell">
        <div
          ref={editorRef}
          aria-label="正文编辑器"
          className="editor rich-text-surface"
          aria-disabled={disabled}
          aria-multiline="true"
          contentEditable={!disabled}
          data-placeholder={placeholder}
          onChange={disabled ? undefined : handleCheckboxChange}
          onClick={handleClick}
          onInput={disabled ? undefined : handleInput}
          onKeyDown={disabled ? undefined : handleKeyDown}
          onPaste={disabled ? undefined : handlePaste}
          role="textbox"
          suppressContentEditableWarning
        />
      </main>
    </>
  );
}

const WAVE_HEIGHTS = [10, 16, 24, 15, 30, 19, 12, 27, 17, 32, 21, 14, 25, 18, 11, 22, 29, 16];

function createTurndownService(): TurndownService {
  const service = new TurndownService({
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    headingStyle: 'atx',
    strongDelimiter: '**',
  });
  service.use(gfm);
  service.addRule('taskCheckbox', {
    filter: (node) => node.nodeName === 'INPUT' && (node as HTMLInputElement).type === 'checkbox' && node.parentElement?.nodeName === 'LI',
    replacement: (_content, node) => {
      const marker = (node as HTMLInputElement).checked ? '[x]' : '[ ]';
      return node.parentElement?.textContent?.trim() ? `${marker} ` : `${marker} <!-- -->`;
    },
  });
  service.addRule('emptyTaskBreak', {
    filter: (node) => node.nodeName === 'BR' && Boolean(node.parentElement?.matches('li.task-list-item')) && !node.parentElement?.textContent?.trim(),
    replacement: () => '',
  });
  service.addRule('tableCellBreak', {
    filter: (node) => node.nodeName === 'BR' && Boolean(node.parentElement?.matches('td, th')),
    replacement: () => '',
  });
  service.addRule('editorControls', {
    filter: (node) => node.nodeName === 'SPAN' && node.classList.contains('media-actions'),
    replacement: () => '',
  });
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

function serializeMarkdown(editor: HTMLDivElement): string {
  return turndownService.turndown(editor).replace(/\n{3,}/g, '\n\n').trim();
}

function decorateEditor(editor: HTMLDivElement, media: EditorMediaSource[]) {
  const mediaById = new Map(media.map((item) => [item.id, item.uri]));
  decorateRichTextContent(editor, true);
  editor.querySelectorAll<HTMLLIElement>('li.task-list-item').forEach(ensureEmptyTaskItemAnchor);
  editor.querySelectorAll<HTMLImageElement>('img').forEach((image) => {
    if (image.src.startsWith(RICH_TEXT_AUDIO_ORIGIN)) {
      const url = new URL(image.src);
      const id = decodeURIComponent(url.pathname.slice(url.pathname.lastIndexOf('/') + 1));
      const frame = createAudioFrame({ durationMs: Number(url.searchParams.get('duration') ?? 0), id, uri: mediaById.get(id) ?? '' });
      const paragraph = image.parentElement?.tagName === 'P' && image.parentElement.childNodes.length === 1 ? image.parentElement : null;
      if (paragraph) paragraph.replaceWith(frame);
      else image.replaceWith(frame);
      return;
    }
    const encodedId = image.src.startsWith(RICH_TEXT_MEDIA_ORIGIN) ? image.src.slice(RICH_TEXT_MEDIA_ORIGIN.length) : null;
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
    if (!frame.querySelector('.media-actions')) {
      const actions = document.createElement('span');
      actions.className = 'media-actions';
      actions.contentEditable = 'false';
      actions.innerHTML = '<button class="media-replace" type="button">替换</button><button class="media-remove" type="button">删除</button>';
      frame.append(actions);
    }
    image.onload = () => frame?.classList.remove('is-media-error');
    image.onerror = () => frame?.classList.add('is-media-error');
    const uri = mediaById.get(id);
    const source = image.getAttribute('src') ?? '';
    if (uri) {
      const shouldRetry = image.complete && image.naturalWidth === 0;
      frame?.classList.remove('is-media-error');
      if (source !== uri || shouldRetry) image.setAttribute('src', uri);
    } else if (source.startsWith(RICH_TEXT_MEDIA_ORIGIN)) {
      frame?.classList.add('is-media-error');
    }
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
  const uri = mediaById.get(id) ?? audio.getAttribute('src') ?? '';
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
    case 'inlineCode': toggleInlineCode(); break;
    case 'quote': toggleQuote(); break;
    case 'bulletList': document.execCommand('insertUnorderedList'); break;
    case 'orderedList': toggleOrderedList(editor); break;
    case 'taskList': toggleTaskList(); break;
    case 'codeBlock': {
      const selection = window.getSelection();
      const anchor = selection?.anchorNode instanceof Element ? selection.anchorNode : selection?.anchorNode?.parentElement;
      const pre = anchor?.closest('pre');
      if (pre) {
        const paragraph = document.createElement('p');
        paragraph.textContent = pre.textContent ?? '';
        pre.replaceWith(paragraph);
        placeCursorAtEnd(paragraph);
      } else document.execCommand('formatBlock', false, 'pre');
      break;
    }
    case 'link':
      if (typeof command.value === 'string') insertLink(command.value);
      break;
    case 'unlink': document.execCommand('unlink'); break;
    case 'horizontalRule': document.execCommand('insertHorizontalRule'); break;
    case 'table': insertTable(); break;
    case 'tableAddRow': addTableRow(editor); break;
    case 'tableDeleteRow': deleteTableRow(editor); break;
    case 'tableAddColumn': addTableColumn(editor); break;
    case 'tableDeleteColumn': deleteTableColumn(editor); break;
    case 'tableDelete': deleteSelectedTable(editor); break;
    case 'images':
      if (Array.isArray(command.value)) insertImages(command.value);
      break;
    case 'replaceImage':
      if (command.value && !Array.isArray(command.value) && typeof command.value === 'object' && 'previousId' in command.value) replaceImage(editor, command.value);
      break;
    case 'audio':
      if (command.value && !Array.isArray(command.value) && typeof command.value === 'object' && 'durationMs' in command.value) insertAudio(editor, command.value);
      break;
    case 'recordingStart': insertRecordingFrame(); break;
    case 'recordingCancel': editor.querySelector('.audio-recording-frame')?.remove(); break;
    case 'mention':
      if (typeof command.value === 'string') insertMention(command.value);
      break;
  }
}

function toggleInlineCode() {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  const anchor = range.commonAncestorContainer instanceof Element
    ? range.commonAncestorContainer
    : range.commonAncestorContainer.parentElement;
  const existing = anchor?.closest('code');
  if (existing) {
    const lastChild = existing.lastChild;
    existing.replaceWith(...existing.childNodes);
    if (lastChild) placeCursorAtEnd(lastChild);
    return;
  }
  const element = document.createElement('code');
  if (range.collapsed) element.textContent = '代码';
  else element.append(range.extractContents());
  range.insertNode(element);
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);
}

function toggleQuote() {
  const selection = window.getSelection();
  const anchor = selection?.anchorNode instanceof Element ? selection.anchorNode : selection?.anchorNode?.parentElement;
  const quote = anchor?.closest('blockquote');
  if (!quote) {
    document.execCommand('formatBlock', false, 'blockquote');
    return;
  }
  const lastChild = quote.lastChild;
  quote.replaceWith(...quote.childNodes);
  if (lastChild) placeCursorAtEnd(lastChild);
}

function toggleOrderedList(editor: HTMLDivElement) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  const initialAnchor = selection.anchorNode instanceof Element ? selection.anchorNode : selection.anchorNode?.parentElement;
  const orderedItem = initialAnchor?.closest('ol > li') as HTMLLIElement | null;
  if (orderedItem && !orderedItem.textContent?.trim()) {
    convertListItemToParagraph(orderedItem);
    return;
  }
  document.execCommand('insertOrderedList');
  const anchor = selection.anchorNode instanceof Element ? selection.anchorNode : selection.anchorNode?.parentElement;
  if (anchor?.closest('ol')) return;
  const block = anchor?.closest('p, div') as HTMLElement | null;
  if (block && block !== editor && !block.textContent?.trim()) {
    const list = document.createElement('ol');
    const item = document.createElement('li');
    item.append(document.createElement('br'));
    list.append(item);
    block.replaceWith(list);
    placeCursorAtStart(item);
    return;
  }
  if (!editor.textContent?.trim()) {
    const list = document.createElement('ol');
    const item = document.createElement('li');
    item.append(document.createElement('br'));
    list.append(item);
    editor.replaceChildren(list);
    placeCursorAtStart(item);
    return;
  }
}

function insertHtml(html: string) {
  document.execCommand('insertHTML', false, html);
}

function toggleTaskList() {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  const anchor = range.commonAncestorContainer instanceof Element ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
  const taskItem = anchor?.closest('li.task-list-item') as HTMLLIElement | null;
  if (taskItem) {
    convertTaskItemToParagraph(taskItem);
    return;
  }
  const listItem = anchor?.closest('li') as HTMLLIElement | null;
  if (listItem) {
    convertListToTask(listItem);
    return;
  }

  const list = document.createElement('ul');
  list.className = 'task-list';
  const item = document.createElement('li');
  item.className = 'task-list-item';
  const selectedContent = range.extractContents();
  item.append(createTaskCheckbox(), selectedContent);
  ensureEmptyTaskItemAnchor(item);
  list.append(item);
  const paragraph = document.createElement('p');
  paragraph.append(document.createElement('br'));
  const fragment = document.createDocumentFragment();
  fragment.append(list, paragraph);
  range.insertNode(fragment);
  placeCursorInTaskItem(item, 'end');
}

function convertListToTask(listItem: HTMLLIElement) {
  const list = listItem.closest('ul, ol');
  if (!list) return;
  const taskList = document.createElement('ul');
  taskList.className = 'task-list';
  Array.from(list.children).forEach((item) => {
    const taskItem = item as HTMLLIElement;
    taskItem.classList.add('task-list-item');
    taskItem.prepend(createTaskCheckbox());
    ensureEmptyTaskItemAnchor(taskItem);
    taskList.append(taskItem);
  });
  list.replaceWith(taskList);
  placeCursorInTaskItem(listItem, 'end');
}

function convertListItemToParagraph(listItem: HTMLLIElement) {
  const list = listItem.closest('ul, ol');
  if (!list) return;
  const paragraph = document.createElement('p');
  paragraph.append(...listItem.childNodes);
  if (!paragraph.hasChildNodes()) paragraph.append(document.createElement('br'));

  const items = Array.from(list.children);
  const itemIndex = items.indexOf(listItem);
  const nextItems = items.slice(itemIndex + 1);
  const trailingList = nextItems.length ? list.cloneNode(false) as HTMLOListElement | HTMLUListElement : null;
  trailingList?.append(...nextItems);
  if (itemIndex > 0) {
    listItem.remove();
    list.after(paragraph, ...(trailingList ? [trailingList] : []));
  } else {
    list.replaceWith(paragraph, ...(trailingList ? [trailingList] : []));
  }
  placeCursorAtStart(paragraph);
}

function convertTaskItemToParagraph(taskItem: HTMLLIElement) {
  const list = taskItem.closest('ul.task-list');
  if (!list) return;
  const paragraph = document.createElement('p');
  const checkbox = taskItem.firstElementChild?.matches('input[type="checkbox"]') ? taskItem.firstElementChild : null;
  checkbox?.remove();
  const first = taskItem.firstChild;
  if (first?.nodeType === Node.TEXT_NODE) {
    first.textContent = (first.textContent ?? '').replace(/^\s/, '');
    if (!first.textContent) first.remove();
  }
  paragraph.append(...taskItem.childNodes);
  if (!paragraph.hasChildNodes()) paragraph.append(document.createElement('br'));

  const items = Array.from(list.children);
  const itemIndex = items.indexOf(taskItem);
  const nextItems = items.slice(itemIndex + 1);
  if (nextItems.length) {
    const trailingList = list.cloneNode(false) as HTMLUListElement;
    trailingList.append(...nextItems);
    if (itemIndex > 0) {
      taskItem.remove();
      list.after(paragraph, trailingList);
    } else list.replaceWith(paragraph, trailingList);
  } else if (itemIndex > 0) {
    taskItem.remove();
    list.after(paragraph);
  } else {
    list.replaceWith(paragraph);
  }
  placeCursorAtEnd(paragraph);
}

function insertTaskListItem(taskItem: HTMLLIElement, selection: Selection) {
  const range = selection.getRangeAt(0).cloneRange();
  const trailingContent = range.cloneRange();
  trailingContent.selectNodeContents(taskItem);
  trailingContent.setStart(range.endContainer, range.endOffset);
  const tail = trailingContent.extractContents();

  const nextItem = document.createElement('li');
  nextItem.className = 'task-list-item';
  tail.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => checkbox.remove());
  nextItem.append(createTaskCheckbox(), tail);
  ensureEmptyTaskItemAnchor(nextItem);
  taskItem.parentElement?.insertBefore(nextItem, taskItem.nextSibling);
  placeCursorInTaskItem(nextItem, 'start');
}

function createTaskCheckbox(): HTMLInputElement {
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.contentEditable = 'false';
  return checkbox;
}

function ensureEmptyTaskItemAnchor(taskItem: HTMLLIElement) {
  const hasContent = Array.from(taskItem.childNodes).some((node) => {
    if (node.nodeType === Node.TEXT_NODE) return Boolean(node.textContent?.trim());
    return node instanceof Element && !node.matches('input[type="checkbox"], br');
  });
  if (hasContent) return;
  Array.from(taskItem.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) node.remove();
  });
  if (!taskItem.querySelector('br')) taskItem.append(document.createElement('br'));
}

function placeCursorInTaskItem(taskItem: HTMLLIElement, edge: 'end' | 'start') {
  const walker = document.createTreeWalker(taskItem, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    if (current.textContent?.trim()) textNodes.push(current as Text);
    current = walker.nextNode();
  }

  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  const textNode = edge === 'start' ? textNodes[0] : textNodes[textNodes.length - 1];
  if (textNode) {
    const offset = edge === 'start'
      ? textNode.data.length - textNode.data.trimStart().length
      : textNode.data.length;
    range.setStart(textNode, offset);
  } else {
    ensureEmptyTaskItemAnchor(taskItem);
    const anchor = taskItem.querySelector('br');
    if (!anchor) return;
    range.setStartBefore(anchor);
  }
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function insertLink(url: string) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  const anchor = range.commonAncestorContainer instanceof Element ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
  const existing = anchor?.closest('a') as HTMLAnchorElement | null;
  if (existing) {
    existing.href = url;
    placeCursorAtEnd(existing);
    return;
  }
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

function replaceImage(editor: HTMLDivElement, replacement: EditorImageReplacement) {
  const image = Array.from(editor.querySelectorAll<HTMLImageElement>('img[data-media-id]'))
    .find((candidate) => candidate.dataset.mediaId === replacement.previousId);
  if (!image) return;
  image.dataset.mediaId = replacement.id;
  image.src = replacement.uri;
  image.alt = replacement.alt;
  const frame = image.closest<HTMLElement>('.media-frame');
  if (frame) frame.dataset.mediaId = replacement.id;
}

function insertTable() {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  const table = document.createElement('table');
  const headerRow = table.createTHead().insertRow();
  const body = table.createTBody();
  for (let column = 0; column < 3; column += 1) headerRow.append(createEmptyTableCell('th'));
  for (let row = 0; row < 2; row += 1) {
    const bodyRow = body.insertRow();
    for (let column = 0; column < 3; column += 1) bodyRow.append(createEmptyTableCell('td'));
  }
  const paragraph = document.createElement('p');
  paragraph.append(document.createElement('br'));
  const fragment = document.createDocumentFragment();
  fragment.append(table, paragraph);
  const range = selection.getRangeAt(0);
  range.deleteContents();
  range.insertNode(fragment);
  placeCursorAtStart(headerRow.cells[0]);
}

function addTableRow(editor: HTMLDivElement) {
  const cell = selectedTableCell(editor);
  const row = cell?.parentElement as HTMLTableRowElement | null;
  const table = row?.closest('table') as HTMLTableElement | null;
  if (!cell || !row || !table) return;
  const columnCount = Math.max(...Array.from(table.rows, (item) => item.cells.length));
  let nextRow: HTMLTableRowElement;
  if (row.parentElement?.tagName === 'THEAD') {
    nextRow = (table.tBodies[0] ?? table.createTBody()).insertRow(0);
  } else {
    const section = row.parentElement as HTMLTableSectionElement;
    nextRow = section.insertRow(Array.from(section.rows).indexOf(row) + 1);
  }
  for (let column = 0; column < columnCount; column += 1) nextRow.append(createEmptyTableCell('td'));
  placeCursorAtStart(nextRow.cells[Math.min(cell.cellIndex, columnCount - 1)]);
}

function deleteTableRow(editor: HTMLDivElement) {
  const cell = selectedTableCell(editor);
  const row = cell?.parentElement as HTMLTableRowElement | null;
  const table = row?.closest('table') as HTMLTableElement | null;
  if (!cell || !row || !table) return;
  if (table.rows.length === 1) {
    removeTable(table);
    return;
  }
  const rowIndex = row.rowIndex;
  const columnIndex = cell.cellIndex;
  const removedHeader = row.parentElement?.tagName === 'THEAD';
  row.remove();
  if (removedHeader) promoteFirstTableRow(table);
  const targetRow = table.rows[Math.min(rowIndex, table.rows.length - 1)];
  placeCursorAtStart(targetRow.cells[Math.min(columnIndex, targetRow.cells.length - 1)]);
}

function addTableColumn(editor: HTMLDivElement) {
  const cell = selectedTableCell(editor);
  const table = cell?.closest('table') as HTMLTableElement | null;
  if (!cell || !table) return;
  const columnIndex = cell.cellIndex + 1;
  let selectedCell: HTMLTableCellElement | null = null;
  for (const row of Array.from(table.rows)) {
    const nextCell = createEmptyTableCell(row.parentElement?.tagName === 'THEAD' ? 'th' : 'td');
    row.insertBefore(nextCell, row.cells[columnIndex] ?? null);
    if (row === cell.parentElement) selectedCell = nextCell;
  }
  if (selectedCell) placeCursorAtStart(selectedCell);
}

function deleteTableColumn(editor: HTMLDivElement) {
  const cell = selectedTableCell(editor);
  const table = cell?.closest('table') as HTMLTableElement | null;
  if (!cell || !table) return;
  const columnIndex = cell.cellIndex;
  if (Math.max(...Array.from(table.rows, (row) => row.cells.length)) === 1) {
    removeTable(table);
    return;
  }
  const rowIndex = (cell.parentElement as HTMLTableRowElement).rowIndex;
  for (const row of Array.from(table.rows)) if (row.cells[columnIndex]) row.deleteCell(columnIndex);
  const targetRow = table.rows[rowIndex];
  const targetCell = targetRow?.cells[Math.min(columnIndex, targetRow.cells.length - 1)]
    ?? Array.from(table.rows).find((row) => row.cells.length)?.cells[0];
  if (targetCell) placeCursorAtStart(targetCell);
}

function deleteSelectedTable(editor: HTMLDivElement) {
  const table = selectedTableCell(editor)?.closest('table') as HTMLTableElement | null;
  if (table) removeTable(table);
}

function selectedTableCell(editor: HTMLDivElement): HTMLTableCellElement | null {
  const selection = window.getSelection();
  const element = selection?.anchorNode instanceof Element ? selection.anchorNode : selection?.anchorNode?.parentElement;
  const cell = element?.closest('td, th') as HTMLTableCellElement | null;
  return cell && editor.contains(cell) ? cell : null;
}

function createEmptyTableCell(tagName: 'td' | 'th'): HTMLTableCellElement {
  const cell = document.createElement(tagName);
  cell.append(document.createElement('br'));
  return cell;
}

function promoteFirstTableRow(table: HTMLTableElement) {
  const row = table.rows[0];
  if (!row) return;
  const head = table.tHead ?? table.createTHead();
  head.append(row);
  for (const cell of Array.from(row.cells)) {
    if (cell.tagName === 'TH') continue;
    const header = document.createElement('th');
    while (cell.firstChild) header.append(cell.firstChild);
    cell.replaceWith(header);
  }
}

function removeTable(table: HTMLTableElement) {
  const next = table.nextElementSibling;
  const paragraph = next?.tagName === 'P' ? next as HTMLElement : document.createElement('p');
  if (!paragraph.hasChildNodes()) paragraph.append(document.createElement('br'));
  if (!paragraph.parentElement) table.after(paragraph);
  table.remove();
  placeCursorAtStart(paragraph);
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
  const element = selection.anchorNode instanceof Element ? selection.anchorNode : selection.anchorNode?.parentElement;
  const taskItem = element?.closest('li.task-list-item');
  if (document.queryCommandState('bold')) formats.push('bold');
  if (document.queryCommandState('italic')) formats.push('italic');
  if (document.queryCommandState('strikeThrough')) formats.push('strikethrough');
  if (document.queryCommandState('insertUnorderedList') && !taskItem) formats.push('bulletList');
  if (document.queryCommandState('insertOrderedList')) formats.push('orderedList');
  if (taskItem) formats.push('taskList');
  if (element?.closest('code')) formats.push('inlineCode');
  if (element?.closest('blockquote')) formats.push('quote');
  if (element?.closest('pre')) formats.push('codeBlock');
  if (element?.closest('a')) formats.push('link');
  if (element?.closest('table')) formats.push('table');
  const textBlock = element?.closest('p, h1, h2, h3');
  if (textBlock?.tagName === 'P') formats.push('paragraph');
  if (textBlock?.tagName === 'H1') formats.push('heading1');
  if (textBlock?.tagName === 'H2') formats.push('heading2');
  if (textBlock?.tagName === 'H3') formats.push('heading3');
  onFormatsChange(formats);
}

const editorCss = (theme: EditorTheme) => `
  :root { color-scheme: ${theme.colorScheme}; font-family: ui-serif, Georgia, "Noto Serif SC", serif; }
  * { box-sizing: border-box; }
  html, body, #root { min-height: 100%; margin: 0; background: transparent; }
  body { overflow-y: auto; color: ${theme.ink}; -webkit-font-smoothing: antialiased; }
  .editor-shell { width: 100%; min-height: 100%; padding: 10px 22px 44px; }
  .editor { position: relative; min-height: calc(100vh - 54px); outline: none; caret-color: ${theme.life}; }
  .editor[aria-disabled="true"] { opacity: 0.72; }
  .editor:empty::before { position: absolute; inset: 0 auto auto 0; content: attr(data-placeholder); color: ${theme.inkFaint}; line-height: inherit; white-space: pre-line; pointer-events: none; }
  ${richTextSurfaceCss(theme)}
  figure { margin: 1.2em 0; }
  .media-frame { display: block; position: relative; overflow: hidden; margin: 1.2em 0; border-radius: 4px; cursor: pointer; }
  .media-actions { position: absolute; top: 10px; right: 10px; display: flex; overflow: hidden; border-radius: 4px; background: ${theme.overlay}; font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, sans-serif; }
  .media-actions button { min-width: 56px; height: 44px; padding: 0 10px; border: 0; background: transparent; color: ${theme.codeForeground}; font: inherit; font-size: 11px; }
  .media-actions button + button { border-left: 1px solid rgba(255, 255, 255, 0.28); }
  .media-actions .media-remove { color: #fff2ef; }
  .media-frame.is-media-error { min-height: 220px; border: 1px solid ${theme.line}; background: ${theme.paper}; }
  .media-frame.is-media-error::before { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; content: "图片暂时无法显示 轻触替换"; color: ${theme.inkSoft}; font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, sans-serif; font-size: 13px; pointer-events: none; }
  .media-frame.is-media-error img { visibility: hidden; }
  .mention { padding: 0.08em 0.22em; border-radius: 5px; background: ${theme.lifeLight}; color: ${theme.life}; }
  .audio-frame, .audio-recording-frame { min-height: 72px; display: flex; align-items: center; margin: 1.25em 0; padding: 14px; border-radius: 4px 22px 4px 22px; font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, sans-serif; }
  .audio-frame { background: ${theme.lifeLight}; }
  .audio-recording-frame { background: ${theme.dangerLight}; }
  .audio-recording-frame.is-saving { background: ${theme.paper}; }
  .audio-recording-copy { min-width: 0; display: flex; flex: 1; flex-direction: column; margin-left: 13px; }
  .audio-recording-copy strong { color: ${theme.danger}; font-family: ui-serif, Georgia, "Noto Serif SC", serif; font-size: 15px; }
  .audio-recording-copy small { margin-top: 4px; color: ${theme.danger}; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 9px; }
  .recording-dot { width: 12px; height: 12px; border-radius: 50%; background: ${theme.danger}; box-shadow: 0 0 0 0 ${theme.dangerLine}; animation: recording-pulse 1.5s ease-out infinite; }
  .audio-recording-stop, .audio-play { flex: 0 0 auto; display: grid; place-items: center; width: 42px; height: 42px; padding: 0; border: 0; border-radius: 50%; cursor: pointer; transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease; }
  .audio-recording-stop { background: ${theme.danger}; }
  .audio-recording-stop span { width: 14px; height: 14px; border-radius: 2px; background: ${theme.codeForeground}; }
  .audio-play { background: ${theme.life}; color: ${theme.onLife}; box-shadow: 0 5px 12px ${theme.lifeLine}; }
  .audio-play:hover { background: ${theme.lifeDeep}; box-shadow: 0 7px 16px ${theme.lifeLine}; transform: translateY(-1px); }
  .audio-play:active { transform: translateY(0) scale(0.96); }
  .audio-play-icon { display: block; width: 0; height: 0; margin-left: 2px; border-top: 7px solid transparent; border-bottom: 7px solid transparent; border-left: 10px solid currentColor; }
  .audio-play.is-playing .audio-play-icon { position: relative; width: 12px; height: 14px; margin-left: 0; border: 0; }
  .audio-play.is-playing .audio-play-icon::before, .audio-play.is-playing .audio-play-icon::after { position: absolute; top: 0; width: 4px; height: 14px; border-radius: 2px; background: currentColor; content: ""; }
  .audio-play.is-playing .audio-play-icon::before { left: 0; }
  .audio-play.is-playing .audio-play-icon::after { right: 0; }
  .audio-content { min-width: 0; display: flex; flex: 1; flex-direction: column; margin-left: 13px; }
  .audio-wave { height: 32px; display: flex; align-items: center; gap: 3px; overflow: hidden; }
  .audio-wave i { flex: 0 0 3px; border-radius: 2px; background: ${theme.lifeLine}; }
  .audio-wave i.played { background: ${theme.life}; }
  .audio-meta { display: flex; justify-content: space-between; margin-top: 3px; color: ${theme.inkSoft}; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 9px; letter-spacing: 0.04em; }
  .audio-meta small { font: inherit; }
  .audio-frame audio { display: none; }
  .audio-remove { display: grid; place-items: center; width: 34px; height: 34px; flex: 0 0 auto; margin-left: 8px; padding: 0; border: 1px solid ${theme.dangerLine}; border-radius: 50%; background: ${theme.dangerLight}; color: ${theme.danger}; cursor: pointer; transition: transform 160ms ease, border-color 160ms ease, background 160ms ease; }
  .audio-remove:hover { border-color: ${theme.danger}; background: ${theme.dangerLight}; transform: translateY(-1px); }
  .audio-remove:active { background: ${theme.dangerLight}; transform: scale(0.94); }
  .audio-trash { display: block; width: 18px; height: 18px; }
  .audio-frame.is-audio-error .audio-content { opacity: 0.45; }
  .audio-frame.is-audio-error .audio-play { pointer-events: none; opacity: 0.45; }
  @keyframes recording-pulse { 70% { box-shadow: 0 0 0 9px rgba(184, 77, 59, 0); } 100% { box-shadow: 0 0 0 0 rgba(184, 77, 59, 0); } }
`;
