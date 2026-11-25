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
  /** chat：AI 回答，无衬线正文并压小标题层级；prose：日记正文，衬线。 */
  variant?: 'prose' | 'chat';
  /** 已知的引用编号（如 S1 / K2）；命中时把正文里的 [S1] 渲染成角标。 */
  citations?: string[];
  dom?: DOMProps;
}

export default function MarkdownView({ citations, markdown, maxHeight, media, onOverflowChange, onReady, preview = false, theme, variant = 'prose' }: MarkdownViewProps) {
  const html = renderCitationMarkers(renderRichTextMarkdown(markdown), citations);
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
      <style>{viewCss(theme, maxHeight, preview, variant)}</style>
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

/**
 * 把正文里的 [S1]/[K2] 替换成可辨识的角标；只处理传入的已知编号，
 * 代码块与链接内不动，未知编号保持原样。
 */
function renderCitationMarkers(html: string, citations?: string[]): string {
  if (!citations?.length || typeof DOMParser === 'undefined') return html;
  const known = new Set(citations);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const targets: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    if (!/\[[SK]\d+\]/u.test(text.data)) continue;
    if (text.parentElement?.closest('pre, code, a')) continue;
    targets.push(text);
  }
  for (const text of targets) {
    const pattern = /\[([SK]\d+)\]/gu;
    const fragment = doc.createDocumentFragment();
    let lastIndex = 0;
    let matched = false;
    for (let match = pattern.exec(text.data); match; match = pattern.exec(text.data)) {
      if (!known.has(match[1])) continue;
      matched = true;
      fragment.append(text.data.slice(lastIndex, match.index));
      const marker = doc.createElement('sup');
      marker.className = 'citation';
      marker.dataset.citation = match[1];
      marker.textContent = match[1];
      fragment.append(marker);
      lastIndex = match.index + match[0].length;
    }
    if (!matched) continue;
    fragment.append(text.data.slice(lastIndex));
    text.replaceWith(fragment);
  }
  return doc.body.innerHTML;
}

const viewCss = (theme: EditorTheme, maxHeight?: number, preview = false, variant: 'prose' | 'chat' = 'prose') => `
  :root { color-scheme: ${theme.colorScheme}; font-family: ${variant === 'chat' ? 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Noto Sans SC", sans-serif' : 'ui-serif, Georgia, "Noto Serif SC", serif'}; }
  * { box-sizing: border-box; }
  html, body, #root { width: 100%; margin: 0; background: transparent; }
  body { overflow: hidden; color: ${theme.ink}; -webkit-font-smoothing: antialiased; }
  ${richTextSurfaceCss(theme)}
  ${preview ? '.rich-text-surface { --rich-text-line-height: 1.6em; font-size: 15px; line-height: 1.6; }' : ''}
  ${variant === 'chat' ? `.rich-text-surface { --rich-text-line-height: 1.55em; font-size: 16px; line-height: 1.55; }
  .rich-text-surface h1 { font-size: 1.4em; } .rich-text-surface h2 { font-size: 1.22em; } .rich-text-surface h3 { font-size: 1.08em; }
  .rich-text-surface p:last-child, .rich-text-surface ul:last-child, .rich-text-surface ol:last-child, .rich-text-surface pre:last-child { margin-bottom: 0; }
  .rich-text-surface table { display: table; table-layout: fixed; }
  .rich-text-surface th, .rich-text-surface td { min-width: 0; }` : ''}
  .markdown { ${maxHeight === undefined ? '' : `max-height: ${Math.max(0, maxHeight)}px; overflow: hidden;`} }
  .markdown .task-list-item > input[type="checkbox"] { opacity: 1; pointer-events: none; }
  .markdown .date-card { display: inline-flex; align-items: center; vertical-align: baseline; margin: 0 0.32em; padding: 0.08em 0.65em; border: 1px solid ${theme.line}; border-radius: 8px; background: ${theme.paper}; color: ${theme.ink}; font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, sans-serif; font-size: 0.88em; line-height: 1.35; font-weight: 700; box-shadow: 0 2px 6px rgba(16, 24, 20, 0.08); }
  .markdown .date-card-datetime { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 0.02em; }
  .markdown img { margin: 1.2em 0; border-radius: 4px; }
  .markdown .citation { display: inline-block; margin: 0 0.16em; padding: 0.12em 0.38em; border-radius: 4px; border: 1px solid ${theme.lifeLine}; background: ${theme.lifeLight}; color: ${theme.life}; font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; font-size: 0.62em; font-weight: 700; line-height: 1.2; letter-spacing: 0.02em; vertical-align: 0.28em; }
`;
