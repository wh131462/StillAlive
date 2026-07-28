'use dom';

import DOMPurify from 'dompurify';
import { marked } from 'marked';
import type { DOMProps } from 'expo/dom';
import type { EditorMediaSource } from './rich-text-editor.types';

interface MarkdownViewProps {
  markdown: string;
  media: EditorMediaSource[];
  dom?: DOMProps;
}

const MEDIA_ORIGIN = 'https://still-alive.local/media/';

export default function MarkdownView({ markdown, media }: MarkdownViewProps) {
  const mediaSafeMarkdown = markdown.replace(
    /!\[([^\]]*)\]\(media:\/\/([^)]+)\)/g,
    (_match, alt: string, id: string) => `![${alt}](${MEDIA_ORIGIN}${encodeURIComponent(id)})`,
  );
  const html = DOMPurify.sanitize(marked.parse(mediaSafeMarkdown, { async: false, breaks: true, gfm: true }) as string, { USE_PROFILES: { html: true } });

  return (
    <>
      <style>{VIEW_CSS}</style>
      <article
        className="markdown"
        ref={(element) => {
          if (!element) return;
          const mediaById = new Map(media.map((item) => [item.id, item.uri]));
          element.querySelectorAll<HTMLImageElement>('img').forEach((image) => {
            if (!image.src.startsWith(MEDIA_ORIGIN)) return;
            const uri = mediaById.get(decodeURIComponent(image.src.slice(MEDIA_ORIGIN.length)));
            if (uri) image.setAttribute('src', uri);
          });
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
}

const VIEW_CSS = `
  :root { color-scheme: light; font-family: ui-serif, Georgia, "Noto Serif SC", serif; }
  * { box-sizing: border-box; }
  html, body, #root { margin: 0; background: transparent; }
  body { overflow: hidden; color: #20231f; -webkit-font-smoothing: antialiased; }
  .markdown { font-size: 18px; line-height: 1.83; }
  p { margin: 0 0 0.88em; }
  h1, h2, h3, h4, h5, h6 { margin: 1.2em 0 0.55em; line-height: 1.3; letter-spacing: -0.02em; }
  h1:first-child, h2:first-child, h3:first-child { margin-top: 0; }
  h1 { font-size: 2em; } h2 { font-size: 1.55em; } h3 { font-size: 1.3em; }
  h4 { font-size: 1.15em; } h5 { font-size: 1em; } h6 { color: #656b62; font-size: 0.9em; }
  a { color: #1d6b49; text-decoration-color: #a9c9b5; text-underline-offset: 3px; }
  blockquote { margin: 1.2em 0; padding: 0.15em 0 0.15em 16px; border-left: 3px solid #d4a84f; color: #656b62; }
  ul, ol { margin: 0.7em 0 1em; padding-left: 1.45em; }
  li { margin: 0.34em 0; padding-left: 0.2em; }
  .task-list-item { list-style: none; } input[type="checkbox"] { width: 17px; height: 17px; margin-right: 8px; accent-color: #1d6b49; }
  code { padding: 0.15em 0.36em; border-radius: 5px; background: #e6ece5; color: #1d6b49; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.82em; }
  pre { overflow-x: auto; margin: 1.2em 0; padding: 15px 16px; border-radius: 14px; background: #252b27; color: #eef0e8; font-size: 0.78em; line-height: 1.65; white-space: pre-wrap; }
  pre code { padding: 0; background: transparent; color: inherit; font-size: inherit; }
  hr { width: 100%; height: 0; margin: 2em 0; border: 0; border-top: 1px solid rgba(32,35,31,0.13); background: transparent; }
  table { display: block; width: 100%; margin: 1.2em 0; overflow-x: auto; border-collapse: collapse; font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, sans-serif; font-size: 0.78em; }
  th, td { min-width: 105px; padding: 9px 10px; border: 1px solid rgba(32,35,31,0.16); text-align: left; }
  th { background: #eef0e8; }
  img { display: block; width: 100%; max-height: 560px; margin: 1.1em 0; border-radius: 4px; background: #d8e8dc; object-fit: cover; }
`;
