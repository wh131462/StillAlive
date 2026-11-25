import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import * as Clipboard from 'expo-clipboard';
import { colors, spacing, typography } from '@still-alive/tokens';
import { useAi } from '../../application/ai/ai-provider';
import { createChatId, useChatHistory } from '../../application/ai/chat-history-provider';
import { useKnowledge } from '../../application/knowledge/knowledge-provider';
import { useAppState } from '../../application/state/app-state';
import type { KnowledgeHit } from '../../features/ai/domain/knowledge-types';
import type { AiChatMessage, AiConversationSource, AiMessage } from '../../infrastructure/ai/ai-types';
import { isAiRequestError } from '../../infrastructure/ai/ai-types';
import { aiErrorMessage, formatRelativeTime } from '../ai/ai-copy';
import { parseActionProposals, prepareAction } from '../../features/ai/domain/app-actions';
import type { PreparedAiAction } from '../../features/ai/domain/app-actions';
import { personDisplayName } from '../people/person-profile';
import type { LedgerTransaction } from '@still-alive/types';
import MarkdownView from '../journal/markdown-view.dom';
import { ToolPageHeader, ToolPageHeaderAction } from '../../shared/components/tool-page-header';
import { AppKeyboardAvoidingView } from '../../shared/components/app-keyboard-avoiding-view';
import { DraggableBottomSheet } from '../../shared/components/draggable-bottom-sheet';
import { feedback } from '../../shared/feedback';
import { createThemedStyles, editorTheme } from '../../shared/theme/app-theme';

const SUGGESTIONS = ['我最常和谁见面？', '今年花了多少？', '我最近在听什么？', '下个月谁过生日？'];
const MAX_HISTORY_TURNS = 6;

interface FailureState {
  question: string;
  text: string;
}

function toSource(hit: KnowledgeHit): AiConversationSource {
  return {
    citationId: hit.citationId,
    title: hit.title,
    route: hit.route,
    dayKey: hit.dayKey ?? null,
    personNames: hit.persons.map((person) => person.name),
    origin: hit.sourceKind === 'person' || hit.sourceKind === 'person_event' ? 'people' : 'me',
  };
}

function structuredFactRoute(source: { kind: string; id: string } | null): string {
  if (!source) return '';
  if (source.kind === 'person') return `/person/${source.id}`;
  if (source.kind === 'post') return `/post/${source.id}`;
  if (source.kind === 'excerpt') return '/excerpts';
  if (source.kind === 'music') return '/music-box';
  return '';
}

function createMessage(input: Pick<AiChatMessage, 'conversationId' | 'role' | 'text' | 'question'> & Partial<Pick<AiChatMessage, 'failed' | 'memoryCount' | 'sources'>>): AiChatMessage {
  return {
    id: createChatId('ai_message'),
    conversationId: input.conversationId,
    role: input.role,
    text: input.text,
    question: input.question,
    failed: input.failed ?? false,
    memoryCount: input.memoryCount ?? 0,
    sources: input.sources ?? [],
    createdAt: new Date().toISOString(),
  };
}

function dayBucket(iso: string, now = Date.now()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '更早';
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((startOfToday.getTime() - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) / 86_400_000);
  if (diffDays <= 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays <= 7) return '过去 7 天';
  return '更早';
}

export default function AiChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ ask?: string; postId?: string; auto?: string }>();
  const ai = useAi();
  const chat = useChatHistory();
  const knowledge = useKnowledge();
  const { checkInToday, createLedgerTransaction, createPerson, people, posts, savePost, today, todayCheckIn } = useAppState();
  const scrollRef = useRef<ScrollView>(null);
  const abortRef = useRef<AbortController | null>(null);
  const autoStartedRef = useRef(false);
  const extractingMemoryRef = useRef(false);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [failure, setFailure] = useState<FailureState | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pendingMemoryBatch, setPendingMemoryBatch] = useState<number | null>(null);
  const [actionState, setActionState] = useState<Record<string, { status: 'running' | 'error'; error?: string }>>({});
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

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const send = useCallback(async (question: string, options?: { saveQuestion?: boolean; fresh?: boolean }) => {
    const trimmed = question.trim();
    if (!trimmed || thinking) return;
    if (!ai.enabled) {
      feedback.alert('AI 功能未启用', '请先在设置里启用并添加服务商。');
      return;
    }
    const reuseConversation = !options?.fresh && Boolean(chat.activeConversation);
    const history: AiMessage[] = reuseConversation
      ? chat.messages.filter((message) => !message.failed).slice(-MAX_HISTORY_TURNS).map((message) => ({ role: message.role, content: parseActionProposals(message.text).visibleText }))
      : [];
    setFailure(null);
    setInput('');
    setThinking(true);
    setPendingMemoryBatch(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const conversation = options?.fresh || !chat.activeConversation ? await chat.start(trimmed) : chat.activeConversation;
      if (options?.saveQuestion !== false) await chat.append(createMessage({ conversationId: conversation.id, role: 'user', text: trimmed, question: trimmed }));
      scrollToEnd();
      const { messages: promptMessages, result, coreMemories, recalledMemories } = await knowledge.buildChatMessages({ question: trimmed, history, ...(pinnedContext ? { pinnedContext } : {}) });
      const answer = await ai.chat(promptMessages, { taskId: 'chat.answer', maxOutputTokens: 1200, temperature: 0.65, signal: controller.signal });
      const memoryCount = coreMemories.length + recalledMemories.length;
      const structuredSources: AiConversationSource[] = result.structured.facts.map((fact) => ({
        citationId: fact.citationId,
        title: `${fact.label}：${fact.value}`,
        route: structuredFactRoute(fact.source),
        dayKey: null,
        personNames: [],
        origin: fact.source?.kind === 'person' ? 'people' : 'me',
      }));
      const sources = [...structuredSources, ...result.hits.slice(0, 5).map(toSource)];
      await chat.append(createMessage({ conversationId: conversation.id, role: 'assistant', text: answer.text.trim(), question: trimmed, memoryCount, sources }));
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
      if (!(isAiRequestError(cause) && cause.code === 'cancelled')) setFailure({ question: trimmed, text: aiErrorMessage(cause) });
      scrollToEnd();
    } finally {
      setThinking(false);
      abortRef.current = null;
    }
  }, [ai, chat, knowledge, pinnedContext, scrollToEnd, thinking]);

  useEffect(() => {
    if (params.auto !== '1' || autoStartedRef.current || !ai.enabled || !chat.loaded) return;
    const question = params.ask?.trim();
    if (!question) return;
    autoStartedRef.current = true;
    void send(question, { fresh: true });
  }, [ai.enabled, chat.loaded, params.ask, params.auto, send]);

  const stop = () => {
    abortRef.current?.abort();
    setThinking(false);
  };

  const startNewConversation = () => {
    if (thinking) stop();
    void chat.open(null).catch(() => undefined);
    setFailure(null);
    setPendingMemoryBatch(null);
    setInput('');
  };

  const openSource = (source: AiConversationSource) => {
    if (source.route.startsWith('/post/') || source.route.startsWith('/person/')) router.push(source.route as RelativePathString);
    else feedback.alert('这条来源暂不支持跳转', '可以在对应页面里查看。');
  };

  const renameConversation = (conversationId: string, currentTitle: string) => {
    feedback.prompt('重命名对话', undefined, (value) => {
      if (!value.trim()) return;
      void chat.rename(conversationId, value).catch((cause: unknown) => feedback.alert('重命名失败', aiErrorMessage(cause)));
    }, currentTitle);
  };

  const deleteConversation = (conversationId: string, title: string) => {
    feedback.alert('删除这个对话？', `“${title}”会从本机删除，无法恢复。`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => void chat.remove(conversationId).catch((cause: unknown) => feedback.alert('删除失败', aiErrorMessage(cause))) },
    ]);
  };

  const showConversationActions = (conversationId: string, title: string) => {
    feedback.alert(title, undefined, [
      { text: '取消', style: 'cancel' },
      { text: '重命名', onPress: () => renameConversation(conversationId, title) },
      { text: '删除', style: 'destructive', onPress: () => deleteConversation(conversationId, title) },
    ]);
  };

  const clearHistory = () => {
    feedback.alert('清空全部历史对话？', '所有对话会从本机删除，无法恢复。', [
      { text: '取消', style: 'cancel' },
      { text: '清空', style: 'destructive', onPress: () => void chat.clearAll().then(() => { feedback.notice('已清空历史对话'); setHistoryOpen(false); }).catch((cause: unknown) => feedback.alert('清空失败', aiErrorMessage(cause))) },
    ]);
  };

  const undoMemories = useCallback(async () => {
    const count = await knowledge.undoAutoMemories();
    setPendingMemoryBatch(null);
    if (count > 0) feedback.notice(`已撤销 ${count} 条自动记忆`);
  }, [knowledge]);

  const personIdsForNames = useCallback((names: string[]): string[] => {
    if (!names.length) return [];
    return people.filter((person) => [personDisplayName(person), person.name, person.nickname ?? ''].some((value) => names.includes(value))).map((person) => person.id);
  }, [people]);

  const executeAppAction = useCallback(async (message: AiChatMessage, prepared: PreparedAiAction, key: string) => {
    const action = prepared.action;
    if (!action) return;
    setActionState((current) => ({ ...current, [key]: { status: 'running' } }));
    try {
      if (action.tool === 'ledger.create') {
        const now = new Date().toISOString();
        const transaction: LedgerTransaction = {
          id: `ledger_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
          type: action.type,
          amountCents: action.amountCents,
          category: action.category,
          dayKey: action.dayKey,
          note: action.note,
          createdAt: now,
          updatedAt: now,
        };
        await createLedgerTransaction(transaction);
      } else if (action.tool === 'post.create') {
        await savePost(action.body, personIdsForNames(action.personNames), action.dayKey, action.locationName);
      } else if (action.tool === 'person.create') {
        await createPerson(action.name);
      } else if (action.tool === 'memory.remember') {
        await knowledge.rememberMemory({ content: action.content, kind: 'semantic' });
      } else if (action.tool === 'checkin.today') {
        if (!todayCheckIn) await checkInToday();
      }
      const stripped = parseActionProposals(message.text).visibleText;
      const summary = prepared.fields.map((field) => `${field.label} ${field.value}`).join('，');
      await chat.update({ ...message, text: `${stripped}\n\n（已执行 · ${prepared.title}：${summary}）` });
      feedback.notice(todayCheckIn && action.tool === 'checkin.today' ? '今天已经打过卡了' : '已执行');
    } catch (cause) {
      setActionState((current) => ({ ...current, [key]: { status: 'error', error: cause instanceof Error ? cause.message : '执行失败，请稍后重试。' } }));
    }
  }, [chat, checkInToday, createLedgerTransaction, createPerson, knowledge, personIdsForNames, savePost, todayCheckIn]);

  const dismissAppAction = useCallback(async (message: AiChatMessage) => {
    const stripped = parseActionProposals(message.text).visibleText;
    await chat.update({ ...message, text: `${stripped}\n\n（已忽略这个操作）` }).catch((cause: unknown) => feedback.alert('操作失败', aiErrorMessage(cause)));
  }, [chat]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof chat.conversations>();
    for (const conversation of chat.conversations) {
      const key = dayBucket(conversation.updatedAt);
      map.set(key, [...(map.get(key) ?? []), conversation]);
    }
    return [...map.entries()];
  }, [chat.conversations]);

  const showEmpty = !chat.messages.length && !thinking && !failure;

  return <SafeAreaView style={styles.safeArea}>
    <ToolPageHeader
      onBack={() => router.back()}
      right={<View style={styles.headerActions}>
        <ToolPageHeaderAction accessibilityLabel="历史对话" onPress={() => setHistoryOpen(true)}><SymbolView name={{ android: 'history', ios: 'clock', web: 'history' }} size={21} tintColor={colors.inkSoft} type="hierarchical" /></ToolPageHeaderAction>
        <ToolPageHeaderAction accessibilityLabel="新对话" onPress={startNewConversation}><SymbolView name={{ android: 'add', ios: 'plus', web: 'add' }} size={22} tintColor={colors.inkSoft} type="hierarchical" /></ToolPageHeaderAction>
      </View>}
      title={chat.activeConversation?.title ?? 'AI 问答'}
    />
    <AppKeyboardAvoidingView style={styles.flex}>
      {!ai.enabled ? <View style={styles.noticeCard}><Text style={styles.noticeText}>AI 功能未启用，启用后可以就本机记录提问。</Text><Pressable accessibilityRole="button" onPress={() => router.push('/ai-settings' as RelativePathString)} style={styles.noticeButton}><Text style={styles.noticeButtonText}>去设置</Text></Pressable></View> : null}
      {knowledge.indexing ? <View style={styles.indexBanner}><ActivityIndicator color={colors.inkFaint} size="small" /><Text style={styles.indexBannerText}>正在整理本机记录…</Text></View> : null}

      <ScrollView contentContainerStyle={styles.content} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" onContentSizeChange={scrollToEnd} ref={scrollRef}>
        {showEmpty ? <View style={styles.empty}>
          <Text style={styles.emptyTitle}>问记录里的任何事</Text>
          <Text style={styles.emptyText}>回答只依据本机记录与记忆，没有相关内容时会直接说没有。</Text>
          <View style={styles.chips}>{SUGGESTIONS.map((suggestion) => <Pressable accessibilityRole="button" disabled={!ai.enabled} key={suggestion} onPress={() => void send(suggestion)} style={({ pressed }) => [styles.chip, !ai.enabled && styles.disabled, pressed && styles.pressed]}><Text style={styles.chipText}>{suggestion}</Text></Pressable>)}</View>
          {chat.conversations.length ? <Pressable accessibilityRole="button" onPress={() => setHistoryOpen(true)} style={({ pressed }) => [styles.emptyHistory, pressed && styles.pressed]}><Text style={styles.emptyHistoryText}>历史对话</Text><SymbolView name={{ android: 'chevron_right', ios: 'chevron.right', web: 'chevron_right' }} size={14} tintColor={colors.inkFaint} type="hierarchical" /></Pressable> : null}
        </View> : null}

        {chat.messages.map((message) => message.role === 'user'
          ? <View key={message.id} style={styles.userRow}><View style={styles.bubble}><Text selectable style={styles.userText}>{message.text}</Text></View></View>
          : (() => {
            const parsed = parseActionProposals(message.text);
            return <View key={message.id} style={styles.answerBlock}>
            {parsed.visibleText.trim()
              ? <View pointerEvents="none" style={styles.answerMarkdown}><MarkdownView citations={message.sources.map((source) => source.citationId)} dom={{ containerStyle: styles.answerMarkdown, matchContents: true, scrollEnabled: false, style: styles.answerMarkdown }} markdown={parsed.visibleText} media={[]} theme={editorTheme()} variant="chat" /></View>
              : null}
            {parsed.proposals.map((proposal, index) => {
              const prepared = prepareAction(proposal, { today });
              const key = `${message.id}:${index}`;
              return <AiActionCard actionState={actionState[key]} key={key} onDismiss={() => void dismissAppAction(message)} onRun={() => void executeAppAction(message, prepared, key)} prepared={prepared} />;
            })}
            {message.sources.length ? <View style={styles.sources}>
              {message.sources.map((source, index) => <Pressable accessibilityRole="button" key={`${message.id}_${source.route}_${index}`} onPress={() => openSource(source)} style={({ pressed }) => [styles.sourceRow, pressed && styles.pressed]}>
                <View style={styles.sourceBadge}><Text style={styles.sourceBadgeText}>{source.citationId}</Text></View>
                <View style={styles.sourceCopy}>
                  <Text numberOfLines={1} style={styles.sourceTitle}>{source.title}</Text>
                  <Text numberOfLines={1} style={styles.sourceMeta}>{source.origin === 'people' || (!source.origin && source.route.startsWith('/person/')) ? '人物资料' : '我的信息'}{[source.dayKey?.replaceAll('-', '.'), source.personNames.join('、')].filter(Boolean).length ? ` · ${[source.dayKey?.replaceAll('-', '.'), source.personNames.join('、')].filter(Boolean).join(' · ')}` : ''}</Text>
                </View>
              </Pressable>)}
            </View> : null}
            <View style={styles.answerActions}>
              <Pressable accessibilityLabel="复制回答" accessibilityRole="button" hitSlop={10} onPress={() => { void Clipboard.setStringAsync(parsed.visibleText); feedback.notice('已复制'); }} style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}><SymbolView name={{ android: 'content_copy', ios: 'doc.on.doc', web: 'content_copy' }} size={16} tintColor={colors.inkFaint} type="hierarchical" /></Pressable>
              {message.memoryCount > 0 ? <Pressable accessibilityRole="button" onPress={() => router.push('/ai-memory' as RelativePathString)} style={({ pressed }) => [styles.memoryAction, pressed && styles.pressed]}><Text style={styles.memoryActionText}>{message.memoryCount} 条记忆</Text></Pressable> : null}
            </View>
          </View>;
          })())}

        {thinking ? <View style={styles.thinkingRow}><ActivityIndicator color={colors.inkFaint} size="small" /><Text style={styles.thinkingText}>思考中</Text></View> : null}

        {failure ? <View style={styles.failureBlock}>
          <Text style={styles.failureText}>{failure.text}</Text>
          <Pressable accessibilityRole="button" onPress={() => { setFailure(null); void send(failure.question, { saveQuestion: false }); }} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}><SymbolView name={{ android: 'refresh', ios: 'arrow.clockwise', web: 'refresh' }} size={14} tintColor={colors.ink} type="hierarchical" /><Text style={styles.retryText}>重试</Text></Pressable>
        </View> : null}

        {pendingMemoryBatch ? <View style={styles.memoryToast}><Text style={styles.memoryToastText}>已自动记住 {pendingMemoryBatch} 件事</Text><Pressable accessibilityRole="button" onPress={() => router.push('/ai-memory' as RelativePathString)}><Text style={styles.memoryToastAction}>查看</Text></Pressable><Pressable accessibilityRole="button" onPress={() => void undoMemories()}><Text style={styles.memoryToastAction}>撤销</Text></Pressable></View> : null}
      </ScrollView>

      <View style={styles.composer}>
        <View style={styles.inputShell}>
          <TextInput
            autoCorrect={false}
            editable={!thinking}
            multiline
            onChangeText={setInput}
            placeholder="问点什么…"
            placeholderTextColor={colors.inkFaint}
            style={styles.input}
            value={input}
          />
          <Pressable accessibilityLabel="发送" accessibilityRole="button" hitSlop={4} disabled={thinking || !input.trim() || !ai.enabled} onPress={() => void send(input)} style={({ pressed }) => [styles.sendButton, (thinking || !input.trim() || !ai.enabled) && styles.disabled, pressed && styles.pressed]}>
            {thinking ? <ActivityIndicator color={colors.onLife} size="small" /> : <SymbolView name={{ android: 'arrow_upward', ios: 'arrow.up', web: 'arrow_upward' }} size={17} tintColor={colors.onLife} type="hierarchical" />}
          </Pressable>
        </View>
      </View>
    </AppKeyboardAvoidingView>

    <DraggableBottomSheet accessibilityLabel="历史对话" onClose={() => setHistoryOpen(false)} open={historyOpen} sheetStyle={styles.sheet}>
      <Text style={styles.sheetTitle}>历史对话</Text>
      <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
        {groups.map(([label, items]) => <View key={label}>
          <Text style={styles.sheetSection}>{label}</Text>
          {items.map((conversation, index) => <Pressable
            accessibilityRole="button"
            key={conversation.id}
            onLongPress={() => showConversationActions(conversation.id, conversation.title)}
            onPress={() => { setHistoryOpen(false); setFailure(null); void chat.open(conversation.id).catch(() => undefined); }}
            style={({ pressed }) => [styles.historyRow, index === items.length - 1 && styles.historyRowLast, pressed && styles.pressed]}
          >
            <Text numberOfLines={1} style={styles.historyTitle}>{conversation.title}</Text>
            <Text style={styles.historyTime}>{formatRelativeTime(conversation.updatedAt)}</Text>
            <Pressable accessibilityLabel="对话操作" accessibilityRole="button" hitSlop={12} onPress={() => showConversationActions(conversation.id, conversation.title)} style={styles.historyMore}><SymbolView name={{ android: 'more_horiz', ios: 'ellipsis', web: 'more_horiz' }} size={18} tintColor={colors.inkFaint} type="hierarchical" /></Pressable>
          </Pressable>)}
        </View>)}
        {!chat.conversations.length ? <Text style={styles.sheetEmpty}>还没有历史对话</Text> : null}
      </ScrollView>
      <View style={styles.sheetFoot}>
        <Text style={styles.sheetNote}>对话只保存在本机，不会随备份导出。</Text>
        {chat.conversations.length ? <Pressable accessibilityRole="button" onPress={clearHistory} style={({ pressed }) => [styles.sheetDangerRow, pressed && styles.pressed]}><Text style={styles.sheetDanger}>清空历史对话</Text></Pressable> : null}
      </View>
    </DraggableBottomSheet>
  </SafeAreaView>;
}

function AiActionCard({ actionState, onDismiss, onRun, prepared }: {
  actionState?: { status: 'running' | 'error'; error?: string };
  onDismiss(): void;
  onRun(): void;
  prepared: PreparedAiAction;
}) {
  const running = actionState?.status === 'running';
  return <View style={styles.actionCard}>
    <Text style={styles.actionEyebrow}>可执行操作 · 写入{prepared.target}</Text>
    <Text style={styles.actionTitle}>{prepared.title}</Text>
    {prepared.fields.map((field) => <View key={`${field.label}_${field.value}`} style={styles.actionField}><Text style={styles.actionFieldLabel}>{field.label}</Text><Text style={styles.actionFieldValue}>{field.value}</Text></View>)}
    {prepared.error ? <Text style={styles.actionError}>{prepared.error}</Text> : null}
    {actionState?.status === 'error' ? <Text style={styles.actionError}>{actionState.error}</Text> : null}
    <View style={styles.actionButtons}>
      {prepared.action ? <Pressable accessibilityRole="button" disabled={running} onPress={onRun} style={({ pressed }) => [styles.actionPrimary, running && styles.disabled, pressed && styles.pressed]}>{running ? <ActivityIndicator color={colors.onLife} size="small" /> : <Text style={styles.actionPrimaryText}>执行</Text>}</Pressable> : null}
      <Pressable accessibilityRole="button" disabled={running} onPress={onDismiss} style={({ pressed }) => [styles.actionGhost, running && styles.disabled, pressed && styles.pressed]}><Text style={styles.actionGhostText}>{prepared.action ? '忽略' : '知道了'}</Text></Pressable>
    </View>
  </View>;
}

const styles = createThemedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  noticeCard: { marginHorizontal: spacing.lg, marginTop: spacing.sm, padding: spacing.md, borderRadius: 12, backgroundColor: colors.sheet },
  noticeText: { color: colors.inkSoft, fontSize: typography.size.body, lineHeight: 20 },
  noticeButton: { marginTop: spacing.sm, alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
  noticeButtonText: { color: colors.life, fontSize: typography.size.body, fontWeight: '600' },
  indexBanner: { marginHorizontal: spacing.lg, minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  indexBannerText: { color: colors.inkFaint, fontSize: typography.size.caption },
  empty: { paddingTop: spacing.xl },
  emptyTitle: { color: colors.ink, fontSize: 26, fontWeight: '700', letterSpacing: -0.4 },
  emptyText: { marginTop: spacing.sm, color: colors.inkFaint, fontSize: typography.size.body, lineHeight: 21 },
  chips: { marginTop: spacing.xl, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { minHeight: 38, paddingHorizontal: spacing.md, justifyContent: 'center', borderRadius: 19, backgroundColor: colors.sheet },
  chipText: { color: colors.inkSoft, fontSize: typography.size.body },
  emptyHistory: { marginTop: spacing.xl, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 2 },
  emptyHistoryText: { color: colors.inkSoft, fontSize: typography.size.body },
  userRow: { marginTop: spacing.xl, alignItems: 'flex-end' },
  bubble: { maxWidth: '84%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, backgroundColor: colors.lifeLight },
  userText: { color: colors.ink, fontSize: typography.size.bodyLarge, lineHeight: 23 },
  answerBlock: { marginTop: spacing.lg },
  answerMarkdown: { width: '100%', alignSelf: 'stretch', backgroundColor: 'transparent' },
  sources: { marginTop: spacing.md, paddingTop: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.lineSoft },
  sourceRow: { minHeight: 48, paddingVertical: spacing.xs, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  sourceBadge: { minWidth: 26, paddingHorizontal: 5, paddingVertical: 2, alignItems: 'center', justifyContent: 'center', borderRadius: 4, backgroundColor: colors.lifeLight },
  sourceBadgeText: { color: colors.life, fontFamily: typography.mono, fontSize: 9, letterSpacing: 0.4 },
  sourceCopy: { flex: 1, gap: 2 },
  sourceTitle: { color: colors.inkSoft, fontSize: typography.size.caption },
  sourceMeta: { color: colors.inkFaint, fontSize: typography.size.meta },
  actionCard: { marginTop: spacing.md, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lifeLine, borderRadius: 12, backgroundColor: colors.sheet },
  actionEyebrow: { color: colors.life, fontFamily: typography.mono, fontSize: 10, letterSpacing: 1 },
  actionTitle: { marginTop: 4, color: colors.ink, fontFamily: typography.display, fontSize: 18 },
  actionField: { marginTop: spacing.sm, flexDirection: 'row', gap: spacing.md },
  actionFieldLabel: { width: 36, color: colors.inkFaint, fontSize: typography.size.meta },
  actionFieldValue: { flex: 1, color: colors.ink, fontSize: typography.size.body },
  actionError: { marginTop: spacing.sm, color: colors.danger, fontSize: typography.size.meta },
  actionButtons: { marginTop: spacing.md, flexDirection: 'row', gap: spacing.sm },
  actionPrimary: { minHeight: 40, minWidth: 92, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.life },
  actionPrimaryText: { color: colors.onLife, fontSize: typography.size.caption, fontWeight: '800' },
  actionGhost: { minHeight: 40, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center' },
  actionGhostText: { color: colors.inkFaint, fontSize: typography.size.caption, fontWeight: '600' },
  answerActions: { marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconAction: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  memoryAction: { minHeight: 32, justifyContent: 'center' },
  memoryActionText: { color: colors.inkFaint, fontSize: typography.size.meta },
  thinkingRow: { marginTop: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  thinkingText: { flex: 1, color: colors.inkFaint, fontSize: typography.size.caption },
  failureBlock: { marginTop: spacing.lg, padding: spacing.md, borderRadius: 12, backgroundColor: colors.sheet },
  failureText: { color: colors.inkSoft, fontSize: typography.size.caption, lineHeight: 19 },
  retryButton: { marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', minHeight: 32 },
  retryText: { color: colors.ink, fontSize: typography.size.caption, fontWeight: '600' },
  memoryToast: { marginTop: spacing.lg, minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  memoryToastText: { flex: 1, color: colors.inkFaint, fontSize: typography.size.caption },
  memoryToastAction: { color: colors.ink, fontSize: typography.size.caption, fontWeight: '600' },
  composer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.lineSoft },
  inputShell: { minHeight: 44, maxHeight: 132, paddingLeft: 16, paddingRight: 6, paddingVertical: 4, flexDirection: 'row', alignItems: 'flex-end', borderRadius: 22, backgroundColor: colors.sheet },
  input: { flex: 1, maxHeight: 120, paddingTop: 10, paddingBottom: 10, paddingRight: spacing.sm, color: colors.ink, fontSize: typography.size.bodyLarge, lineHeight: 21 },
  sendButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: colors.life },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.6 },
  sheet: { maxHeight: '76%', paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  sheetTitle: { paddingTop: spacing.xs, paddingBottom: spacing.md, color: colors.ink, fontSize: typography.size.title, fontWeight: '700' },
  sheetList: { flexGrow: 0, flexShrink: 1 },
  sheetSection: { paddingTop: spacing.md, paddingBottom: spacing.xs, color: colors.inkFaint, fontSize: typography.size.label },
  historyRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  historyRowLast: { borderBottomWidth: 0 },
  historyTitle: { flex: 1, color: colors.ink, fontSize: typography.size.bodyLarge },
  historyTime: { color: colors.inkFaint, fontSize: typography.size.meta },
  historyMore: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  sheetEmpty: { paddingVertical: spacing.xl, color: colors.inkFaint, fontSize: typography.size.body },
  sheetFoot: { paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.lineSoft },
  sheetNote: { color: colors.inkFaint, fontSize: typography.size.label, lineHeight: 17 },
  sheetDangerRow: { marginTop: spacing.md, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.dangerLight },
  sheetDanger: { color: colors.danger, fontSize: typography.size.bodyLarge, fontWeight: '600' },
}));
