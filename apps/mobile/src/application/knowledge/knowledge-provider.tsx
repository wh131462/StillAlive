import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { useAppState } from '../state/app-state';
import { useAi } from '../ai/ai-provider';
import { SQLiteStillAliveRepository } from '../../infrastructure/database/sqlite-repository';
import { buildKnowledgeData, ensureKnowledgeIndex } from './indexer';
import type { KnowledgeIndexResult } from './indexer';
import { buildQueryTerms, packKnowledgeHits, routeForKnowledgeSource, scoreChunks } from '../../features/ai/domain/retrieval';
import { routeStructuredQueries, resolveStructuredQueries } from '../../features/ai/domain/intent-resolvers';
import type { CombinedStructuredResult } from '../../features/ai/domain/intent-resolvers';
import { createMemoryRevisionJson, planMemoryWrite, scoreMemories, selectCoreMemories } from '../../features/ai/domain/memory-rules';
import type { MemoryHit } from '../../features/ai/domain/memory-rules';
import { buildChatAnswerMessages, buildMemoryExtractMessages, parseMemoryExtractionResponse } from '../ai/ai-tasks';
import type { ChatPromptInput } from '../ai/ai-tasks';
import { createLocalEntityId, hashText } from '../../features/ai/domain/knowledge-types';
import type {
  KnowledgeDataInput,
  KnowledgeHit,
  KnowledgeQuery,
  KnowledgeStats,
  MemoryItem,
  MemoryKind,
  MemorySourceRef,
  MemorySubject,
} from '../../features/ai/domain/knowledge-types';
import { writePersistentError } from '../../infrastructure/platform/persistent-log';

export interface KnowledgeSearchResult {
  hits: KnowledgeHit[];
  structured: CombinedStructuredResult;
  usedTokens: number;
  truncated: boolean;
  scopeLabel: string;
}

export interface KnowledgeContextValue {
  knowledgeEnabled: boolean;
  memoryEnabled: boolean;
  autoExtract: boolean;
  indexing: boolean;
  indexError: string | null;
  lastIndexedAt: string | null;
  memories: MemoryItem[];
  setKnowledgeEnabled(value: boolean): Promise<void>;
  setMemoryEnabled(value: boolean): Promise<void>;
  setAutoExtract(value: boolean): Promise<void>;
  ensureIndexed(force?: boolean): Promise<KnowledgeIndexResult>;
  search(input: KnowledgeQuery): Promise<KnowledgeSearchResult>;
  buildChatMessages(input: { question: string; history: ChatPromptInput['history']; scopeLabel?: string; pinnedContext?: string }): Promise<{ messages: ReturnType<typeof buildChatAnswerMessages>; result: KnowledgeSearchResult; coreMemories: MemoryItem[]; recalledMemories: MemoryHit[] }>;
  recallMemories(question: string, subject?: MemorySubject): Promise<{ core: MemoryItem[]; recalled: MemoryHit[] }>;
  rememberMemory(input: { content: string; kind?: MemoryKind; subject?: MemorySubject }): Promise<void>;
  forgetMemory(memoryId: string): Promise<void>;
  restoreMemory(memoryId: string): Promise<void>;
  suppressMemory(memoryId: string): Promise<void>;
  undoAutoMemories(): Promise<number>;
  clearMemories(): Promise<void>;
  markMemoriesUsed(memoryIds: string[]): Promise<void>;
  extractMemories(input: { question: string; answer: string; sourcesSummary: string }): Promise<number>;
  refreshMemories(): Promise<void>;
  stats(): Promise<KnowledgeStats>;
  clearIndex(): Promise<void>;
}

const KnowledgeContext = createContext<KnowledgeContextValue | null>(null);

export function KnowledgeProvider({ children }: PropsWithChildren) {
  const database = useSQLiteContext();
  const repository = useMemo(() => new SQLiteStillAliveRepository(database), [database]);
  const appState = useAppState();
  const ai = useAi();
  const [knowledgeEnabled, setKnowledgeEnabledState] = useState(true);
  const [memoryEnabled, setMemoryEnabledState] = useState(true);
  const [autoExtract, setAutoExtractState] = useState(true);
  const [indexing, setIndexing] = useState(false);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [lastIndexedAt, setLastIndexedAt] = useState<string | null>(null);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const indexPromise = useRef<Promise<KnowledgeIndexResult> | null>(null);

  const refreshMemories = useCallback(async () => {
    const items = await repository.listMemoryItems();
    setMemories(items);
  }, [repository]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      repository.getAiSetting('knowledge.enabled'),
      repository.getAiSetting('memory.enabled'),
      repository.getAiSetting('memory.autoExtract'),
      repository.getKnowledgeState('last_indexed_at'),
      repository.listMemoryItems(),
    ]).then(([knowledgeValue, memoryValue, autoValue, indexedAt, memoryItems]) => {
      if (!active) return;
      setKnowledgeEnabledState(knowledgeValue !== 'false');
      setMemoryEnabledState(memoryValue !== 'false');
      setAutoExtractState(autoValue !== 'false');
      setLastIndexedAt(indexedAt);
      setMemories(memoryItems);
    }).catch((cause: unknown) => writePersistentError('knowledge.settings.load.failed', cause));
    return () => { active = false; };
  }, [repository]);

  const setSetting = useCallback(async (key: string, value: boolean, apply: (next: boolean) => void) => {
    await repository.setAiSetting(key, value ? 'true' : 'false');
    apply(value);
  }, [repository]);

  const buildData = useCallback(async (): Promise<KnowledgeDataInput> => {
    const postPersons = await repository.listPostPersons();
    return buildKnowledgeData({
      posts: appState.posts,
      people: appState.people,
      personEvents: appState.personEvents,
      postPersons,
      personTags: appState.personTags,
      bookExcerpts: appState.bookExcerpts,
      books: appState.books,
      ledgerTransactions: appState.ledgerTransactions,
      checkIns: appState.checkIns,
      musicTracks: appState.musicTracks,
      musicCollectionEntries: appState.musicCollectionEntries,
      personBooks: appState.personBooks,
      self: { name: appState.preferences.nickname.trim() || appState.preferences.profileName.trim(), birthDate: appState.preferences.birthDate || null },
      today: appState.today,
    });
  }, [appState.bookExcerpts, appState.books, appState.checkIns, appState.ledgerTransactions, appState.musicCollectionEntries, appState.musicTracks, appState.people, appState.personBooks, appState.personEvents, appState.personTags, appState.posts, appState.preferences.birthDate, appState.preferences.nickname, appState.preferences.profileName, appState.today, repository]);

  const ensureIndexed = useCallback(async (force = false): Promise<KnowledgeIndexResult> => {
    if (indexPromise.current) return indexPromise.current;
    setIndexing(true);
    setIndexError(null);
    const task = (async () => {
      try {
        const data = await buildData();
        const result = await ensureKnowledgeIndex({ repository, data, force });
        setLastIndexedAt(await repository.getKnowledgeState('last_indexed_at'));
        return result;
      } catch (cause) {
        setIndexError(cause instanceof Error ? cause.message : '整理记录失败');
        throw cause;
      } finally {
        setIndexing(false);
        indexPromise.current = null;
      }
    })();
    indexPromise.current = task;
    return task;
  }, [buildData, repository]);

  const search = useCallback(async (input: KnowledgeQuery): Promise<KnowledgeSearchResult> => {
    const empty: KnowledgeSearchResult = { hits: [], structured: { facts: [], renderedText: '', entityIds: { postIds: [], personIds: [], trackIds: [], bookIds: [] } }, usedTokens: 0, truncated: false, scopeLabel: '' };
    if (!knowledgeEnabled) return empty;
    const data = await buildData();
    const query = input.text.trim();
    const scopeLabel = describeScope(input);
    const structured = resolveStructuredQueries(routeStructuredQueries(query, data), data);
    if (!query) return { ...empty, structured, scopeLabel };
    await ensureIndexed();
    const terms = buildQueryTerms(query);
    const [ftsChunks, likeChunks] = await Promise.all([
      terms.ftsMatch ? repository.searchKnowledgeFts(terms.ftsMatch, 120) : Promise.resolve([]),
      terms.likePatterns.length ? repository.searchKnowledgeLike(terms.likePatterns, 60) : Promise.resolve([]),
    ]);
    const matches = new Map<string, Array<'fts' | 'like'>>();
    for (const chunk of ftsChunks) matches.set(chunk.id, ['fts']);
    for (const chunk of likeChunks) {
      const current = matches.get(chunk.id) ?? [];
      if (!current.includes('like')) current.push('like');
      matches.set(chunk.id, current);
    }
    const chunks = [...new Map([...ftsChunks, ...likeChunks].map((chunk) => [chunk.id, chunk])).values()];
    const personNames = new Map(appState.people.map((person) => [person.id, person.nickname.trim() || person.name]));
    const preferredSourceIds = new Set([...structured.entityIds.postIds, ...structured.entityIds.personIds, ...structured.entityIds.trackIds, ...structured.entityIds.bookIds]);
    const scored = scoreChunks({ chunks, terms, matches, personNames: { get: (id) => personNames.get(id) }, scope: input.scope, preferredSourceIds, excludePrivate: true });
    const packed = packKnowledgeHits({
      scored,
      personNames: { get: (id) => personNames.get(id) },
      tokenBudget: input.tokenBudget ?? 5200,
      limit: input.limit ?? 8,
      routeFor: (chunk) => routeForKnowledgeSource(chunk.sourceKind, chunk.sourceId),
    });
    return { hits: packed.hits, structured, usedTokens: packed.usedTokens, truncated: packed.truncated, scopeLabel };
  }, [appState.people, buildData, ensureIndexed, knowledgeEnabled, repository]);

  const recallMemories = useCallback(async (question: string, subject?: MemorySubject) => {
    if (!memoryEnabled) return { core: [], recalled: [] };
    const items = await repository.listMemoryItems();
    const active = items.filter((item) => item.status === 'active' && item.validTo === null);
    const core = selectCoreMemories(active);
    const coreIds = new Set(core.map((item) => item.id));
    const recalled = scoreMemories({ memories: active.filter((item) => !coreIds.has(item.id)), question, subject }).slice(0, 8);
    return { core, recalled };
  }, [memoryEnabled, repository]);

  const writeMemoryPlan = useCallback(async (draft: { content: string; kind: MemoryKind; subject: MemorySubject; origin: MemoryItem['origin']; confidence?: number; importance?: 1 | 2 | 3; sources: MemorySourceRef[]; extractionBatchId?: string }) => {
    const existing = await repository.listMemoryItems();
    const plan = planMemoryWrite({ content: draft.content, kind: draft.kind, subject: draft.subject, origin: draft.origin, confidence: draft.confidence, importance: draft.importance, sources: draft.sources, extractionBatchId: draft.extractionBatchId ?? null }, existing);
    if (plan.reason === 'empty') return null;
    if (plan.mergedMemoryId) {
      await repository.updateMemoryItem(plan.item);
      await repository.saveMemorySources(plan.item.id, draft.sources);
      await repository.saveMemoryRevision({
        id: createLocalEntityId('memory_revision'), memoryId: plan.item.id, action: plan.revisionAction,
        beforeJson: null, afterJson: createMemoryRevisionJson(plan.item), reason: plan.reason, createdAt: new Date().toISOString(),
      });
      return plan.item;
    }
    await repository.saveMemoryItem(plan.item);
    await repository.saveMemorySources(plan.item.id, draft.sources);
    await repository.saveMemoryRevision({
      id: createLocalEntityId('memory_revision'), memoryId: plan.item.id, action: plan.revisionAction,
      beforeJson: null, afterJson: createMemoryRevisionJson(plan.item), reason: plan.reason, createdAt: new Date().toISOString(),
    });
    for (const invalidatedId of plan.invalidatedMemoryIds) {
      const invalidated = existing.find((item) => item.id === invalidatedId);
      if (!invalidated) continue;
      const updated: MemoryItem = { ...invalidated, validTo: new Date().toISOString(), status: 'archived', updatedAt: new Date().toISOString() };
      await repository.updateMemoryItem(updated);
      await repository.saveMemoryRevision({
        id: createLocalEntityId('memory_revision'), memoryId: invalidated.id, action: 'invalidate',
        beforeJson: createMemoryRevisionJson(invalidated), afterJson: createMemoryRevisionJson(updated),
        reason: `auto_extract:${draft.extractionBatchId ?? ''}`, createdAt: new Date().toISOString(),
      });
    }
    return plan.item;
  }, [repository]);

  const rememberMemory = useCallback(async (input: { content: string; kind?: MemoryKind; subject?: MemorySubject }) => {
    await writeMemoryPlan({
      content: input.content,
      kind: input.kind ?? 'semantic',
      subject: input.subject ?? { type: 'self', id: null },
      origin: 'user',
      confidence: 1,
      importance: 3,
      sources: [],
    });
    await refreshMemories();
  }, [refreshMemories, writeMemoryPlan]);

  const markMemoryStatus = useCallback(async (memoryId: string, status: MemoryItem['status'], validTo: string | null) => {
    const item = await repository.getMemoryItem(memoryId);
    if (!item) return;
    const action = status === 'deleted' ? 'forget' : status === 'suppressed' ? 'suppress' : 'archive';
    await repository.updateMemoryItem({ ...item, status, validTo, updatedAt: new Date().toISOString() });
    await repository.saveMemoryRevision({
      id: createLocalEntityId('memory_revision'), memoryId, action,
      beforeJson: createMemoryRevisionJson(item), afterJson: null, reason: null, createdAt: new Date().toISOString(),
    });
    await refreshMemories();
  }, [refreshMemories, repository]);

  const forgetMemory = useCallback(async (memoryId: string) => markMemoryStatus(memoryId, 'deleted', new Date().toISOString()), [markMemoryStatus]);
  const restoreMemory = useCallback(async (memoryId: string) => markMemoryStatus(memoryId, 'active', null), [markMemoryStatus]);
  const suppressMemory = useCallback(async (memoryId: string) => markMemoryStatus(memoryId, 'suppressed', new Date().toISOString()), [markMemoryStatus]);

  const undoAutoMemories = useCallback(async (): Promise<number> => {
    const items = await repository.listMemoryItems();
    const autoItems = items.filter((item) => item.origin === 'ai_auto' && item.status === 'active' && item.extractionBatchId);
    const batches = autoItems.map((item) => item.extractionBatchId ?? '').sort();
    const latestBatch = batches[batches.length - 1] ?? '';
    if (!latestBatch) return 0;
    const batchItems = autoItems.filter((item) => item.extractionBatchId === latestBatch);
    for (const item of batchItems) {
      await repository.updateMemoryItem({ ...item, status: 'deleted', updatedAt: new Date().toISOString() });
      await repository.saveMemoryRevision({
        id: createLocalEntityId('memory_revision'), memoryId: item.id, action: 'undo',
        beforeJson: createMemoryRevisionJson(item), afterJson: null, reason: `undo:${latestBatch}`, createdAt: new Date().toISOString(),
      });
    }
    await refreshMemories();
    return batchItems.length;
  }, [refreshMemories, repository]);

  const clearMemories = useCallback(async () => {
    await repository.clearAllMemory();
    setMemories([]);
  }, [repository]);

  const markMemoriesUsed = useCallback(async (memoryIds: string[]) => {
    const now = new Date().toISOString();
    for (const memoryId of memoryIds) {
      const item = await repository.getMemoryItem(memoryId);
      if (!item) continue;
      await repository.updateMemoryItem({ ...item, lastUsedAt: now, useCount: item.useCount + 1, updatedAt: now });
    }
  }, [repository]);

  const extractMemories = useCallback(async (input: { question: string; answer: string; sourcesSummary: string }): Promise<number> => {
    if (!memoryEnabled || !autoExtract || !ai.enabled) return 0;
    let batchId: string | null = null;
    try {
      const knownPeople = appState.people.map((person) => ({ id: person.id, name: person.nickname.trim() || person.name }));
      const existing = await repository.listMemoryItems();
      const result = await ai.chat(buildMemoryExtractMessages({
        question: input.question,
        answer: input.answer,
        sourcesSummary: input.sourcesSummary,
        knownPeople,
        existingMemories: existing.filter((item) => item.status === 'active').slice(0, 20).map((item) => item.content),
      }), { taskId: 'memory.extract', maxOutputTokens: 400, temperature: 0.2 });
      const drafts = parseMemoryExtractionResponse(result.text, new Set(knownPeople.map((person) => person.id)));
      if (!drafts.length) return 0;
      batchId = createLocalEntityId('memory_batch');
      let created = 0;
      for (const draft of drafts) {
        const written = await writeMemoryPlan({
          content: draft.content,
          kind: draft.kind,
          subject: { type: draft.subjectType, id: draft.subjectId },
          origin: 'ai_auto',
          confidence: draft.confidence,
          importance: 2,
          sources: [{ sourceKind: 'chat', sourceId: hashText(input.question) }],
          extractionBatchId: batchId,
        });
        if (written) created += 1;
      }
      await refreshMemories();
      return created;
    } catch (cause) {
      writePersistentError('ai.memory.extract.failed', cause);
      return 0;
    }
  }, [ai, appState.people, autoExtract, memoryEnabled, refreshMemories, repository, writeMemoryPlan]);

  const stats = useCallback(async (): Promise<KnowledgeStats> => {
    const [sources, aggregates, lastIndexed] = await Promise.all([
      repository.listKnowledgeSources(),
      repository.listKnowledgeAggregates(),
      repository.getKnowledgeState('last_indexed_at'),
    ]);
    return {
      chunks: sources.reduce((sum, source) => sum + source.chunkCount, 0),
      aggregates: aggregates.length,
      lastIndexedAt: lastIndexed,
      backfillDone: Boolean(lastIndexed),
    };
  }, [repository]);

  const clearIndex = useCallback(async () => {
    await repository.clearKnowledgeIndex();
    setLastIndexedAt(null);
  }, [repository]);

  const buildChatMessages = useCallback(async (input: { question: string; history: ChatPromptInput['history']; scopeLabel?: string; pinnedContext?: string }): Promise<{ messages: ReturnType<typeof buildChatAnswerMessages>; result: KnowledgeSearchResult; coreMemories: MemoryItem[]; recalledMemories: MemoryHit[] }> => {
    const result = await search({ text: input.question, tokenBudget: 5200 });
    const { core, recalled } = await recallMemories(input.question);
    const messages = buildChatAnswerMessages({
      question: input.question,
      scopeLabel: input.scopeLabel ?? result.scopeLabel,
      structuredText: result.structured.renderedText,
      ...(input.pinnedContext ? { pinnedContext: input.pinnedContext } : {}),
      hits: result.hits,
      hitsTruncated: result.truncated,
      coreMemories: core,
      recalledMemories: recalled,
      history: input.history,
    });
    return { messages, result, coreMemories: core, recalledMemories: recalled };
  }, [recallMemories, search]);

  const value = useMemo<KnowledgeContextValue>(() => ({
    knowledgeEnabled,
    memoryEnabled,
    autoExtract,
    indexing,
    indexError,
    lastIndexedAt,
    memories,
    setKnowledgeEnabled: (next: boolean) => setSetting('knowledge.enabled', next, setKnowledgeEnabledState),
    setMemoryEnabled: (next: boolean) => setSetting('memory.enabled', next, setMemoryEnabledState),
    setAutoExtract: (next: boolean) => setSetting('memory.autoExtract', next, setAutoExtractState),
    ensureIndexed,
    search,
    buildChatMessages,
    recallMemories,
    rememberMemory,
    forgetMemory,
    restoreMemory,
    suppressMemory,
    undoAutoMemories,
    clearMemories,
    markMemoriesUsed,
    extractMemories,
    refreshMemories,
    stats,
    clearIndex,
  }), [autoExtract, buildChatMessages, clearIndex, clearMemories, ensureIndexed, extractMemories, forgetMemory, indexError, indexing, knowledgeEnabled, lastIndexedAt, markMemoriesUsed, memories, memoryEnabled, recallMemories, refreshMemories, rememberMemory, restoreMemory, search, setSetting, stats, suppressMemory, undoAutoMemories]);

  return <KnowledgeContext.Provider value={value}>{children}</KnowledgeContext.Provider>;
}

export function useKnowledge(): KnowledgeContextValue {
  const value = useContext(KnowledgeContext);
  if (!value) throw new Error('useKnowledge must be used inside KnowledgeProvider');
  return value;
}

function describeScope(query: KnowledgeQuery): string {
  if (!query.scope) return '全部记录';
  const parts: string[] = [];
  if (query.scope.personId) parts.push('指定人物');
  if (query.scope.from || query.scope.to) parts.push(`${query.scope.from ?? '—'} 至 ${query.scope.to ?? '—'}`);
  if (query.scope.tag) parts.push(`标签 ${query.scope.tag}`);
  if (query.scope.bookId) parts.push('指定书籍');
  return parts.join(' · ') || '全部记录';
}

