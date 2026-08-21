'use dom';

import type { DOMProps } from 'expo/dom';

export default function BookReaderDom({ uri, page, tone }: { uri: string; page: number; tone: 'paper' | 'warm' | 'night'; dom?: DOMProps }) {
  const separator = uri.includes('#') ? '&' : '#';
  const src = `${uri}${separator}page=${Math.max(1, Math.floor(page))}&toolbar=0&navpanes=0`;
  const background = tone === 'night' ? '#151916' : tone === 'warm' ? '#EEE3C9' : '#F8F8F4';
  return <div style={{ width: '100%', height: '100%', overflow: 'hidden', background }}><embed key={src} aria-label={`PDF 阅读器，第 ${page} 页`} src={src} type="application/pdf" style={{ width: '100%', height: '100%', border: 0, filter: tone === 'night' ? 'invert(0.9) hue-rotate(180deg)' : undefined }} /></div>;
}
