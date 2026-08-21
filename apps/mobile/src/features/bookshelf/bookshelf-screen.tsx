import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { feedback } from '../../shared/feedback';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { Book } from '@still-alive/types';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { useAppState } from '../../application/state/app-state';
import { bookFormatFromName, pickLocalBookAssets, pickLocalBooksFromDirectory } from '../../infrastructure/files/local-assets';
import { pageFromBookLocation } from './book-reader';
import { createThemedStyles } from '../../shared/theme/app-theme';

export default function BookshelfScreen() {
  const router = useRouter();
  const { books, createBook, deleteBook, discardMedia, media, saveMedia, updateBook } = useAppState();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'recent' | 'title'>('recent');
  const [importing, setImporting] = useState(false);
  const importingRef = useRef(false);
  const visible = useMemo(() => books.filter((book) => `${book.title} ${book.author ?? ''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())).sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : b.updatedAt.localeCompare(a.updatedAt)), [books, search, sort]);

  const importBooks = async (source: 'files' | 'directory') => {
    if (importingRef.current) return;
    importingRef.current = true;
    setImporting(true);
    try {
      const assets = source === 'files' ? await pickLocalBookAssets() : await pickLocalBooksFromDirectory();
      if (!assets.length) return;

      const bookMediaIds = new Set(books.map((book) => book.fileMediaId));
      const knownChecksums = new Set(media.filter((item) => bookMediaIds.has(item.id) && item.checksum).map((item) => item.checksum));
      let imported = 0;
      let skipped = 0;
      const failures: string[] = [];

      for (let index = 0; index < assets.length; index += 1) {
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
        const readable = format === 'pdf' || format === 'epub';
        try {
          await saveMedia(asset);
          await createBook({
            id: `book_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`,
            fileMediaId: asset.id,
            coverMediaId: null,
            title: name.replace(/\.[^.]+$/, '') || '未命名书籍',
            author: null,
            format,
            parseStatus: readable ? 'ready' : 'unsupported',
            parseMessage: readable ? null : '当前版本仅归档 MOBI/AZW/AZW3，原始文件会保留在书架。',
            progress: 0,
            location: null,
            locationType: format === 'pdf' ? 'pdf-page' : null,
            chapterHref: null,
            chapterTitle: null,
            engineVersion: null,
            pageCount: null,
            chapterCache: [],
            createdAt: now,
            updatedAt: now,
          });
          knownChecksums.add(asset.checksum);
          imported += 1;
        } catch (cause) {
          failures.push(`${name}：${cause instanceof Error ? cause.message : '请稍后重试'}`);
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
    }
  };

  const showImportOptions = () => feedback.alert('导入书籍', undefined, [
    { text: '选择多本书籍', onPress: () => void importBooks('files') },
    { text: '从文件夹导入', onPress: () => void importBooks('directory') },
    { text: '取消', style: 'cancel' },
  ]);

  const edit = (book: Book) => feedback.prompt('编辑书籍', '输入新的书名', async (title) => { const value = title.trim(); if (!value) return; await updateBook({ ...book, title: value, updatedAt: new Date().toISOString() }); });
  const remove = (book: Book) => feedback.alert('删除书籍？', '原始文件会删除，摘抄与引用快照会保留。', [{ text: '取消', style: 'cancel' }, { text: '删除', style: 'destructive', onPress: () => void deleteBook(book.id) }]);
  return <SafeAreaView style={styles.safe}><View style={styles.header}><Pressable onPress={() => router.back()} style={styles.button}><SymbolView name={{ android: 'chevron_left', ios: 'chevron.left', web: 'chevron_left' }} size={22} tintColor={colors.inkSoft} type="hierarchical" /></Pressable><Text style={styles.headerTitle}>我的书架</Text><Pressable accessibilityLabel={importing ? '正在导入书籍' : '导入书籍'} disabled={importing} onPress={showImportOptions} style={styles.button}>{importing ? <ActivityIndicator color={colors.life} size="small" /> : <SymbolView name={{ android: 'add', ios: 'plus', web: 'add' }} size={22} tintColor={colors.life} type="hierarchical" />}</Pressable></View><ScrollView contentContainerStyle={styles.content}><TextInput placeholder="搜索书名或作者" placeholderTextColor={colors.inkFaint} onChangeText={setSearch} style={styles.search} value={search} /><View style={styles.sorts}><Pressable onPress={() => setSort('recent')} style={[styles.sort, sort === 'recent' && styles.sortActive]}><Text style={[styles.sortText, sort === 'recent' && styles.sortTextActive]}>最近阅读</Text></Pressable><Pressable onPress={() => setSort('title')} style={[styles.sort, sort === 'title' && styles.sortActive]}><Text style={[styles.sortText, sort === 'title' && styles.sortTextActive]}>标题</Text></Pressable></View>{visible.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>书架还是空的</Text><Text style={styles.emptyText}>导入 PDF、EPUB 或其他常见电子书文件。</Text></View> : visible.map((book) => <View key={book.id} style={styles.row}><View style={styles.bookIcon}><SymbolView name={{ android: 'menu_book', ios: 'book.closed.fill', web: 'menu_book' }} size={22} tintColor={colors.life} type="hierarchical" /></View><Pressable onPress={() => book.parseStatus === 'ready' ? router.push({ pathname: '/reader', params: { id: book.id } } as never) : feedback.alert('暂不可阅读', book.parseMessage || `状态：${book.parseStatus}`)} style={styles.copy}><Text numberOfLines={1} style={styles.title}>{book.title}</Text><Text style={styles.meta}>{book.author || '作者未知'} / {book.format.toUpperCase()} / {readingPosition(book)}</Text></Pressable><Pressable onPress={() => edit(book)} style={styles.small}><Text style={styles.edit}>编辑</Text></Pressable><Pressable onPress={() => remove(book)} style={styles.small}><Text style={styles.delete}>删除</Text></Pressable></View>)}</ScrollView></SafeAreaView>;
}

function readingPosition(book: Book) {
  if (book.parseStatus !== 'ready') return '不可阅读';
  if (book.format === 'pdf') return `第 ${pageFromBookLocation(book.location)} 页`;
  return `${Math.round(book.progress * 100)}%`;
}
const styles = createThemedStyles(() => ({ safe: { flex: 1, backgroundColor: colors.paper }, header: { minHeight: 56, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }, button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, headerTitle: { flex: 1, color: colors.ink, fontFamily: typography.display, fontSize: 19, textAlign: 'center' }, content: { padding: spacing.lg, paddingBottom: spacing.xxl }, search: { minHeight: 46, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.sheet, color: colors.ink }, sorts: { marginTop: spacing.sm, flexDirection: 'row', gap: spacing.sm }, sort: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.sheet }, sortActive: { backgroundColor: colors.lifeLight }, sortText: { color: colors.inkFaint, fontSize: 10 }, sortTextActive: { color: colors.life, fontWeight: '700' }, empty: { marginTop: spacing.xxl, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.sheet }, emptyTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 18 }, emptyText: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: 11 }, row: { minHeight: 76, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }, bookIcon: { width: 44, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.sunLight }, copy: { flex: 1, minWidth: 0, marginLeft: spacing.md }, title: { color: colors.ink, fontFamily: typography.display, fontSize: 15 }, meta: { marginTop: 4, color: colors.inkFaint, fontSize: 10 }, small: { padding: spacing.sm }, edit: { color: colors.life, fontSize: 10 }, delete: { color: colors.danger, fontSize: 10 } }));
