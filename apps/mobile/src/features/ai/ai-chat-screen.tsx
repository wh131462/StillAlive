import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import * as Clipboard from 'expo-clipboard';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { useAi } from '../../application/ai/ai-provider';
import { useKnowledge } from '../../application/knowledge/knowledge-provider';
import { useAppState } from '../../application/state/app-state';
import type { KnowledgeHit } from '../../features/ai/domain/knowledge-types';
import type { AiMessage } from '../../infrastructure/ai/ai-types';
import { isAiRequestError } from '../../infrastructure/ai/ai-types';
import { aiErrorMessage } from '../ai/ai-copy';
import { ToolPageHeader, ToolPageHeaderAction, ToolPageHeaderTextAction } from '../../shared/components/tool-page-header';
import { feedback } from '../../shared/feedback';
import { createThemedStyles } from '../../shared/theme/app-theme';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  question: string;
  sources: KnowledgeHit[];
  memoryCount: number;
  failed: boolean;
}

const SUGGESTIONS = ['我最常和谁见面？', '今年花了多少？', '我最近在听什么？', '下个月谁过生日？'];

export default function AiChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ ask?: string; postId?: string; auto?: string }>();
  const ai = useAi();
  const knowledge = useKnowledge();
  const { posts } = useAppState();
  const scrollRef = useRef<ScrollView>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [pendingMemoryBatch, setPendingMemoryBatch] = useState<number | null>(null);
  const autoAskedRef = useRef(false);
  const extractingMemoryRef = useRef(false);
  const ensureIndexed = knowledge.ensureIndexed;

  const pinnedContext = useMemo(() => {
    if (!params.postId) return undefined;
    const post = posts.find((item) => item.id === params.postId);
    if (!post) return undefined;
    return `[${post.dayKey}] ${post.bodyMarkdown.slice(0, 1500)}`;
  }, [params.postId, posts]);

  useEffect(() => {
    if (params.ask?.trim()) setInput(params.ask);
  }, [params.ask]);


  useEffect(() => {
    if (!ai.enabled) return;
    void ensureIndexed().catch(() => undefined);
  }, [ai.enabled, ensureIndexed]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const send = useCallback(async (question: string, options?: { appendUser?: boolean }) => {
    const trimmed = question.trim();
    if (!trimmed || thinking) return;
    if (!ai.enabled) {
      feedback.alert('AI 功能未启用', '请先在 AI 设置里启用并添加服务商。');
      return;
    }
    const history: AiMessage[] = messages
      .filter((message) => !message.failed)
      .slice(-4)
      .map((message) => ({ role: message.role, content: message.text }));
    if (options?.appendUser !== false) setMessages((current) => [...current, { id: `user_${Date.now()}`, role: 'user', text: trimmed, question: trimmed, sources: [], memoryCount: 0, failed: false }]);
    setInput('');
    setThinking(true);
    setPendingMemoryBatch(null);
    const controller = new AbortController();
    abortRef.current = controller;
    scrollToEnd();
    try {
      const { messages: promptMessages, result, coreMemories, recalledMemories } = await knowledge.buildChatMessages({ question: trimmed, history, ...(pinnedContext ? { pinnedContext } : {}) });
      const answer = await ai.chat(promptMessages, { taskId: 'chat.answer', maxOutputTokens: 1200, temperature: 0.4, signal: controller.signal });
      const memoryCount = coreMemories.length + recalledMemories.length;
      setMessages((current) => [...current, { id: `assistant_${Date.now()}`, role: 'assistant', text: answer.text.trim(), question: trimmed, sources: result.hits, memoryCount, failed: false }]);
      scrollToEnd();
      void knowledge.markMemoriesUsed([...coreMemories.map((item) => item.id), ...recalledMemories.map((hit) => hit.item.id)]).catch(() => undefined);
      if (knowledge.autoExtract && knowledge.memoryEnabled && !extractingMemoryRef.current) {
        extractingMemoryRef.current = true;
        const sourcesSummary = result.structured.renderedText || result.hits.map((hit) => `${hit.title}：${hit.snippet}`).join('\n');
        void knowledge.extractMemories({ question: trimmed, answer: answer.text, sourcesSummary }).then((count) => {
          if (count > 0) setPendingMemoryBatch(count);
        }).catch(() => undefined).finally(() => { extractingMemoryRef.current = false; });
      }
    } catch (cause) {
      if (isAiRequestError(cause) && cause.code === 'cancelled') {
        // 用户主动停止：不追加错误消息。
      } else {
        setMessages((current) => [...current, { id: `assistant_${Date.now()}`, role: 'assistant', text: aiErrorMessage(cause), question: trimmed, sources: [], memoryCount: 0, failed: true }]);
      }
      scrollToEnd();
    } finally {
      setThinking(false);
      abortRef.current = null;
    }
  }, [ai, knowledge, messages, pinnedContext, scrollToEnd, thinking]);

  useEffect(() => {
    if (params.auto !== '1' || autoAskedRef.current || !ai.enabled) return;
    const question = params.ask?.trim();
    if (!question) return;
    autoAskedRef.current = true;
    void send(question);
  }, [ai.enabled, params.ask, params.auto, send]);

  const handleBack = useCallback(() => {
    if (!messages.length) { router.back(); return; }
    feedback.alert('离开对话？', '当前对话不会保存；记忆与历史记录不受影响。', [
      { text: '取消', style: 'cancel' },
      { text: '离开', style: 'destructive', onPress: () => router.back() },
    ]);
  }, [messages.length, router]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!messages.length) return false;
      handleBack();
      return true;
    });
    return () => subscription.remove();
  }, [handleBack, messages.length]);

  const stop = () => {
    abortRef.current?.abort();
    setThinking(false);
  };

  const startNewConversation = () => {
    if (!messages.length) return;
    feedback.alert('开始新对话？', '当前会话记录不会保存；记忆与历史记录不受影响。', [
      { text: '取消', style: 'cancel' },
      { text: '新对话', onPress: () => { setMessages([]); setPendingMemoryBatch(null); abortRef.current?.abort(); } },
    ]);
  };

  const retryMessage = (message: ChatMessage) => {
    setMessages((current) => current.filter((item) => item.id !== message.id));
    setPendingMemoryBatch(null);
    void send(message.question, { appendUser: false });
  };

  const undoMemories = async () => {
    const count = await knowledge.undoAutoMemories();
    setPendingMemoryBatch(null);
    if (count > 0) feedback.notice(`已撤销 ${count} 条自动记忆`);
  };

  const openSource = (hit: KnowledgeHit) => {
    if (hit.route.startsWith('/post/') || hit.route.startsWith('/person/')) router.push(hit.route as RelativePathString);
    else feedback.alert('这条来源暂不支持跳转', '可以在对应页面里查看。');
  };

  return <SafeAreaView style={styles.safeArea}>
    <ToolPageHeader
      onBack={handleBack}
      right={<View style={styles.headerActions}>
        <ToolPageHeaderAction accessibilityLabel="搜索本机记录" onPress={() => router.push('/search' as RelativePathString)}><SymbolView name={{ android: 'search', ios: 'magnifyingglass', web: 'search' }} size={19} tintColor={colors.inkSoft} type="hierarchical" /></ToolPageHeaderAction>
        <ToolPageHeaderTextAction accessibilityLabel="管理记忆" label="记忆" onPress={() => router.push('/ai-memory' as RelativePathString)} />
        <ToolPageHeaderTextAction accessibilityLabel="AI 设置" label="设置" onPress={() => router.push('/ai-settings' as RelativePathString)} />
      </View>}
      subtitle="只基于本机记录与记忆"
      title="AI 对话"
    />
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      {!ai.enabled ? <View style={styles.noticeCard}><Text style={styles.noticeTitle}>AI 功能未启用</Text><Text style={styles.noticeText}>启用后可以就本机记录提问；关闭时不会发出任何请求。</Text><Pressable accessibilityRole="button" onPress={() => router.push('/ai-settings' as RelativePathString)} style={styles.noticeButton}><Text style={styles.noticeButtonText}>去启用</Text></Pressable></View> : null}
      {knowledge.indexing ? <View style={styles.indexBanner}><ActivityIndicator color={colors.life} size="small" /><Text style={styles.indexBannerText}>正在整理本机记录，首次会稍慢…</Text></View> : null}
      <ScrollView contentContainerStyle={styles.content} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" onContentSizeChange={scrollToEnd} ref={scrollRef}>
        {!messages.length ? <View style={styles.intro}>
          <Text style={styles.introEyebrow}>ASK YOUR RECORDS</Text>
          <Text style={styles.introTitle}>可以问记录里的任何事</Text>
          <Text style={styles.introText}>回答只依据本机记录与记忆；命中的片段只在你发送问题时交给所选服务商。没有相关记录时，它会直接说没有。</Text>
          <View style={styles.suggestionRow}>{SUGGESTIONS.map((suggestion) => <Pressable accessibilityRole="button" disabled={!ai.enabled} key={suggestion} onPress={() => void send(suggestion)} style={({ pressed }) => [styles.suggestion, !ai.enabled && styles.disabled, pressed && styles.pressed]}><Text style={styles.suggestionText}>{suggestion}</Text><Text style={styles.suggestionArrow}>›</Text></Pressable>)}</View>
        </View> : null}
        {messages.length ? <View style={styles.conversationBar}><Text style={styles.conversationLabel}>{messages.filter((item) => item.role === 'user').length} 轮问答</Text><Pressable accessibilityRole="button" onPress={startNewConversation}><Text style={styles.newChatAction}>新对话</Text></Pressable></View> : null}
        {messages.map((message) => message.role === 'user'
          ? <View key={message.id} style={styles.userTurn}>
            <Text style={styles.turnAuthorRight}>你</Text>
            <Text style={styles.userText}>{message.text}</Text>
          </View>
          : <View key={message.id} style={[styles.aiTurn, message.failed && styles.failedTurn]}>
            <View style={styles.turnHead}><Text style={styles.turnAuthor}>AI</Text><Pressable accessibilityLabel="复制回答" accessibilityRole="button" hitSlop={8} onPress={() => { void Clipboard.setStringAsync(message.text); feedback.notice('已复制回答'); }}><Text style={styles.copyAction}>复制</Text></Pressable></View>
            <Text selectable style={styles.assistantText}>{message.text}</Text>
            {message.failed ? <Pressable accessibilityRole="button" onPress={() => retryMessage(message)} style={({ pressed }) => [styles.retryRow, pressed && styles.pressed]}><SymbolView name={{ android: 'refresh', ios: 'arrow.clockwise', web: 'refresh' }} size={14} tintColor={colors.life} type="hierarchical" /><Text style={styles.retryText}>重试</Text></Pressable> : null}
            {message.sources.length ? <View style={styles.footnotes}>
              <Text style={styles.footnotesLabel}>来源</Text>
              {message.sources.slice(0, 5).map((hit) => <Pressable accessibilityRole="button" key={hit.id} onPress={() => openSource(hit)} style={({ pressed }) => [styles.footnoteRow, pressed && styles.pressed]}>
                <Text numberOfLines={1} style={styles.footnoteTitle}>{hit.citationId} {hit.title}</Text>
                <Text numberOfLines={1} style={styles.footnoteMeta}>{[hit.dayKey?.replaceAll('-', '.'), hit.persons.map((person) => person.name).join('、')].filter(Boolean).join(' · ') || '本机记录'}</Text>
              </Pressable>)}
            </View> : null}
            {message.memoryCount > 0 ? <Pressable accessibilityRole="button" onPress={() => router.push('/ai-memory' as RelativePathString)}><Text style={styles.memoryNote}>参考了 {message.memoryCount} 条记忆 · 查看</Text></Pressable> : null}
          </View>)}
        {thinking ? <View style={styles.aiTurn}><View style={styles.thinkingRow}><ActivityIndicator color={colors.life} size="small" /><Text style={styles.thinkingText}>正在翻你的记录…</Text></View></View> : null}
        {pendingMemoryBatch ? <View style={styles.memoryToast}><Text style={styles.memoryToastText}>已自动记住 {pendingMemoryBatch} 件事</Text><View style={styles.memoryToastActions}><Pressable accessibilityRole="button" onPress={() => router.push('/ai-memory' as RelativePathString)}><Text style={styles.memoryToastAction}>查看</Text></Pressable><Pressable accessibilityRole="button" onPress={() => void undoMemories()}><Text style={styles.memoryToastAction}>撤销</Text></Pressable></View></View> : null}
      </ScrollView>
      <View style={styles.composer}>
        <TextInput
          autoCorrect={false}
          editable={!thinking}
          multiline
          onChangeText={setInput}
          placeholder="问点什么，例如：我和小林最近一次见面是什么时候？"
          placeholderTextColor={colors.inkFaint}
          style={styles.input}
          value={input}
        />
        {thinking ? <Pressable accessibilityLabel="停止回答" accessibilityRole="button" onPress={stop} style={({ pressed }) => [styles.sendButton, styles.stopButton, pressed && styles.pressed]}><SymbolView name={{ android: 'stop', ios: 'stop.fill', web: 'stop' }} size={18} tintColor={colors.onLife} type="hierarchical" /></Pressable>
          : <Pressable accessibilityLabel="发送" accessibilityRole="button" disabled={!input.trim() || !ai.enabled} onPress={() => void send(input)} style={({ pressed }) => [styles.sendButton, (!input.trim() || !ai.enabled) && styles.disabled, pressed && styles.pressed]}><SymbolView name={{ android: 'arrow_upward', ios: 'arrow.up', web: 'arrow_upward' }} size={19} tintColor={colors.onLife} type="hierarchical" /></Pressable>}
      </View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = createThemedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  noticeCard: { margin: spacing.lg, padding: spacing.lg, borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, backgroundColor: colors.sheet },
  noticeTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 18 },
  noticeText: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: typography.size.meta, lineHeight: 18 },
  noticeButton: { marginTop: spacing.md, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.life },
  noticeButtonText: { color: colors.onLife, fontSize: typography.size.caption, fontWeight: '800' },
  indexBanner: { marginHorizontal: spacing.lg, marginTop: spacing.sm, minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  indexBannerText: { color: colors.inkFaint, fontSize: typography.size.meta },
  intro: { paddingTop: spacing.lg, paddingBottom: spacing.md },
  introEyebrow: { color: colors.life, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.4 },
  introTitle: { marginTop: spacing.md, color: colors.ink, fontFamily: typography.display, fontSize: 30, lineHeight: 38, letterSpacing: -0.4 },
  introText: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: typography.size.body, lineHeight: 23 },
  suggestionRow: { marginTop: spacing.xl, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.lineSoft },
  suggestion: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  suggestionText: { color: colors.inkSoft, fontSize: typography.size.body },
  suggestionArrow: { color: colors.inkFaint, fontSize: 18 },
  conversationBar: { paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  conversationLabel: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: typography.size.meta },
  newChatAction: { color: colors.life, fontSize: typography.size.caption, fontWeight: '700' },
  userTurn: { marginTop: spacing.lg, alignSelf: 'flex-end', maxWidth: '88%', alignItems: 'flex-end' },
  turnAuthorRight: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1, marginBottom: 4 },
  userText: { color: colors.ink, fontSize: typography.size.body, lineHeight: 23, textAlign: 'right' },
  aiTurn: { marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.lineSoft },
  failedTurn: { borderTopColor: colors.dangerLine },
  turnHead: { marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  turnAuthor: { color: colors.life, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.4, fontWeight: '700' },
  copyAction: { color: colors.inkFaint, fontSize: typography.size.meta },
  assistantText: { color: colors.ink, fontFamily: typography.display, fontSize: 16, lineHeight: 27 },
  retryRow: { marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 4 },
  retryText: { color: colors.life, fontSize: typography.size.meta, fontWeight: '700' },
  footnotes: { marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.lineSoft },
  footnotesLabel: { marginBottom: 4, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1 },
  footnoteRow: { paddingVertical: 4 },
  footnoteTitle: { color: colors.inkSoft, fontSize: typography.size.caption },
  footnoteMeta: { marginTop: 2, color: colors.inkFaint, fontSize: typography.size.meta },
  memoryNote: { marginTop: spacing.sm, color: colors.inkFaint, fontSize: typography.size.meta },
  thinkingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  thinkingText: { color: colors.inkFaint, fontSize: typography.size.meta },
  memoryToast: { marginTop: spacing.lg, minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft },
  memoryToastText: { color: colors.inkSoft, fontSize: typography.size.meta },
  memoryToastActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  memoryToastAction: { color: colors.life, fontSize: typography.size.caption, fontWeight: '700' },
  composer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm, flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.lineSoft, backgroundColor: colors.paper },
  input: { minHeight: 42, maxHeight: 120, flex: 1, paddingVertical: spacing.sm, paddingHorizontal: 2, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, color: colors.ink, fontSize: typography.size.body },
  sendButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.life },
  stopButton: { backgroundColor: colors.danger },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.65 },
}));
