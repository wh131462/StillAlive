import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import Constants, { AppOwnership } from 'expo-constants';
import { File } from 'expo-file-system';
import { Reader, useReader } from '@epubjs-react-native/core';
import type { Annotation, Location, Section, Theme, Toc } from '@epubjs-react-native/core';
import type Pdf from 'react-native-pdf';
import type { PdfRef, TableContent } from 'react-native-pdf';
import type { Book, BookExcerpt, ReaderTheme, ReaderTocItem, ReadingPreferences } from '@still-alive/types';
import type { BookLocator, ReaderLocationEvent, ReaderSelection, ReaderSurfaceHandle } from './book-reader';
import { createEpubLocator, createPdfLocator, createReflowLocator } from './book-reader';
import { isReflowBookFormat, prepareReflowBook } from './book-reflow-cache';
import { useEpubFileSystem } from './epub-file-system';

interface BookReaderProps {
  book: Book;
  uri: string;
  initialLocator: BookLocator | null;
  preferences: ReadingPreferences;
  contentPadding: { top: number; bottom: number };
  excerpts: BookExcerpt[];
  palette: { background: string; text: string; muted: string; accent: string };
  onLocationChange(event: ReaderLocationEvent): void;
  onSelection(selection: ReaderSelection): void;
  onTocChange(toc: ReaderTocItem[]): void;
  onReady(): void;
  onMetadata?(metadata: { title: string | null; author: string | null }): void;
  onError(message: string): void;
  onSingleTap(): void;
  sourceFormat?: 'epub' | 'reflow';
}

export const BookReader = forwardRef<ReaderSurfaceHandle, BookReaderProps>(function BookReader(props, ref) {
  if (props.book.format === 'epub') return <EpubBookReader {...props} ref={ref} />;
  if (props.book.format === 'pdf') return <PdfBookReader {...props} ref={ref} />;
  if (isReflowBookFormat(props.book.format)) return <ReflowBookReader {...props} ref={ref} />;
  return <NativeModuleUnavailable palette={props.palette} />;
});

const ReflowBookReader = forwardRef<ReaderSurfaceHandle, BookReaderProps>(function ReflowBookReader(props, ref) {
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setSource(null);
    setError(null);
    void prepareReflowBook(props.uri, props.book.id, props.book.format)
      .then((uri) => { if (active) setSource(uri); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : '重排书籍转换失败'); });
    return () => { active = false; };
  }, [props.book.format, props.book.id, props.uri]);

  useEffect(() => {
    if (error) props.onError(error);
  }, [error, props.onError]);

  if (error) return <ReaderConversionError message={error} palette={props.palette} />;
  if (!source) return <LoadingReader color={props.palette.muted} label="正在准备阅读内容" />;
  return <EpubBookReader {...props} ref={ref} sourceFormat="reflow" uri={source} />;
});

const EpubBookReader = forwardRef<ReaderSurfaceHandle, BookReaderProps>(function EpubBookReader({ uri, initialLocator, preferences, contentPadding, excerpts, palette, onLocationChange, onSelection, onTocChange, onReady, onMetadata, onError, onSingleTap, sourceFormat = 'epub' }, ref) {
  const { addAnnotation, changeFontFamily, changeFontSize, changeTheme, getMeta, goNext, goPrevious, goToLocation, removeSelection, section } = useReader();
  const [dimensions, setDimensions] = useState({ width: 1, height: 1 });
  const theme = useMemo(() => epubTheme(preferences, palette), [palette, preferences]);
  const initialThemeRef = useRef(theme);
  const scrolled = preferences.flow === 'scrolled';
  const initialAnnotations = useMemo(() => excerpts.flatMap<Annotation>((excerpt) => (excerpt.locationType === 'epub-cfi' || excerpt.locationType === 'reflow-cfi') && excerpt.location?.match(/^(?:epubcfi\(|reflow:)/) ? [{ type: 'highlight', cfiRange: excerpt.location.replace(/^reflow:/, ''), cfiRangeText: excerpt.text, sectionIndex: 0, data: { excerptId: excerpt.id }, styles: { color: palette.accent, opacity: 0.28 } }] : []), [excerpts, palette.accent]);
  const currentChapter = section ? { href: section.href, title: section.label } : { href: initialLocator?.type === 'epub-cfi' || initialLocator?.type === 'reflow-cfi' ? initialLocator.href : null, title: initialLocator?.type === 'epub-cfi' || initialLocator?.type === 'reflow-cfi' ? initialLocator.chapterTitle : null };

  useImperativeHandle(ref, () => ({
    previous: goPrevious,
    next: goNext,
    goTo: (locator) => {
      if (locator.type === 'epub-cfi' || locator.type === 'reflow-cfi') goToLocation(locator.cfi || locator.href || '');
    },
  }), [goNext, goPrevious, goToLocation]);

  useEffect(() => {
    changeTheme(theme);
    changeFontSize(`${preferences.fontSize}px`);
    changeFontFamily(preferences.fontFamily === 'serif' ? 'Georgia, "Songti SC", serif' : '-apple-system, "PingFang SC", sans-serif');
  }, [changeFontFamily, changeFontSize, changeTheme, preferences.fontFamily, preferences.fontSize, theme]);

  useEffect(() => {
    if (!onMetadata) return;
    const metadata = getMeta();
    onMetadata({ title: metadata.title.trim() || null, author: metadata.author.trim() || null });
  }, [getMeta, onMetadata]);

  const syncMetadata = () => {
    if (!onMetadata) return;
    const metadata = getMeta();
    onMetadata({ title: metadata.title.trim() || null, author: metadata.author.trim() || null });
  };

  const saveSelection = (cfiRange: string, text: string) => {
    const value = text.trim();
    if (!value) return true;
    onSelection({
      text: value,
      locator: sourceFormat === 'reflow' ? createReflowLocator(cfiRange, currentChapter.href, currentChapter.title, 0) : createEpubLocator(cfiRange, currentChapter.href, currentChapter.title, 0),
      contextBefore: null,
      contextAfter: null,
    });
    addAnnotation('highlight', cfiRange, {}, { color: palette.accent, opacity: 0.28 });
    removeSelection();
    return true;
  };

  return (
    <View style={[styles.fill, { backgroundColor: palette.background, paddingTop: contentPadding.top, paddingBottom: contentPadding.bottom }]}>
      <View onLayout={(event) => setDimensions({ width: Math.max(1, event.nativeEvent.layout.width), height: Math.max(1, event.nativeEvent.layout.height) })} style={styles.readerFill}>
        <Reader
          key={`${sourceFormat}:${preferences.flow}`}
          src={uri}
          fileSystem={useEpubFileSystem}
          width={dimensions.width}
          height={dimensions.height}
          initialLocation={initialLocator?.type === 'epub-cfi' || initialLocator?.type === 'reflow-cfi' ? initialLocator.cfi || initialLocator.href || undefined : undefined}
          defaultTheme={initialThemeRef.current}
          flow={scrolled ? 'scrolled-continuous' : 'paginated'}
          manager={scrolled ? 'continuous' : 'default'}
          snap={false}
          spread="none"
          enableSwipe={!scrolled}
          keepScrollOffsetOnLocationChange={scrolled}
          enableSelection
          menuItems={[{ label: '摘抄', action: saveSelection }]}
          initialAnnotations={initialAnnotations}
          onReady={() => {
            changeTheme(theme);
            changeFontSize(`${preferences.fontSize}px`);
            changeFontFamily(preferences.fontFamily === 'serif' ? 'Georgia, "Songti SC", serif' : '-apple-system, "PingFang SC", sans-serif');
            syncMetadata();
            onReady();
          }}
          onSingleTap={onSingleTap}
          onDisplayError={(reason) => onError(reason || (sourceFormat === 'reflow' ? '重排书籍无法打开' : 'EPUB 无法打开'))}
          onNavigationLoaded={({ toc }) => onTocChange(flattenToc(toc))}
          onLocationChange={(_total, location, progression, currentSection) => onLocationChange(epubLocationEvent(location, progression, currentSection, sourceFormat === 'reflow'))}
          renderOpeningBookComponent={() => <LoadingReader label="正在排版" color={palette.muted} />}
          openingBookComponentContainerStyle={{ backgroundColor: palette.background }}
        />
      </View>
    </View>
  );
});

const PdfBookReader = forwardRef<ReaderSurfaceHandle, BookReaderProps>(function PdfBookReader({ uri, initialLocator, preferences, contentPadding, palette, onLocationChange, onSelection, onTocChange, onReady, onMetadata, onError, onSingleTap }, ref) {
  const PdfComponent = useMemo(loadPdfComponent, []);
  const initialPageRef = useRef(initialLocator?.type === 'pdf-page' ? initialLocator.page : 1);
  const currentPageRef = useRef(initialPageRef.current);
  const pagePropRef = useRef(initialPageRef.current);
  const pageCountRef = useRef(initialLocator?.type === 'pdf-page' ? initialLocator.pageCount : null);
  const tocRef = useRef<ReaderTocItem[]>([]);
  const horizontalRef = useRef(preferences.pdfHorizontal);
  const pdfRef = useRef<PdfRef>(null);
  const selectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeScale, setActiveScale] = useState(preferences.pdfScale);
  const [loaded, setLoaded] = useState(false);
  const pdfAppearance = useMemo(() => pdfThemeAppearance(preferences.theme, preferences.pdfThemeEnabled, palette.background), [palette.background, preferences.pdfThemeEnabled, preferences.theme]);

  useEffect(() => {
    setActiveScale(preferences.pdfScale);
  }, [preferences.pdfScale]);

  if (horizontalRef.current !== preferences.pdfHorizontal) {
    horizontalRef.current = preferences.pdfHorizontal;
    pagePropRef.current = currentPageRef.current;
  }

  useEffect(() => {
    if (!PdfComponent) onError('PDF 阅读需要 development build；Expo Go 不包含 PDF 原生模块。');
  }, [PdfComponent, onError]);

  useEffect(() => () => {
    if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);
  }, []);

  useEffect(() => setLoaded(false), [uri]);

  useEffect(() => {
    if (!onMetadata) return;
    let active = true;
    void probePdfMetadata(uri).then((metadata) => {
      if (active && (metadata.title || metadata.author)) onMetadata(metadata);
    });
    return () => { active = false; };
  }, [onMetadata, uri]);

  useImperativeHandle(ref, () => ({
    previous: () => pdfRef.current?.setPage(Math.max(1, currentPageRef.current - 1)),
    next: () => pdfRef.current?.setPage(Math.min(pageCountRef.current ?? currentPageRef.current + 1, currentPageRef.current + 1)),
    goTo: (locator) => {
      if (locator.type === 'pdf-page') pdfRef.current?.setPage(Math.min(locator.pageCount ?? pageCountRef.current ?? locator.page, Math.max(1, locator.page)));
    },
    setZoom: (scale) => {
      const nextScale = clampScale(scale);
      setActiveScale(nextScale);
    },
  }), []);

  const emitLocation = (nextPage: number, nextPageCount: number | null) => {
    const count = nextPageCount && nextPageCount > 0 ? nextPageCount : null;
    const currentSection = pdfOutlineSection(tocRef.current, nextPage);
    currentPageRef.current = nextPage;
    pageCountRef.current = count;
    onLocationChange({ locator: createPdfLocator(nextPage, count), progression: count ? (nextPage - 1) / Math.max(1, count - 1) : 0, chapterHref: currentSection?.href ?? null, chapterTitle: currentSection?.label ?? null, pageCount: count });
  };

  if (!PdfComponent) return <NativeModuleUnavailable palette={palette} />;

  return (
    <View style={[styles.fill, { backgroundColor: palette.background, paddingTop: contentPadding.top, paddingBottom: contentPadding.bottom }]}>
      <View style={[styles.readerFill, pdfAppearance.surface]}>
        <PdfComponent
          ref={pdfRef}
          source={{ uri }}
          page={pagePropRef.current}
          scale={activeScale}
          minScale={1}
          maxScale={5}
          horizontal={preferences.pdfHorizontal}
          enablePaging={preferences.pdfHorizontal}
          enableAntialiasing
          enableDoubleTapZoom
          enableAnnotationRendering
          enableTextSelection
          fitPolicy={0}
          spacing={preferences.pdfHorizontal ? 0 : 8}
          scrollEnabled
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          progressContainerStyle={{ backgroundColor: palette.background }}
          onLoadComplete={(count, _path, _size, tableContents) => {
            const firstPage = Math.min(count, Math.max(1, currentPageRef.current));
            const outline = flattenPdfOutline(tableContents);
            pagePropRef.current = firstPage;
            tocRef.current = outline;
            onTocChange(outline);
            emitLocation(firstPage, count);
            setLoaded(true);
            onReady();
          }}
          onPageChanged={(nextPage, count) => emitLocation(nextPage, count)}
          onPageSingleTap={onSingleTap}
          onTextSelectionChange={(event) => {
            if (event.nativeEvent.type !== 'selectionChanged' || !event.nativeEvent.text.trim()) return;
            const selectedText = event.nativeEvent.text.trim();
            if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);
            selectionTimerRef.current = setTimeout(() => onSelection({ text: selectedText, locator: createPdfLocator(currentPageRef.current, pageCountRef.current), contextBefore: null, contextAfter: null }), 350);
          }}
          onScaleChanged={() => {}}
          onError={(cause) => onError(cause instanceof Error ? cause.message : String(cause))}
          renderActivityIndicator={(progress) => <LoadingReader color={palette.muted} label={progress > 0 ? `正在载入 ${Math.round(progress * 100)}%` : '正在载入'} progress={progress} />}
          style={[styles.readerFill, styles.pdfDocument]}
        />
        {loaded && pdfAppearance.overlay ? <View pointerEvents="none" style={[styles.pdfThemeOverlay, pdfAppearance.overlay]} /> : null}
      </View>
    </View>
  );
});

function flattenPdfOutline(items: TableContent[] | undefined, depth = 0): ReaderTocItem[] {
  if (!items?.length) return [];
  return items.flatMap((item) => {
    const title = item.title?.trim();
    const pageIndex = Number(item.pageIdx);
    const page = Number.isFinite(pageIndex) && pageIndex >= 0 ? Math.floor(pageIndex) + 1 : 1;
    const entry: ReaderTocItem[] = title ? [{ href: `pdf:${page}`, label: title, depth }] : [];
    return [...entry, ...flattenPdfOutline(item.children, depth + (title ? 1 : 0))];
  });
}

function pdfOutlineSection(items: ReaderTocItem[], page: number): ReaderTocItem | null {
  let current: { item: ReaderTocItem; page: number } | null = null;
  for (const item of items) {
    const outlinePage = Number(item.href.match(/^pdf:(\d+)$/)?.[1]);
    if (Number.isInteger(outlinePage) && outlinePage > 0 && outlinePage <= page && (!current || outlinePage >= current.page)) current = { item, page: outlinePage };
  }
  return current?.item ?? null;
}

function loadPdfComponent(): typeof Pdf | null {
  if (Constants.appOwnership === AppOwnership.Expo) return null;
  try {
    const module = require('react-native-pdf') as { default?: typeof Pdf };
    return module.default ?? (module as unknown as typeof Pdf);
  } catch {
    return null;
  }
}

async function probePdfMetadata(uri: string): Promise<{ title: string | null; author: string | null }> {
  try {
    const bytes = await new File(uri).bytes();
    const source = new TextDecoder('latin1').decode(bytes);
    return { title: pdfInfoValue(source, 'Title'), author: pdfInfoValue(source, 'Author') };
  } catch {
    return { title: null, author: null };
  }
}

function pdfInfoValue(source: string, key: 'Title' | 'Author'): string | null {
  const match = new RegExp(`\\/${key}\\s+(\\([^)]*(?:\\\\.[^)]*)*\\)|<([\\da-fA-F]+)>)`).exec(source);
  if (!match) return null;
  if (match[2]) {
    const hex = match[2].length % 2 === 0 ? match[2] : `${match[2]}0`;
    const bytes = Uint8Array.from(hex.match(/.{2}/g) ?? [], (part) => Number.parseInt(part, 16));
    return cleanPdfMetadata(new TextDecoder('utf-8').decode(bytes)) ?? cleanPdfMetadata(new TextDecoder('latin1').decode(bytes));
  }
  return cleanPdfMetadata(match[1].slice(1, -1).replace(/\\([\\()])/g, '$1').replace(/\\n/g, '\n').replace(/\\r/g, '\r'));
}

function cleanPdfMetadata(value: string): string | null {
  const cleaned = value.replace(/^\\uFEFF/, '').trim();
  return cleaned || null;
}

function epubLocationEvent(location: Location, progression: number, section: Section | null, reflow: boolean): ReaderLocationEvent {
  const safeProgression = normalizeEpubProgression(progression, location.start.percentage);
  return {
    locator: reflow ? createReflowLocator(location.start.cfi, location.start.href, section?.label ?? null, safeProgression) : createEpubLocator(location.start.cfi, location.start.href, section?.label ?? null, safeProgression),
    progression: safeProgression,
    chapterHref: section?.href ?? location.start.href,
    chapterTitle: section?.label ?? null,
    pageCount: null,
  };
}

function normalizeEpubProgression(progression: number, fallback: number): number {
  const value = Number.isFinite(progression) ? progression : fallback;
  return Math.max(0, Math.min(1, value > 1 ? value / 100 : value));
}

function flattenToc(items: Toc, depth = 0): ReaderTocItem[] {
  return items.flatMap((item) => [
    { href: item.href, label: item.label.trim() || '未命名章节', depth },
    ...flattenToc((item.subitems ?? []) as Toc, depth + 1),
  ]);
}

function epubTheme(preferences: ReadingPreferences, palette: BookReaderProps['palette']): Theme {
  const family = preferences.fontFamily === 'serif' ? 'Georgia, "Songti SC", serif' : '-apple-system, "PingFang SC", sans-serif';
  return {
    'html, body': { background: `${palette.background} !important`, color: `${palette.text} !important` },
    body: { paddingRight: `${preferences.pageMargin}px !important`, paddingLeft: `${preferences.pageMargin}px !important`, fontFamily: `${family} !important`, fontSize: `${preferences.fontSize}px !important`, lineHeight: `${preferences.lineHeight} !important`, overflowWrap: 'break-word !important' },
    'article, section, main, div, p, li, blockquote, span, td, th, dt, dd, figcaption': { background: 'transparent !important', color: `${palette.text} !important`, fontFamily: `${family} !important`, lineHeight: `${preferences.lineHeight} !important`, letterSpacing: '0 !important' },
    'h1, h2, h3, h4': { color: `${palette.text} !important`, fontFamily: `${family} !important`, letterSpacing: '0 !important' },
    a: { color: `${palette.accent} !important` },
    'img, svg, video': { maxWidth: '100% !important', height: 'auto !important' },
    '::selection': { background: `${palette.accent}55` },
  };
}

function pdfThemeAppearance(theme: ReaderTheme, enabled: boolean, background: string): { surface: ViewStyle; overlay: ViewStyle | null } {
  if (!enabled) return { surface: { backgroundColor: background }, overlay: null };
  const blendModeSupported = Platform.OS !== 'android' || Number(Platform.Version) >= 29;
  if (blendModeSupported) {
    return {
      surface: { backgroundColor: '#FFFFFF', isolation: 'isolate' },
      overlay: theme === 'night'
        ? { backgroundColor: invertHex(background), mixBlendMode: 'difference' }
        : { backgroundColor: background, mixBlendMode: 'multiply' },
    };
  }
  if (theme === 'night') return { surface: { backgroundColor: '#FFFFFF', filter: [{ invert: 1 }, { brightness: 0.94 }] }, overlay: null };
  if (theme === 'warm') return { surface: { backgroundColor: '#FFFFFF', filter: [{ sepia: 0.24 }, { saturate: 0.82 }, { brightness: 0.98 }] }, overlay: null };
  if (theme === 'green') return { surface: { backgroundColor: '#FFFFFF', filter: [{ sepia: 0.14 }, { hueRotate: 72 }, { saturate: 0.74 }, { brightness: 0.98 }] }, overlay: null };
  return { surface: { backgroundColor: background }, overlay: null };
}

function invertHex(value: string): string {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(value);
  if (!match) return '#EAE6E9';
  return `#${match.slice(1).map((part) => (255 - Number.parseInt(part, 16)).toString(16).padStart(2, '0')).join('')}`;
}

function LoadingReader({ label, color, progress }: { label: string; color: string; progress?: number }) {
  const normalizedProgress = typeof progress === 'number' && Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : null;
  return <View style={styles.loading}><ActivityIndicator color={color} /><Text style={[styles.loadingText, { color }]}>{label}</Text>{normalizedProgress !== null ? <View style={styles.loadingTrack}><View style={[styles.loadingFill, { width: `${Math.round(normalizedProgress * 100)}%`, backgroundColor: color }]} /></View> : null}</View>;
}

function NativeModuleUnavailable({ palette }: { palette: BookReaderProps['palette'] }) {
  return <View style={[styles.loading, { backgroundColor: palette.background }]}><Text style={[styles.loadingText, { color: palette.text }]}>PDF 阅读需要 development build</Text><Text style={[styles.moduleHint, { color: palette.muted }]}>Expo Go 不包含 PDF 原生模块</Text></View>;
}

function ReaderConversionError({ message, palette }: { message: string; palette: BookReaderProps['palette'] }) {
  return <View style={[styles.loading, { backgroundColor: palette.background }]}><Text style={[styles.loadingText, { color: palette.text }]}>书籍转换失败</Text><Text style={[styles.moduleHint, { color: palette.muted }]}>{message}</Text></View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  readerFill: { flex: 1 },
  pdfDocument: { backgroundColor: 'transparent' },
  pdfThemeOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, fontSize: 12 },
  loadingTrack: { width: 148, height: 4, marginTop: 10, overflow: 'hidden', borderRadius: 2, backgroundColor: 'rgba(116, 122, 116, 0.18)' },
  loadingFill: { height: '100%', borderRadius: 2 },
  moduleHint: { marginTop: 6, fontSize: 12 },
});

function clampScale(value: number): number {
  return Number.isFinite(value) ? Math.min(5, Math.max(1, value)) : 1;
}
