import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { Book, Media } from '@still-alive/types';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { useAppState } from '../../application/state/app-state';
import { feedback } from '../../shared/feedback';
import { createThemedStyles } from '../../shared/theme/app-theme';
import { ToolPageHeader, ToolPageHeaderAction } from '../../shared/components/tool-page-header';
import { DraggableBottomSheet } from '../../shared/components/draggable-bottom-sheet';
import { personDisplayName } from './person-profile';

export default function PersonBooksScreen() {
  const router = useRouter();
  const { personId } = useLocalSearchParams<{ personId?: string }>();
  const { books, media, people, personBooks, setPersonBooks } = useAppState();
  const person = personId ? people.find((item) => item.id === personId) : null;
  const displayName = person ? personDisplayName(person) : '';
  const [pickerVisible, setPickerVisible] = useState(false);
  const [search, setSearch] = useState('');
  const savingRef = useRef(false);
  const selectedIds = useMemo(() => new Set(personBooks.filter((entry) => entry.personId === personId).map((entry) => entry.bookId)), [personBooks, personId]);
  const selectionRef = useRef(selectedIds);
  const selectedBooks = useMemo(() => books.filter((book) => selectedIds.has(book.id)), [books, selectedIds]);
  const availableBooks = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return books.filter((book) => !selectedIds.has(book.id) && (!query || `${book.title} ${book.author ?? ''}`.toLocaleLowerCase().includes(query)));
  }, [books, search, selectedIds]);

  useEffect(() => { selectionRef.current = selectedIds; }, [selectedIds]);

  const updateSelection = async (bookId: string, selected: boolean) => {
    if (!person || savingRef.current) return;
    savingRef.current = true;
    const previous = selectionRef.current;
    const next = selected ? [...previous, bookId] : [...previous].filter((id) => id !== bookId);
    selectionRef.current = new Set(next);
    try {
      await setPersonBooks(person.id, next);
    } catch (cause) {
      selectionRef.current = previous;
      feedback.alert('保存失败', cause instanceof Error ? cause.message : '请稍后重试。');
    } finally {
      savingRef.current = false;
    }
  };

  const openBook = (book: Book) => {
    if (book.parseStatus !== 'ready') {
      feedback.alert('暂时无法阅读', book.parseMessage || '这本书当前仅保存在书架中。');
      return;
    }
    router.push({ pathname: '/reader', params: { id: book.id } } as never);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ToolPageHeader
        onBack={() => router.back()}
        right={<ToolPageHeaderAction accessibilityLabel="添加喜欢的书籍" disabled={!person || !books.length} onPress={() => setPickerVisible(true)}><SymbolView name={{ android: 'add', ios: 'plus', web: 'add' }} size={22} tintColor={colors.life} type="hierarchical" /></ToolPageHeaderAction>}
      title={person ? `${displayName}喜欢的书籍` : '喜欢的书籍'}
      />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.summary}>{selectedBooks.length} 本书籍</Text>
        {selectedBooks.length ? selectedBooks.map((book) => (
          <View key={book.id} style={styles.bookRow}>
            <Pressable accessibilityRole="button" onPress={() => openBook(book)} style={({ pressed }) => [styles.bookMain, pressed && styles.pressed]}>
              <BookCover book={book} media={media} />
              <View style={styles.bookCopy}><Text numberOfLines={2} style={styles.bookTitle}>{book.title}</Text><Text numberOfLines={1} style={styles.bookMeta}>{book.author || '作者未知'}　{book.format.toUpperCase()}</Text></View>
            </Pressable>
            <Pressable accessibilityLabel={`从喜欢的书籍中移除 ${book.title}`} onPress={() => void updateSelection(book.id, false)} style={styles.removeButton}><SymbolView name={{ android: 'remove_circle_outline', ios: 'minus.circle', web: 'remove_circle_outline' }} size={19} tintColor={colors.inkFaint} type="hierarchical" /></Pressable>
          </View>
        )) : (
          <Pressable disabled={!person || !books.length} onPress={() => setPickerVisible(true)} style={({ pressed }) => [styles.empty, pressed && styles.pressed]}>
            <View style={styles.emptyIcon}><SymbolView name={{ android: 'auto_stories', ios: 'books.vertical', web: 'auto_stories' }} size={30} tintColor={colors.life} type="hierarchical" /></View>
            <Text style={styles.emptyTitle}>还没有喜欢的书籍</Text>
            <Text style={styles.emptyText}>{books.length ? '从书架中选择，记录 ta 喜欢读的书。' : '先去书架导入书籍，再回来添加。'}</Text>
            {books.length ? <Text style={styles.emptyAction}>选择书籍</Text> : null}
          </Pressable>
        )}
      </ScrollView>

      <DraggableBottomSheet onClose={() => { setPickerVisible(false); setSearch(''); }} open={pickerVisible} sheetStyle={styles.sheet}>
        <Text style={styles.sheetTitle}>从书架选择</Text>
        <Text style={styles.sheetHint}>添加后仍保留在原书架中</Text>
        <View style={styles.searchBar}><SymbolView name={{ android: 'search', ios: 'magnifyingglass', web: 'search' }} size={17} tintColor={colors.inkFaint} type="hierarchical" /><TextInput accessibilityLabel="搜索书名或作者" onChangeText={setSearch} placeholder="搜索书名或作者" placeholderTextColor={colors.inkFaint} style={styles.searchInput} value={search} /></View>
        <ScrollView keyboardShouldPersistTaps="handled" style={styles.bookList}>
          {availableBooks.map((book) => <Pressable key={book.id} onPress={() => void updateSelection(book.id, true)} style={({ pressed }) => [styles.choice, pressed && styles.pressed]}><BookCover book={book} media={media} small /><View style={styles.bookCopy}><Text numberOfLines={1} style={styles.bookTitle}>{book.title}</Text><Text numberOfLines={1} style={styles.bookMeta}>{book.author || '作者未知'}</Text></View><SymbolView name={{ android: 'add', ios: 'plus', web: 'add' }} size={18} tintColor={colors.life} type="hierarchical" /></Pressable>)}
          {availableBooks.length === 0 ? <Text style={styles.noChoices}>{search ? '没有找到匹配书籍' : '书架中没有可添加的其他书籍'}</Text> : null}
        </ScrollView>
      </DraggableBottomSheet>
    </SafeAreaView>
  );
}

function BookCover({ book, media, small = false }: { book: Book; media: Media[]; small?: boolean }) {
  const cover = book.coverMediaId ? media.find((item) => item.id === book.coverMediaId) : null;
  return <View style={[styles.cover, small && styles.coverSmall]}>{cover ? <Image accessibilityLabel={`${book.title}封面`} resizeMode="cover" source={{ uri: cover.localPath }} style={styles.coverImage} /> : <><Text style={styles.coverFormat}>{book.format.toUpperCase()}</Text><Text numberOfLines={1} style={styles.coverLetter}>{book.title.trim().slice(0, 1) || '书'}</Text></>}</View>;
}

const styles = createThemedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  container: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  summary: { paddingVertical: spacing.md, color: colors.inkFaint, fontSize: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  bookRow: { minHeight: 82, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  bookMain: { minWidth: 0, minHeight: 82, flex: 1, flexDirection: 'row', alignItems: 'center' },
  cover: { width: 42, height: 58, overflow: 'hidden', padding: 5, justifyContent: 'space-between', backgroundColor: colors.lifeLight },
  coverSmall: { width: 34, height: 46 },
  coverImage: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  coverFormat: { color: colors.life, fontSize: 6, fontWeight: '700' },
  coverLetter: { color: colors.ink, fontFamily: typography.display, fontSize: 18, textAlign: 'center' },
  bookCopy: { minWidth: 0, flex: 1, marginLeft: spacing.md },
  bookTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 14, lineHeight: 20 },
  bookMeta: { marginTop: 5, color: colors.inkFaint, fontSize: 9 },
  removeButton: { width: 44, height: 58, alignItems: 'center', justifyContent: 'center' },
  empty: { marginTop: spacing.xl, paddingVertical: spacing.xxl, alignItems: 'center' },
  emptyIcon: { width: 74, height: 74, alignItems: 'center', justifyContent: 'center', borderRadius: 37, backgroundColor: colors.lifeLight },
  emptyTitle: { marginTop: spacing.lg, color: colors.ink, fontFamily: typography.display, fontSize: 17 },
  emptyText: { maxWidth: 240, marginTop: spacing.sm, color: colors.inkSoft, fontSize: 11, lineHeight: 19, textAlign: 'center' },
  emptyAction: { marginTop: spacing.lg, color: colors.life, fontSize: 11, fontWeight: '700' },
  sheet: { maxHeight: '78%', padding: spacing.lg, paddingBottom: spacing.xxl, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, backgroundColor: colors.sheet },
  sheetTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 18 },
  sheetHint: { marginTop: spacing.xs, color: colors.inkFaint, fontSize: 10 },
  searchBar: { minHeight: 46, marginTop: spacing.md, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, backgroundColor: colors.paper },
  searchInput: { flex: 1, paddingHorizontal: spacing.sm, color: colors.ink, fontSize: 12 },
  bookList: { marginTop: spacing.sm },
  choice: { minHeight: 64, paddingHorizontal: spacing.xs, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  noChoices: { paddingVertical: spacing.xl, color: colors.inkFaint, fontSize: 10, textAlign: 'center' },
  pressed: { opacity: 0.62 },
}));
