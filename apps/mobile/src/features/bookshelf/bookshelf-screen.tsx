import { useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { Book, BookList, BookParseStatus, Media, ReaderTocItem } from '@still-alive/types';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { feedback } from '../../shared/feedback';
import { useAppState } from '../../application/state/app-state';
import { bookFormatFromName, pickLocalBookAssets, pickLocalBooksFromDirectory } from '../../infrastructure/files/local-assets';
import { extractBookCover } from '../../infrastructure/files/book-cover-thumbnail';
import { persistPickedImage } from '../../infrastructure/files/local-media';
import { pageFromBookLocation } from './book-reader';
import { classifyReflowError, clearReflowBookCache, isReflowBookFormat, probeReflowBook, reflowErrorMessage } from './book-reflow-cache';
import { createThemedStyles } from '../../shared/theme/app-theme';
import { DraggableBottomSheet } from '../../shared/components/draggable-bottom-sheet';
import { ToolPageHeader, ToolPageHeaderAction } from '../../shared/components/tool-page-header';
import { BookListCover } from './book-list-cover';

type SortMode = 'reading' | 'imported' | 'title';

export default function BookshelfScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { bookListEntries, bookLists, books, createBook, createBookList, deleteBook, discardMedia, media, saveMedia, updateBook } = useAppState();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('reading');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [importOptionsVisible, setImportOptionsVisible] = useState(false);
  const [sortVisible, setSortVisible] = useState(false);
  const [createListVisible, setCreateListVisible] = useState(false);
  const [listName, setListName] = useState('');
  const [actionBook, setActionBook] = useState<Book | null>(null);
  const [infoBook, setInfoBook] = useState<Book | null>(null);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingAuthor, setEditingAuthor] = useState('');
  const [editingCoverId, setEditingCoverId] = useState<string | null>(null);
  const [pendingCover, setPendingCover] = useState<Media | null>(null);
  const importingRef = useRef(false);
  const booksRef = useRef(books);
  const coverBackfillRunningRef = useRef(false);
  const coverBackfillAttemptedRef = useRef(new Set<string>());
  const mountedRef = useRef(true);
  const [coverBackfillTick, setCoverBackfillTick] = useState(0);

  booksRef.current = books;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (coverBackfillRunningRef.current) return;
    const book = books.find((item) => !item.coverMediaId
      && supportsAutomaticCover(item.format)
      && media.some((source) => source.id === item.fileMediaId)
      && !coverBackfillAttemptedRef.current.has(item.id));
    if (!book) return;
    const source = media.find((item) => item.id === book.fileMediaId);
    if (!source) return;

    coverBackfillAttemptedRef.current.add(book.id);
    coverBackfillRunningRef.current = true;
    void (async () => {
      let cover: Media | null = null;
      try {
        cover = await extractBookCover(source, book.format);
        if (!cover) return;
        const current = booksRef.current.find((item) => item.id === book.id);
        if (!mountedRef.current || !current || current.coverMediaId) return;
        await saveMedia(cover);
        const latest = booksRef.current.find((item) => item.id === book.id);
        if (!mountedRef.current || !latest || latest.coverMediaId) return;
        await updateBook({ ...latest, coverMediaId: cover.id, updatedAt: new Date().toISOString() });
        cover = null;
      } catch {
        // 单本封面失败不影响书架及其他书籍补录。
      } finally {
        if (cover) await discardMedia(cover).catch(() => undefined);
        coverBackfillRunningRef.current = false;
        if (mountedRef.current) setCoverBackfillTick((value) => value + 1);
      }
    })();
  }, [books, coverBackfillTick, discardMedia, media, saveMedia, updateBook]);

  const readableBookCount = books.filter((book) => book.parseStatus === 'ready').length;
  const continueBook = useMemo(() => books
    .filter((book) => book.parseStatus === 'ready' && book.progress > 0 && book.progress < 1)
    .sort((a, b) => compareDates(readingDate(b) ?? b.updatedAt, readingDate(a) ?? a.updatedAt))[0] ?? null, [books]);
  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return books
      .filter((book) => `${book.title} ${book.author ?? ''}`.toLocaleLowerCase().includes(query))
      .sort((a, b) => {
        if (sort === 'title') return a.title.localeCompare(b.title, 'zh-CN', { sensitivity: 'base' });
        if (sort === 'imported') return compareDates(b.createdAt, a.createdAt);
        const aReadAt = readingDate(a);
        const bReadAt = readingDate(b);
        if (aReadAt && !bReadAt) return -1;
        if (!aReadAt && bReadAt) return 1;
        return compareDates(bReadAt ?? b.createdAt, aReadAt ?? a.createdAt);
      });
  }, [books, search, sort]);

  const createList = async () => {
    if (!listName.trim()) return;
    try {
      const list = await createBookList(listName);
      setListName('');
      setCreateListVisible(false);
      router.push({ pathname: '/book-list', params: { id: list.id } } as never);
    } catch (cause) {
      feedback.alert('创建失败', cause instanceof Error ? cause.message : '请稍后重试。');
    }
  };

  const openList = (list: BookList) => {
    router.push({ pathname: '/book-list', params: { id: list.id } } as never);
  };

  const importBooks = async (source: 'files' | 'directory') => {
    setImportOptionsVisible(false);
    if (importingRef.current) return;
    importingRef.current = true;
    setImporting(true);
    try {
      const assets = source === 'files' ? await pickLocalBookAssets() : await pickLocalBooksFromDirectory();
      if (!assets.length) return;
      setImportProgress({ current: 0, total: assets.length });

      const bookMediaIds = new Set(books.map((book) => book.fileMediaId));
      const knownChecksums = new Set(media.filter((item) => bookMediaIds.has(item.id) && item.checksum).map((item) => item.checksum));
      let imported = 0;
      let skipped = 0;
      const failures: string[] = [];

      for (let index = 0; index < assets.length; index += 1) {
        setImportProgress({ current: index + 1, total: assets.length });
        const asset = assets[index];
        const name = asset.originalName ?? '未命名书籍';
        if (knownChecksums.has(asset.checksum)) {
          skipped += 1;
          await discardMedia(asset).catch(() => undefined);
          continue;
        }

        const format = bookFormatFromName(name);
        if (!format) {
          failures.push(`${name}：无法识别书籍格式`);
          await discardMedia(asset).catch(() => undefined);
          continue;
        }

        const now = new Date().toISOString();
        const readable = format === 'pdf' || format === 'epub' || isReflowBookFormat(format);
        let parseStatus: BookParseStatus = readable ? 'ready' : 'unsupported';
        let parseMessage: string | null = readable ? null : `${format.toUpperCase()} 当前仅归档：该格式不在新导入列表中，原始文件会保留。`;
        let parsedTitle: string | null = null;
        let parsedAuthor: string | null = null;
        let chapterCache: ReaderTocItem[] = [];
        if (isReflowBookFormat(format)) {
          try {
            const probe = await probeReflowBook(asset.localPath, format);
            parsedTitle = probe.title;
            parsedAuthor = probe.author;
            chapterCache = probe.chapterCache;
          } catch (cause) {
            parseStatus = classifyReflowError(cause);
            parseMessage = reflowErrorMessage(cause);
          }
        }
        const cover = await extractBookCover(asset, format).catch(() => null);
        try {
          await saveMedia(asset);
          if (cover) await saveMedia(cover);
          await createBook({
            id: `book_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`,
            fileMediaId: asset.id,
            coverMediaId: cover?.id ?? null,
            title: parsedTitle || name.replace(/\.[^.]+$/, '') || '未命名书籍',
            author: parsedAuthor,
            format,
            parseStatus,
            parseMessage,
            progress: 0,
            lastReadAt: null,
            location: null,
            locationType: format === 'pdf' ? 'pdf-page' : null,
            chapterHref: null,
            chapterTitle: null,
            engineVersion: null,
            pageCount: null,
            chapterCache,
            createdAt: now,
            updatedAt: now,
          });
          knownChecksums.add(asset.checksum);
          imported += 1;
        } catch (cause) {
          failures.push(`${name}：${cause instanceof Error ? cause.message : '请稍后重试'}`);
          if (cover) await discardMedia(cover).catch(() => undefined);
          await discardMedia(asset).catch(() => undefined);
        }
      }

      const summary = [`已导入 ${imported} 本`, `已跳过 ${skipped} 本`];
      if (failures.length) summary.push(`导入失败 ${failures.length} 本`, failures[0]);
      const title = failures.length ? (imported ? '导入完成，部分失败' : '导入失败') : (imported ? '导入完成' : '没有新书');
      feedback.alert(title, summary.join('\n'));
    } catch (cause) {
      feedback.alert('导入失败', cause instanceof Error ? cause.message : '请稍后重试。');
    } finally {
      importingRef.current = false;
      setImporting(false);
      setImportProgress(null);
    }
  };

  const openEditor = (book: Book) => {
    setActionBook(null);
    setEditingBook(book);
    setEditingTitle(book.title);
    setEditingAuthor(book.author ?? '');
    setEditingCoverId(book.coverMediaId);
    setPendingCover(null);
  };

  const closeEditor = () => {
    if (pendingCover) void discardMedia(pendingCover).catch(() => undefined);
    setPendingCover(null);
    setEditingBook(null);
  };

  const chooseCover = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [3, 4], mediaTypes: ['images'], quality: 0.9 });
    if (result.canceled || !result.assets[0]) return;
    try {
      const item = await persistPickedImage(result.assets[0]);
      if (pendingCover) await discardMedia(pendingCover).catch(() => undefined);
      setPendingCover(item);
      setEditingCoverId(item.id);
    } catch (cause) {
      feedback.alert('封面保存失败', cause instanceof Error ? cause.message : '请稍后重试。');
    }
  };

  const removeEditingCover = () => {
    if (pendingCover) void discardMedia(pendingCover).catch(() => undefined);
    setPendingCover(null);
    setEditingCoverId(null);
  };

  const saveEditingBook = async () => {
    if (!editingBook) return;
    const title = editingTitle.trim();
    if (!title) {
      feedback.alert('无法保存', '书名不能为空。');
      return;
    }
    const oldCoverId = editingBook.coverMediaId;
    const newCoverId = editingCoverId;
    let pendingCommitted = false;
    try {
      if (pendingCover) {
        await saveMedia(pendingCover);
        pendingCommitted = true;
      }
      await updateBook({ ...editingBook, title, author: editingAuthor.trim() || null, coverMediaId: newCoverId, updatedAt: new Date().toISOString() });
      if (oldCoverId && oldCoverId !== newCoverId) {
        const oldCover = media.find((item) => item.id === oldCoverId);
        if (oldCover) await discardMedia(oldCover).catch(() => undefined);
      }
      setPendingCover(null);
      setEditingBook(null);
    } catch (cause) {
      if (pendingCommitted && pendingCover) await discardMedia(pendingCover).catch(() => undefined);
      feedback.alert('保存失败', cause instanceof Error ? cause.message : '请稍后重试。');
    }
  };

  const remove = (book: Book) => {
    setActionBook(null);
    feedback.alert('删除书籍？', '原始文件会删除，摘抄与引用快照会保留。', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => { clearReflowBookCache(book.id); void deleteBook(book.id); } },
    ]);
  };

  const openBook = (book: Book) => {
    if (book.parseStatus === 'ready') {
      setActionBook(null);
      router.push({ pathname: '/reader', params: { id: book.id } } as never);
      return;
    }
    setActionBook(book);
  };

  const openInfo = (book: Book) => {
    setActionBook(null);
    setInfoBook(book);
  };

  const listHeader = <>
    <View style={styles.intro}>
      <View style={styles.introCopy}>
        <Text style={styles.eyebrow}>PERSONAL LIBRARY</Text>
        <Text style={styles.heading}>把读过的书，留在身边。</Text>
        <Text style={styles.subheading}>{books.length ? `${books.length} 本收藏，${readableBookCount} 本可阅读` : '导入书籍，保留阅读进度与书摘。'}</Text>
      </View>
      <View style={styles.introIcon}><SymbolView name={{ android: 'menu_book', ios: 'book.closed.fill', web: 'menu_book' }} size={26} tintColor={colors.life} type="hierarchical" /></View>
    </View>

    {importProgress ? <View style={styles.importProgress}><ActivityIndicator color={colors.life} size="small" /><View style={styles.importProgressCopy}><Text style={styles.importProgressTitle}>正在导入 {importProgress.current} / {importProgress.total}</Text><View style={styles.importProgressTrack}><View style={[styles.importProgressFill, { width: `${Math.round(importProgress.current / importProgress.total * 100)}%` }]} /></View></View></View> : null}
    {continueBook ? <ContinueReading book={continueBook} media={media} onPress={() => openBook(continueBook)} /> : null}

    <View style={styles.bookListSection}>
      <View style={styles.bookListHeader}><View style={styles.listTitleRow}><Text style={styles.listTitle}>书单</Text><Text style={styles.listCount}>{bookLists.length}</Text></View><Pressable accessibilityLabel="创建书单" onPress={() => setCreateListVisible(true)} style={styles.bookListAdd}><SymbolView name={{ android: 'playlist_add', ios: 'text.badge.plus', web: 'playlist_add' }} size={21} tintColor={colors.life} type="hierarchical" /></Pressable></View>
      {bookLists.length ? <ScrollView horizontal contentContainerStyle={styles.bookListContent} showsHorizontalScrollIndicator={false}>{bookLists.map((list) => {
        const listBooks = bookListEntries.filter((entry) => entry.listId === list.id).map((entry) => books.find((book) => book.id === entry.bookId)).filter((book): book is Book => Boolean(book));
        return <Pressable key={list.id} accessibilityRole="button" onPress={() => openList(list)} style={({ pressed }) => [styles.bookListCard, pressed && styles.pressed]}><BookListCover books={listBooks} media={media} size={86} /><Text numberOfLines={1} style={styles.bookListName}>{list.name}</Text><Text style={styles.bookListMeta}>{listBooks.length} 本书</Text></Pressable>;
      })}</ScrollView> : <Pressable onPress={() => setCreateListVisible(true)} style={({ pressed }) => [styles.bookListEmpty, pressed && styles.pressed]}><View><Text style={styles.bookListEmptyTitle}>创建第一张书单</Text><Text style={styles.bookListEmptyText}>按主题整理你的私人藏书</Text></View><Text style={styles.bookListEmptyAction}>创建</Text></Pressable>}
    </View>

    <View style={styles.controls}>
      <View style={styles.searchBar}>
        <SymbolView name={{ android: 'search', ios: 'magnifyingglass', web: 'search' }} size={18} tintColor={colors.inkFaint} type="hierarchical" />
        <TextInput accessibilityLabel="搜索书名或作者" onChangeText={setSearch} placeholder="搜索书名或作者" placeholderTextColor={colors.inkFaint} style={styles.searchInput} value={search} />
        {search ? <Pressable accessibilityLabel="清除书架搜索" onPress={() => setSearch('')} style={styles.clearSearch}><SymbolView name={{ android: 'cancel', ios: 'xmark.circle.fill', web: 'cancel' }} size={17} tintColor={colors.inkFaint} type="hierarchical" /></Pressable> : null}
      </View>
      <Pressable accessibilityLabel="选择书架排序" accessibilityRole="button" onPress={() => setSortVisible(true)} style={({ pressed }) => [styles.sortButton, pressed && styles.pressed]}>
        <SymbolView name={{ android: 'sort', ios: 'arrow.up.arrow.down', web: 'sort' }} size={17} tintColor={colors.life} type="hierarchical" />
        <Text style={styles.sortButtonText}>{sortLabel(sort)}</Text>
      </Pressable>
    </View>

    <View style={styles.listHeader}><View style={styles.listTitleRow}><Text style={styles.listTitle}>{search ? '搜索结果' : '全部书籍'}</Text><Text style={styles.listCount}>{visible.length} 本</Text></View><Text style={styles.listHint}>{sortLabel(sort)}</Text></View>
  </>;

  return <SafeAreaView style={styles.safe}>
    <ToolPageHeader
      onBack={() => router.back()}
      right={<ToolPageHeaderAction accessibilityLabel={importing ? '正在导入书籍' : '导入书籍'} disabled={importing} onPress={() => setImportOptionsVisible(true)}>{importing ? <ActivityIndicator color={colors.life} size="small" /> : <SymbolView name={{ android: 'add', ios: 'plus', web: 'add' }} size={22} tintColor={colors.life} type="hierarchical" />}</ToolPageHeaderAction>}
      title="我的书架"
    />
    <FlatList
      contentContainerStyle={styles.content}
      data={visible}
      initialNumToRender={12}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      keyExtractor={(book) => book.id}
      ListEmptyComponent={<EmptyState hasBooks={books.length > 0} onImport={() => setImportOptionsVisible(true)} />}
      ListHeaderComponent={listHeader}
      renderItem={({ item }) => <BookRow book={item} media={media} onMore={() => setActionBook(item)} onPress={() => openBook(item)} />}
      showsVerticalScrollIndicator={false}
      windowSize={7}
    />

    <DraggableBottomSheet accessibilityLabel="选择导入方式，向下拖动关闭" accessibilityRole="menu" onClose={() => setImportOptionsVisible(false)} open={importOptionsVisible} sheetStyle={[styles.actionSheet, { paddingBottom: Math.max(spacing.xl, insets.bottom + spacing.md) }]}>
      <SheetTitle title="导入书籍" subtitle="原始文件会复制到应用沙盒，不会被重编码。" />
      <SheetOption icon={{ android: 'library_add', ios: 'doc.on.doc', web: 'library_add' }} label="选择多本书籍" onPress={() => void importBooks('files')} />
      <SheetOption icon={{ android: 'folder_open', ios: 'folder', web: 'folder_open' }} label="从文件夹导入" onPress={() => void importBooks('directory')} />
      <SheetCancel onPress={() => setImportOptionsVisible(false)} />
    </DraggableBottomSheet>

    <DraggableBottomSheet accessibilityLabel="选择书架排序，向下拖动关闭" accessibilityRole="menu" onClose={() => setSortVisible(false)} open={sortVisible} sheetStyle={[styles.actionSheet, { paddingBottom: Math.max(spacing.xl, insets.bottom + spacing.md) }]}>
      <SheetTitle title="排序方式" subtitle="最近阅读只根据实际阅读进度更新。" />
      {(['reading', 'imported', 'title'] as SortMode[]).map((mode) => <Pressable key={mode} accessibilityRole="menuitem" onPress={() => { setSort(mode); setSortVisible(false); }} style={({ pressed }) => [styles.sortOption, pressed && styles.pressed]}><Text style={[styles.sortOptionText, sort === mode && styles.sortOptionTextActive]}>{sortLabel(mode)}</Text>{sort === mode ? <SymbolView name={{ android: 'check', ios: 'checkmark', web: 'check' }} size={18} tintColor={colors.life} type="hierarchical" /> : null}</Pressable>)}
      <SheetCancel onPress={() => setSortVisible(false)} />
    </DraggableBottomSheet>

    <DraggableBottomSheet keyboardAvoiding onClose={() => setCreateListVisible(false)} open={createListVisible} sheetStyle={[styles.editSheet, { paddingBottom: Math.max(spacing.lg, insets.bottom + spacing.md) }]}>
      <Text style={styles.sheetTitle}>创建书单</Text><Text style={styles.editSectionLabel}>书单名称</Text><TextInput autoFocus maxLength={40} onChangeText={setListName} onSubmitEditing={() => void createList()} placeholder="例如：这个秋天想读" placeholderTextColor={colors.inkFaint} returnKeyType="done" style={styles.editInput} value={listName} /><Pressable accessibilityRole="button" disabled={!listName.trim()} onPress={() => void createList()} style={({ pressed }) => [styles.saveButton, !listName.trim() && styles.disabled, pressed && styles.pressed]}><Text style={styles.saveButtonText}>创建</Text></Pressable>
    </DraggableBottomSheet>

    <DraggableBottomSheet accessibilityLabel={actionBook ? `管理 ${actionBook.title}，向下拖动关闭` : undefined} accessibilityRole="menu" onClose={() => setActionBook(null)} open={Boolean(actionBook)} sheetStyle={[styles.actionSheet, { paddingBottom: Math.max(spacing.xl, insets.bottom + spacing.md) }]}>
      {actionBook ? <>
        <View style={styles.actionPreview}><BookCover book={actionBook} media={media} size="small" /><View style={styles.actionCopy}><Text numberOfLines={2} style={styles.actionTitle}>{actionBook.title}</Text><Text style={styles.actionMeta}>{formatLabel(actionBook.format)}，{statusLabel(actionBook)}</Text></View></View>
        {actionBook.parseStatus === 'ready' ? <SheetOption icon={{ android: 'menu_book', ios: 'book.closed', web: 'menu_book' }} label={actionBook.progress > 0 ? '继续阅读' : '开始阅读'} onPress={() => openBook(actionBook)} /> : <View style={styles.statusExplanation}><Text style={[styles.statusExplanationLabel, isBookFailure(actionBook) && styles.statusExplanationDanger]}>{statusLabel(actionBook)}</Text><Text style={styles.statusExplanationText}>{statusMessage(actionBook)}</Text></View>}
        <SheetOption icon={{ android: 'edit', ios: 'pencil', web: 'edit' }} label="编辑书籍信息" onPress={() => openEditor(actionBook)} />
        <SheetOption icon={{ android: 'description', ios: 'doc.text', web: 'description' }} label="查看文件信息" onPress={() => openInfo(actionBook)} />
        <SheetOption destructive icon={{ android: 'delete_outline', ios: 'trash', web: 'delete_outline' }} label="删除书籍" onPress={() => remove(actionBook)} />
        <SheetCancel onPress={() => setActionBook(null)} />
      </> : null}
    </DraggableBottomSheet>

    <DraggableBottomSheet accessibilityLabel={infoBook ? `${infoBook.title} 的文件信息，向下拖动关闭` : undefined} onClose={() => setInfoBook(null)} open={Boolean(infoBook)} sheetStyle={[styles.actionSheet, { paddingBottom: Math.max(spacing.xl, insets.bottom + spacing.md) }]}>
      {infoBook ? <>
        <View style={styles.actionPreview}><BookCover book={infoBook} media={media} size="small" /><View style={styles.actionCopy}><Text numberOfLines={2} style={styles.actionTitle}>{infoBook.title}</Text><Text style={styles.actionMeta}>{infoBook.author || '作者未知'}</Text></View></View>
        <Text style={styles.editSectionLabel}>书籍状态</Text>
        <InfoRow label="格式" value={formatLabel(infoBook.format)} />
        <InfoRow label="状态" value={statusLabel(infoBook)} />
        <InfoRow label="阅读位置" value={infoBook.parseStatus === 'ready' ? progressLabel(infoBook) : statusMessage(infoBook)} last />
        <Text style={styles.editSectionLabel}>本地文件</Text>
        <InfoRow label="原始文件" value={media.find((item) => item.id === infoBook.fileMediaId)?.originalName || '未知'} />
        <InfoRow label="文件大小" value={formatFileSize(media.find((item) => item.id === infoBook.fileMediaId)?.sizeBytes ?? null)} />
        <InfoRow label="导入时间" value={formatDate(infoBook.createdAt)} />
        <InfoRow label="保存位置" value={formatLocalPath(media.find((item) => item.id === infoBook.fileMediaId)?.localPath)} last />
        <SheetCancel onPress={() => setInfoBook(null)} />
      </> : null}
    </DraggableBottomSheet>

    <DraggableBottomSheet accessibilityLabel={editingBook ? `编辑 ${editingBook.title}，向下拖动关闭` : undefined} onClose={closeEditor} open={Boolean(editingBook)} sheetStyle={[styles.editSheet, { paddingBottom: Math.max(spacing.lg, insets.bottom + spacing.md) }]}>
      {editingBook ? <ScrollView contentContainerStyle={styles.editContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.editHeader}><Text style={styles.sheetTitle}>编辑书籍</Text></View>
        <Pressable accessibilityLabel={editingCoverId ? '更换书籍封面' : '添加书籍封面'} onPress={() => void chooseCover()} style={({ pressed }) => [styles.editCoverButton, pressed && styles.pressed]}><BookCover book={{ ...editingBook, coverMediaId: editingCoverId }} media={[...media, ...(pendingCover ? [pendingCover] : [])]} size="large" /><View style={styles.coverBadge}><SymbolView name={{ android: 'edit', ios: 'pencil', web: 'edit' }} size={14} tintColor={colors.onLife} type="hierarchical" /></View></Pressable>
        {editingCoverId ? <Pressable onPress={removeEditingCover} style={styles.removeCoverButton}><Text style={styles.removeCoverText}>移除封面</Text></Pressable> : null}
        <EditField label="书名" value={editingTitle} onChangeText={setEditingTitle} placeholder="输入书名" />
        <EditField label="作者" value={editingAuthor} onChangeText={setEditingAuthor} placeholder="未知作者" />
        <Pressable accessibilityRole="button" disabled={!editingTitle.trim()} onPress={() => void saveEditingBook()} style={({ pressed }) => [styles.saveButton, !editingTitle.trim() && styles.disabled, pressed && styles.pressed]}><Text style={styles.saveButtonText}>保存修改</Text></Pressable>
      </ScrollView> : null}
    </DraggableBottomSheet>
  </SafeAreaView>;
}

function ContinueReading({ book, media, onPress }: { book: Book; media: Media[]; onPress(): void }) {
  return <View style={styles.continueSection}>
    <View style={styles.sectionHeader}><Text style={styles.sectionEyebrow}>CONTINUE READING</Text><Text style={styles.sectionHint}>上次读到这里</Text></View>
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.continueCard, pressed && styles.pressed]}>
      <BookCover book={book} media={media} size="large" />
      <View style={styles.continueCopy}><Text numberOfLines={2} style={styles.continueTitle}>{book.title}</Text><Text numberOfLines={1} style={styles.continueMeta}>{book.author || '作者未知'}{book.chapterTitle ? `，${book.chapterTitle}` : ''}</Text><ProgressBar book={book} /><Text style={styles.continueProgress}>{progressLabel(book)}</Text></View>
      <View style={styles.continueAction}><SymbolView name={{ android: 'play_arrow', ios: 'play.fill', web: 'play_arrow' }} size={17} tintColor={colors.onLife} type="hierarchical" /></View>
    </Pressable>
  </View>;
}

function BookRow({ book, media, onMore, onPress }: { book: Book; media: Media[]; onMore(): void; onPress(): void }) {
  const readable = book.parseStatus === 'ready';
  const failed = book.parseStatus === 'failed' || book.parseStatus === 'protected';
  return <View style={styles.row}>
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}>
      <BookCover book={book} media={media} size="medium" />
      <View style={styles.rowCopy}><Text numberOfLines={2} style={styles.rowTitle}>{book.title}</Text><Text numberOfLines={1} style={styles.rowAuthor}>{book.author || '作者未知'}</Text><View style={styles.rowMeta}><Text style={[styles.formatTag, !readable && styles.formatTagWarm, failed && styles.formatTagDanger]}>{formatLabel(book.format)}</Text><Text style={[styles.rowPosition, !readable && styles.rowPositionWarm, failed && styles.rowPositionDanger]}>{readable ? readingStatusLabel(book) : statusLabel(book)}</Text>{readable ? <Text style={styles.rowProgress}>{progressPercentage(book)}</Text> : null}</View></View>
    </Pressable>
    <Pressable accessibilityLabel={`管理 ${book.title}`} accessibilityRole="button" onPress={onMore} style={({ pressed }) => [styles.moreButton, pressed && styles.pressed]}><SymbolView name={{ android: 'more_vert', ios: 'ellipsis', web: 'more_vert' }} size={20} tintColor={colors.inkFaint} type="hierarchical" /></Pressable>
  </View>;
}

function BookCover({ book, media, size }: { book: Book; media: Media[]; size: 'small' | 'medium' | 'large' }) {
  const cover = book.coverMediaId ? media.find((item) => item.id === book.coverMediaId) : undefined;
  const style = size === 'large' ? styles.coverLarge : size === 'small' ? styles.coverSmall : styles.coverMedium;
  return <View style={[styles.cover, style, { backgroundColor: coverColor(book) }]}>{cover ? <Image accessibilityLabel={`${book.title} 封面`} resizeMode="cover" source={{ uri: cover.localPath }} style={styles.coverImage} /> : <><Text style={styles.coverFormat}>{formatLabel(book.format)}</Text><Text numberOfLines={3} style={styles.coverInitial}>{book.title.trim().slice(0, 1) || '书'}</Text></>}</View>;
}

function ProgressBar({ book }: { book: Book }) {
  return <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.round(Math.max(0, Math.min(1, book.progress)) * 100)}%` }]} /></View>;
}

function EmptyState({ hasBooks, onImport }: { hasBooks: boolean; onImport(): void }) {
  return <View style={styles.empty}><View style={styles.emptyIcon}><SymbolView name={{ android: hasBooks ? 'search_off' : 'menu_book', ios: hasBooks ? 'magnifyingglass' : 'book.closed', web: hasBooks ? 'search_off' : 'menu_book' }} size={25} tintColor={colors.life} type="hierarchical" /></View><Text style={styles.emptyTitle}>{hasBooks ? '没有找到匹配书籍' : '书架还是空的'}</Text><Text style={styles.emptyText}>{hasBooks ? '换一个关键词再试试。' : '支持 PDF、EPUB、无 DRM MOBI、TXT、HTML 和 FB2。'}</Text>{!hasBooks ? <Pressable accessibilityRole="button" onPress={onImport} style={styles.emptyButton}><Text style={styles.emptyButtonText}>导入书籍</Text></Pressable> : null}</View>;
}

function SheetTitle({ subtitle, title }: { subtitle: string; title: string }) { return <View style={styles.sheetTitleBlock}><Text style={styles.sheetTitle}>{title}</Text><Text style={styles.sheetSubtitle}>{subtitle}</Text></View>; }
function SheetOption({ destructive = false, icon, label, onPress }: { destructive?: boolean; icon: ComponentProps<typeof SymbolView>['name']; label: string; onPress(): void }) { return <Pressable accessibilityRole="menuitem" onPress={onPress} style={({ pressed }) => [styles.sheetOption, pressed && styles.pressed]}><SymbolView name={icon} size={20} tintColor={destructive ? colors.danger : colors.ink} type="hierarchical" /><Text style={[styles.sheetOptionText, destructive && styles.sheetOptionDanger]}>{label}</Text></Pressable>; }
function SheetCancel({ onPress }: { onPress(): void }) { return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.sheetCancel, pressed && styles.pressed]}><Text style={styles.sheetCancelText}>取消</Text></Pressable>; }
function EditField({ label, onChangeText, placeholder, value }: { label: string; onChangeText(value: string): void; placeholder: string; value: string }) { return <View style={styles.editField}><Text style={styles.editLabel}>{label}</Text><TextInput maxLength={120} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.inkFaint} style={styles.editInput} value={value} /></View>; }
function InfoRow({ label, last = false, value }: { label: string; last?: boolean; value: string }) { return <View style={[styles.infoRow, last && styles.infoRowLast]}><Text style={styles.infoLabel}>{label}</Text><Text numberOfLines={2} style={styles.infoValue}>{value}</Text></View>; }

function sortLabel(sort: SortMode): string { return sort === 'reading' ? '最近阅读' : sort === 'imported' ? '最近导入' : '书名'; }
function formatLabel(format: Book['format']): string { return format.toUpperCase(); }
function statusLabel(book: Book): string { return book.parseStatus === 'ready' ? '可阅读' : book.parseStatus === 'protected' ? '受保护' : book.parseStatus === 'failed' ? '解析失败' : '仅归档'; }
function statusMessage(book: Book): string {
  if (book.parseMessage) return book.parseMessage;
  if (book.parseStatus === 'unsupported') return `${formatLabel(book.format)} 当前仅归档：暂无稳定的离线章节解析器，不会隐式转码；原始文件会保留。`;
  if (book.parseStatus === 'protected') return '文件受到 DRM 或密码保护，应用不会尝试绕过保护。原始文件仍保留在书架。';
  if (book.parseStatus === 'failed') return '文件解析失败，原始文件仍保留在书架，可以重新导入其他版本。';
  return '当前版本无法打开这本书，原始文件仍保留在书架。';
}
function progressLabel(book: Book): string {
  if (book.progress <= 0 && !book.location) return '尚未阅读';
  if (book.format === 'pdf') return book.pageCount ? `第 ${pageFromBookLocation(book.location)} / ${book.pageCount} 页` : `第 ${pageFromBookLocation(book.location)} 页`;
  if (book.progress >= 1) return '已读完';
  if (book.progress <= 0) return '尚未阅读';
  return `阅读至 ${Math.round(book.progress * 100)}%`;
}
function readingStatusLabel(book: Book): string {
  if (book.progress <= 0 && !book.location) return '尚未阅读';
  if (book.format === 'pdf') return book.pageCount ? `第 ${pageFromBookLocation(book.location)} / ${book.pageCount} 页` : `第 ${pageFromBookLocation(book.location)} 页`;
  if (book.progress >= 1) return '已读完';
  return '阅读中';
}
function progressPercentage(book: Book): string { return `${Math.round(Math.max(0, Math.min(1, book.progress)) * 100)}%`; }
function compareDates(a: string, b: string): number { return new Date(a).getTime() - new Date(b).getTime(); }
function readingDate(book: Book): string | null { return book.lastReadAt ?? (book.progress > 0 ? book.updatedAt : null); }
function isBookFailure(book: Book): boolean { return book.parseStatus === 'failed' || book.parseStatus === 'protected'; }
function supportsAutomaticCover(format: Book['format']): boolean { return format === 'pdf' || format === 'epub' || format === 'mobi' || format === 'fb2'; }
function coverColor(book: Book): string { if (book.parseStatus === 'failed' || book.parseStatus === 'protected') return colors.dangerLight; return book.format === 'pdf' ? colors.sunLight : book.format === 'epub' ? colors.lifeLight : colors.sunLight; }
function formatFileSize(bytes: number | null): string { if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return '未知'; if (bytes < 1_024) return `${Math.round(bytes)} B`; if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`; if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`; return `${(bytes / 1_073_741_824).toFixed(1)} GB`; }
function formatDate(value: string): string { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`; }
function formatLocalPath(value: string | undefined): string { if (!value) return '未知'; const path = value.startsWith('file://') ? value.slice('file://'.length) : value; try { return decodeURI(path); } catch { return path; } }

const styles = createThemedStyles(() => ({
  safe: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  intro: { minHeight: 124, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderTopRightRadius: radius.xl, borderBottomLeftRadius: radius.xl, backgroundColor: colors.sheet },
  introCopy: { flex: 1, paddingRight: spacing.md },
  eyebrow: { color: colors.life, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1.4 },
  heading: { marginTop: 7, color: colors.ink, fontFamily: typography.display, fontSize: 23, lineHeight: 30 },
  subheading: { marginTop: 7, color: colors.inkFaint, fontSize: 11 },
  introIcon: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderTopRightRadius: radius.md, borderBottomLeftRadius: radius.md, backgroundColor: colors.lifeLight },
  importProgress: { minHeight: 64, marginTop: spacing.md, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, backgroundColor: colors.sheet },
  importProgressCopy: { flex: 1, marginLeft: spacing.md },
  importProgressTitle: { color: colors.inkSoft, fontSize: 11, fontWeight: '600' },
  importProgressTrack: { height: 4, marginTop: 7, overflow: 'hidden', borderRadius: 2, backgroundColor: colors.lineSoft },
  importProgressFill: { height: '100%', borderRadius: 2, backgroundColor: colors.life },
  continueSection: { marginTop: spacing.xl },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing.sm },
  sectionEyebrow: { color: colors.life, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1.3 },
  sectionHint: { color: colors.inkFaint, fontSize: 10 },
  continueCard: { minHeight: 146, padding: spacing.md, flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, backgroundColor: colors.lifeLight },
  continueCopy: { flex: 1, minWidth: 0, marginLeft: spacing.md, paddingRight: spacing.sm },
  continueTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 18, lineHeight: 24 },
  continueMeta: { marginTop: 5, color: colors.inkSoft, fontSize: 10 },
  continueProgress: { marginTop: 6, color: colors.lifeDeep, fontFamily: typography.mono, fontSize: 9 },
  continueAction: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: colors.life },
  bookListSection: { marginTop: spacing.xl },
  bookListHeader: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bookListAdd: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  bookListContent: { paddingTop: spacing.xs, paddingBottom: spacing.sm, gap: spacing.sm },
  bookListCard: { width: 92 },
  bookListName: { marginTop: spacing.sm, color: colors.ink, fontSize: 12, fontWeight: '600' },
  bookListMeta: { marginTop: 3, color: colors.inkFaint, fontSize: 10 },
  bookListEmpty: { minHeight: 66, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.md, backgroundColor: colors.sheet },
  bookListEmptyTitle: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  bookListEmptyText: { marginTop: 4, color: colors.inkFaint, fontSize: 11 },
  bookListEmptyAction: { color: colors.life, fontSize: 12, fontWeight: '700' },
  controls: { marginTop: spacing.xl, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  searchBar: { flex: 1, minHeight: 46, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderRadius: radius.md, backgroundColor: colors.sheet },
  searchInput: { flex: 1, minHeight: 46, paddingHorizontal: spacing.sm, color: colors.ink, fontSize: 12 },
  clearSearch: { width: 32, height: 40, alignItems: 'center', justifyContent: 'center' },
  sortButton: { minHeight: 46, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lifeLine, borderRadius: radius.md, backgroundColor: colors.lifeLight },
  sortButtonText: { color: colors.life, fontSize: 10, fontWeight: '700' },
  listHeader: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  listTitleRow: { flexDirection: 'row', alignItems: 'baseline' },
  listTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 19 },
  listCount: { marginLeft: spacing.sm, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 10 },
  listHint: { color: colors.inkFaint, fontSize: 10 },
  row: { minHeight: 104, paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  rowMain: { flex: 1, minWidth: 0, minHeight: 76, flexDirection: 'row', alignItems: 'center' },
  rowCopy: { flex: 1, minWidth: 0, marginLeft: spacing.md },
  rowTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 16, lineHeight: 21 },
  rowAuthor: { marginTop: 4, color: colors.inkFaint, fontSize: 10 },
  rowMeta: { marginTop: 7, flexDirection: 'row', alignItems: 'center' },
  formatTag: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5, color: colors.life, backgroundColor: colors.lifeLight, fontFamily: typography.mono, fontSize: 8 },
  formatTagWarm: { color: colors.sun, backgroundColor: colors.sunLight },
  formatTagDanger: { color: colors.danger, backgroundColor: colors.dangerLight },
  rowPosition: { marginLeft: spacing.sm, color: colors.inkSoft, fontSize: 10 },
  rowPositionWarm: { color: colors.sun },
  rowPositionDanger: { color: colors.danger },
  rowProgress: { marginLeft: 'auto', color: colors.life, fontFamily: typography.mono, fontSize: 10 },
  moreButton: { width: 44, height: 52, alignItems: 'center', justifyContent: 'center' },
  cover: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  coverSmall: { width: 50, height: 68 },
  coverMedium: { width: 56, height: 76 },
  coverLarge: { width: 72, height: 96 },
  coverImage: { width: '100%', height: '100%' },
  coverFormat: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: 8, letterSpacing: 0.6 },
  coverInitial: { marginTop: 4, paddingHorizontal: 6, color: colors.ink, fontFamily: typography.display, fontSize: 22, textAlign: 'center' },
  progressTrack: { height: 4, marginTop: 7, overflow: 'hidden', borderRadius: 2, backgroundColor: colors.lineSoft },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: colors.life },
  empty: { marginTop: spacing.xl, padding: spacing.xl, alignItems: 'center', borderRadius: radius.lg, backgroundColor: colors.sheet },
  emptyIcon: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 28, backgroundColor: colors.lifeLight },
  emptyTitle: { marginTop: spacing.md, color: colors.ink, fontFamily: typography.display, fontSize: 19 },
  emptyText: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: 11, textAlign: 'center' },
  emptyButton: { minHeight: 44, marginTop: spacing.lg, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life },
  emptyButtonText: { color: colors.onLife, fontSize: 11, fontWeight: '700' },
  actionSheet: { paddingHorizontal: spacing.lg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.sheet },
  sheetTitleBlock: { paddingBottom: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  sheetTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 21 },
  sheetSubtitle: { marginTop: 5, color: colors.inkFaint, fontSize: 10, lineHeight: 16 },
  sheetOption: { minHeight: 56, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  sheetOptionText: { color: colors.ink, fontSize: 13 },
  sheetOptionDanger: { color: colors.danger },
  sheetCancel: { minHeight: 48, marginTop: spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.paper },
  sheetCancelText: { color: colors.inkSoft, fontSize: 11, fontWeight: '600' },
  sortOption: { minHeight: 54, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  sortOptionText: { color: colors.inkSoft, fontSize: 13 },
  sortOptionTextActive: { color: colors.life, fontWeight: '700' },
  actionPreview: { minHeight: 82, paddingBottom: spacing.md, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  actionCopy: { flex: 1, minWidth: 0, marginLeft: spacing.md },
  actionTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 17, lineHeight: 22 },
  actionMeta: { marginTop: 4, color: colors.inkFaint, fontSize: 10 },
  statusExplanation: { paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  statusExplanationLabel: { color: colors.sun, fontSize: 12, fontWeight: '700' },
  statusExplanationDanger: { color: colors.danger },
  statusExplanationText: { marginTop: 5, color: colors.inkSoft, fontSize: 11, lineHeight: 17 },
  editSheet: { maxHeight: '92%', paddingHorizontal: spacing.lg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.sheet },
  editContent: { paddingBottom: spacing.sm },
  editHeader: { minHeight: 48, justifyContent: 'center' },
  editCoverButton: { alignSelf: 'center', marginTop: spacing.sm },
  coverBadge: { position: 'absolute', right: -3, bottom: -3, width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.sheet, borderRadius: 14, backgroundColor: colors.life },
  removeCoverButton: { alignSelf: 'center', marginTop: spacing.sm, padding: spacing.xs },
  removeCoverText: { color: colors.danger, fontSize: 10 },
  editField: { marginTop: spacing.lg },
  editLabel: { marginBottom: spacing.sm, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1 },
  editInput: { minHeight: 50, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.paper, color: colors.ink, fontSize: 14 },
  editSectionLabel: { marginTop: spacing.xl, marginBottom: spacing.sm, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1 },
  infoRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  infoRowLast: { borderBottomWidth: 0 },
  infoLabel: { width: 82, color: colors.inkFaint, fontSize: 10 },
  infoValue: { flex: 1, color: colors.inkSoft, fontSize: 11, textAlign: 'right' },
  saveButton: { minHeight: 50, marginTop: spacing.xl, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life },
  saveButtonText: { color: colors.onLife, fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.66 },
}));
