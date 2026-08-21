'use dom';

import { useEffect, useRef } from 'react';
import type { DOMProps } from 'expo/dom';
import type { EditorMediaSource, EditorTheme } from './rich-text-editor.types';
import { richTextSurfaceCss } from './rich-text-content-css';
import { decorateRichTextContent, renderRichTextMarkdown, RICH_TEXT_MEDIA_ORIGIN } from './rich-text-markdown';

interface MarkdownViewProps {
  markdown: string;
  maxHeight?: number;
  media: EditorMediaSource[];
  onOverflowChange?(overflowed: boolean): void;
  onReady?(): void;
  preview?: boolean;
  theme: EditorTheme;
  dom?: DOMProps;
}

export default function MarkdownView({ markdown, maxHeight, media, onOverflowChange, onReady, preview = false, theme }: MarkdownViewProps) {
  const html = renderRichTextMarkdown(markdown);
  const contentRef = useRef<HTMLElement | null>(null);
  const overflowRef = useRef<boolean | null>(null);

  useEffect(() => {
    void onReady?.();
  }, [html, onReady]);

  useEffect(() => {
    const element = contentRef.current;
    if (!element || !onOverflowChange) return;
    overflowRef.current = null;
    const measure = () => {
      const overflowed = maxHeight !== undefined && element.scrollHeight > element.clientHeight + 1;
      if (overflowRef.current === overflowed) return;
      overflowRef.current = overflowed;
      onOverflowChange(overflowed);
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    return () => observer?.disconnect();
  }, [html, maxHeight, onOverflowChange]);

  return (
    <>
      <style>{viewCss(theme, maxHeight, preview)}</style>
      <article
        className="markdown rich-text-surface"
        ref={(element) => {
          if (!element) return;
          contentRef.current = element;
          decorateRichTextContent(element, false);
          const mediaById = new Map(media.map((item) => [item.id, item.uri]));
          element.querySelectorAll<HTMLImageElement>('img').forEach((image) => {
            if (!image.src.startsWith(RICH_TEXT_MEDIA_ORIGIN)) return;
            const uri = mediaById.get(decodeURIComponent(image.src.slice(RICH_TEXT_MEDIA_ORIGIN.length)));
            if (uri) image.setAttribute('src', uri);
          });
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
}

const viewCss = (theme: EditorTheme, maxHeight?: number, preview = false) => `
  :root { color-scheme: ${theme.colorScheme}; font-family: ui-serif, Georgia, "Noto Serif SC", serif; }
  * { box-sizing: border-box; }
  html, body, #root { width: 100%; margin: 0; background: transparent; }
  body { overflow: hidden; color: ${theme.ink}; -webkit-font-smoothing: antialiased; }
  ${richTextSurfaceCss(theme)}
  ${preview ? '.rich-text-surface { --rich-text-line-height: 1.6em; font-size: 15px; line-height: 1.6; }' : ''}
  .markdown { ${maxHeight === undefined ? '' : `max-height: ${Math.max(0, maxHeight)}px; overflow: hidden;`} }
  .markdown .task-list-item > input[type="checkbox"] { opacity: 1; pointer-events: none; }
  .markdown img { margin: 1.2em 0; border-radius: 4px; }
`;
