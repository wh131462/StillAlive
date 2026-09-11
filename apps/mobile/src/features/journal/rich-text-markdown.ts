import DOMPurify from 'dompurify';
import { marked } from 'marked';

export const RICH_TEXT_AUDIO_ORIGIN = 'https://still-alive.local/audio/';
export const RICH_TEXT_MEDIA_ORIGIN = 'https://still-alive.local/media/';

function parseDateCardValue(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value);
  if (!match) return new Date(value);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4] ?? 0), Number(match[5] ?? 0));
}

function formatDateCard(value: string, kind: 'date' | 'datetime'): string {
  const date = parseDateCardValue(value);
  if (Number.isNaN(date.getTime())) return value;
  const dateText = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
  if (kind === 'date') return dateText;
  return `${new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date)} · ${dateText}`;
}

export function renderRichTextMarkdown(markdown: string): string {
  const audioSafeMarkdown = markdown.replace(
    /!\[语音\]\(audio:\/\/([^)?]+)(?:\?duration=(\d+))?\)/g,
    (_match, id: string, duration: string | undefined) => `![语音](${RICH_TEXT_AUDIO_ORIGIN}${encodeURIComponent(id)}?duration=${Number(duration ?? 0)})`,
  );
  const mediaSafeMarkdown = audioSafeMarkdown.replace(
    /!\[([^\]]*)\]\(media:\/\/([^)]+)\)/g,
    (_match, alt: string, id: string) => `![${alt}](${RICH_TEXT_MEDIA_ORIGIN}${encodeURIComponent(id)})`,
  );
  const dateSafeMarkdown = mediaSafeMarkdown.replace(/\[\[(date|datetime):([^\]]+)\]\]/g, (_match, kind: 'date' | 'datetime', value: string) => {
    const safeValue = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?$/.test(safeValue)) return _match;
    return `<span class="date-card date-card-${kind}" data-date-kind="${kind}" data-date-value="${safeValue}" contenteditable="false">${formatDateCard(safeValue, kind)}</span>`;
  });
  const html = marked.parse(dateSafeMarkdown, { async: false, breaks: true, gfm: true }) as string;
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

export function decorateRichTextContent(root: ParentNode, interactive: boolean): void {
  root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.disabled = !interactive;
    checkbox.contentEditable = 'false';
    const item = checkbox.closest('li');
    const paragraph = checkbox.parentElement;
    if (paragraph?.tagName === 'P' && paragraph.parentElement === item) paragraph.replaceWith(...paragraph.childNodes);
    item?.classList.add('task-list-item');
    checkbox.closest('ul')?.classList.add('task-list');
  });
  root.querySelectorAll('ul.task-list').forEach((list) => {
    list.classList.toggle('mixed-task-list', Array.from(list.children).some((item) => !item.classList.contains('task-list-item')));
  });
  root.querySelectorAll<HTMLTableCellElement>('th, td').forEach((cell) => {
    if (!cell.hasChildNodes()) cell.append(document.createElement('br'));
  });
}
