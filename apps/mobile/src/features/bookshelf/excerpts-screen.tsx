import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Book, BookExcerpt } from '@still-alive/types';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { useAppState } from '../../application/state/app-state';
import { useAi } from '../../application/ai/ai-provider';
import { buildExcerptExplainMessages } from '../../application/ai/ai-tasks';
import { aiErrorMessage } from '../ai/ai-copy';
import { AiResultSheet } from '../ai/ai-result-sheet';
import { feedback } from '../../shared/feedback';
import { ToolPageHeader } from '../../shared/components/tool-page-header';
import { createThemedStyles } from '../../shared/theme/app-theme';

interface ExcerptGroup {
  key: string;
  title: string;
  book: Book | null;
  items: BookExcerpt[];
}

export default function ExcerptsScreen() {
  const router = useRouter();
  const { bookExcerpts, books, deleteBookExcerpt, ready, updateBookExcerpt } = useAppState();
  const [query, setQuery] = useState('');
  const ai = useAi();
  const [aiSheet, setAiSheet] = useState<{ open: boolean; loading: boolean; text: string; error: string | null; excerpt: BookExcerpt | null }>({ open: false, loading: false, text: '', error: null, excerpt: null });
  const bookById = useMemo(() => new Map(books.map((book) => [book.id, book])), [books]);
  const groups = useMemo<ExcerptGroup[]>(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const values = new Map<string, ExcerptGroup>();
    for (const excerpt of bookExcerpts) {
      const book = excerpt.bookId ? bookById.get(excerpt.bookId) ?? null : null;
      const title = book?.title || excerpt.bookTitle || '原书已删除';
      const haystack = `${excerpt.text} ${excerpt.note ?? ''} ${title} ${excerpt.chapterTitle ?? ''}`.toLocaleLowerCase();
      if (normalized && !haystack.includes(normalized)) continue;
      const key = excerpt.bookId ?? `deleted:${title}`;
      const existing = values.get(key);
      if (existing) existing.items.push(excerpt);
      else values.set(key, { key, title, book, items: [excerpt] });
    }
    return [...values.values()].sort((left, right) => (right.items[0]?.createdAt ?? '').localeCompare(left.items[0]?.createdAt ?? ''));
  }, [bookById, bookExcerpts, query]);
  const total = bookExcerpts.length;

  const editNote = (excerpt: BookExcerpt) => {
    feedback.prompt('编辑书摘备注', '这句书摘让你想到什么？', (value) => {
      void updateBookExcerpt({ ...excerpt, note: value.trim() || null })
        .then(() => feedback.notice('备注已保存'))
        .catch((cause: unknown) => feedback.alert('保存失败', cause instanceof Error ? cause.message : '请稍后重试。'));
    }, excerpt.note ?? '');
  };

  const writeReflection = (excerpt: BookExcerpt) => {
    if (!excerpt.bookId) { feedback.notice('原书已删除，无法打开观后感编辑器'); return; }
    router.push({ pathname: '/editor', params: { sourceBookId: excerpt.bookId, sourceExcerptId: excerpt.id } });
  };

  const remove = (excerpt: BookExcerpt) => {
    feedback.alert('删除这条书摘？', '删除后无法恢复；引用它的读书笔记仍会保留快照。', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => void deleteBookExcerpt(excerpt.id).catch((cause: unknown) => feedback.alert('删除失败', cause instanceof Error ? cause.message : '请稍后重试。')) },
    ]);
  };

  const explainWithAi = async (excerpt: BookExcerpt) => {
    if (!ai.enabled) {
      feedback.alert('AI 功能未启用', '启用后可以让 AI 解释这段摘抄。');
      return;
    }
    const bookTitle = excerpt.bookId ? bookById.get(excerpt.bookId)?.title ?? excerpt.bookTitle ?? '未知书籍' : excerpt.bookTitle ?? '未知书籍';
    setAiSheet({ open: true, loading: true, text: '', error: null, excerpt });
    try {
      const result = await ai.chat(buildExcerptExplainMessages({ text: excerpt.text, bookTitle, chapterTitle: excerpt.chapterTitle ?? null }), { taskId: 'excerpt.explain', maxOutputTokens: 300, temperature: 0.5 });
      setAiSheet({ open: true, loading: false, text: result.text.trim(), error: null, excerpt });
    } catch (cause) {
      setAiSheet({ open: true, loading: false, text: '', error: aiErrorMessage(cause), excerpt });
    }
  };

  const saveAiExplanation = () => {
    const excerpt = aiSheet.excerpt;
    if (!excerpt || !aiSheet.text) return;
    const writeNote = (note: string) => {
      void updateBookExcerpt({ ...excerpt, note })
        .then(() => { feedback.notice('已写入备注'); setAiSheet((current) => ({ ...current, open: false })); })
        .catch((cause: unknown) => feedback.alert('保存失败', cause instanceof Error ? cause.message : '请稍后重试。'));
    };
    const existing = excerpt.note?.trim();
    if (existing) {
      feedback.alert('这条摘抄已有备注', '要替换原来的备注，还是把 AI 解读追加到末尾？', [
        { text: '取消', style: 'cancel' },
        { text: '替换', style: 'destructive', onPress: () => writeNote(aiSheet.text) },
        { text: '追加', onPress: () => writeNote(`${existing}\n\n${aiSheet.text}`) },
      ]);
      return;
    }
    writeNote(aiSheet.text);
  };

  const openActions = (excerpt: BookExcerpt) => feedback.alert('书摘操作', undefined, [
    { text: '编辑备注', onPress: () => editNote(excerpt) },
    ...(ai.enabled ? [{ text: 'AI 解读', onPress: () => void explainWithAi(excerpt) }] : []),
    ...(excerpt.bookId ? [{ text: '写观后感', onPress: () => writeReflection(excerpt) }] : []),
    { text: '删除', style: 'destructive' as const, onPress: () => remove(excerpt) },
    { text: '取消', style: 'cancel' as const },
  ]);

  const openExcerpt = (excerpt: BookExcerpt) => {
    if (!excerpt.bookId) { feedback.notice('原书已删除，这条书摘仍保留在本地'); return; }
    router.push({ pathname: '/reader', params: { id: excerpt.bookId, excerptId: excerpt.id } });
  };

  return <SafeAreaView style={styles.safeArea}>
    <ToolPageHeader onBack={() => router.back()} title="全部书摘" />
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.intro}>
        <Text style={styles.eyebrow}>HIGHLIGHTS / {total}</Text>
        <Text style={styles.title}>把喜欢的句子，留在这里。</Text>
        <Text style={styles.subtitle}>摘抄按书籍归拢。原书删除后，书摘和引用快照仍会保留。</Text>
      </View>
      <View style={styles.searchField}>
        <SymbolView name={{ android: 'search', ios: 'magnifyingglass', web: 'search' }} size={17} tintColor={colors.inkFaint} type="hierarchical" />
        <TextInput accessibilityLabel="搜索书摘" autoCorrect={false} onChangeText={setQuery} placeholder="搜索书摘、书名或备注" placeholderTextColor={colors.inkFaint} returnKeyType="search" style={styles.searchInput} value={query} />
        {query ? <Pressable accessibilityLabel="清除搜索" accessibilityRole="button" hitSlop={8} onPress={() => setQuery('')} style={styles.clearButton}><SymbolView name={{ android: 'close', ios: 'xmark.circle.fill', web: 'close' }} size={16} tintColor={colors.inkFaint} type="hierarchical" /></Pressable> : null}
      </View>
      {!ready ? <Text style={styles.stateText}>正在打开本地书摘…</Text> : null}
      {ready && groups.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>{total ? '没有找到匹配的书摘' : '还没有书摘'}</Text><Text style={styles.emptyText}>{total ? '换一个关键词，或清除搜索。' : '在阅读器里长按选中正文，选择“摘抄”。'}</Text></View> : null}
      {groups.map((group) => <View key={group.key} style={styles.group}>
        <View style={styles.groupHeader}>
          <View style={styles.groupCopy}>
            <Text numberOfLines={1} style={styles.groupTitle}>{group.title}</Text>
            <Text style={styles.groupMeta}>{group.book ? `${group.book.author || '未知作者'} / ${group.book.format.toUpperCase()}` : '原书已删除 / 引用快照仍保留'}</Text>
          </View>
          <Text style={styles.groupCount}>{group.items.length} 条</Text>
        </View>
        {group.items.map((excerpt) => <Pressable key={excerpt.id} accessibilityLabel="打开书摘" accessibilityRole="button" onPress={() => openExcerpt(excerpt)} style={({ pressed }) => [styles.excerpt, pressed && styles.pressed]}>
          <Text numberOfLines={5} style={styles.quote}>{excerpt.text}</Text>
          {excerpt.note ? <Text numberOfLines={2} style={styles.note}>备注：{excerpt.note}</Text> : null}
          <View style={styles.excerptFooter}>
            <Text style={styles.location}>{excerpt.chapterTitle || excerpt.locationType || '手动摘抄'} / {formatDate(excerpt.createdAt)}</Text>
            <Pressable accessibilityLabel="书摘操作" accessibilityRole="button" hitSlop={8} onPress={(event) => { event.stopPropagation(); openActions(excerpt); }} style={styles.moreButton}><SymbolView name={{ android: 'more_horiz', ios: 'ellipsis', web: 'more_horiz' }} size={18} tintColor={colors.inkFaint} type="hierarchical" /></Pressable>
          </View>
        </Pressable>)}
      </View>)}
    </ScrollView>
    <AiResultSheet actionLabel="写入备注" error={aiSheet.error} hint="基于这条摘抄生成，可先预览再决定是否写入备注。" loading={aiSheet.loading} onAction={saveAiExplanation} onClose={() => setAiSheet((current) => ({ ...current, open: false }))} open={aiSheet.open} text={aiSheet.text} title="AI 解读" />
  </SafeAreaView>;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

const styles = createThemedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  intro: { paddingBottom: spacing.lg },
  eyebrow: { color: colors.life, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1.2 },
  title: { marginTop: spacing.sm, color: colors.ink, fontFamily: typography.display, fontSize: 30, lineHeight: 38 },
  subtitle: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: 11, lineHeight: 18 },
  searchField: { minHeight: 48, paddingLeft: spacing.md, paddingRight: spacing.xs, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderRadius: 6, backgroundColor: colors.sheet },
  searchInput: { flex: 1, height: '100%', paddingVertical: 0, color: colors.ink, fontSize: 13 },
  clearButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  stateText: { marginTop: spacing.lg, color: colors.inkFaint, fontSize: 11 },
  group: { marginTop: spacing.xl },
  groupHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  groupCopy: { flex: 1, minWidth: 0, paddingRight: spacing.md },
  groupTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 20 },
  groupMeta: { marginTop: 4, color: colors.inkFaint, fontSize: 9 },
  groupCount: { color: colors.life, fontFamily: typography.mono, fontSize: 9, letterSpacing: 0.6 },
  excerpt: { marginTop: spacing.sm, padding: spacing.md, borderLeftWidth: 2, borderLeftColor: colors.sunInk, borderRadius: 4, backgroundColor: colors.sheet },
  quote: { color: colors.ink, fontFamily: typography.display, fontSize: 14, lineHeight: 24 },
  note: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: 10, lineHeight: 17 },
  excerptFooter: { marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  location: { flex: 1, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 8 },
  moreButton: { width: 44, height: 32, alignItems: 'flex-end', justifyContent: 'center' },
  empty: { marginTop: spacing.xl, padding: spacing.xl, alignItems: 'center', borderRadius: 6, backgroundColor: colors.sheet },
  emptyTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 20 },
  emptyText: { marginTop: spacing.sm, color: colors.inkFaint, fontSize: 11, lineHeight: 18, textAlign: 'center' },
  pressed: { opacity: 0.7 },
}));
