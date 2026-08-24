import { useMemo, useState } from 'react';
import type { ComponentProps } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { Book, Media } from '@still-alive/types';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { useAppState } from '../../application/state/app-state';
import { DraggableBottomSheet } from '../../shared/components/draggable-bottom-sheet';
import { feedback } from '../../shared/feedback';
import { createThemedStyles } from '../../shared/theme/app-theme';
import { ToolPageHeader, ToolPageHeaderAction } from '../../shared/components/tool-page-header';
import { pageFromBookLocation } from './book-reader';
import { BookListCover } from './book-list-cover';

export default function BookListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { addBooksToList, bookListEntries, bookLists, books, deleteBookList, media, removeBookFromList, renameBookList } = useAppState();
  const [manageVisible, setManageVisible] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [renameVisible, setRenameVisible] = useState(false);
  const [listName, setListName] = useState('');
  const [selectedBookIds, setSelectedBookIds] = useState<Set<string>>(new Set());
  const list = bookLists.find((item) => item.id === id);
  const listBooks = useMemo(() => {
    const byId = new Map(books.map((book) => [book.id, book]));
    return bookListEntries.filter((entry) => entry.listId === id).map((entry) => byId.get(entry.bookId)).filter((book): book is Book => Boolean(book));
  }, [bookListEntries, books, id]);
  const listBookIds = useMemo(() => new Set(listBooks.map((book) => book.id)), [listBooks]);
  const availableBooks = useMemo(() => books.filter((book) => !listBookIds.has(book.id)), [books, listBookIds]);

  const openPicker = () => {
    setSelectedBookIds(new Set());
    setPickerVisible(true);
  };

  const toggleBook = (bookId: string) => {
    setSelectedBookIds((current) => {
      const next = new Set(current);
      if (next.has(bookId)) next.delete(bookId);
      else next.add(bookId);
      return next;
    });
  };

  const addSelectedBooks = async () => {
    if (!list || !selectedBookIds.size) return;
    try {
      await addBooksToList(list.id, [...selectedBookIds]);
      setSelectedBookIds(new Set());
      setPickerVisible(false);
    } catch (cause) {
      feedback.alert('添加失败', cause instanceof Error ? cause.message : '请稍后重试。');
    }
  };

  const openBook = (book: Book) => {
    if (book.parseStatus !== 'ready') {
      feedback.alert('暂时无法阅读', book.parseMessage || '这本书当前只能保存在书架中。');
      return;
    }
    router.push({ pathname: '/reader', params: { id: book.id } } as never);
  };

  const openRename = () => {
    if (!list) return;
    setManageVisible(false);
    setListName(list.name);
    setRenameVisible(true);
  };

  const saveName = async () => {
    if (!list || !listName.trim()) return;
    try {
      await renameBookList(list.id, listName);
      setRenameVisible(false);
    } catch (cause) {
      feedback.alert('保存失败', cause instanceof Error ? cause.message : '请稍后重试。');
    }
  };

  const confirmDelete = () => {
    if (!list) return;
    setManageVisible(false);
    feedback.alert('删除书单？', '只会删除书单，不会删除书架中的书籍。', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => void deleteBookList(list.id).then(() => router.back()).catch((cause: unknown) => feedback.alert('删除失败', cause instanceof Error ? cause.message : '请稍后重试。')) },
    ]);
  };

  const confirmRemove = (book: Book) => {
    if (!list) return;
    feedback.alert('移出书单？', `《${book.title}》仍会保留在书架中。`, [
      { text: '取消', style: 'cancel' },
      { text: '移出', style: 'destructive', onPress: () => void removeBookFromList(list.id, book.id) },
    ]);
  };

  if (!list) return <SafeAreaView style={styles.safe}><ToolPageHeader onBack={() => router.back()} title="书单" /><View style={styles.missing}><Text style={styles.emptyTitle}>书单不存在</Text><Text style={styles.emptyText}>它可能已经被删除。</Text></View></SafeAreaView>;

  return <SafeAreaView style={styles.safe}>
    <ToolPageHeader onBack={() => router.back()} right={<ToolPageHeaderAction accessibilityLabel="管理书单" onPress={() => setManageVisible(true)}><SymbolView name={{ android: 'more_vert', ios: 'ellipsis', web: 'more_vert' }} size={20} tintColor={colors.inkSoft} type="hierarchical" /></ToolPageHeaderAction>} title={list.name} />

    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.summary}><BookListCover books={listBooks} media={media} size={86} /><View style={styles.summaryCopy}><Text numberOfLines={2} style={styles.summaryTitle}>{list.name}</Text><Text style={styles.summaryMeta}>{listBooks.length} 本书</Text></View></View>
      <View style={styles.listHeader}><View style={styles.listTitleRow}><Text style={styles.listTitle}>书籍</Text><Text style={styles.listCount}>{listBooks.length}</Text></View><Pressable accessibilityLabel="添加书籍" onPress={openPicker} style={styles.addButton}><SymbolView name={{ android: 'library_add', ios: 'books.vertical.fill', web: 'library_add' }} size={20} tintColor={colors.life} type="hierarchical" /></Pressable></View>
      {listBooks.length ? listBooks.map((book) => <BookRow key={book.id} book={book} media={media} onPress={() => openBook(book)} onRemove={() => confirmRemove(book)} />) : <View style={styles.empty}><Text style={styles.emptyTitle}>书单还是空的</Text><Text style={styles.emptyText}>从书架里挑几本书放进来。</Text><Pressable accessibilityRole="button" onPress={openPicker} style={({ pressed }) => [styles.emptyAction, pressed && styles.pressed]}><SymbolView name={{ android: 'library_add', ios: 'books.vertical.fill', web: 'library_add' }} size={18} tintColor={colors.life} type="hierarchical" /><Text style={styles.emptyActionText}>添加书籍</Text></Pressable></View>}
    </ScrollView>

    <DraggableBottomSheet onClose={() => setPickerVisible(false)} open={pickerVisible} sheetStyle={[styles.pickerSheet, { paddingBottom: Math.max(spacing.lg, insets.bottom + spacing.md) }]}>
      <View style={styles.sheetHeading}><Text style={styles.sheetTitle}>添加书籍</Text><Text style={styles.sheetMeta}>已选择 {selectedBookIds.size} 本</Text></View>
      <ScrollView contentContainerStyle={styles.pickerContent} style={styles.pickerList}>{availableBooks.map((book) => { const checked = selectedBookIds.has(book.id); return <Pressable key={book.id} accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => toggleBook(book.id)} style={({ pressed }) => [styles.pickerRow, pressed && styles.pressed]}><View style={[styles.checkbox, checked && styles.checkboxActive]}>{checked ? <SymbolView name={{ android: 'check', ios: 'checkmark', web: 'check' }} size={15} tintColor={colors.onLife} type="hierarchical" /> : null}</View><BookThumb book={book} media={media} /><View style={styles.pickerCopy}><Text numberOfLines={1} style={styles.bookTitle}>{book.title}</Text><Text numberOfLines={1} style={styles.bookMeta}>{book.author || '作者未知'} · {book.format.toUpperCase()}</Text></View></Pressable>; })}{!availableBooks.length ? <View style={styles.pickerEmpty}><Text style={styles.emptyText}>书架中的书都已加入这个书单</Text></View> : null}</ScrollView>
      <Pressable disabled={!selectedBookIds.size} onPress={() => void addSelectedBooks()} style={[styles.confirmButton, !selectedBookIds.size && styles.disabled]}><Text style={styles.confirmButtonText}>添加 {selectedBookIds.size ? `${selectedBookIds.size} 本` : '书籍'}</Text></Pressable>
    </DraggableBottomSheet>

    <DraggableBottomSheet accessibilityRole="menu" onClose={() => setManageVisible(false)} open={manageVisible} sheetStyle={[styles.actionSheet, { paddingBottom: Math.max(spacing.lg, insets.bottom + spacing.md) }]}>
      <View style={styles.actionHeader}><BookListCover books={listBooks} media={media} size={64} /><View style={styles.actionCopy}><Text style={styles.actionLabel}>书单</Text><Text numberOfLines={2} style={styles.actionTitle}>{list.name}</Text><Text style={styles.actionMeta}>{listBooks.length} 本书</Text></View></View>
      <ActionOption icon={{ android: 'edit', ios: 'pencil', web: 'edit' }} label="重命名书单" onPress={openRename} />
      <ActionOption destructive icon={{ android: 'delete_outline', ios: 'trash', web: 'delete_outline' }} label="删除书单" onPress={confirmDelete} />
      <Pressable onPress={() => setManageVisible(false)} style={styles.cancelAction}><Text style={styles.cancelText}>取消</Text></Pressable>
    </DraggableBottomSheet>

    <DraggableBottomSheet keyboardAvoiding onClose={() => setRenameVisible(false)} open={renameVisible} sheetStyle={[styles.editSheet, { paddingBottom: Math.max(spacing.lg, insets.bottom + spacing.md) }]}>
      <Text style={styles.sheetTitle}>重命名书单</Text><Text style={styles.inputLabel}>书单名称</Text><TextInput autoFocus maxLength={40} onChangeText={setListName} onSubmitEditing={() => void saveName()} placeholder="输入书单名称" placeholderTextColor={colors.inkFaint} returnKeyType="done" selectTextOnFocus style={styles.editInput} value={listName} /><Pressable disabled={!listName.trim()} onPress={() => void saveName()} style={[styles.confirmButton, !listName.trim() && styles.disabled]}><Text style={styles.confirmButtonText}>保存</Text></Pressable>
    </DraggableBottomSheet>
  </SafeAreaView>;
}

function BookRow({ book, media, onPress, onRemove }: { book: Book; media: Media[]; onPress(): void; onRemove(): void }) {
  return <View style={styles.bookRow}><Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.bookMain, pressed && styles.pressed]}><BookThumb book={book} media={media} /><View style={styles.bookCopy}><Text numberOfLines={2} style={styles.bookTitle}>{book.title}</Text><Text numberOfLines={1} style={styles.bookMeta}>{book.author || '作者未知'} · {progressLabel(book)}</Text></View></Pressable><Pressable accessibilityLabel={`将 ${book.title} 移出书单`} onPress={onRemove} style={styles.removeButton}><SymbolView name={{ android: 'remove_circle_outline', ios: 'minus.circle', web: 'remove_circle_outline' }} size={20} tintColor={colors.inkFaint} type="hierarchical" /></Pressable></View>;
}

function BookThumb({ book, media }: { book: Book; media: Media[] }) {
  const cover = book.coverMediaId ? media.find((item) => item.id === book.coverMediaId) : null;
  return <View style={[styles.bookCover, { backgroundColor: book.format === 'epub' ? colors.lifeLight : colors.sunLight }]}>{cover ? <Image accessibilityLabel={`${book.title} 封面`} resizeMode="cover" source={{ uri: cover.localPath }} style={styles.coverImage} /> : <Text style={styles.coverInitial}>{book.title.trim().slice(0, 1) || '书'}</Text>}</View>;
}

function ActionOption({ destructive = false, icon, label, onPress }: { destructive?: boolean; icon: ComponentProps<typeof SymbolView>['name']; label: string; onPress(): void }) {
  return <Pressable accessibilityRole="menuitem" onPress={onPress} style={({ pressed }) => [styles.actionOption, pressed && styles.pressed]}><SymbolView name={icon} size={20} tintColor={destructive ? colors.danger : colors.ink} type="hierarchical" /><Text style={[styles.actionOptionText, destructive && styles.actionOptionDanger]}>{label}</Text></Pressable>;
}

function progressLabel(book: Book): string {
  if (book.parseStatus !== 'ready') return '暂不可阅读';
  if (book.progress <= 0 && !book.location) return '尚未阅读';
  if (book.format === 'pdf') return book.pageCount ? `第 ${pageFromBookLocation(book.location)} / ${book.pageCount} 页` : `第 ${pageFromBookLocation(book.location)} 页`;
  if (book.progress >= 1) return '已读完';
  return `阅读至 ${Math.round(book.progress * 100)}%`;
}

const styles = createThemedStyles(() => ({
  safe: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  summary: { paddingTop: spacing.md, paddingBottom: spacing.lg, flexDirection: 'row', alignItems: 'center' },
  summaryCopy: { flex: 1, minWidth: 0, marginLeft: spacing.md },
  summaryTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 23, lineHeight: 30 },
  summaryMeta: { marginTop: 5, color: colors.inkFaint, fontSize: 10 },
  listHeader: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  listTitleRow: { flexDirection: 'row', alignItems: 'baseline' },
  listTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 18 },
  listCount: { marginLeft: spacing.sm, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9 },
  addButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  bookRow: { minHeight: 82, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  bookMain: { flex: 1, minWidth: 0, minHeight: 82, flexDirection: 'row', alignItems: 'center' },
  bookCover: { width: 38, height: 52, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  coverImage: { width: '100%', height: '100%' },
  coverInitial: { color: colors.ink, fontFamily: typography.display, fontSize: 16 },
  bookCopy: { flex: 1, minWidth: 0, marginLeft: spacing.md },
  bookTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 14, lineHeight: 20 },
  bookMeta: { marginTop: 4, color: colors.inkFaint, fontSize: 10 },
  removeButton: { width: 44, height: 54, alignItems: 'center', justifyContent: 'center' },
  empty: { marginTop: spacing.xl, padding: spacing.xl, alignItems: 'center', backgroundColor: colors.sheet, borderRadius: radius.md },
  emptyTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 18 },
  emptyText: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: 11, textAlign: 'center' },
  emptyAction: { minHeight: 42, marginTop: spacing.lg, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lifeLine, borderRadius: radius.md },
  emptyActionText: { color: colors.life, fontSize: 11, fontWeight: '700' },
  pickerSheet: { height: '82%', paddingHorizontal: spacing.lg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.sheet },
  sheetHeading: { minHeight: 58, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  sheetTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 20 },
  sheetMeta: { marginTop: 3, color: colors.inkFaint, fontSize: 10 },
  pickerList: { flex: 1 },
  pickerContent: { paddingBottom: spacing.md },
  pickerRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  checkbox: { width: 22, height: 22, marginRight: spacing.md, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: 5 },
  checkboxActive: { borderColor: colors.life, backgroundColor: colors.life },
  pickerCopy: { flex: 1, minWidth: 0, marginLeft: spacing.md },
  pickerEmpty: { paddingVertical: spacing.xxl },
  confirmButton: { minHeight: 50, marginTop: spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life },
  confirmButtonText: { color: colors.onLife, fontSize: 12, fontWeight: '700' },
  actionSheet: { paddingHorizontal: spacing.lg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.sheet },
  actionHeader: { minHeight: 84, paddingBottom: spacing.md, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  actionCopy: { flex: 1, minWidth: 0, marginLeft: spacing.md },
  actionLabel: { color: colors.life, fontFamily: typography.mono, fontSize: 9 },
  actionTitle: { marginTop: 3, color: colors.ink, fontFamily: typography.display, fontSize: 17, lineHeight: 22 },
  actionMeta: { marginTop: 3, color: colors.inkFaint, fontSize: 10 },
  actionOption: { minHeight: 56, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  actionOptionText: { color: colors.ink, fontSize: 13 },
  actionOptionDanger: { color: colors.danger },
  cancelAction: { minHeight: 48, marginTop: spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.paper },
  cancelText: { color: colors.inkSoft, fontSize: 11, fontWeight: '600' },
  editSheet: { paddingHorizontal: spacing.lg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.sheet },
  inputLabel: { marginTop: spacing.lg, marginBottom: spacing.sm, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9 },
  editInput: { minHeight: 50, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.paper, color: colors.ink, fontSize: 14 },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.64 },
}));
