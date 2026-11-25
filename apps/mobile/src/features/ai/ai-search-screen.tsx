import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { useAi } from '../../application/ai/ai-provider';
import { useKnowledge } from '../../application/knowledge/knowledge-provider';
import { useAppState } from '../../application/state/app-state';
import type { KnowledgeHit, KnowledgeSourceKind } from '../ai/domain/knowledge-types';
import { aiErrorMessage } from '../ai/ai-copy';
import { isAiRequestError } from '../../infrastructure/ai/ai-types';
import * as Clipboard from 'expo-clipboard';
import { feedback } from '../../shared/feedback';
import { ToolPageHeader } from '../../shared/components/tool-page-header';
import { createThemedStyles } from '../../shared/theme/app-theme';

interface AiAnswer {
  question: string;
  text: string;
  hits: KnowledgeHit[];
  memoryCount: number;
}

interface DirectResult {
  key: string;
  group: '人物' | '音乐' | '书籍' | '账本';
  title: string;
  meta: string;
  onPress(): void;
}

const SOURCE_LABELS: Record<KnowledgeSourceKind, string> = {
  post: '记录',
  comments: '记录评论',
  person: '人物',
  person_event: '人物事件',
  excerpt: '书摘',
  aggregate: '汇总',
};

const SUGGESTIONS = ['今年花了多少？', '我和小林最近一次见面', '下个月谁过生日？', '我最近在读什么'];
const QUESTION_PATTERN = /[?？]|吗|呢|多少|谁|哪|什么时候|多久|为什么|怎么|帮我|总结|回顾|今年|去年|上个月|最近/u;

export default function AiSearchScreen() {
  const router = useRouter();
  const ai = useAi();
  const knowledge = useKnowledge();
  const { books, ledgerTransactions, musicTracks, people } = useAppState();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<KnowledgeHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<AiAnswer | null>(null);
  const askAbortRef = useRef<AbortController | null>(null);
  const trimmed = query.trim();
  const searchKnowledge = knowledge.search;
  const buildChatMessages = knowledge.buildChatMessages;
  const extractMemories = knowledge.extractMemories;

  useEffect(() => {
    if (!trimmed) { setHits([]); setSearching(false); return; }
    let active = true;
    const timer = setTimeout(() => {
      setSearching(true);
      void searchKnowledge({ text: trimmed, limit: 40, tokenBudget: 3000 })
        .then((result) => { if (active) setHits(result.hits); })
        .catch(() => { if (active) setHits([]); })
        .finally(() => { if (active) setSearching(false); });
    }, 240);
    return () => { active = false; clearTimeout(timer); };
  }, [searchKnowledge, trimmed]);

  useEffect(() => {
    if (answer && answer.question !== trimmed) setAnswer(null);
  }, [answer, trimmed]);

  const directResults = useMemo<DirectResult[]>(() => {
    if (!trimmed) return [];
    const lower = trimmed.toLowerCase();
    const results: DirectResult[] = [];
    for (const person of people.filter((item) => `${item.name} ${item.nickname}`.toLowerCase().includes(lower)).slice(0, 4)) {
      results.push({ key: `person:${person.id}`, group: '人物', title: person.nickname.trim() || person.name, meta: person.relationToMe ?? '人物', onPress: () => router.push(`/person/${person.id}` as RelativePathString) });
    }
    for (const track of musicTracks.filter((item) => `${item.title} ${item.artist ?? ''}`.toLowerCase().includes(lower)).slice(0, 4)) {
      results.push({ key: `music:${track.id}`, group: '音乐', title: track.title, meta: track.artist ?? '音乐', onPress: () => router.push('/music-box' as RelativePathString) });
    }
    for (const book of books.filter((item) => `${item.title} ${item.author ?? ''}`.toLowerCase().includes(lower)).slice(0, 4)) {
      results.push({ key: `book:${book.id}`, group: '书籍', title: book.title, meta: book.author ?? '书籍', onPress: () => router.push({ pathname: '/reader', params: { id: book.id } }) });
    }
    for (const transaction of ledgerTransactions.filter((item) => `${item.note ?? ''} ${item.category}`.toLowerCase().includes(lower)).slice(0, 4)) {
      results.push({ key: `ledger:${transaction.id}`, group: '账本', title: transaction.category, meta: `${transaction.dayKey} · ${transaction.note ?? ''}`.trim(), onPress: () => router.push('/ledger' as RelativePathString) });
    }
    return results;
  }, [books, ledgerTransactions, musicTracks, people, router, trimmed]);

  const groupedHits = useMemo(() => {
    const groups = new Map<KnowledgeSourceKind, KnowledgeHit[]>();
    for (const hit of hits) groups.set(hit.sourceKind, [...(groups.get(hit.sourceKind) ?? []), hit]);
    return [...groups.entries()];
  }, [hits]);

  const ask = useCallback(async () => {
    if (!trimmed || asking) return;
    if (!ai.enabled) {
      feedback.alert('AI 功能未启用', '启用后可以就本机记录问一句。');
      return;
    }
    const controller = new AbortController();
    askAbortRef.current = controller;
    setAskError(null);
    setAsking(true);
    try {
      const { messages, result, coreMemories, recalledMemories } = await buildChatMessages({ question: trimmed, history: [] });
      const response = await ai.chat(messages, { taskId: 'chat.answer', maxOutputTokens: 1200, temperature: 0.4, signal: controller.signal });
      setAnswer({ question: trimmed, text: response.text.trim(), hits: result.hits, memoryCount: coreMemories.length + recalledMemories.length });
      if (knowledge.autoExtract && knowledge.memoryEnabled) {
        const sourcesSummary = result.structured.renderedText || result.hits.map((hit) => `${hit.title}：${hit.snippet}`).join('\n');
        void extractMemories({ question: trimmed, answer: response.text, sourcesSummary }).catch(() => undefined);
      }
    } catch (cause) {
      if (!(isAiRequestError(cause) && cause.code === 'cancelled')) setAskError(aiErrorMessage(cause));
    } finally {
      setAsking(false);
      askAbortRef.current = null;
    }
  }, [ai, asking, buildChatMessages, extractMemories, knowledge.autoExtract, knowledge.memoryEnabled, trimmed]);

  const openHit = (hit: KnowledgeHit) => {
    if (hit.route.startsWith('/post/') || hit.route.startsWith('/person/') || hit.route.startsWith('/excerpts')) router.push(hit.route as RelativePathString);
    else feedback.alert('这条结果暂不支持跳转', '可以在对应模块里查看。');
  };

  const showAsk = Boolean(trimmed) && ai.enabled && !answer;

  return <SafeAreaView style={styles.safeArea}>
    <ToolPageHeader onBack={() => router.back()} title="找一找" />
    <View style={styles.searchWrap}>
      <SymbolView name={{ android: 'search', ios: 'magnifyingglass', web: 'search' }} size={17} tintColor={colors.inkFaint} type="hierarchical" />
      <TextInput
        autoFocus
        autoCorrect={false}
        onChangeText={setQuery}
        onSubmitEditing={() => { Keyboard.dismiss(); if (QUESTION_PATTERN.test(trimmed) && ai.enabled) void ask(); }}
        placeholder="搜索记录，或问一句…"
        placeholderTextColor={colors.inkFaint}
        returnKeyType="search"
        style={styles.searchInput}
        value={query}
      />
      {query ? <Pressable accessibilityLabel="清除" accessibilityRole="button" hitSlop={8} onPress={() => setQuery('')}><SymbolView name={{ android: 'close', ios: 'xmark.circle.fill', web: 'close' }} size={16} tintColor={colors.inkFaint} type="hierarchical" /></Pressable> : null}
    </View>

    <ScrollView contentContainerStyle={styles.content} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {showAsk ? <Pressable accessibilityRole="button" disabled={asking} onPress={() => void ask()} style={({ pressed }) => [styles.askRow, pressed && styles.pressed]}>
        <SymbolView name={{ android: 'auto_awesome', ios: 'sparkles', web: 'auto_awesome' }} size={15} tintColor={colors.life} type="hierarchical" />
        <Text numberOfLines={1} style={styles.askText}>{asking ? '正在检索并回答…' : `问一句：${trimmed}`}</Text>
        {asking ? <Pressable accessibilityRole="button" hitSlop={8} onPress={() => { askAbortRef.current?.abort(); setAsking(false); }}><Text style={styles.askCancel}>取消</Text></Pressable> : <Text style={styles.askChevron}>›</Text>}
      </Pressable> : null}
      {askError ? <View style={styles.askErrorRow}><Text style={styles.askErrorText}>{askError}</Text><Pressable accessibilityRole="button" onPress={() => void ask()}><Text style={styles.askRetry}>重试</Text></Pressable></View> : null}

      {answer ? <View style={styles.answerCard}>
        <Text style={styles.answerLabel}>问一问</Text>
        <Text selectable style={styles.answerText}>{answer.text}</Text>
        {answer.hits.length ? <View style={styles.answerSources}>
          {answer.hits.slice(0, 4).map((hit) => <Pressable accessibilityRole="button" key={hit.id} onPress={() => openHit(hit)} style={({ pressed }) => [styles.sourceRow, pressed && styles.pressed]}>
            <Text numberOfLines={1} style={styles.sourceTitle}>{hit.citationId} · {hit.title}</Text>
            <Text numberOfLines={1} style={styles.sourceMeta}>{[hit.dayKey?.replaceAll('-', '.'), hit.persons.map((person) => person.name).join('、')].filter(Boolean).join(' · ') || '本机记录'}</Text>
          </Pressable>)}
        </View> : null}
        {answer.memoryCount > 0 ? <Text style={styles.answerMemory}>参考了 {answer.memoryCount} 条记忆</Text> : null}
        <View style={styles.answerActions}>
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/ai', params: { ask: answer.question, auto: '1' } } as never)} style={({ pressed }) => [styles.answerPrimary, pressed && styles.pressed]}><Text style={styles.answerPrimaryText}>继续追问</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => { void Clipboard.setStringAsync(answer.text); feedback.notice('已复制回答'); }} style={({ pressed }) => [styles.answerSecondary, pressed && styles.pressed]}><Text style={styles.answerSecondaryText}>复制</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => setAnswer(null)} style={({ pressed }) => [styles.answerSecondary, pressed && styles.pressed]}><Text style={styles.answerSecondaryText}>收起</Text></Pressable>
        </View>
      </View> : null}

      {!trimmed ? <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>搜索记录，或直接问一句</Text>
        <Text style={styles.emptyText}>搜记录、人物、书摘、音乐和账本；AI 启用时，问题会在这里直接得到带来源的回答。</Text>
        <View style={styles.suggestionRow}>{SUGGESTIONS.map((suggestion) => <Pressable accessibilityRole="button" key={suggestion} onPress={() => { Keyboard.dismiss(); setQuery(suggestion); }} style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}><Text style={styles.suggestionText}>{suggestion}</Text></Pressable>)}</View>
      </View> : null}

      {trimmed && !searching ? <Text style={styles.resultSummary}>{hits.length + directResults.length ? `找到 ${hits.length + directResults.length} 条本机结果` : '没有找到相关记录'}</Text> : null}
      {searching ? <View style={styles.loadingRow}><ActivityIndicator color={colors.life} size="small" /><Text style={styles.loadingText}>正在搜索本机记录…</Text></View> : null}

      {groupedHits.map(([kind, items]) => <View key={kind} style={styles.group}>
        <Text style={styles.groupLabel}>{SOURCE_LABELS[kind]}</Text>
        {items.slice(0, 8).map((hit) => <Pressable accessibilityRole="button" key={hit.id} onPress={() => openHit(hit)} style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}>
          <Text numberOfLines={1} style={styles.resultTitle}>{hit.title}</Text>
          <Text numberOfLines={2} style={styles.resultSnippet}>{hit.snippet}</Text>
          <Text style={styles.resultMeta}>{[hit.dayKey?.replaceAll('-', '.'), hit.persons.map((person) => person.name).join('、')].filter(Boolean).join(' · ') || '本机记录'}</Text>
        </Pressable>)}
      </View>)}

      {(['人物', '音乐', '书籍', '账本'] as const).map((group) => {
        const items = directResults.filter((item) => item.group === group);
        if (!items.length) return null;
        return <View key={group} style={styles.group}>
          <Text style={styles.groupLabel}>{group}</Text>
          {items.map((item) => <Pressable accessibilityRole="button" key={item.key} onPress={item.onPress} style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}>
            <Text numberOfLines={1} style={styles.resultTitle}>{item.title}</Text>
            <Text numberOfLines={1} style={styles.resultMeta}>{item.meta}</Text>
          </Pressable>)}
        </View>;
      })}
    </ScrollView>
  </SafeAreaView>;
}

const styles = createThemedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  searchWrap: { marginHorizontal: spacing.lg, paddingBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  searchInput: { flex: 1, minHeight: 42, paddingVertical: 0, color: colors.ink, fontSize: typography.size.bodyLarge },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  askRow: { minHeight: 44, marginTop: spacing.md, paddingHorizontal: 2, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft },
  askText: { flex: 1, color: colors.life, fontSize: typography.size.caption, fontWeight: '700' },
  askChevron: { color: colors.inkFaint, fontSize: 18 },
  askCancel: { color: colors.inkFaint, fontSize: typography.size.meta },
  askErrorRow: { paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  askErrorText: { flex: 1, color: colors.danger, fontSize: typography.size.meta },
  askRetry: { color: colors.life, fontSize: typography.size.meta, fontWeight: '700' },
  answerCard: { marginTop: spacing.md, padding: spacing.lg, borderTopRightRadius: radius.lg, borderBottomLeftRadius: radius.lg, backgroundColor: colors.sheet },
  answerLabel: { color: colors.life, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.2 },
  answerText: { marginTop: spacing.sm, color: colors.ink, fontFamily: typography.display, fontSize: 15, lineHeight: 25 },
  answerSources: { marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.lineSoft },
  sourceRow: { paddingVertical: 5 },
  sourceTitle: { color: colors.life, fontSize: typography.size.caption, fontWeight: '700' },
  sourceMeta: { marginTop: 2, color: colors.inkFaint, fontSize: typography.size.meta },
  answerMemory: { marginTop: spacing.sm, color: colors.inkFaint, fontSize: typography.size.meta },
  answerActions: { marginTop: spacing.md, flexDirection: 'row', gap: spacing.sm },
  answerPrimary: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.life },
  answerPrimaryText: { color: colors.onLife, fontSize: typography.size.caption, fontWeight: '800' },
  answerSecondary: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.paper },
  answerSecondaryText: { color: colors.inkSoft, fontSize: typography.size.caption, fontWeight: '700' },
  emptyState: { paddingVertical: spacing.xl },
  emptyTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 22 },
  emptyText: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: typography.size.body, lineHeight: 21 },
  suggestionRow: { marginTop: spacing.lg, gap: 2 },
  suggestion: { minHeight: 38, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center' },
  suggestionText: { color: colors.inkSoft, fontSize: typography.size.body },
  resultSummary: { marginTop: spacing.md, color: colors.inkFaint, fontSize: typography.size.meta },
  loadingRow: { marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  loadingText: { color: colors.inkFaint, fontSize: typography.size.meta },
  group: { marginTop: spacing.lg },
  groupLabel: { marginBottom: spacing.sm, color: colors.inkFaint, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.1 },
  resultRow: { minHeight: 56, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  resultTitle: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  resultSnippet: { marginTop: 3, color: colors.inkSoft, fontSize: typography.size.meta, lineHeight: 17 },
  resultMeta: { marginTop: 4, color: colors.inkFaint, fontSize: typography.size.meta },
  pressed: { opacity: 0.7 },
}));
