'use dom';

import { useEffect } from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import type { DOMProps } from 'expo/dom';
import type { EditorMediaSource, EditorTheme } from './rich-text-editor.types';
import { richTextContentCss } from './rich-text-content-css';

interface MarkdownViewProps {
  markdown: string;
  maxHeight?: number;
  media: EditorMediaSource[];
  onReady?(): void;
  theme: EditorTheme;
  dom?: DOMProps;
}

const MEDIA_ORIGIN = 'https://still-alive.local/media/';

export default function MarkdownView({ markdown, maxHeight, media, onReady, theme }: MarkdownViewProps) {
  const mediaSafeMarkdown = markdown.replace(
    /!\[([^\]]*)\]\(media:\/\/([^)]+)\)/g,
    (_match, alt: string, id: string) => `![${alt}](${MEDIA_ORIGIN}${encodeURIComponent(id)})`,
  );
  const html = DOMPurify.sanitize(marked.parse(mediaSafeMarkdown, { async: false, breaks: true, gfm: true }) as string, { USE_PROFILES: { html: true } });

  useEffect(() => {
    void onReady?.();
  }, [html, onReady]);

  return (
    <>
      <style>{viewCss(theme, maxHeight)}</style>
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

const viewCss = (theme: EditorTheme, maxHeight?: number) => `
  :root { color-scheme: ${theme.colorScheme}; font-family: ui-serif, Georgia, "Noto Serif SC", serif; }
  * { box-sizing: border-box; }
  html, body, #root { width: 100%; margin: 0; background: transparent; }
  body { overflow: hidden; color: ${theme.ink}; -webkit-font-smoothing: antialiased; }
  .markdown { width: 100%; ${maxHeight === undefined ? '' : `max-height: ${Math.max(0, maxHeight)}px; overflow: hidden;`} font-size: 19px; line-height: 1.85; }
  ${richTextContentCss(theme)}
  img { display: block; width: 100%; max-height: 560px; margin: 1.1em 0; border-radius: 4px; background: ${theme.lifeLight}; object-fit: cover; }
`;
