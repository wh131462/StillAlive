import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentProps, PropsWithChildren } from 'react';
import { Animated, AppState, Easing, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { feedback } from '../../shared/feedback';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Battery from 'expo-battery';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { Book, BookExcerpt, Media, ReaderTheme, ReaderTocItem, ReadingPreferences } from '@still-alive/types';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { DraggableBottomSheet } from '../../shared/components/draggable-bottom-sheet';
import { getSystemFontFamilies } from '../../infrastructure/platform/system-fonts';
import { BookReader } from './book-reader-view';
import { useAppState } from '../../application/state/app-state';
import { createThemedStyles } from '../../shared/theme/app-theme';
import type { BookLocator, ReaderLocationEvent, ReaderSelection, ReaderSurfaceHandle } from './book-reader';
import { createEpubLocator, createPdfLocator, createReflowLocator, detectReaderCapability, locatorFromBook, pageFromBookLocation, ReaderSessionController, readingPreferencesForBook, serializeBookLocator, updateReadingPreferencesJson } from './book-reader';

type ReaderSheet = 'library' | 'display' | 'font' | 'jump' | 'info' | null;
type LibraryTab = 'toc' | 'excerpts' | 'notes';

const READER_THEMES: Array<{ id: ReaderTheme; label: string; swatch: string }> = [
  { id: 'paper', label: '纸白', swatch: '#F8F8F4' },
  { id: 'warm', label: '暖黄', swatch: '#EEE3C9' },
  { id: 'green', label: '护眼', swatch: '#E6F0DC' },
  { id: 'night', label: '夜间', swatch: '#151916' },
];

const READER_LOCATION_WRITE_DELAY_MS = 800;

export default function ReaderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { books, bookExcerpts, createBookExcerpt, deleteBookExcerpt, media, preferences, updateBook, updatePreferences } = useAppState();
  const book = books.find((item) => item.id === id);
  const file = book ? media.find((item) => item.id === book.fileMediaId) : null;
  const excerpts = useMemo(() => bookExcerpts.filter((item) => item.bookId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [bookExcerpts, id]);
  const readerRef = useRef<ReaderSurfaceHandle>(null);
  const pendingLocationRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestLocationEventRef = useRef<ReaderLocationEvent | null>(null);
  const latestLocationKeyRef = useRef<string | null>(null);
  const bookRef = useRef(book);
  const controlsProgress = useRef(new Animated.Value(0)).current;
  const [controlsVisible, setControlsVisible] = useState(false);
  const [sheet, setSheet] = useState<ReaderSheet>(null);
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('toc');
  const [toc, setToc] = useState<ReaderTocItem[]>(book?.chapterCache ?? []);
  const [location, setLocation] = useState<BookLocator | null>(() => book ? locatorFromBook(book) : null);
  const [excerptDraft, setExcerptDraft] = useState('');
  const [pendingSelection, setPendingSelection] = useState<ReaderSelection | null>(null);
  const [jumpDraft, setJumpDraft] = useState(() => String(book ? pageFromBookLocation(book.location) : 1));
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [fontSearch, setFontSearch] = useState('');
  const [systemFonts, setSystemFonts] = useState<string[]>([]);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const readingPreferences = useMemo(() => book ? readingPreferencesForBook(preferences.readerPreferencesJson, book.id) : null, [book?.id, preferences.readerPreferencesJson]);
  const palette = useMemo(() => readerPalette(readingPreferences?.theme ?? 'paper'), [readingPreferences?.theme]);

  useEffect(() => {
    bookRef.current = book;
  }, [book]);

  useEffect(() => {
    if (sheet !== 'font' || fontsLoaded) return;
    let active = true;
    void getSystemFontFamilies().then((families) => {
      if (active) setSystemFonts(families);
    }).finally(() => {
      if (active) setFontsLoaded(true);
    });
    return () => { active = false; };
  }, [fontsLoaded, sheet]);

  const persistBookPatch = useCallback((changes: Partial<Book>) => {
    const currentBook = bookRef.current;
    if (!currentBook) return;
    const nextBook = { ...currentBook, ...changes, updatedAt: new Date().toISOString() };
    bookRef.current = nextBook;
    void updateBook(nextBook);
  }, [updateBook]);

  const handleMetadata = useCallback(({ title, author }: { title: string | null; author: string | null }) => {
    const currentBook = bookRef.current;
    if (!currentBook) return;
    const fallbackTitle = file?.originalName?.replace(/\.[^.]+$/, '').trim() || '';
    const canUseMetadataTitle = Boolean(title && (!currentBook.title.trim() || currentBook.title === '未命名书籍' || currentBook.title === fallbackTitle));
    const nextTitle = canUseMetadataTitle && title ? title : currentBook.title;
    const nextAuthor = currentBook.author ?? author;
    if (nextTitle === currentBook.title && nextAuthor === currentBook.author) return;
    persistBookPatch({ title: nextTitle, author: nextAuthor });
  }, [file?.originalName, persistBookPatch]);

  const flushLocation = useCallback(() => {
    const event = latestLocationEventRef.current;
    const currentBook = bookRef.current;
    if (!event || !currentBook) return;
    latestLocationEventRef.current = null;
    if (pendingLocationRef.current) clearTimeout(pendingLocationRef.current);
    pendingLocationRef.current = null;
    const nextBook = new ReaderSessionController(currentBook).applyLocation(event);
    bookRef.current = nextBook;
    void updateBook(nextBook);
  }, [updateBook]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') flushLocation();
    });
    return () => {
      subscription.remove();
      flushLocation();
    };
  }, [flushLocation]);

  useEffect(() => {
    const animation = Animated.timing(controlsProgress, {
      toValue: controlsVisible ? 1 : 0,
      duration: controlsVisible ? 210 : 180,
      easing: controlsVisible ? Easing.out(Easing.cubic) : Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [controlsProgress, controlsVisible]);

  if (!book || !readingPreferences) return <SafeAreaView style={styles.missingSafe}><Text style={styles.missing}>书籍不存在。</Text></SafeAreaView>;

  const session = new ReaderSessionController(book);
  const capability = detectReaderCapability(book);
  const readable = capability.status === 'ready' && Boolean(file) && !runtimeError;
  const immersive = readable && !controlsVisible && sheet === null;
  const currentPdfTocItem = book.format === 'pdf' && location?.type === 'pdf-page' ? pdfTocItemAtPage(toc, location.page) : null;
  const currentChapterTitle = currentPdfTocItem?.label ?? chapterTitleFromLocator(location) ?? (book.chapterTitle?.trim() || null);
  const immersiveChapterTitle = currentChapterTitle ?? book.title;

  // 阅读控制栏是覆盖层，不应参与正文布局。固定安全区可以避免展开/收起时
  // EPUB 重新分页或 PDF 可视区域变化，导致正文跳动。
  const readerContentPadding = {
    top: Math.max(40, insets.top + 28),
    bottom: insets.bottom + 44,
  };

  const persistLocation = (event: ReaderLocationEvent) => {
    const key = readerLocationEventKey(book.id, event);
    if (latestLocationKeyRef.current === key) return;
    latestLocationKeyRef.current = key;
    setLocation(event.locator);
    latestLocationEventRef.current = event;
    if (pendingLocationRef.current) clearTimeout(pendingLocationRef.current);
    pendingLocationRef.current = setTimeout(flushLocation, READER_LOCATION_WRITE_DELAY_MS);
  };

  const persistPreferences = (next: ReadingPreferences) => {
    void updatePreferences({ readerPreferencesJson: updateReadingPreferencesJson(preferences.readerPreferencesJson, book.id, next) });
  };

  const handleTocChange = (items: ReaderTocItem[]) => {
    setToc(items);
    if (sameToc(items, bookRef.current?.chapterCache ?? [])) return;
    persistBookPatch({ chapterCache: items, engineVersion: session.adapter.engineVersion });
  };

  const openLibrary = (tab: LibraryTab) => {
    setLibraryTab(tab);
    setSheet('library');
  };

  const handleSelection = (selection: ReaderSelection) => {
    setPendingSelection(selection);
    setExcerptDraft(selection.text);
    openLibrary('excerpts');
  };

  const saveExcerpt = async () => {
    const text = excerptDraft.trim();
    if (!text || text.length > 20_000) {
      feedback.alert('无法保存', '摘抄不能为空且不能超过 20000 字。');
      return;
    }
    const locator = pendingSelection?.locator ?? manualLocator(book.format, location, book.chapterTitle ?? null);
    try {
      await createBookExcerpt({
        id: `excerpt_${Date.now()}`,
        bookId: book.id,
        text,
        location: serializeBookLocator(locator),
        locationType: locator.type,
        chapterTitle: locator.type === 'epub-cfi' || locator.type === 'reflow-cfi' ? locator.chapterTitle : book.chapterTitle ?? null,
        contextBefore: pendingSelection?.contextBefore ?? null,
        contextAfter: pendingSelection?.contextAfter ?? null,
        sourceKind: pendingSelection ? 'selection' : 'manual',
        note: null,
        createdAt: new Date().toISOString(),
      });
      setExcerptDraft('');
      setPendingSelection(null);
    } catch (cause) {
      feedback.alert('保存失败', cause instanceof Error ? cause.message : '请稍后重试。');
    }
  };

  const removeExcerpt = (excerptId: string) => {
    feedback.alert('删除这条书摘？', '已引用到读书笔记中的文字快照不会受到影响。', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => void deleteBookExcerpt(excerptId) },
    ]);
  };

  const writeNote = (sourceExcerptId?: string) => {
    setSheet(null);
    router.push({ pathname: '/editor', params: { sourceBookId: book.id, ...(sourceExcerptId ? { sourceExcerptId } : {}) } });
  };

  const jumpToPage = () => {
    const target = Number(jumpDraft);
    const pageCount = location?.type === 'pdf-page' ? location.pageCount : book.pageCount ?? null;
    if (!Number.isInteger(target) || target < 1 || (pageCount !== null && target > pageCount)) {
      feedback.alert('页码无效', pageCount ? `请输入 1 至 ${pageCount} 之间的整数。` : '请输入大于 0 的整数。');
      return;
    }
    const locator = createPdfLocator(target, pageCount);
    readerRef.current?.goTo(locator);
    setLocation(locator);
    setSheet(null);
  };

  const setPdfZoom = (scale: number) => {
    if (!session.capabilities.zoom) return;
    const nextScale = Math.min(5, Math.max(1, Number(scale.toFixed(2))));
    readerRef.current?.setZoom?.(nextScale);
    persistPreferences({ ...readingPreferences, pdfScale: nextScale });
  };

  const selectFont = (fontName: string | null, fontFamily = readingPreferences.fontFamily) => {
    persistPreferences({ ...readingPreferences, fontFamily, fontName });
    setSheet('display');
  };

  const locationLabel = formatLocation(book.format, location, book.progress);
  const hudProgressLabel = formatHudProgress(book.format, location, book.progress);
  const currentTocHref = currentTocItemHref(book.format, location, book.chapterHref ?? null, toc);
  const controlBarOpacity = controlsProgress;
  const immersiveHudOpacity = controlsProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const fontSearchValue = fontSearch.trim().toLocaleLowerCase();
  const visibleSystemFonts = fontSearchValue
    ? systemFonts.filter((name) => name.toLocaleLowerCase().includes(fontSearchValue))
    : systemFonts;
  const selectedFontLabel = readingPreferences.fontName
    ?? (readingPreferences.fontFamily === 'serif' ? '默认衬线' : '默认无衬线');

  return (
    <SafeAreaView edges={[]} style={[styles.safe, { backgroundColor: palette.background }]}>
      <StatusBar animated hidden={readable && !readingPreferences.showStatusBar} hideTransitionAnimation="fade" style={readingPreferences.theme === 'night' ? 'light' : 'dark'} />

      <Animated.View
        accessibilityElementsHidden={!controlsVisible}
        importantForAccessibility={controlsVisible ? 'auto' : 'no-hide-descendants'}
        pointerEvents={controlsVisible ? 'auto' : 'none'}
        style={[
          styles.header,
          {
            minHeight: 54 + insets.top,
            paddingTop: insets.top,
            backgroundColor: palette.background,
            borderBottomColor: palette.line,
            opacity: controlBarOpacity,
            transform: [{ translateY: controlsProgress.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
          },
        ]}
      >
        <IconButton label="返回书架" name={{ android: 'chevron_left', ios: 'chevron.left', web: 'chevron_left' }} onPress={() => { flushLocation(); router.back(); }} tint={palette.text} />
        <View style={styles.headerCopy}>
          <Text ellipsizeMode="tail" numberOfLines={1} style={[styles.headerTitle, { color: palette.text }]}>{book.title}</Text>
        </View>
        <IconButton label="查看阅读信息" name={{ android: 'info', ios: 'info.circle', web: 'info' }} onPress={() => setSheet('info')} tint={palette.text} />
      </Animated.View>

      <View style={[styles.readerSurface, { backgroundColor: palette.background }]}>
        {readable && file ? (
          <BookReader
            ref={readerRef}
            book={book}
            uri={file.localPath}
            initialLocator={location ?? session.initialLocator}
            preferences={readingPreferences}
            contentPadding={readerContentPadding}
            excerpts={excerpts}
            palette={palette}
            onLocationChange={persistLocation}
            onSelection={handleSelection}
            onTocChange={handleTocChange}
            onReady={() => {
              if (bookRef.current?.engineVersion !== session.adapter.engineVersion) persistBookPatch({ engineVersion: session.adapter.engineVersion });
            }}
            onMetadata={handleMetadata}
            onError={(message) => setRuntimeError(message || '书籍无法打开')}
            onSingleTap={() => setControlsVisible((visible) => !visible)}
          />
        ) : (
          <ReaderError palette={palette} status={runtimeError ? (isProtectedReaderError(runtimeError) ? 'protected' : 'failed') : capability.status} message={runtimeError || capability.message || (file ? null : '书籍文件不存在')} onBack={() => router.back()} />
        )}

        {readable && sheet === null ? (
          <Animated.View
            accessibilityElementsHidden={!immersive}
            importantForAccessibility={immersive ? 'auto' : 'no-hide-descendants'}
            pointerEvents="none"
            style={[
              styles.immersiveChapterLayer,
              {
                top: insets.top + spacing.xs,
                opacity: immersiveHudOpacity,
                transform: [{ translateY: controlsProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }],
              },
            ]}
          >
            <Text ellipsizeMode="tail" numberOfLines={1} style={[styles.immersiveChapterTitle, { color: palette.muted }]}>{immersiveChapterTitle}</Text>
          </Animated.View>
        ) : null}

        {readable && sheet === null ? (
          <Animated.View
            accessibilityElementsHidden={!immersive}
            importantForAccessibility={immersive ? 'auto' : 'no-hide-descendants'}
            pointerEvents={immersive ? 'auto' : 'none'}
            style={[
              styles.immersiveHudLayer,
              {
                bottom: Math.max(spacing.xs, insets.bottom + spacing.xs),
                opacity: immersiveHudOpacity,
                transform: [{ translateY: controlsProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 8] }) }],
              },
            ]}
          >
            <ImmersiveReaderHud progressLabel={hudProgressLabel} onOpenControls={() => setControlsVisible(true)} palette={palette} />
          </Animated.View>
        ) : null}
      </View>

      <Animated.View
        accessibilityElementsHidden={!controlsVisible}
        importantForAccessibility={controlsVisible ? 'auto' : 'no-hide-descendants'}
        pointerEvents={controlsVisible ? 'auto' : 'none'}
        style={[
          styles.bottomControls,
          {
            paddingBottom: insets.bottom,
            backgroundColor: palette.background,
            borderTopColor: palette.line,
            opacity: controlBarOpacity,
            transform: [{ translateY: controlsProgress.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
          },
        ]}
      >
        <View style={styles.positionControls}>
          <Pressable accessibilityLabel="上一页或上一章" disabled={!readable} onPress={() => readerRef.current?.previous()} style={({ pressed }) => [styles.positionAction, !readable && styles.disabled, pressed && styles.pressed]}><Text style={[styles.positionActionText, { color: palette.text }]}>上一页</Text></Pressable>
          <Pressable accessibilityLabel={book.format === 'pdf' ? '跳转页码' : '当前阅读位置'} disabled={!session.capabilities.pageJump} onPress={() => {
            if (!session.capabilities.pageJump) return;
            setJumpDraft(String(location?.type === 'pdf-page' ? location.page : 1));
            setSheet('jump');
          }} style={styles.positionLabel}><Text style={[styles.positionText, { color: palette.text }]}>{locationLabel}</Text></Pressable>
          <Pressable accessibilityLabel="下一页或下一章" disabled={!readable} onPress={() => readerRef.current?.next()} style={({ pressed }) => [styles.positionAction, !readable && styles.disabled, pressed && styles.pressed]}><Text style={[styles.positionActionText, { color: palette.text }]}>下一页</Text></Pressable>
        </View>
        <View style={styles.readerTools}>
          <ReaderTool icon={{ android: 'menu_book', ios: 'list.bullet', web: 'menu_book' }} label="目录" disabled={!session.capabilities.toc} onPress={() => openLibrary('toc')} tint={palette.muted} />
          <ReaderTool icon={{ android: 'format_quote', ios: 'quote.bubble', web: 'format_quote' }} label={excerpts.length ? `书摘 ${excerpts.length}` : '书摘'} onPress={() => openLibrary('excerpts')} tint={palette.muted} />
          <ReaderTool icon={{ android: 'edit_note', ios: 'square.and.pencil', web: 'edit_note' }} label="笔记" onPress={() => openLibrary('notes')} tint={palette.muted} />
          <ReaderTool icon={{ android: 'text_fields', ios: 'textformat', web: 'text_fields' }} label="设置" onPress={() => setSheet('display')} tint={palette.muted} />
        </View>
      </Animated.View>

      <ReaderSheetShell onClose={() => setSheet(null)} open={sheet === 'jump'} palette={palette} paddingBottom={Math.max(spacing.lg, insets.bottom + spacing.md)} title="跳转页码">
        <Text style={[styles.sheetHint, { color: palette.muted }]}>{location?.type === 'pdf-page' && location.pageCount ? `全书共 ${location.pageCount} 页` : '页数载入后将自动校验范围'}</Text>
        <TextInput autoFocus keyboardType="number-pad" maxLength={6} onChangeText={setJumpDraft} onSubmitEditing={jumpToPage} placeholder="输入页码" placeholderTextColor={palette.muted} returnKeyType="done" selectTextOnFocus style={[styles.sheetInput, { backgroundColor: palette.background, color: palette.text }]} value={jumpDraft} />
        <Pressable onPress={jumpToPage} style={({ pressed }) => [styles.primaryAction, { backgroundColor: palette.accent }, pressed && styles.pressed]}><Text style={styles.primaryActionText}>前往该页</Text></Pressable>
      </ReaderSheetShell>

      <ReaderSheetShell compact onClose={() => setSheet(null)} open={sheet === 'info'} palette={palette} paddingBottom={Math.max(spacing.lg, insets.bottom + spacing.md)} title="阅读信息">
        <ReadingInfoPanel book={book} file={file ?? null} locationLabel={currentChapterTitle ?? locationLabel} outlineCount={toc.length} palette={palette} progressLabel={readingProgressLabel(book, location)} />
      </ReaderSheetShell>

      <ReaderSheetShell onClose={() => setSheet(null)} open={sheet === 'library'} palette={palette} paddingBottom={Math.max(spacing.lg, insets.bottom + spacing.md)} title="阅读工具">
        <View style={[styles.tabs, { borderBottomColor: palette.line }]}>
          <SheetTab active={libraryTab === 'toc'} disabled={!session.capabilities.toc} label="目录" onPress={() => setLibraryTab('toc')} palette={palette} />
          <SheetTab active={libraryTab === 'excerpts'} label={`书摘 ${excerpts.length}`} onPress={() => setLibraryTab('excerpts')} palette={palette} />
          <SheetTab active={libraryTab === 'notes'} label="笔记" onPress={() => setLibraryTab('notes')} palette={palette} />
        </View>
        {libraryTab === 'toc' ? <TocPanel currentHref={currentTocHref} items={toc} onSelect={(item) => {
          const locator = tocItemLocator(book, location, item);
          if (locator) readerRef.current?.goTo(locator);
          setSheet(null);
        }} palette={palette} /> : null}
        {libraryTab === 'excerpts' ? <ExcerptPanel draft={excerptDraft} excerpts={excerpts} manual={!session.capabilities.selection || !pendingSelection} onChangeDraft={setExcerptDraft} onDelete={removeExcerpt} onSave={() => void saveExcerpt()} onWrite={writeNote} palette={palette} /> : null}
        {libraryTab === 'notes' ? <View style={styles.notesPanel}><Text style={[styles.notesTitle, { color: palette.text }]}>关于《{book.title}》</Text><Text style={[styles.notesCopy, { color: palette.muted }]}>笔记会进入时间线，并保留当前书籍来源。</Text><Pressable onPress={() => writeNote()} style={[styles.primaryAction, { backgroundColor: palette.accent }]}><Text style={styles.primaryActionText}>写读书笔记</Text></Pressable></View> : null}
      </ReaderSheetShell>

      <ReaderSheetShell compact onClose={() => setSheet(null)} open={sheet === 'display'} palette={palette} paddingBottom={Math.max(spacing.md, insets.bottom + spacing.sm)} title="显示设置">
        <ScrollView contentContainerStyle={styles.displayContent} showsVerticalScrollIndicator={false}>
          <Pressable accessibilityRole="switch" accessibilityState={{ checked: readingPreferences.showStatusBar }} onPress={() => persistPreferences({ ...readingPreferences, showStatusBar: !readingPreferences.showStatusBar })} style={({ pressed }) => [styles.statusBarSetting, { borderBottomColor: palette.line }, pressed && styles.pressed]}>
            <Text style={[styles.settingRowLabel, { color: palette.text }]}>显示系统状态栏</Text>
            <View style={[styles.switchTrack, { backgroundColor: readingPreferences.showStatusBar ? palette.accent : palette.line }]}><View style={[styles.switchThumb, readingPreferences.showStatusBar && styles.switchThumbOn]} /></View>
          </Pressable>
          <SettingLabel color={palette.muted}>阅读主题</SettingLabel>
          <View style={styles.themeOptions}>{READER_THEMES.map((option) => <Pressable key={option.id} accessibilityState={{ selected: readingPreferences.theme === option.id }} onPress={() => persistPreferences({ ...readingPreferences, theme: option.id })} style={({ pressed }) => [styles.themeOption, { borderColor: readingPreferences.theme === option.id ? palette.accent : palette.line }, pressed && styles.pressed]}><View style={[styles.themeSwatch, { backgroundColor: option.swatch }]} /><Text style={[styles.themeLabel, { color: readingPreferences.theme === option.id ? palette.accent : palette.text }]}>{option.label}</Text></Pressable>)}</View>
          {session.capabilities.reflow ? <>
            <SettingLabel color={palette.muted}>排版</SettingLabel>
            <View>
              {session.capabilities.fontSize ? <SettingRow label="字号" palette={palette}><Stepper label={`${readingPreferences.fontSize} px`} onDecrease={() => persistPreferences({ ...readingPreferences, fontSize: Math.max(14, readingPreferences.fontSize - 1) })} onIncrease={() => persistPreferences({ ...readingPreferences, fontSize: Math.min(32, readingPreferences.fontSize + 1) })} palette={palette} /></SettingRow> : null}
              {session.capabilities.lineHeight ? <SettingRow label="行距" palette={palette}><Stepper label={readingPreferences.lineHeight.toFixed(1)} onDecrease={() => persistPreferences({ ...readingPreferences, lineHeight: Math.max(1.3, Number((readingPreferences.lineHeight - 0.1).toFixed(1))) })} onIncrease={() => persistPreferences({ ...readingPreferences, lineHeight: Math.min(2.4, Number((readingPreferences.lineHeight + 0.1).toFixed(1))) })} palette={palette} /></SettingRow> : null}
              <SettingRow label="页边距" palette={palette}><Stepper label={`${readingPreferences.pageMargin} px`} onDecrease={() => persistPreferences({ ...readingPreferences, pageMargin: Math.max(12, readingPreferences.pageMargin - 2) })} onIncrease={() => persistPreferences({ ...readingPreferences, pageMargin: Math.min(44, readingPreferences.pageMargin + 2) })} palette={palette} /></SettingRow>
              <SettingRow label="字体" palette={palette}>
                <Pressable accessibilityLabel={`当前字体：${selectedFontLabel}`} onPress={() => {
                  setFontSearch('');
                  setSheet('font');
                }} style={({ pressed }) => [styles.fontSettingButton, { backgroundColor: palette.surface }, pressed && styles.pressed]}>
                  <Text numberOfLines={1} style={[styles.fontSettingValue, { color: palette.text }]}>{selectedFontLabel}</Text>
                  <SymbolView name={{ android: 'chevron_right', ios: 'chevron.right', web: 'chevron_right' }} size={14} tintColor={palette.muted} type="hierarchical" />
                </Pressable>
              </SettingRow>
              <SettingRow label="翻页" palette={palette}><View style={[styles.segmented, { backgroundColor: palette.surface }]}><Segment active={readingPreferences.flow === 'paginated'} label="左右" onPress={() => persistPreferences({ ...readingPreferences, flow: 'paginated' })} palette={palette} /><Segment active={readingPreferences.flow === 'scrolled'} label="上下" onPress={() => persistPreferences({ ...readingPreferences, flow: 'scrolled' })} palette={palette} /></View></SettingRow>
            </View>
          </> : null}
          {session.capabilities.zoom ? <><SettingLabel color={palette.muted}>PDF 页面</SettingLabel><View><SettingRow label="配色" palette={palette}><View style={[styles.segmented, { backgroundColor: palette.surface }]}><Segment active={readingPreferences.pdfThemeEnabled} label="跟随主题" onPress={() => persistPreferences({ ...readingPreferences, pdfThemeEnabled: true })} palette={palette} /><Segment active={!readingPreferences.pdfThemeEnabled} label="保留原色" onPress={() => persistPreferences({ ...readingPreferences, pdfThemeEnabled: false })} palette={palette} /></View></SettingRow><SettingRow label="缩放" palette={palette}><Stepper label={`${readingPreferences.pdfScale.toFixed(1)}x`} onDecrease={() => setPdfZoom(readingPreferences.pdfScale - 0.25)} onIncrease={() => setPdfZoom(readingPreferences.pdfScale + 0.25)} palette={palette} /></SettingRow><SettingRow label="快捷缩放" palette={palette}><View style={[styles.segmented, { backgroundColor: palette.surface }]}><Segment active={readingPreferences.pdfScale === 1} label="适合宽度" onPress={() => setPdfZoom(1)} palette={palette} /><Segment active={readingPreferences.pdfScale === 1.5} label="150%" onPress={() => setPdfZoom(1.5)} palette={palette} /></View></SettingRow><SettingRow label="阅读方向" palette={palette}><View style={[styles.segmented, { backgroundColor: palette.surface }]}><Segment active={!readingPreferences.pdfHorizontal} label="纵向" onPress={() => persistPreferences({ ...readingPreferences, pdfHorizontal: false })} palette={palette} /><Segment active={readingPreferences.pdfHorizontal} label="横向" onPress={() => persistPreferences({ ...readingPreferences, pdfHorizontal: true })} palette={palette} /></View></SettingRow></View></> : null}
        </ScrollView>
      </ReaderSheetShell>

      <ReaderSheetShell onClose={() => setSheet(null)} open={sheet === 'font'} palette={palette} paddingBottom={Math.max(spacing.lg, insets.bottom + spacing.md)} title="选择字体">
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setFontSearch}
          placeholder="搜索系统字体"
          placeholderTextColor={palette.muted}
          style={[styles.fontSearchInput, { backgroundColor: palette.background, color: palette.text }]}
          value={fontSearch}
        />
        <ScrollView contentContainerStyle={styles.fontList} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <SettingLabel color={palette.muted}>内置</SettingLabel>
          <FontOption active={!readingPreferences.fontName && readingPreferences.fontFamily === 'serif'} label="默认衬线" onPress={() => selectFont(null, 'serif')} palette={palette} previewFontFamily="serif" />
          <FontOption active={!readingPreferences.fontName && readingPreferences.fontFamily === 'sans'} label="默认无衬线" onPress={() => selectFont(null, 'sans')} palette={palette} previewFontFamily="sans-serif" />
          <SettingLabel color={palette.muted}>系统字体</SettingLabel>
          {!fontsLoaded ? <Text style={[styles.fontStateText, { color: palette.muted }]}>正在读取系统字体…</Text> : null}
          {fontsLoaded && visibleSystemFonts.length === 0 ? <Text style={[styles.fontStateText, { color: palette.muted }]}>{systemFonts.length === 0 ? '当前运行环境无法读取系统字体' : '没有匹配的字体'}</Text> : null}
          {visibleSystemFonts.map((name) => <FontOption key={name} active={readingPreferences.fontName === name} label={name} onPress={() => selectFont(name)} palette={palette} previewFontFamily={name} />)}
        </ScrollView>
      </ReaderSheetShell>
    </SafeAreaView>
  );
}

function ReaderError({ palette, status, message, onBack }: { palette: ReturnType<typeof readerPalette>; status: string; message: string | null; onBack(): void }) {
  const title = status === 'protected' ? '书籍受保护' : status === 'failed' ? '解析失败' : '暂不支持阅读';
  return <View style={styles.readerError}><View style={[styles.errorIcon, { backgroundColor: palette.accentSoft }]}><SymbolView name={{ android: 'menu_book', ios: 'book.closed', web: 'menu_book' }} size={28} tintColor={palette.accent} type="hierarchical" /></View><Text style={[styles.readerErrorTitle, { color: palette.text }]}>{title}</Text><Text style={[styles.readerErrorText, { color: palette.muted }]}>{message || '原始文件仍保留在书架，可以重新导入其他版本。'}</Text><Pressable onPress={onBack} style={[styles.secondaryAction, { borderColor: palette.line }]}><Text style={[styles.secondaryActionText, { color: palette.text }]}>返回书架</Text></Pressable></View>;
}

function TocPanel({ items, currentHref, onSelect, palette }: { items: ReaderTocItem[]; currentHref: string | null; onSelect(item: ReaderTocItem): void; palette: ReturnType<typeof readerPalette> }) {
  return <ScrollView contentContainerStyle={styles.tocList} style={styles.toolScroll}>{items.map((item, index) => {
    const active = currentHref === item.href;
    const page = pdfPageFromTocHref(item.href);
    return <Pressable key={`${item.href}:${item.label}:${index}`} accessibilityState={{ selected: active }} onPress={() => onSelect(item)} style={({ pressed }) => [styles.tocRow, { paddingLeft: spacing.xs + Math.min(item.depth, 4) * spacing.md, borderBottomColor: palette.line }, pressed && styles.pressed]}><View style={[styles.tocCurrentMark, { backgroundColor: active ? palette.accent : 'transparent' }]} /><Text numberOfLines={2} style={[styles.tocLabel, item.depth === 0 && styles.tocRootLabel, { color: active ? palette.accent : palette.text }]}>{item.label}</Text>{page ? <Text style={[styles.tocPage, { color: active ? palette.accent : palette.muted }]}>{page}</Text> : null}</Pressable>;
  })}{items.length === 0 ? <Text style={[styles.emptyText, { color: palette.muted }]}>这本书没有可用大纲</Text> : null}</ScrollView>;
}

function ReadingInfoPanel({ book, file, locationLabel, outlineCount, palette, progressLabel }: { book: Book; file: Media | null; locationLabel: string; outlineCount: number; palette: ReturnType<typeof readerPalette>; progressLabel: string }) {
  return <View style={styles.readingInfo}>
    <Text numberOfLines={2} style={[styles.readingInfoTitle, { color: palette.text }]}>{book.title}</Text>
    <Text numberOfLines={1} style={[styles.readingInfoAuthor, { color: palette.muted }]}>{book.author?.trim() || '未知作者'}</Text>
    <View style={styles.readingInfoRows}>
      <ReadingInfoRow label="阅读进度" palette={palette} value={progressLabel} />
      <ReadingInfoRow label="当前位置" palette={palette} value={locationLabel} />
      <ReadingInfoRow label="文件格式" palette={palette} value={book.format.toUpperCase()} />
      <ReadingInfoRow label="大纲" palette={palette} value={outlineCount ? `${outlineCount} 项` : '无可用大纲'} />
      <ReadingInfoRow label="原始文件" palette={palette} value={file?.originalName?.trim() || '未知'} />
      <ReadingInfoRow label="文件大小" palette={palette} value={formatFileSize(file?.sizeBytes ?? null)} />
    </View>
  </View>;
}

function ReadingInfoRow({ label, palette, value }: { label: string; palette: ReturnType<typeof readerPalette>; value: string }) {
  return <View style={[styles.readingInfoRow, { borderBottomColor: palette.line }]}><Text style={[styles.readingInfoLabel, { color: palette.muted }]}>{label}</Text><Text numberOfLines={2} style={[styles.readingInfoValue, { color: palette.text }]}>{value}</Text></View>;
}

function ExcerptPanel({ draft, excerpts, manual, onChangeDraft, onDelete, onSave, onWrite, palette }: { draft: string; excerpts: BookExcerpt[]; manual: boolean; onChangeDraft(value: string): void; onDelete(id: string): void; onSave(): void; onWrite(id: string): void; palette: ReturnType<typeof readerPalette> }) {
  return <View style={styles.excerptPanel}><Text style={[styles.sheetHint, { color: palette.muted }]}>{manual ? '手动录入的书摘会绑定当前阅读位置。' : '已从阅读器选区取得文字，保存后会恢复高亮。'}</Text><TextInput maxLength={20_000} multiline onChangeText={onChangeDraft} placeholder="输入摘抄内容" placeholderTextColor={palette.muted} style={[styles.excerptInput, { backgroundColor: palette.background, color: palette.text }]} textAlignVertical="top" value={draft} /><Pressable disabled={!draft.trim()} onPress={onSave} style={({ pressed }) => [styles.primaryAction, { backgroundColor: palette.accent }, !draft.trim() && styles.disabled, pressed && styles.pressed]}><Text style={styles.primaryActionText}>保存书摘</Text></Pressable><ScrollView contentContainerStyle={styles.toolList} keyboardShouldPersistTaps="handled" style={styles.excerptScroll}>{excerpts.map((excerpt) => <View key={excerpt.id} style={[styles.excerpt, { borderTopColor: palette.line }]}><Text numberOfLines={5} style={[styles.quote, { color: palette.text }]}>{excerpt.text}</Text><View style={styles.excerptFooter}><Text style={[styles.excerptLocation, { color: palette.muted }]}>{formatExcerptLocation(excerpt)}</Text><View style={styles.excerptActions}><IconButton label="引用书摘写观后感" name={{ android: 'edit_note', ios: 'square.and.pencil', web: 'edit_note' }} onPress={() => onWrite(excerpt.id)} tint={palette.accent} /><IconButton label="删除书摘" name={{ android: 'delete_outline', ios: 'trash', web: 'delete_outline' }} onPress={() => onDelete(excerpt.id)} tint={colors.danger} /></View></View></View>)}{excerpts.length === 0 ? <Text style={[styles.emptyText, { color: palette.muted }]}>还没有书摘</Text> : null}</ScrollView></View>;
}

function ReaderTool({ icon, label, onPress, tint, disabled = false }: { icon: ComponentProps<typeof SymbolView>['name']; label: string; onPress(): void; tint: string; disabled?: boolean }) {
  return <Pressable accessibilityLabel={label} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.readerTool, disabled && styles.disabled, pressed && styles.pressed]}><SymbolView name={icon} size={21} tintColor={tint} type="hierarchical" /><Text numberOfLines={1} style={[styles.readerToolText, { color: tint }]}>{label}</Text></Pressable>;
}

function ImmersiveReaderHud({ progressLabel, onOpenControls, palette }: { progressLabel: string; onOpenControls(): void; palette: ReturnType<typeof readerPalette> }) {
  const [now, setNow] = useState(() => new Date());
  const powerState = Battery.usePowerState();

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    const update = () => setNow(new Date());
    const timeout = setTimeout(() => {
      update();
      interval = setInterval(update, 60_000);
    }, 60_000 - Date.now() % 60_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') update();
    });
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
      subscription.remove();
    };
  }, []);

  const batteryPercent = powerState.batteryLevel >= 0 ? Math.round(Math.min(1, powerState.batteryLevel) * 100) : null;
  const batteryLevel = batteryPercent === null ? '电量未知' : `电量 ${batteryPercent}%`;
  const batteryColor = batteryPercent !== null && batteryPercent <= 20 ? colors.danger : palette.muted;
  const batteryIcon = batterySymbol(batteryPercent, powerState.batteryState === Battery.BatteryState.CHARGING);

  return <Pressable accessibilityLabel={`显示阅读控制，阅读进度 ${progressLabel}，${batteryLevel}，当前时间 ${formatReaderTime(now)}`} hitSlop={12} onPress={onOpenControls} style={({ pressed }) => [styles.immersiveHud, pressed && styles.pressed]}>
    <Text numberOfLines={1} style={[styles.immersiveHudMeta, { color: palette.muted }]}>{progressLabel}</Text>
    <View style={styles.immersiveHudRight}>
      <Text style={[styles.immersiveHudMeta, { color: palette.muted }]}>{formatReaderTime(now)}</Text>
      <View style={styles.immersiveBattery}><SymbolView name={batteryIcon} size={14} tintColor={batteryColor} type="hierarchical" /><Text style={[styles.immersiveHudMeta, { color: batteryColor }]}>{batteryPercent === null ? '--' : `${batteryPercent}%`}</Text></View>
    </View>
  </Pressable>;
}

function batterySymbol(percent: number | null, charging: boolean): ComponentProps<typeof SymbolView>['name'] {
  if (charging) return { android: 'battery_charging_full', ios: 'battery.100.bolt', web: 'battery_charging_full' };
  if (percent === null) return { android: 'battery_unknown', ios: 'battery.0', web: 'battery_unknown' };
  if (percent <= 20) return { android: 'battery_alert', ios: 'battery.0', web: 'battery_alert' };
  if (percent <= 40) return { android: 'battery_20', ios: 'battery.25', web: 'battery_20' };
  if (percent <= 65) return { android: 'battery_50', ios: 'battery.50', web: 'battery_50' };
  if (percent <= 85) return { android: 'battery_80', ios: 'battery.75', web: 'battery_80' };
  return { android: 'battery_full', ios: 'battery.100', web: 'battery_full' };
}

function IconButton({ label, name, onPress, tint }: { label: string; name: ComponentProps<typeof SymbolView>['name']; onPress(): void; tint: string }) {
  return <Pressable accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><SymbolView name={name} size={20} tintColor={tint} type="hierarchical" /></Pressable>;
}

function ReaderSheetShell({ children, compact = false, onClose, open, paddingBottom, palette, title }: PropsWithChildren<{ compact?: boolean; onClose(): void; open: boolean; paddingBottom: number; palette: ReturnType<typeof readerPalette>; title: string }>) {
  return <DraggableBottomSheet handleStyle={{ backgroundColor: palette.line }} keyboardAvoiding onClose={onClose} open={open} sheetStyle={[styles.sheet, compact && styles.compactSheet, { paddingBottom, backgroundColor: palette.chrome }]}><View style={[styles.sheetHeader, compact && styles.compactSheetHeader]}><Text style={[styles.sheetTitle, { color: palette.text }]}>{title}</Text></View>{children}</DraggableBottomSheet>;
}

function SheetTab({ active, disabled = false, label, onPress, palette }: { active: boolean; disabled?: boolean; label: string; onPress(): void; palette: ReturnType<typeof readerPalette> }) {
  return <Pressable disabled={disabled} onPress={onPress} style={[styles.tab, disabled && styles.disabled, active && { borderBottomColor: palette.accent }]}><Text style={[styles.tabText, { color: active ? palette.accent : palette.muted }]}>{label}</Text></Pressable>;
}

function SettingLabel({ children, color }: PropsWithChildren<{ color: string }>) {
  return <Text style={[styles.settingLabel, { color }]}>{children}</Text>;
}

function SettingRow({ children, label, palette }: PropsWithChildren<{ label: string; palette: ReturnType<typeof readerPalette> }>) {
  return <View style={[styles.settingRow, { borderBottomColor: palette.line }]}><Text style={[styles.settingRowLabel, { color: palette.text }]}>{label}</Text><View style={styles.settingRowControl}>{children}</View></View>;
}

function FontOption({ active, label, onPress, palette, previewFontFamily }: { active: boolean; label: string; onPress(): void; palette: ReturnType<typeof readerPalette>; previewFontFamily: string }) {
  return <Pressable accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.fontOption, { borderBottomColor: palette.line }, pressed && styles.pressed]}>
    <View style={styles.fontOptionCopy}>
      <Text numberOfLines={1} style={[styles.fontOptionLabel, { color: active ? palette.accent : palette.text }]}>{label}</Text>
      <Text numberOfLines={1} style={[styles.fontOptionPreview, { color: palette.muted, fontFamily: previewFontFamily }]}>山川湖海 Aa 123</Text>
    </View>
    {active ? <SymbolView name={{ android: 'check', ios: 'checkmark', web: 'check' }} size={17} tintColor={palette.accent} type="hierarchical" /> : null}
  </Pressable>;
}

function Stepper({ label, onDecrease, onIncrease, palette }: { label: string; onDecrease(): void; onIncrease(): void; palette: ReturnType<typeof readerPalette> }) {
  return <View style={[styles.stepper, { backgroundColor: palette.surface }]}><Pressable accessibilityLabel="减小" onPress={onDecrease} style={({ pressed }) => [styles.stepperButton, pressed && styles.pressed]}><SymbolView name={{ android: 'remove', ios: 'minus', web: 'remove' }} size={16} tintColor={palette.text} type="hierarchical" /></Pressable><Text style={[styles.stepperValue, { color: palette.text }]}>{label}</Text><Pressable accessibilityLabel="增大" onPress={onIncrease} style={({ pressed }) => [styles.stepperButton, pressed && styles.pressed]}><SymbolView name={{ android: 'add', ios: 'plus', web: 'add' }} size={16} tintColor={palette.text} type="hierarchical" /></Pressable></View>;
}

function Segment({ active, label, onPress, palette }: { active: boolean; label: string; onPress(): void; palette: ReturnType<typeof readerPalette> }) {
  return <Pressable accessibilityState={{ selected: active }} onPress={onPress} style={[styles.segment, active && { backgroundColor: palette.chrome }]}><Text numberOfLines={1} style={[styles.segmentText, { color: active ? palette.accent : palette.muted }]}>{label}</Text></Pressable>;
}

function manualLocator(format: string, location: BookLocator | null, chapterTitle: string | null): BookLocator {
  if (format === 'pdf') return location?.type === 'pdf-page' ? location : createPdfLocator(1);
  if (location?.type === 'epub-cfi') return location;
  if (location?.type === 'reflow-cfi') return location;
  if (format !== 'epub') return createReflowLocator('', null, chapterTitle, 0);
  return { type: 'manual', location: location ? serializeBookLocator(location) : null, chapterTitle };
}

function formatLocation(format: string, locator: BookLocator | null, progression: number) {
  if (format === 'pdf') {
    const page = locator?.type === 'pdf-page' ? locator.page : 1;
    const total = locator?.type === 'pdf-page' ? locator.pageCount : null;
    return total ? `${page} / ${total}` : `第 ${page} 页`;
  }
  const value = locator?.type === 'epub-cfi' || locator?.type === 'reflow-cfi' ? locator.progression : progression;
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

function tocItemLocator(book: Book, location: BookLocator | null, item: ReaderTocItem): BookLocator | null {
  if (book.format === 'pdf') {
    const page = pdfPageFromTocHref(item.href);
    const pageCount = location?.type === 'pdf-page' ? location.pageCount : book.pageCount ?? null;
    return page ? createPdfLocator(page, pageCount) : null;
  }
  if (book.format === 'epub') return createEpubLocator('', item.href, item.label, book.progress);
  if (['mobi', 'txt', 'html', 'fb2'].includes(book.format)) return createReflowLocator('', item.href, item.label, book.progress);
  return null;
}

function currentTocItemHref(format: Book['format'], location: BookLocator | null, chapterHref: string | null, items: ReaderTocItem[]): string | null {
  if (format !== 'pdf') {
    if (location?.type === 'epub-cfi' || location?.type === 'reflow-cfi') return location.href ?? chapterHref;
    return chapterHref;
  }
  if (location?.type !== 'pdf-page') return null;
  return pdfTocItemAtPage(items, location.page)?.href ?? null;
}

function pdfTocItemAtPage(items: ReaderTocItem[], currentPage: number): ReaderTocItem | null {
  let current: { item: ReaderTocItem; page: number } | null = null;
  for (const item of items) {
    const page = pdfPageFromTocHref(item.href);
    if (page && page <= currentPage && (!current || page >= current.page)) current = { item, page };
  }
  return current?.item ?? null;
}

function pdfPageFromTocHref(href: string): number | null {
  const page = Number(href.match(/^pdf:(\d+)$/)?.[1]);
  return Number.isInteger(page) && page > 0 ? page : null;
}

function readingProgressLabel(book: Book, location: BookLocator | null): string {
  const value = location?.type === 'epub-cfi' || location?.type === 'reflow-cfi'
    ? location.progression
    : location?.type === 'pdf-page' && location.pageCount
      ? (location.page - 1) / Math.max(1, location.pageCount - 1)
      : book.progress;
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return '未知';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function chapterTitleFromLocator(locator: BookLocator | null): string | null {
  if (locator?.type !== 'epub-cfi' && locator?.type !== 'reflow-cfi' && locator?.type !== 'manual') return null;
  return locator.chapterTitle?.trim() || null;
}

function formatHudProgress(format: string, locator: BookLocator | null, progression: number) {
  if (format === 'pdf' && locator?.type === 'pdf-page') {
    const percent = locator.pageCount
      ? Math.round(Math.max(0, Math.min(1, locator.page / locator.pageCount)) * 100)
      : Math.round(Math.max(0, Math.min(1, progression)) * 100);
    return locator.pageCount ? `${locator.page}/${locator.pageCount}  ${percent}%` : `第 ${locator.page} 页  ${percent}%`;
  }
  const value = locator?.type === 'epub-cfi' || locator?.type === 'reflow-cfi' ? locator.progression : progression;
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

function formatExcerptLocation(excerpt: BookExcerpt) {
  if (excerpt.locationType === 'pdf-page') return `第 ${pageFromBookLocation(excerpt.location)} 页 / ${excerpt.sourceKind === 'selection' ? '选区' : '手动'}`;
  if (excerpt.locationType === 'epub-cfi' || excerpt.locationType === 'reflow-cfi') return `${excerpt.chapterTitle || '正文'} / 选区`;
  return excerpt.chapterTitle || '手动摘抄';
}

function sameToc(left: ReaderTocItem[], right: ReaderTocItem[]) {
  return left.length === right.length && left.every((item, index) => item.href === right[index]?.href && item.label === right[index]?.label && item.depth === right[index]?.depth);
}

function readerLocationEventKey(bookId: string, event: ReaderLocationEvent): string {
  return `${bookId}:${event.locator.type}:${serializeBookLocator(event.locator) ?? ''}:${event.progression}:${event.chapterHref ?? ''}:${event.chapterTitle ?? ''}:${event.pageCount ?? ''}`;
}

function formatReaderTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function isProtectedReaderError(message: string): boolean {
  const normalized = message.toLocaleLowerCase();
  return normalized.includes('password') || normalized.includes('密码') || normalized.includes('protected') || normalized.includes('加密');
}

function readerPalette(theme: ReaderTheme) {
  if (theme === 'night') return { background: '#151916', chrome: '#202621', surface: '#2A312B', line: '#3B463D', text: '#EDF0EB', muted: '#9DA69E', accent: '#83A98B', accentSoft: '#29382D' };
  if (theme === 'warm') return { background: '#EEE3C9', chrome: '#F5ECD9', surface: '#E5D8BC', line: '#D2C3A4', text: '#403A30', muted: '#817664', accent: '#587763', accentSoft: '#DCE7D8' };
  if (theme === 'green') return { background: '#E6F0DC', chrome: '#EEF5E8', surface: '#D7E5CD', line: '#C4D4BA', text: '#29372B', muted: '#657267', accent: '#4D7357', accentSoft: '#D1E4D2' };
  return { background: '#F8F8F4', chrome: '#FFFFFF', surface: '#ECEDE7', line: '#D8DAD1', text: '#242824', muted: '#747A74', accent: colors.life, accentSoft: colors.lifeLight };
}

const styles = createThemedStyles(() => ({
  flex: { flex: 1 },
  safe: { flex: 1 },
  missingSafe: { flex: 1, backgroundColor: colors.paper },
  missing: { margin: spacing.lg, color: colors.inkSoft },
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  headerCopy: { flex: 1, minWidth: 0, paddingVertical: spacing.xs, alignItems: 'flex-start' },
  headerTitle: { maxWidth: '100%', fontFamily: typography.display, fontSize: 14, lineHeight: 18 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  readerSurface: { flex: 1 },
  readerError: { flex: 1, paddingHorizontal: spacing.xl, alignItems: 'center', justifyContent: 'center' },
  errorIcon: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 29 },
  readerErrorTitle: { marginTop: spacing.lg, fontFamily: typography.display, fontSize: 19 },
  readerErrorText: { maxWidth: 300, marginTop: spacing.sm, fontSize: 12, lineHeight: 20, textAlign: 'center' },
  secondaryAction: { minWidth: 128, minHeight: 46, marginTop: spacing.lg, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm },
  secondaryActionText: { fontSize: 12, fontWeight: '600' },
  immersiveChapterLayer: { position: 'absolute', left: spacing.md, right: spacing.md, zIndex: 18, minHeight: 24, justifyContent: 'center' },
  immersiveChapterTitle: { maxWidth: '100%', fontFamily: typography.display, fontSize: 11, lineHeight: 16, opacity: 0.72 },
  immersiveHudLayer: { position: 'absolute', left: spacing.md, right: spacing.md, zIndex: 18 },
  immersiveHud: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  immersiveHudRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  immersiveHudMeta: { fontFamily: typography.mono, fontSize: 10, fontVariant: ['tabular-nums'], opacity: 0.72 },
  immersiveBattery: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  bottomControls: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20, paddingHorizontal: spacing.md, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  positionControls: { minHeight: 52, flexDirection: 'row', alignItems: 'center' },
  positionAction: { width: 82, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  positionActionText: { fontSize: 11, fontWeight: '600' },
  positionLabel: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  positionText: { fontFamily: typography.mono, fontSize: 11 },
  readerTools: { minHeight: 72, flexDirection: 'row', justifyContent: 'space-around' },
  readerTool: { width: 74, minHeight: 66, alignItems: 'center', justifyContent: 'center' },
  readerToolText: { maxWidth: 68, marginTop: 5, fontSize: 10 },
  disabled: { opacity: 0.32 },
  pressed: { opacity: 0.58 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.backdropStrong },
  sheet: { height: '82%', paddingTop: spacing.sm, paddingHorizontal: spacing.lg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  compactSheet: { height: '72%' },
  handle: { width: 36, height: 4, marginBottom: spacing.sm, alignSelf: 'center', borderRadius: 2 },
  sheetHeader: { minHeight: 46, flexDirection: 'row', alignItems: 'center' },
  compactSheetHeader: { minHeight: 38 },
  sheetTitle: { flex: 1, fontFamily: typography.display, fontSize: 18 },
  sheetHint: { marginTop: spacing.sm, fontSize: 11, lineHeight: 18 },
  sheetInput: { minHeight: 52, marginTop: spacing.lg, paddingHorizontal: spacing.md, borderRadius: radius.sm, fontFamily: typography.mono, fontSize: 16 },
  fontSearchInput: { minHeight: 48, marginTop: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.sm, fontSize: 13 },
  fontList: { paddingBottom: spacing.lg },
  fontStateText: { paddingVertical: spacing.xl, fontSize: 11, textAlign: 'center' },
  fontOption: { minHeight: 64, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  fontOptionCopy: { flex: 1, minWidth: 0, marginRight: spacing.md },
  fontOptionLabel: { fontSize: 12, fontWeight: '600' },
  fontOptionPreview: { marginTop: 4, fontSize: 15 },
  primaryAction: { minHeight: 48, marginTop: spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  primaryActionText: { color: colors.onLife, fontSize: 12, fontWeight: '700' },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 11, fontWeight: '600' },
  toolScroll: { flex: 1 },
  toolList: { paddingBottom: spacing.lg },
  tocList: { paddingTop: spacing.xs, paddingBottom: spacing.lg },
  tocRow: { minHeight: 48, paddingRight: spacing.xs, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  tocCurrentMark: { width: 2, height: 16, marginRight: spacing.sm, borderRadius: 1 },
  tocLabel: { flex: 1, fontFamily: typography.display, fontSize: 13, lineHeight: 20 },
  tocRootLabel: { fontSize: 14, fontWeight: '600' },
  tocPage: { width: 38, marginLeft: spacing.sm, fontFamily: typography.mono, fontSize: 9, textAlign: 'right' },
  emptyText: { paddingVertical: spacing.xl, fontSize: 11, textAlign: 'center' },
  excerptPanel: { flex: 1 },
  excerptInput: { minHeight: 96, maxHeight: 150, marginTop: spacing.md, padding: spacing.md, borderRadius: radius.sm, fontSize: 13, lineHeight: 21 },
  excerptScroll: { flex: 1, marginTop: spacing.md },
  excerpt: { paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  quote: { fontFamily: typography.display, fontSize: 14, lineHeight: 23 },
  excerptFooter: { marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center' },
  excerptLocation: { flex: 1, fontFamily: typography.mono, fontSize: 9 },
  excerptActions: { flexDirection: 'row' },
  notesPanel: { paddingTop: spacing.xl },
  notesTitle: { fontFamily: typography.display, fontSize: 18 },
  notesCopy: { marginTop: spacing.sm, fontSize: 11, lineHeight: 18 },
  readingInfo: { paddingTop: spacing.xs },
  readingInfoTitle: { fontFamily: typography.display, fontSize: 20, lineHeight: 27 },
  readingInfoAuthor: { marginTop: spacing.xs, fontSize: 11 },
  readingInfoRows: { marginTop: spacing.md },
  readingInfoRow: { minHeight: 44, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  readingInfoLabel: { width: 72, flexShrink: 0, fontSize: 10 },
  readingInfoValue: { flex: 1, minWidth: 0, fontSize: 11, lineHeight: 17, textAlign: 'right' },
  displayContent: { paddingBottom: spacing.sm },
  statusBarSetting: { minHeight: 44, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  switchTrack: { width: 40, height: 24, marginLeft: spacing.md, padding: 2, borderRadius: 12 },
  switchThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.paper },
  switchThumbOn: { alignSelf: 'flex-end' },
  settingLabel: { marginTop: spacing.md, marginBottom: spacing.xs, fontSize: 9, fontWeight: '700' },
  themeOptions: { flexDirection: 'row', gap: spacing.xs },
  themeOption: { flex: 1, minWidth: 0, minHeight: 42, paddingHorizontal: spacing.xs, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm },
  themeSwatch: { width: 18, height: 18, flexShrink: 0, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.16)', borderRadius: 9 },
  themeLabel: { fontSize: 9, fontWeight: '600' },
  settingRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  settingRowLabel: { flex: 1, minWidth: 0, marginRight: spacing.sm, fontSize: 11, fontWeight: '600' },
  settingRowControl: { width: '68%', maxWidth: 210, minWidth: 176 },
  fontSettingButton: { minHeight: 38, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', borderRadius: radius.sm },
  fontSettingValue: { flex: 1, minWidth: 0, marginRight: spacing.xs, fontSize: 10, fontWeight: '600', textAlign: 'right' },
  stepper: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.sm },
  stepperButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  stepperValue: { fontFamily: typography.mono, fontSize: 13 },
  segmented: { minHeight: 38, padding: 2, flexDirection: 'row', borderRadius: radius.sm },
  segment: { flex: 1, minWidth: 0, minHeight: 34, paddingHorizontal: spacing.xs, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  segmentText: { fontSize: 10, fontWeight: '600' },
}));
