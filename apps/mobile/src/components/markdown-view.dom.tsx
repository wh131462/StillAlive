'use dom';

import DOMPurify from 'dompurify';
import { marked } from 'marked';
import type { DOMProps } from 'expo/dom';
import type { EditorMediaSource, EditorTheme } from './rich-text-editor.types';

interface MarkdownViewProps {
  markdown: string;
  media: EditorMediaSource[];
  theme: EditorTheme;
  dom?: DOMProps;
}

const MEDIA_ORIGIN = 'https://still-alive.local/media/';

export default function MarkdownView({ markdown, media, theme }: MarkdownViewProps) {
  const mediaSafeMarkdown = markdown.replace(
    /!\[([^\]]*)\]\(media:\/\/([^)]+)\)/g,
    (_match, alt: string, id: string) => `![${alt}](${MEDIA_ORIGIN}${encodeURIComponent(id)})`,
  );
  const html = DOMPurify.sanitize(marked.parse(mediaSafeMarkdown, { async: false, breaks: true, gfm: true }) as string, { USE_PROFILES: { html: true } });

  return (
    <>
      <style>{viewCss(theme)}</style>
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

const viewCss = (theme: EditorTheme) => `
  :root { color-scheme: ${theme.colorScheme}; font-family: ui-serif, Georgia, "Noto Serif SC", serif; }
  * { box-sizing: border-box; }
  html, body, #root { margin: 0; background: transparent; }
  body { overflow: hidden; color: ${theme.ink}; -webkit-font-smoothing: antialiased; }
  .markdown { font-size: 18px; line-height: 1.83; }
  p { margin: 0 0 0.88em; }
  h1, h2, h3, h4, h5, h6 { margin: 1.2em 0 0.55em; line-height: 1.3; letter-spacing: -0.02em; }
  h1:first-child, h2:first-child, h3:first-child { margin-top: 0; }
  h1 { font-size: 2em; } h2 { font-size: 1.55em; } h3 { font-size: 1.3em; }
  h4 { font-size: 1.15em; } h5 { font-size: 1em; } h6 { color: ${theme.inkSoft}; font-size: 0.9em; }
  a { color: ${theme.life}; text-decoration-color: ${theme.lifeLine}; text-underline-offset: 3px; }
  blockquote { margin: 1.2em 0; padding: 0.15em 0 0.15em 16px; border-left: 3px solid ${theme.sun}; color: ${theme.inkSoft}; }
  ul, ol { margin: 0.7em 0 1em; padding-left: 1.45em; }
  li { margin: 0.34em 0; padding-left: 0.2em; }
  .task-list-item { list-style: none; } input[type="checkbox"] { width: 17px; height: 17px; margin-right: 8px; accent-color: ${theme.life}; }
  code { padding: 0.15em 0.36em; border-radius: 5px; background: ${theme.lifeLight}; color: ${theme.life}; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.82em; }
  pre { overflow-x: auto; margin: 1.2em 0; padding: 15px 16px; border-radius: 14px; background: ${theme.codeBackground}; color: ${theme.codeForeground}; font-size: 0.78em; line-height: 1.65; white-space: pre-wrap; }
  pre code { padding: 0; background: transparent; color: inherit; font-size: inherit; }
  hr { width: 100%; height: 0; margin: 2em 0; border: 0; border-top: 1px solid ${theme.line}; background: transparent; }
  table { display: block; width: 100%; margin: 1.2em 0; overflow-x: auto; border-collapse: collapse; font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, sans-serif; font-size: 0.78em; }
  th, td { min-width: 105px; padding: 9px 10px; border: 1px solid ${theme.line}; text-align: left; }
  th { background: ${theme.paper}; }
  img { display: block; width: 100%; max-height: 560px; margin: 1.1em 0; border-radius: 4px; background: ${theme.lifeLight}; object-fit: cover; }
`;
