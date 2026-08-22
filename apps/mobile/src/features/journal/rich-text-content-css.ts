import type { EditorTheme } from './rich-text-editor.types';

export function richTextSurfaceCss(theme: EditorTheme): string {
  return `
    .rich-text-surface { --rich-text-line-height: 1.85em; width: 100%; min-width: 0; overflow-wrap: anywhere; font-size: 19px; line-height: 1.85; }
    ${richTextContentCss(theme)}
    img, video { display: block; width: 100%; max-height: 520px; background: ${theme.lifeLight}; object-fit: cover; }
  `;
}

export function richTextContentCss(theme: EditorTheme): string {
  return `
    p { margin: 0 0 0.85em; }
    h1, h2, h3, h4, h5, h6 { margin: 1.15em 0 0.55em; line-height: 1.3; letter-spacing: -0.02em; }
    h1:first-child, h2:first-child, h3:first-child { margin-top: 0; }
    h1 { font-size: 2em; } h2 { font-size: 1.62em; } h3 { font-size: 1.34em; }
    h4 { font-size: 1.16em; } h5 { font-size: 1em; } h6 { color: ${theme.inkSoft}; font-size: 0.9em; letter-spacing: 0.04em; }
    strong { font-weight: 760; } em { font-style: italic; } del { color: ${theme.inkFaint}; }
    a { color: ${theme.life}; text-decoration-color: ${theme.lifeLine}; text-underline-offset: 3px; }
    blockquote { margin: 1.2em 0; padding: 0.15em 0 0.15em 16px; border-left: 3px solid ${theme.sun}; color: ${theme.inkSoft}; }
    blockquote p:last-child { margin-bottom: 0; }
    ul, ol { margin: 0.7em 0 1em; padding-left: 1.45em; list-style-position: outside; }
    ul { list-style-type: disc; } ol { list-style-type: decimal; }
    li { margin: 0.34em 0; padding-left: 0.2em; }
    .task-list { padding-left: 0.25em; list-style: none; }
    .task-list-item { position: relative; min-height: var(--rich-text-line-height); padding-left: 1.9em; list-style: none; }
    .task-list-item::marker { content: ""; }
    .task-list-item > input[type="checkbox"] { position: absolute; top: calc((var(--rich-text-line-height) - 18px) / 2); left: 0.2em; width: 18px; height: 18px; margin: 0; appearance: none; -webkit-appearance: none; border: 1.5px solid ${theme.inkFaint}; border-radius: 4px; background: transparent; font-size: inherit; line-height: inherit; opacity: 1; }
    .task-list-item > input[type="checkbox"]:checked { border-color: ${theme.life}; background: ${theme.life}; }
    .task-list-item > input[type="checkbox"]:checked::after { position: absolute; top: 2px; left: 5px; width: 4px; height: 8px; border: solid ${theme.onLife}; border-width: 0 2px 2px 0; content: ""; transform: rotate(45deg); }
    code { padding: 0.15em 0.36em; border-radius: 5px; background: ${theme.lifeLight}; color: ${theme.life}; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.82em; }
    pre { overflow-x: auto; margin: 1.2em 0; padding: 15px 16px; border-radius: 14px; background: ${theme.codeBackground}; color: ${theme.codeForeground}; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.78em; line-height: 1.65; white-space: pre-wrap; }
    pre code { padding: 0; background: transparent; color: inherit; font-size: inherit; }
    hr { display: block; width: 100%; height: 0; margin: 2em 0; border: 0; border-top: 1px solid ${theme.line}; background: transparent; }
    table { display: block; width: 100%; margin: 1.2em 0; overflow-x: auto; border-collapse: collapse; font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, sans-serif; font-size: 0.78em; }
    th, td { min-width: 110px; padding: 9px 10px; border: 1px solid ${theme.line}; text-align: left; }
    th { background: ${theme.paper}; font-weight: 700; }
  `;
}
