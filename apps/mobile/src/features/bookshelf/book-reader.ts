import type { Book, BookFormat, BookParseStatus, ReaderTocItem, ReadingPreferences } from '@still-alive/types';
import { Platform } from 'react-native';

export type BookLocator =
  | { type: 'epub-cfi'; cfi: string; href: string | null; chapterTitle: string | null; progression: number }
  | { type: 'pdf-page'; page: number; pageCount: number | null }
  | { type: 'manual'; location: string | null; chapterTitle: string | null };

export interface ReaderCapabilities {
  reflow: boolean;
  toc: boolean;
  selection: boolean;
  highlights: boolean;
  fontSize: boolean;
  lineHeight: boolean;
  flow: boolean;
  pageJump: boolean;
  zoom: boolean;
}

export interface ReaderSelection {
  text: string;
  locator: BookLocator;
  contextBefore: string | null;
  contextAfter: string | null;
}

export interface ReaderLocationEvent {
  locator: BookLocator;
  progression: number;
  chapterHref: string | null;
  chapterTitle: string | null;
  pageCount: number | null;
}

export interface ReaderSurfaceHandle {
  previous(): void;
  next(): void;
  goTo(locator: BookLocator): void;
}

export interface BookReaderAdapter {
  readonly format: BookFormat;
  readonly engineVersion: string;
  readonly capabilities: ReaderCapabilities;
  canOpen(book: Book): boolean;
}

export interface ReaderCapability {
  status: BookParseStatus;
  message: string | null;
}

export function detectReaderCapability(book: Book): ReaderCapability {
  if (book.parseStatus !== 'ready') return { status: book.parseStatus, message: book.parseMessage };
  if (book.format === 'pdf' || book.format === 'epub') return { status: 'ready', message: null };
  return { status: 'unsupported', message: '当前设备阅读适配器未启用该格式，原始文件仍保留在书架。' };
}

const EPUB_CAPABILITIES: ReaderCapabilities = { reflow: true, toc: true, selection: true, highlights: true, fontSize: true, lineHeight: true, flow: true, pageJump: false, zoom: false };
const PDF_CAPABILITIES: ReaderCapabilities = { reflow: false, toc: false, selection: Platform.OS === 'ios', highlights: false, fontSize: false, lineHeight: false, flow: false, pageJump: true, zoom: true };
const UNSUPPORTED_CAPABILITIES: ReaderCapabilities = { reflow: false, toc: false, selection: false, highlights: false, fontSize: false, lineHeight: false, flow: false, pageJump: false, zoom: false };

const ADAPTERS: Record<BookFormat, BookReaderAdapter> = {
  epub: { format: 'epub', engineVersion: 'epubjs-react-native@1.4.7', capabilities: EPUB_CAPABILITIES, canOpen: (book) => book.format === 'epub' && book.parseStatus === 'ready' },
  pdf: { format: 'pdf', engineVersion: 'react-native-pdf@7.0.5', capabilities: PDF_CAPABILITIES, canOpen: (book) => book.format === 'pdf' && book.parseStatus === 'ready' },
  mobi: { format: 'mobi', engineVersion: 'archive-only', capabilities: UNSUPPORTED_CAPABILITIES, canOpen: () => false },
  azw: { format: 'azw', engineVersion: 'archive-only', capabilities: UNSUPPORTED_CAPABILITIES, canOpen: () => false },
  azw3: { format: 'azw3', engineVersion: 'archive-only', capabilities: UNSUPPORTED_CAPABILITIES, canOpen: () => false },
};

export class ReaderSessionController {
  readonly adapter: BookReaderAdapter;
  readonly initialLocator: BookLocator | null;

  constructor(readonly book: Book) {
    this.adapter = ADAPTERS[book.format];
    this.initialLocator = locatorFromBook(book);
  }

  get capabilities(): ReaderCapabilities {
    return this.adapter.capabilities;
  }

  get toc(): ReaderTocItem[] {
    return this.book.chapterCache ?? [];
  }

  applyLocation(event: ReaderLocationEvent): Book {
    return {
      ...this.book,
      progress: clamp(event.progression, 0, 1),
      location: serializeBookLocator(event.locator),
      locationType: event.locator.type,
      chapterHref: event.chapterHref,
      chapterTitle: event.chapterTitle,
      engineVersion: this.adapter.engineVersion,
      pageCount: event.pageCount,
      updatedAt: new Date().toISOString(),
    };
  }
}

export const DEFAULT_READING_PREFERENCES: ReadingPreferences = {
  theme: 'paper',
  fontSize: 20,
  lineHeight: 1.8,
  pageMargin: 22,
  fontFamily: 'serif',
  flow: 'paginated',
  pdfScale: 1,
  pdfHorizontal: false,
};

export function readingPreferencesForBook(json: string, bookId: string): ReadingPreferences {
  try {
    const all: unknown = JSON.parse(json);
    if (!all || typeof all !== 'object' || Array.isArray(all)) return DEFAULT_READING_PREFERENCES;
    return sanitizePreferences((all as Record<string, unknown>)[bookId]);
  } catch {
    return DEFAULT_READING_PREFERENCES;
  }
}

export function updateReadingPreferencesJson(json: string, bookId: string, preferences: ReadingPreferences): string {
  let all: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(json);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) all = parsed as Record<string, unknown>;
  } catch {
    // Invalid legacy preference data is replaced with a valid store.
  }
  return JSON.stringify({ ...all, [bookId]: sanitizePreferences(preferences) });
}

export function createPdfLocator(page: number, pageCount: number | null = null): BookLocator {
  return { type: 'pdf-page', page: normalizePage(page), pageCount: pageCount && pageCount > 0 ? Math.floor(pageCount) : null };
}

export function createEpubLocator(cfi: string, href: string | null, chapterTitle: string | null, progression: number): BookLocator {
  return { type: 'epub-cfi', cfi, href, chapterTitle, progression: clamp(progression, 0, 1) };
}

export function serializeBookLocator(locator: BookLocator): string | null {
  if (locator.type === 'pdf-page') return `pdf:${normalizePage(locator.page)}`;
  if (locator.type === 'epub-cfi') return locator.cfi || locator.href;
  return locator.location;
}

export function locatorFromBook(book: Pick<Book, 'format' | 'location' | 'locationType' | 'chapterHref' | 'chapterTitle' | 'progress' | 'pageCount'>): BookLocator | null {
  if (!book.location && !book.chapterHref) return book.format === 'pdf' ? createPdfLocator(1, book.pageCount ?? null) : null;
  if (book.locationType === 'epub-cfi' || book.format === 'epub') {
    const cfi = book.location?.startsWith('epubcfi(') ? book.location : '';
    if (cfi || book.chapterHref) return createEpubLocator(cfi, book.chapterHref ?? null, book.chapterTitle ?? null, book.progress);
  }
  if (book.locationType === 'pdf-page' || book.format === 'pdf') return createPdfLocator(pageFromBookLocation(book.location), book.pageCount ?? null);
  return { type: 'manual', location: book.location, chapterTitle: book.chapterTitle ?? null };
}

export function createBookLocation(page: number): string {
  return serializeBookLocator(createPdfLocator(page)) ?? 'pdf:1';
}

export function pageFromBookLocation(location: string | null): number {
  const page = Number(location?.match(/^(?:page|pdf):(\d+)$/)?.[1] ?? 1);
  return normalizePage(page);
}

function sanitizePreferences(value: unknown): ReadingPreferences {
  const candidate = value && typeof value === 'object' && !Array.isArray(value) ? value as Partial<ReadingPreferences> : {};
  return {
    theme: candidate.theme === 'warm' || candidate.theme === 'green' || candidate.theme === 'night' ? candidate.theme : 'paper',
    fontSize: clampNumber(candidate.fontSize, 14, 32, DEFAULT_READING_PREFERENCES.fontSize),
    lineHeight: clampNumber(candidate.lineHeight, 1.3, 2.4, DEFAULT_READING_PREFERENCES.lineHeight),
    pageMargin: clampNumber(candidate.pageMargin, 12, 44, DEFAULT_READING_PREFERENCES.pageMargin),
    fontFamily: candidate.fontFamily === 'sans' ? 'sans' : 'serif',
    flow: candidate.flow === 'scrolled' ? 'scrolled' : 'paginated',
    pdfScale: clampNumber(candidate.pdfScale, 1, 5, DEFAULT_READING_PREFERENCES.pdfScale),
    pdfHorizontal: candidate.pdfHorizontal === true,
  };
}

function normalizePage(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

function clampNumber(value: unknown, minimum: number, maximum: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? clamp(value, minimum, maximum) : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
