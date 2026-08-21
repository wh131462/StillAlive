import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import Constants, { AppOwnership } from 'expo-constants';
import { Reader, useReader } from '@epubjs-react-native/core';
import type { Annotation, Location, Section, Theme, Toc } from '@epubjs-react-native/core';
import type Pdf from 'react-native-pdf';
import type { Book, BookExcerpt, ReaderTocItem, ReadingPreferences } from '@still-alive/types';
import type { BookLocator, ReaderLocationEvent, ReaderSelection, ReaderSurfaceHandle } from './book-reader';
import { createEpubLocator, createPdfLocator } from './book-reader';
import { useEpubFileSystem } from './epub-file-system';

interface BookReaderProps {
  book: Book;
  uri: string;
  initialLocator: BookLocator | null;
  preferences: ReadingPreferences;
  excerpts: BookExcerpt[];
  palette: { background: string; text: string; muted: string; accent: string };
  onLocationChange(event: ReaderLocationEvent): void;
  onSelection(selection: ReaderSelection): void;
  onTocChange(toc: ReaderTocItem[]): void;
  onReady(): void;
  onError(message: string): void;
  onSingleTap(): void;
}

export const BookReader = forwardRef<ReaderSurfaceHandle, BookReaderProps>(function BookReader(props, ref) {
  if (props.book.format === 'epub') return <EpubBookReader {...props} ref={ref} />;
  if (props.book.format === 'pdf') return <PdfBookReader {...props} ref={ref} />;
  return null;
});

const EpubBookReader = forwardRef<ReaderSurfaceHandle, BookReaderProps>(function EpubBookReader({ uri, initialLocator, preferences, excerpts, palette, onLocationChange, onSelection, onTocChange, onReady, onError, onSingleTap }, ref) {
  const { addAnnotation, changeFlow, changeFontFamily, changeFontSize, changeTheme, goNext, goPrevious, goToLocation, removeSelection, section } = useReader();
  const [dimensions, setDimensions] = useState({ width: 1, height: 1 });
  const theme = useMemo(() => epubTheme(preferences, palette), [palette, preferences]);
  const initialAnnotations = useMemo(() => excerpts.flatMap<Annotation>((excerpt) => excerpt.locationType === 'epub-cfi' && excerpt.location?.startsWith('epubcfi(') ? [{ type: 'highlight', cfiRange: excerpt.location, cfiRangeText: excerpt.text, sectionIndex: 0, data: { excerptId: excerpt.id }, styles: { color: palette.accent, opacity: 0.28 } }] : []), [excerpts, palette.accent]);
  const currentChapter = section ? { href: section.href, title: section.label } : { href: initialLocator?.type === 'epub-cfi' ? initialLocator.href : null, title: initialLocator?.type === 'epub-cfi' ? initialLocator.chapterTitle : null };

  useImperativeHandle(ref, () => ({
    previous: goPrevious,
    next: goNext,
    goTo: (locator) => {
      if (locator.type === 'epub-cfi') goToLocation(locator.cfi || locator.href || '');
    },
  }), [goNext, goPrevious, goToLocation]);

  useEffect(() => {
    changeTheme(theme);
    changeFontSize(`${preferences.fontSize}px`);
    changeFontFamily(preferences.fontFamily === 'serif' ? 'Georgia, "Songti SC", serif' : '-apple-system, "PingFang SC", sans-serif');
    changeFlow(preferences.flow === 'scrolled' ? 'scrolled-doc' : 'paginated');
  }, [changeFlow, changeFontFamily, changeFontSize, changeTheme, preferences.flow, preferences.fontFamily, preferences.fontSize, theme]);

  const saveSelection = (cfiRange: string, text: string) => {
    const value = text.trim();
    if (!value) return true;
    onSelection({
      text: value,
      locator: createEpubLocator(cfiRange, currentChapter.href, currentChapter.title, 0),
      contextBefore: null,
      contextAfter: null,
    });
    addAnnotation('highlight', cfiRange, {}, { color: palette.accent, opacity: 0.28 });
    removeSelection();
    return true;
  };

  return (
    <View onLayout={(event) => setDimensions({ width: Math.max(1, event.nativeEvent.layout.width), height: Math.max(1, event.nativeEvent.layout.height) })} style={styles.fill}>
      <Reader
        src={uri}
        fileSystem={useEpubFileSystem}
        width={dimensions.width}
        height={dimensions.height}
        initialLocation={initialLocator?.type === 'epub-cfi' ? initialLocator.cfi || initialLocator.href || undefined : undefined}
        defaultTheme={theme}
        flow={preferences.flow === 'scrolled' ? 'scrolled-doc' : 'paginated'}
        manager={preferences.flow === 'scrolled' ? 'continuous' : 'default'}
        enableSelection
        menuItems={[{ label: '摘抄', action: saveSelection }]}
        initialAnnotations={initialAnnotations}
        onReady={() => onReady()}
        onSingleTap={onSingleTap}
        onDisplayError={(reason) => onError(reason || 'EPUB 无法打开')}
        onNavigationLoaded={({ toc }) => onTocChange(flattenToc(toc))}
        onLocationChange={(_total, location, progression, currentSection) => onLocationChange(epubLocationEvent(location, progression, currentSection))}
        renderOpeningBookComponent={() => <LoadingReader label="正在排版" color={palette.muted} />}
        openingBookComponentContainerStyle={{ backgroundColor: palette.background }}
      />
    </View>
  );
});

const PdfBookReader = forwardRef<ReaderSurfaceHandle, BookReaderProps>(function PdfBookReader({ uri, initialLocator, preferences, palette, onLocationChange, onSelection, onReady, onError, onSingleTap }, ref) {
  const PdfComponent = useMemo(loadPdfComponent, []);
  const [page, setPage] = useState(initialLocator?.type === 'pdf-page' ? initialLocator.page : 1);
  const [pageCount, setPageCount] = useState(initialLocator?.type === 'pdf-page' ? initialLocator.pageCount : null);
  const selectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!PdfComponent) onError('PDF 阅读需要 development build；Expo Go 不包含 PDF 原生模块。');
  }, [PdfComponent, onError]);

  useEffect(() => () => {
    if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);
  }, []);

  useImperativeHandle(ref, () => ({
    previous: () => setPage((current) => Math.max(1, current - 1)),
    next: () => setPage((current) => Math.min(pageCount ?? current + 1, current + 1)),
    goTo: (locator) => {
      if (locator.type === 'pdf-page') setPage(Math.min(locator.pageCount ?? pageCount ?? locator.page, Math.max(1, locator.page)));
    },
  }), [pageCount]);

  const emitLocation = (nextPage: number, nextPageCount: number | null) => {
    const count = nextPageCount && nextPageCount > 0 ? nextPageCount : null;
    setPage(nextPage);
    setPageCount(count);
    onLocationChange({ locator: createPdfLocator(nextPage, count), progression: count ? (nextPage - 1) / Math.max(1, count - 1) : 0, chapterHref: null, chapterTitle: null, pageCount: count });
  };

  if (!PdfComponent) return <NativeModuleUnavailable palette={palette} />;

  return (
    <PdfComponent
      source={{ uri }}
      page={page}
      scale={preferences.pdfScale}
      minScale={1}
      maxScale={5}
      horizontal={preferences.pdfHorizontal}
      enablePaging={preferences.pdfHorizontal}
      enableAnnotationRendering
      enableTextSelection={Platform.OS === 'ios'}
      fitPolicy={0}
      spacing={8}
      onLoadComplete={(count) => {
        emitLocation(page, count);
        onReady();
      }}
      onPageChanged={(nextPage, count) => emitLocation(nextPage, count)}
      onPageSingleTap={onSingleTap}
      onTextSelectionChange={(event) => {
        if (event.nativeEvent.type !== 'selectionChanged' || !event.nativeEvent.text.trim()) return;
        const selectedText = event.nativeEvent.text.trim();
        if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);
        selectionTimerRef.current = setTimeout(() => onSelection({ text: selectedText, locator: createPdfLocator(page, pageCount), contextBefore: null, contextAfter: null }), 350);
      }}
      onError={(cause) => onError(cause instanceof Error ? cause.message : String(cause))}
      renderActivityIndicator={() => <LoadingReader label="正在载入" color={palette.muted} />}
      style={[styles.fill, { backgroundColor: palette.background }]}
    />
  );
});

function loadPdfComponent(): typeof Pdf | null {
  if (Constants.appOwnership === AppOwnership.Expo) return null;
  try {
    const module = require('react-native-pdf') as { default?: typeof Pdf };
    return module.default ?? (module as unknown as typeof Pdf);
  } catch {
    return null;
  }
}

function epubLocationEvent(location: Location, progression: number, section: Section | null): ReaderLocationEvent {
  const safeProgression = Number.isFinite(progression) ? progression : location.start.percentage;
  return {
    locator: createEpubLocator(location.start.cfi, location.start.href, section?.label ?? null, safeProgression),
    progression: safeProgression,
    chapterHref: section?.href ?? location.start.href,
    chapterTitle: section?.label ?? null,
    pageCount: null,
  };
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
    body: { paddingLeft: `${preferences.pageMargin}px !important`, paddingRight: `${preferences.pageMargin}px !important`, fontFamily: `${family} !important`, fontSize: `${preferences.fontSize}px !important`, lineHeight: `${preferences.lineHeight} !important` },
    'p, li, blockquote': { color: `${palette.text} !important`, fontFamily: `${family} !important`, lineHeight: `${preferences.lineHeight} !important`, letterSpacing: '0 !important' },
    'h1, h2, h3, h4': { color: `${palette.text} !important`, fontFamily: `${family} !important`, letterSpacing: '0 !important' },
    a: { color: `${palette.accent} !important` },
    '::selection': { background: `${palette.accent}55` },
  };
}

function LoadingReader({ label, color }: { label: string; color: string }) {
  return <View style={styles.loading}><ActivityIndicator color={color} /><Text style={[styles.loadingText, { color }]}>{label}</Text></View>;
}

function NativeModuleUnavailable({ palette }: { palette: BookReaderProps['palette'] }) {
  return <View style={[styles.loading, { backgroundColor: palette.background }]}><Text style={[styles.loadingText, { color: palette.text }]}>PDF 阅读需要 development build</Text><Text style={[styles.moduleHint, { color: palette.muted }]}>Expo Go 不包含 PDF 原生模块</Text></View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, fontSize: 12 },
  moduleHint: { marginTop: 6, fontSize: 12 },
});
