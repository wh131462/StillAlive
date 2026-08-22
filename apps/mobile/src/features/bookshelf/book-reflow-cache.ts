import { Directory, File, Paths } from 'expo-file-system';
import { strToU8, zipSync } from 'fflate';
import { fb2 } from 'rebook/parsers/fb2';
import { mobi } from 'rebook/parsers/mobi';
import type { Book as ParsedBook, Section, TOCItem } from 'rebook';
import type { BookFormat, ReaderTocItem } from '@still-alive/types';
import { MobileDOMAdapter, MobileURLFactory } from './book-reflow-adapter';

const CACHE_DIRECTORY = 'book-readers';
const CACHE_VERSION = 2;
const MAX_EPUB_RESOURCE_BYTES = 12 * 1024 * 1024;
const REFLOW_FORMATS = new Set<BookFormat>(['mobi', 'txt', 'html', 'fb2']);

export interface ReflowBookProbe {
  title: string | null;
  author: string | null;
  chapterCache: ReaderTocItem[];
}

export type ReflowBookErrorKind = 'protected' | 'failed';

export function isReflowBookFormat(format: BookFormat): boolean {
  return REFLOW_FORMATS.has(format);
}

export async function probeReflowBook(uri: string, format: BookFormat): Promise<ReflowBookProbe> {
  if (!isReflowBookFormat(format)) throw new Error(`暂不支持 ${format.toUpperCase()} 重排阅读`);
  const bytes = await new File(uri).bytes();
  if (!bytes.length) throw new Error('书籍文件为空');
  if (format === 'txt') {
    const text = decodeText(bytes);
    if (!text.trim()) throw new Error('TXT 文件没有可读内容');
    return { title: null, author: null, chapterCache: [] };
  }
  if (format === 'html') {
    const html = sanitizeHtml(decodeText(bytes));
    if (!stripTags(html).trim()) throw new Error('HTML 文件没有可读内容');
    return { title: htmlTitle(html), author: null, chapterCache: [] };
  }
  const { book } = await parseReflowBook(bytes, format);
  try {
    if (!book.sections.length) throw new Error('书籍没有可读章节');
    return {
      title: metadataString(book.metadata?.title),
      author: metadataAuthor(book.metadata?.author),
      chapterCache: flattenToc(book.toc),
    };
  } finally {
    book.destroy?.();
  }
}

export async function prepareReflowBook(uri: string, bookId: string, format: BookFormat): Promise<string> {
  if (!isReflowBookFormat(format)) throw new Error(`暂不支持 ${format.toUpperCase()} 重排阅读`);
  const cacheDirectory = new Directory(Paths.cache, CACHE_DIRECTORY);
  cacheDirectory.create({ idempotent: true, intermediates: true });
  const cacheFile = new File(cacheDirectory, `${bookId}.${CACHE_VERSION}.epub`);
  if (cacheFile.exists && cacheFile.size > 0) return cacheFile.uri;

  const bytes = await new File(uri).bytes();
  if (!bytes.length) throw new Error('书籍文件为空');
  const epubBytes = format === 'txt'
    ? createSimpleEpub('TXT 书籍', textToHtml(decodeText(bytes)))
    : format === 'html'
      ? createSimpleEpub(htmlTitle(sanitizeHtml(decodeText(bytes))) || 'HTML 书籍', extractHtmlBody(sanitizeHtml(decodeText(bytes))))
      : await convertParsedBookToEpub(bytes, format);
  cacheFile.write(epubBytes);
  return cacheFile.uri;
}

export function classifyReflowError(cause: unknown): ReflowBookErrorKind {
  const message = cause instanceof Error ? cause.message : String(cause);
  const normalized = message.toLocaleLowerCase();
  return normalized.includes('drm') || normalized.includes('encrypt') || normalized.includes('protected') || normalized.includes('password') || normalized.includes('加密') || normalized.includes('受保护') ? 'protected' : 'failed';
}

export function reflowErrorMessage(cause: unknown): string {
  const message = cause instanceof Error ? cause.message.trim() : String(cause).trim();
  if (classifyReflowError(cause) === 'protected') return '文件受到 DRM 或密码保护，当前仅支持无 DRM MOBI；应用不会尝试绕过保护。';
  return message || '书籍解析失败，原始文件仍保留在书架。';
}

export function clearReflowBookCache(bookId: string): void {
  const directory = new Directory(Paths.cache, CACHE_DIRECTORY);
  for (const name of [`${bookId}.epub`, `${bookId}.${CACHE_VERSION}.epub`]) {
    const file = new File(directory, name);
    if (file.exists) file.delete();
  }
}

async function convertParsedBookToEpub(bytes: Uint8Array, format: BookFormat): Promise<Uint8Array> {
  const { book, urlFactory } = await parseReflowBook(bytes, format);
  try {
    if (!book.sections.length) throw new Error('书籍没有可读章节');
    return await createParsedBookEpub(book, urlFactory);
  } finally {
    book.destroy?.();
  }
}

async function parseReflowBook(bytes: Uint8Array, format: BookFormat) {
  const parser = format === 'mobi' ? mobi() : fb2();
  const domAdapter = new MobileDOMAdapter();
  const urlFactory = new MobileURLFactory();
  const book = await parser.parse(toArrayBuffer(bytes), { domAdapter, urlFactory });
  return { book, urlFactory };
}

async function createParsedBookEpub(book: ParsedBook, urlFactory: MobileURLFactory): Promise<Uint8Array> {
  const titles = sectionTitles(book);
  const loadedSections: Array<{ section: Section; title: string; html: string }> = [];
  for (let index = 0; index < book.sections.length; index += 1) {
    const section = book.sections[index];
    loadedSections.push({ section, title: titles.get(index) ?? `第 ${index + 1} 章`, html: String(await section.load()) });
    if (index % 4 === 3) await yieldToUi();
  }

  const resources = (await Promise.all(urlFactory.entries().map(async ([url, value], index) => {
    const bytes = await resourceBytes(value.data);
    const mimeType = normalizeResourceMimeType(value.mimeType, bytes);
    return bytes.length <= MAX_EPUB_RESOURCE_BYTES ? { url, bytes, mimeType, fileName: `resource-${index + 1}${resourceExtension(mimeType)}` } : null;
  }))).filter((resource): resource is NonNullable<typeof resource> => resource !== null);
  const resourceFiles = new Map(resources.map((resource) => [resource.url, resource.fileName]));
  const chapters = loadedSections.map((loaded, index) => ({
    id: `chapter-${index + 1}`,
    href: `text/chapter-${index + 1}.xhtml`,
    title: loaded.title,
    content: normalizeChapterXhtml(rewriteResourceUrls(loaded.html, resourceFiles, '../resources/'), loaded.title),
  }));
  const title = metadataString(book.metadata?.title) ?? '本地书籍';
  const author = metadataAuthor(book.metadata?.author);
  const language = Array.isArray(book.metadata?.language) ? book.metadata.language[0] : book.metadata?.language;
  const identifier = metadataString(book.metadata?.identifier) ?? `still-alive-${Date.now()}`;
  const files: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {
    mimetype: [strToU8('application/epub+zip'), { level: 0 as const }],
    'META-INF/container.xml': strToU8(epubContainer()),
    'OEBPS/content.opf': strToU8(epubPackage(title, author, language || 'und', identifier, chapters, resources)),
    'OEBPS/nav.xhtml': strToU8(epubNavigation(title, chapters)),
  };
  for (const chapter of chapters) files[`OEBPS/${chapter.href}`] = strToU8(chapter.content);
  for (const resource of resources) {
    const value = isTextResource(resource.mimeType)
      ? strToU8(rewriteResourceUrls(new TextDecoder().decode(resource.bytes), resourceFiles, ''))
      : resource.bytes;
    files[`OEBPS/resources/${resource.fileName}`] = value;
  }
  return zipSync(files, { level: 6 });
}

function sectionTitles(book: ParsedBook): Map<number, string> {
  const titles = new Map<number, string>();
  const visit = (items: readonly TOCItem[] | undefined) => {
    for (const item of items ?? []) {
      const index = book.resolveHref?.(item.href)?.index;
      if (index !== undefined && index >= 0 && !titles.has(index)) titles.set(index, item.label.trim() || `第 ${index + 1} 章`);
      visit(item.subitems);
    }
  };
  visit(book.toc);
  return titles;
}

function rewriteResourceUrls(value: string, resources: ReadonlyMap<string, string>, prefix: string): string {
  let result = value;
  for (const [url, fileName] of resources) result = result.split(url).join(`${prefix}${fileName}`);
  return result;
}

function normalizeChapterXhtml(value: string, title: string): string {
  const body = extractHtmlBody(value)
    .replace(/<\?xml[^>]*>/gi, '')
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)\b([^<>]*?)(?<!\/)\s*>/gi, '<$1$2/>')
    .replace(/&nbsp;/gi, '&#160;');
  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>${escapeXml(title)}</title></head><body>${body}</body></html>`;
}

function epubContainer(): string {
  return '<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>';
}

function epubPackage(title: string, author: string | null, language: string, identifier: string, chapters: Array<{ id: string; href: string }>, resources: Array<{ fileName: string; mimeType: string }>): string {
  const chapterManifest = chapters.map((chapter) => `<item id="${chapter.id}" href="${chapter.href}" media-type="application/xhtml+xml"/>`).join('');
  const resourceManifest = resources.map((resource, index) => `<item id="resource-${index + 1}" href="resources/${resource.fileName}" media-type="${escapeXml(resource.mimeType)}"/>`).join('');
  const spine = chapters.map((chapter) => `<itemref idref="${chapter.id}"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">${escapeXml(identifier)}</dc:identifier><dc:title>${escapeXml(title)}</dc:title>${author ? `<dc:creator>${escapeXml(author)}</dc:creator>` : ''}<dc:language>${escapeXml(language)}</dc:language><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>${chapterManifest}${resourceManifest}</manifest><spine>${spine}</spine></package>`;
}

function epubNavigation(title: string, chapters: Array<{ href: string; title: string }>): string {
  const items = chapters.map((chapter) => `<li><a href="${chapter.href}">${escapeXml(chapter.title)}</a></li>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>${escapeXml(title)}</title></head><body><nav epub:type="toc"><ol>${items}</ol></nav></body></html>`;
}

async function resourceBytes(data: string | ArrayBuffer | Blob): Promise<Uint8Array> {
  if (typeof data === 'string') return strToU8(data);
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (typeof data.arrayBuffer === 'function') return new Uint8Array(await data.arrayBuffer());
  throw new Error('书籍内嵌资源无法读取');
}

function normalizeResourceMimeType(value: string, bytes: Uint8Array): string {
  if (value) return value;
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes.length >= 6 && (ascii(bytes, 0, 6) === 'GIF87a' || ascii(bytes, 0, 6) === 'GIF89a')) return 'image/gif';
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'image/webp';
  return 'application/octet-stream';
}

function resourceExtension(mimeType: string): string {
  const extensions: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp', 'image/svg+xml': '.svg', 'text/css': '.css', 'font/woff': '.woff', 'font/woff2': '.woff2', 'application/vnd.ms-opentype': '.otf', 'application/font-sfnt': '.ttf' };
  return extensions[mimeType.toLocaleLowerCase()] ?? '.bin';
}

function isTextResource(mimeType: string): boolean {
  return mimeType.startsWith('text/') || mimeType === 'image/svg+xml' || mimeType.includes('xml');
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function createSimpleEpub(title: string, body: string): Uint8Array {
  const safeTitle = escapeXml(title || '本地书籍');
  const chapter = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>${safeTitle}</title></head><body>${body}</body></html>`;
  const nav = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>${safeTitle}</title></head><body><nav epub:type="toc"><ol><li><a href="chapter.xhtml">${safeTitle}</a></li></ol></nav></body></html>`;
  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">still-alive-local</dc:identifier><dc:title>${safeTitle}</dc:title><dc:language>und</dc:language></metadata><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/></manifest><spine><itemref idref="chapter"/></spine></package>`;
  const container = `<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`;
  return zipSync({
    mimetype: [strToU8('application/epub+zip'), { level: 0 }],
    'META-INF/container.xml': strToU8(container),
    'OEBPS/content.opf': strToU8(opf),
    'OEBPS/nav.xhtml': strToU8(nav),
    'OEBPS/chapter.xhtml': strToU8(chapter),
  });
}

function textToHtml(text: string): string {
  const normalized = text.replace(/\r\n?/g, '\n').trim();
  const paragraphs = normalized.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  if (!paragraphs.length) return '<p>（空白内容）</p>';
  return paragraphs.map((paragraph) => `<p>${paragraph.split('\n').map(escapeXml).join('<br/>')}</p>`).join('');
}

function sanitizeHtml(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*')/gi, '')
    .replace(/\s+(?:href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\1/gi, '');
}

function extractHtmlBody(value: string): string {
  return value.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? value.replace(/<!doctype[^>]*>/i, '');
}

function htmlTitle(value: string): string | null {
  const title = value.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const clean = title ? stripTags(title).trim() : '';
  return clean || null;
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

function decodeText(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.slice(2));
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    try { return new TextDecoder('utf-16be').decode(bytes.slice(2)); } catch { return new TextDecoder().decode(bytes); }
  }
  for (const encoding of ['utf-8', 'gb18030']) {
    try { return new TextDecoder(encoding).decode(bytes); } catch { /* Hermes may not expose every encoding label. */ }
  }
  return new TextDecoder().decode(bytes);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function flattenToc(items: readonly { href: string; label: string; subitems?: readonly { href: string; label: string; subitems?: readonly unknown[] }[] }[] | undefined, depth = 0): ReaderTocItem[] {
  return (items ?? []).flatMap((item) => [
    { href: item.href, label: item.label.trim() || '未命名章节', depth },
    ...flattenToc(item.subitems as typeof items, depth + 1),
  ]);
}

function metadataString(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const first = Object.values(record).find((item) => typeof item === 'string');
    return typeof first === 'string' ? first.trim() || null : null;
  }
  return null;
}

function metadataAuthor(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (!Array.isArray(value)) return metadataAuthor(value && typeof value === 'object' ? [value] : null);
  const names = value.map((item) => {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object') return metadataString((item as Record<string, unknown>).name);
    return null;
  }).filter((item): item is string => Boolean(item));
  return names.join('、') || null;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
