import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentProps, PropsWithChildren } from 'react';
import { Alert, AppState, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { BookExcerpt, ReaderTheme, ReaderTocItem, ReadingPreferences } from '@still-alive/types';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { AppKeyboardAvoidingView } from '../src/components/app-keyboard-avoiding-view';
import { BookReader } from '../src/components/book-reader';
import { useAppState } from '../src/state/app-state';
import { createThemedStyles } from '../src/theme/app-theme';
import type { BookLocator, ReaderLocationEvent, ReaderSelection, ReaderSurfaceHandle } from '../src/domain/book-reader';
import { createEpubLocator, createPdfLocator, detectReaderCapability, locatorFromBook, pageFromBookLocation, ReaderSessionController, readingPreferencesForBook, serializeBookLocator, updateReadingPreferencesJson } from '../src/domain/book-reader';

type ReaderSheet = 'library' | 'display' | 'jump' | null;
type LibraryTab = 'toc' | 'excerpts' | 'notes';

const READER_THEMES: Array<{ id: ReaderTheme; label: string; swatch: string }> = [
  { id: 'paper', label: '纸白', swatch: '#F8F8F4' },
  { id: 'warm', label: '暖黄', swatch: '#EEE3C9' },
  { id: 'green', label: '护眼', swatch: '#E6F0DC' },
  { id: 'night', label: '夜间', swatch: '#151916' },
];

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
  const bookRef = useRef(book);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [sheet, setSheet] = useState<ReaderSheet>(null);
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('toc');
  const [toc, setToc] = useState<ReaderTocItem[]>(book?.chapterCache ?? []);
  const [location, setLocation] = useState<BookLocator | null>(() => book ? locatorFromBook(book) : null);
  const [excerptDraft, setExcerptDraft] = useState('');
  const [pendingSelection, setPendingSelection] = useState<ReaderSelection | null>(null);
  const [jumpDraft, setJumpDraft] = useState(() => String(book ? pageFromBookLocation(book.location) : 1));
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const readingPreferences = useMemo(() => book ? readingPreferencesForBook(preferences.readerPreferencesJson, book.id) : null, [book, preferences.readerPreferencesJson]);

  bookRef.current = book;

  const flushLocation = useCallback(() => {
    const event = latestLocationEventRef.current;
    const currentBook = bookRef.current;
    if (!event || !currentBook) return;
    latestLocationEventRef.current = null;
    if (pendingLocationRef.current) clearTimeout(pendingLocationRef.current);
    pendingLocationRef.current = null;
    void updateBook(new ReaderSessionController(currentBook).applyLocation(event));
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

  if (!book || !readingPreferences) return <SafeAreaView style={styles.missingSafe}><Text style={styles.missing}>书籍不存在。</Text></SafeAreaView>;

  const session = new ReaderSessionController(book);
  const capability = detectReaderCapability(book);
  const palette = readerPalette(readingPreferences.theme);
  const readable = capability.status === 'ready' && Boolean(file) && !runtimeError;

  const persistLocation = (event: ReaderLocationEvent) => {
    setLocation(event.locator);
    latestLocationEventRef.current = event;
    if (pendingLocationRef.current) clearTimeout(pendingLocationRef.current);
    pendingLocationRef.current = setTimeout(flushLocation, 300);
  };

  const persistPreferences = (next: ReadingPreferences) => {
    void updatePreferences({ readerPreferencesJson: updateReadingPreferencesJson(preferences.readerPreferencesJson, book.id, next) });
  };

  const handleTocChange = (items: ReaderTocItem[]) => {
    setToc(items);
    if (sameToc(items, book.chapterCache ?? [])) return;
    void updateBook({ ...book, chapterCache: items, engineVersion: session.adapter.engineVersion, updatedAt: new Date().toISOString() });
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
      Alert.alert('无法保存', '摘抄不能为空且不能超过 20000 字。');
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
        chapterTitle: locator.type === 'epub-cfi' ? locator.chapterTitle : book.chapterTitle ?? null,
        contextBefore: pendingSelection?.contextBefore ?? null,
        contextAfter: pendingSelection?.contextAfter ?? null,
        sourceKind: pendingSelection ? 'selection' : 'manual',
        note: null,
        createdAt: new Date().toISOString(),
      });
      setExcerptDraft('');
      setPendingSelection(null);
    } catch (cause) {
      Alert.alert('保存失败', cause instanceof Error ? cause.message : '请稍后重试。');
    }
  };

  const removeExcerpt = (excerptId: string) => {
    Alert.alert('删除这条书摘？', '已引用到读书笔记中的文字快照不会受到影响。', [
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
      Alert.alert('页码无效', pageCount ? `请输入 1 至 ${pageCount} 之间的整数。` : '请输入大于 0 的整数。');
      return;
    }
    const locator = createPdfLocator(target, pageCount);
    readerRef.current?.goTo(locator);
    setLocation(locator);
    setSheet(null);
  };

  const locationLabel = formatLocation(book.format, location, book.progress);
  const chapterLabel = location?.type === 'epub-cfi' ? location.chapterTitle : book.chapterTitle;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.safe, { backgroundColor: palette.background }]}>
      <StatusBar style={readingPreferences.theme === 'night' ? 'light' : 'dark'} />

      {controlsVisible ? (
        <View style={[styles.header, { backgroundColor: palette.chrome, borderBottomColor: palette.line }]}>
          <IconButton label="返回书架" name={{ android: 'chevron_left', ios: 'chevron.left', web: 'chevron_left' }} onPress={() => { flushLocation(); router.back(); }} tint={palette.text} />
          <View style={styles.headerCopy}>
            <Text numberOfLines={1} style={[styles.headerTitle, { color: palette.text }]}>{book.title}</Text>
            <Text numberOfLines={1} style={[styles.headerMeta, { color: palette.muted }]}>{chapterLabel || (book.format === 'pdf' ? locationLabel : book.author || '正文')}</Text>
          </View>
          <IconButton label="收起阅读控制" name={{ android: 'fullscreen', ios: 'arrow.up.left.and.arrow.down.right', web: 'fullscreen' }} onPress={() => setControlsVisible(false)} tint={palette.text} />
        </View>
      ) : null}

      <View style={[styles.readerSurface, { backgroundColor: palette.background }]}>
        {readable && file ? (
          <BookReader
            ref={readerRef}
            book={book}
            uri={file.localPath}
            initialLocator={session.initialLocator}
            preferences={readingPreferences}
            excerpts={excerpts}
            palette={palette}
            onLocationChange={persistLocation}
            onSelection={handleSelection}
            onTocChange={handleTocChange}
            onReady={() => {
              if (book.engineVersion !== session.adapter.engineVersion) void updateBook({ ...book, engineVersion: session.adapter.engineVersion, updatedAt: new Date().toISOString() });
            }}
            onError={(message) => setRuntimeError(message || '书籍无法打开')}
            onSingleTap={() => setControlsVisible((visible) => !visible)}
          />
        ) : (
          <ReaderError palette={palette} status={runtimeError ? 'failed' : capability.status} message={runtimeError || capability.message || (file ? null : '书籍文件不存在')} onBack={() => router.back()} />
        )}

        {!controlsVisible && readable ? (
          <Pressable accessibilityLabel="显示阅读控制" onPress={() => setControlsVisible(true)} style={[styles.restoreControls, { backgroundColor: palette.chrome, borderColor: palette.line }]}>
            <SymbolView name={{ android: 'tune', ios: 'slider.horizontal.3', web: 'tune' }} size={20} tintColor={palette.muted} type="hierarchical" />
          </Pressable>
        ) : null}
      </View>

      {controlsVisible ? (
        <View style={[styles.bottomControls, { backgroundColor: palette.chrome, borderTopColor: palette.line }]}>
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
        </View>
      ) : null}

      <ReaderSheetShell onClose={() => setSheet(null)} open={sheet === 'jump'} palette={palette} paddingBottom={Math.max(spacing.lg, insets.bottom + spacing.md)} title="跳转页码">
        <Text style={[styles.sheetHint, { color: palette.muted }]}>{location?.type === 'pdf-page' && location.pageCount ? `全书共 ${location.pageCount} 页` : '页数载入后将自动校验范围'}</Text>
        <TextInput autoFocus keyboardType="number-pad" maxLength={6} onChangeText={setJumpDraft} onSubmitEditing={jumpToPage} placeholder="输入页码" placeholderTextColor={palette.muted} returnKeyType="done" selectTextOnFocus style={[styles.sheetInput, { backgroundColor: palette.background, color: palette.text }]} value={jumpDraft} />
        <Pressable onPress={jumpToPage} style={({ pressed }) => [styles.primaryAction, { backgroundColor: palette.accent }, pressed && styles.pressed]}><Text style={styles.primaryActionText}>前往该页</Text></Pressable>
      </ReaderSheetShell>

      <ReaderSheetShell onClose={() => setSheet(null)} open={sheet === 'library'} palette={palette} paddingBottom={Math.max(spacing.lg, insets.bottom + spacing.md)} title="阅读工具">
        <View style={[styles.tabs, { borderBottomColor: palette.line }]}>
          <SheetTab active={libraryTab === 'toc'} disabled={!session.capabilities.toc} label="目录" onPress={() => setLibraryTab('toc')} palette={palette} />
          <SheetTab active={libraryTab === 'excerpts'} label={`书摘 ${excerpts.length}`} onPress={() => setLibraryTab('excerpts')} palette={palette} />
          <SheetTab active={libraryTab === 'notes'} label="笔记" onPress={() => setLibraryTab('notes')} palette={palette} />
        </View>
        {libraryTab === 'toc' ? <TocPanel currentHref={book.chapterHref ?? null} items={toc} onSelect={(item) => {
          readerRef.current?.goTo(createEpubLocator('', item.href, item.label, book.progress));
          setSheet(null);
        }} palette={palette} /> : null}
        {libraryTab === 'excerpts' ? <ExcerptPanel draft={excerptDraft} excerpts={excerpts} manual={!session.capabilities.selection || !pendingSelection} onChangeDraft={setExcerptDraft} onDelete={removeExcerpt} onSave={() => void saveExcerpt()} onWrite={writeNote} palette={palette} /> : null}
        {libraryTab === 'notes' ? <View style={styles.notesPanel}><Text style={[styles.notesTitle, { color: palette.text }]}>关于《{book.title}》</Text><Text style={[styles.notesCopy, { color: palette.muted }]}>笔记会进入时间线，并保留当前书籍来源。</Text><Pressable onPress={() => writeNote()} style={[styles.primaryAction, { backgroundColor: palette.accent }]}><Text style={styles.primaryActionText}>写读书笔记</Text></Pressable></View> : null}
      </ReaderSheetShell>

      <ReaderSheetShell onClose={() => setSheet(null)} open={sheet === 'display'} palette={palette} paddingBottom={Math.max(spacing.lg, insets.bottom + spacing.md)} title="显示设置">
        <ScrollView contentContainerStyle={styles.displayContent} showsVerticalScrollIndicator={false}>
          <SettingLabel color={palette.muted}>阅读主题</SettingLabel>
          <View style={styles.themeOptions}>{READER_THEMES.map((option) => <Pressable key={option.id} accessibilityState={{ selected: readingPreferences.theme === option.id }} onPress={() => persistPreferences({ ...readingPreferences, theme: option.id })} style={({ pressed }) => [styles.themeOption, { borderColor: readingPreferences.theme === option.id ? palette.accent : palette.line }, pressed && styles.pressed]}><View style={[styles.themeSwatch, { backgroundColor: option.swatch }]} /><Text style={[styles.themeLabel, { color: readingPreferences.theme === option.id ? palette.accent : palette.text }]}>{option.label}</Text></Pressable>)}</View>

          {session.capabilities.fontSize ? <><SettingLabel color={palette.muted}>字号</SettingLabel><Stepper label={`${readingPreferences.fontSize} px`} onDecrease={() => persistPreferences({ ...readingPreferences, fontSize: Math.max(14, readingPreferences.fontSize - 1) })} onIncrease={() => persistPreferences({ ...readingPreferences, fontSize: Math.min(32, readingPreferences.fontSize + 1) })} palette={palette} /></> : null}
          {session.capabilities.lineHeight ? <><SettingLabel color={palette.muted}>行距</SettingLabel><Stepper label={readingPreferences.lineHeight.toFixed(1)} onDecrease={() => persistPreferences({ ...readingPreferences, lineHeight: Math.max(1.3, Number((readingPreferences.lineHeight - 0.1).toFixed(1))) })} onIncrease={() => persistPreferences({ ...readingPreferences, lineHeight: Math.min(2.4, Number((readingPreferences.lineHeight + 0.1).toFixed(1))) })} palette={palette} /></> : null}
          {session.capabilities.reflow ? <><SettingLabel color={palette.muted}>页边距</SettingLabel><Stepper label={`${readingPreferences.pageMargin} px`} onDecrease={() => persistPreferences({ ...readingPreferences, pageMargin: Math.max(12, readingPreferences.pageMargin - 2) })} onIncrease={() => persistPreferences({ ...readingPreferences, pageMargin: Math.min(44, readingPreferences.pageMargin + 2) })} palette={palette} /></> : null}
          {session.capabilities.reflow ? <><SettingLabel color={palette.muted}>字体与翻页</SettingLabel><View style={[styles.segmented, { backgroundColor: palette.surface }]}><Segment active={readingPreferences.fontFamily === 'serif'} label="衬线" onPress={() => persistPreferences({ ...readingPreferences, fontFamily: 'serif' })} palette={palette} /><Segment active={readingPreferences.fontFamily === 'sans'} label="无衬线" onPress={() => persistPreferences({ ...readingPreferences, fontFamily: 'sans' })} palette={palette} /></View><View style={[styles.segmented, { backgroundColor: palette.surface }]}><Segment active={readingPreferences.flow === 'paginated'} label="左右翻页" onPress={() => persistPreferences({ ...readingPreferences, flow: 'paginated' })} palette={palette} /><Segment active={readingPreferences.flow === 'scrolled'} label="上下滚动" onPress={() => persistPreferences({ ...readingPreferences, flow: 'scrolled' })} palette={palette} /></View></> : null}
          {session.capabilities.zoom ? <><SettingLabel color={palette.muted}>PDF 缩放</SettingLabel><Stepper label={`${readingPreferences.pdfScale.toFixed(1)}x`} onDecrease={() => persistPreferences({ ...readingPreferences, pdfScale: Math.max(1, Number((readingPreferences.pdfScale - 0.25).toFixed(2))) })} onIncrease={() => persistPreferences({ ...readingPreferences, pdfScale: Math.min(5, Number((readingPreferences.pdfScale + 0.25).toFixed(2))) })} palette={palette} /><View style={[styles.segmented, { backgroundColor: palette.surface }]}><Segment active={!readingPreferences.pdfHorizontal} label="纵向滚动" onPress={() => persistPreferences({ ...readingPreferences, pdfHorizontal: false })} palette={palette} /><Segment active={readingPreferences.pdfHorizontal} label="横向翻页" onPress={() => persistPreferences({ ...readingPreferences, pdfHorizontal: true })} palette={palette} /></View></> : null}
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
  return <ScrollView contentContainerStyle={styles.toolList} style={styles.toolScroll}>{items.map((item) => <Pressable key={`${item.href}:${item.label}`} onPress={() => onSelect(item)} style={[styles.tocRow, { paddingLeft: spacing.md + Math.min(item.depth, 3) * spacing.md, borderBottomColor: palette.line }]}><View style={[styles.currentBar, { backgroundColor: currentHref === item.href ? palette.accent : 'transparent' }]} /><Text numberOfLines={2} style={[styles.tocLabel, { color: currentHref === item.href ? palette.accent : palette.text }]}>{item.label}</Text></Pressable>)}{items.length === 0 ? <Text style={[styles.emptyText, { color: palette.muted }]}>目录载入后会显示在这里</Text> : null}</ScrollView>;
}

function ExcerptPanel({ draft, excerpts, manual, onChangeDraft, onDelete, onSave, onWrite, palette }: { draft: string; excerpts: BookExcerpt[]; manual: boolean; onChangeDraft(value: string): void; onDelete(id: string): void; onSave(): void; onWrite(id: string): void; palette: ReturnType<typeof readerPalette> }) {
  return <View style={styles.excerptPanel}><Text style={[styles.sheetHint, { color: palette.muted }]}>{manual ? '手动录入的书摘会绑定当前阅读位置。' : '已从 EPUB 选区取得文字，保存后会恢复高亮。'}</Text><TextInput maxLength={20_000} multiline onChangeText={onChangeDraft} placeholder="输入摘抄内容" placeholderTextColor={palette.muted} style={[styles.excerptInput, { backgroundColor: palette.background, color: palette.text }]} textAlignVertical="top" value={draft} /><Pressable disabled={!draft.trim()} onPress={onSave} style={({ pressed }) => [styles.primaryAction, { backgroundColor: palette.accent }, !draft.trim() && styles.disabled, pressed && styles.pressed]}><Text style={styles.primaryActionText}>保存书摘</Text></Pressable><ScrollView contentContainerStyle={styles.toolList} keyboardShouldPersistTaps="handled" style={styles.excerptScroll}>{excerpts.map((excerpt) => <View key={excerpt.id} style={[styles.excerpt, { borderTopColor: palette.line }]}><Text numberOfLines={5} style={[styles.quote, { color: palette.text }]}>{excerpt.text}</Text><View style={styles.excerptFooter}><Text style={[styles.excerptLocation, { color: palette.muted }]}>{formatExcerptLocation(excerpt)}</Text><View style={styles.excerptActions}><IconButton label="引用书摘写观后感" name={{ android: 'edit_note', ios: 'square.and.pencil', web: 'edit_note' }} onPress={() => onWrite(excerpt.id)} tint={palette.accent} /><IconButton label="删除书摘" name={{ android: 'delete_outline', ios: 'trash', web: 'delete_outline' }} onPress={() => onDelete(excerpt.id)} tint={colors.danger} /></View></View></View>)}{excerpts.length === 0 ? <Text style={[styles.emptyText, { color: palette.muted }]}>还没有书摘</Text> : null}</ScrollView></View>;
}

function ReaderTool({ icon, label, onPress, tint, disabled = false }: { icon: ComponentProps<typeof SymbolView>['name']; label: string; onPress(): void; tint: string; disabled?: boolean }) {
  return <Pressable accessibilityLabel={label} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.readerTool, disabled && styles.disabled, pressed && styles.pressed]}><SymbolView name={icon} size={21} tintColor={tint} type="hierarchical" /><Text numberOfLines={1} style={[styles.readerToolText, { color: tint }]}>{label}</Text></Pressable>;
}

function IconButton({ label, name, onPress, tint }: { label: string; name: ComponentProps<typeof SymbolView>['name']; onPress(): void; tint: string }) {
  return <Pressable accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><SymbolView name={name} size={20} tintColor={tint} type="hierarchical" /></Pressable>;
}

function ReaderSheetShell({ children, onClose, open, paddingBottom, palette, title }: PropsWithChildren<{ onClose(): void; open: boolean; paddingBottom: number; palette: ReturnType<typeof readerPalette>; title: string }>) {
  return <Modal animationType="slide" onRequestClose={onClose} transparent visible={open}><AppKeyboardAvoidingView style={styles.flex}><Pressable onPress={onClose} style={styles.backdrop}><Pressable accessibilityViewIsModal onPress={(event) => event.stopPropagation()} style={[styles.sheet, { paddingBottom, backgroundColor: palette.chrome }]}><View style={[styles.handle, { backgroundColor: palette.line }]} /><View style={styles.sheetHeader}><Text style={[styles.sheetTitle, { color: palette.text }]}>{title}</Text><IconButton label="关闭" name={{ android: 'close', ios: 'xmark', web: 'close' }} onPress={onClose} tint={palette.muted} /></View>{children}</Pressable></Pressable></AppKeyboardAvoidingView></Modal>;
}

function SheetTab({ active, disabled = false, label, onPress, palette }: { active: boolean; disabled?: boolean; label: string; onPress(): void; palette: ReturnType<typeof readerPalette> }) {
  return <Pressable disabled={disabled} onPress={onPress} style={[styles.tab, disabled && styles.disabled, active && { borderBottomColor: palette.accent }]}><Text style={[styles.tabText, { color: active ? palette.accent : palette.muted }]}>{label}</Text></Pressable>;
}

function SettingLabel({ children, color }: PropsWithChildren<{ color: string }>) {
  return <Text style={[styles.settingLabel, { color }]}>{children}</Text>;
}

function Stepper({ label, onDecrease, onIncrease, palette }: { label: string; onDecrease(): void; onIncrease(): void; palette: ReturnType<typeof readerPalette> }) {
  return <View style={[styles.stepper, { backgroundColor: palette.surface }]}><IconButton label="减小" name={{ android: 'remove', ios: 'minus', web: 'remove' }} onPress={onDecrease} tint={palette.text} /><Text style={[styles.stepperValue, { color: palette.text }]}>{label}</Text><IconButton label="增大" name={{ android: 'add', ios: 'plus', web: 'add' }} onPress={onIncrease} tint={palette.text} /></View>;
}

function Segment({ active, label, onPress, palette }: { active: boolean; label: string; onPress(): void; palette: ReturnType<typeof readerPalette> }) {
  return <Pressable onPress={onPress} style={[styles.segment, active && { backgroundColor: palette.chrome }]}><Text style={[styles.segmentText, { color: active ? palette.accent : palette.muted }]}>{label}</Text></Pressable>;
}

function manualLocator(format: string, location: BookLocator | null, chapterTitle: string | null): BookLocator {
  if (format === 'pdf') return location?.type === 'pdf-page' ? location : createPdfLocator(1);
  if (location?.type === 'epub-cfi') return location;
  return { type: 'manual', location: location ? serializeBookLocator(location) : null, chapterTitle };
}

function formatLocation(format: string, locator: BookLocator | null, progression: number) {
  if (format === 'pdf') {
    const page = locator?.type === 'pdf-page' ? locator.page : 1;
    const total = locator?.type === 'pdf-page' ? locator.pageCount : null;
    return total ? `${page} / ${total}` : `第 ${page} 页`;
  }
  const value = locator?.type === 'epub-cfi' ? locator.progression : progression;
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

function formatExcerptLocation(excerpt: BookExcerpt) {
  if (excerpt.locationType === 'pdf-page') return `第 ${pageFromBookLocation(excerpt.location)} 页 · ${excerpt.sourceKind === 'selection' ? '选区' : '手动'}`;
  if (excerpt.locationType === 'epub-cfi') return `${excerpt.chapterTitle || '正文'} · 选区`;
  return excerpt.chapterTitle || '手动摘抄';
}

function sameToc(left: ReaderTocItem[], right: ReaderTocItem[]) {
  return left.length === right.length && left.every((item, index) => item.href === right[index]?.href && item.label === right[index]?.label && item.depth === right[index]?.depth);
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
  header: { minHeight: 54, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  headerCopy: { flex: 1, minWidth: 0, alignItems: 'center' },
  headerTitle: { maxWidth: '100%', fontFamily: typography.display, fontSize: 15 },
  headerMeta: { maxWidth: '100%', marginTop: 2, fontSize: 10 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  readerSurface: { flex: 1 },
  readerError: { flex: 1, paddingHorizontal: spacing.xl, alignItems: 'center', justifyContent: 'center' },
  errorIcon: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 29 },
  readerErrorTitle: { marginTop: spacing.lg, fontFamily: typography.display, fontSize: 19 },
  readerErrorText: { maxWidth: 300, marginTop: spacing.sm, fontSize: 12, lineHeight: 20, textAlign: 'center' },
  secondaryAction: { minWidth: 128, minHeight: 46, marginTop: spacing.lg, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm },
  secondaryActionText: { fontSize: 12, fontWeight: '600' },
  restoreControls: { position: 'absolute', right: spacing.md, bottom: spacing.md, width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderRadius: 23, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 },
  bottomControls: { paddingHorizontal: spacing.sm, paddingTop: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth },
  positionControls: { minHeight: 48, flexDirection: 'row', alignItems: 'center' },
  positionAction: { width: 82, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  positionActionText: { fontSize: 11, fontWeight: '600' },
  positionLabel: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  positionText: { fontFamily: typography.mono, fontSize: 11 },
  readerTools: { minHeight: 66, flexDirection: 'row', justifyContent: 'space-around' },
  readerTool: { width: 74, minHeight: 60, alignItems: 'center', justifyContent: 'center' },
  readerToolText: { maxWidth: 68, marginTop: 5, fontSize: 10 },
  disabled: { opacity: 0.32 },
  pressed: { opacity: 0.58 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.backdropStrong },
  sheet: { height: '82%', paddingTop: spacing.sm, paddingHorizontal: spacing.lg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  handle: { width: 36, height: 4, marginBottom: spacing.sm, alignSelf: 'center', borderRadius: 2 },
  sheetHeader: { minHeight: 46, flexDirection: 'row', alignItems: 'center' },
  sheetTitle: { flex: 1, fontFamily: typography.display, fontSize: 18 },
  sheetHint: { marginTop: spacing.sm, fontSize: 11, lineHeight: 18 },
  sheetInput: { minHeight: 52, marginTop: spacing.lg, paddingHorizontal: spacing.md, borderRadius: radius.sm, fontFamily: typography.mono, fontSize: 16 },
  primaryAction: { minHeight: 48, marginTop: spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  primaryActionText: { color: colors.onLife, fontSize: 12, fontWeight: '700' },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 11, fontWeight: '600' },
  toolScroll: { flex: 1 },
  toolList: { paddingBottom: spacing.lg },
  tocRow: { minHeight: 52, paddingRight: spacing.md, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  currentBar: { width: 3, height: 20, marginRight: spacing.sm, borderRadius: 2 },
  tocLabel: { flex: 1, fontSize: 13, lineHeight: 20 },
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
  displayContent: { paddingBottom: spacing.xl },
  settingLabel: { marginTop: spacing.lg, marginBottom: spacing.sm, fontSize: 10, fontWeight: '600' },
  themeOptions: { flexDirection: 'row', gap: spacing.sm },
  themeOption: { flex: 1, minWidth: 0, minHeight: 66, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm },
  themeSwatch: { width: 28, height: 28, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.16)', borderRadius: 14 },
  themeLabel: { marginTop: 5, fontSize: 10, fontWeight: '600' },
  stepper: { minHeight: 50, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.sm },
  stepperValue: { fontFamily: typography.mono, fontSize: 13 },
  segmented: { minHeight: 46, marginBottom: spacing.sm, padding: 3, flexDirection: 'row', borderRadius: radius.sm },
  segment: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  segmentText: { fontSize: 11, fontWeight: '600' },
}));
