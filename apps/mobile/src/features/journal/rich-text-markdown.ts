import DOMPurify from 'dompurify';
import { marked } from 'marked';

export const RICH_TEXT_AUDIO_ORIGIN = 'https://still-alive.local/audio/';
export const RICH_TEXT_MEDIA_ORIGIN = 'https://still-alive.local/media/';

export function renderRichTextMarkdown(markdown: string): string {
  const audioSafeMarkdown = markdown.replace(
    /!\[语音\]\(audio:\/\/([^)?]+)(?:\?duration=(\d+))?\)/g,
    (_match, id: string, duration: string | undefined) => `![语音](${RICH_TEXT_AUDIO_ORIGIN}${encodeURIComponent(id)}?duration=${Number(duration ?? 0)})`,
  );
  const mediaSafeMarkdown = audioSafeMarkdown.replace(
    /!\[([^\]]*)\]\(media:\/\/([^)]+)\)/g,
    (_match, alt: string, id: string) => `![${alt}](${RICH_TEXT_MEDIA_ORIGIN}${encodeURIComponent(id)})`,
  );
  const html = marked.parse(mediaSafeMarkdown, { async: false, breaks: true, gfm: true }) as string;
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

export function decorateRichTextContent(root: ParentNode, interactive: boolean): void {
  root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.disabled = !interactive;
    checkbox.contentEditable = 'false';
    checkbox.parentElement?.classList.add('task-list-item');
    checkbox.closest('ul')?.classList.add('task-list');
  });
  root.querySelectorAll<HTMLTableCellElement>('th, td').forEach((cell) => {
    if (!cell.hasChildNodes()) cell.append(document.createElement('br'));
  });
}
