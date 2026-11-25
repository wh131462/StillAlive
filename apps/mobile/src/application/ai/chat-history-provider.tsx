import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { SQLiteStillAliveRepository } from '../../infrastructure/database/sqlite-repository';
import type { AiChatMessage, AiConversation } from '../../infrastructure/ai/ai-types';
import { writePersistentError } from '../../infrastructure/platform/persistent-log';

export interface ChatHistoryContextValue {
  conversations: AiConversation[];
  activeConversation: AiConversation | null;
  messages: AiChatMessage[];
  loaded: boolean;
  refresh(): Promise<AiConversation[]>;
  open(conversationId: string | null): Promise<void>;
  start(question: string): Promise<AiConversation>;
  append(message: AiChatMessage): Promise<void>;
  update(message: AiChatMessage): Promise<void>;
  rename(conversationId: string, title: string): Promise<void>;
  remove(conversationId: string): Promise<void>;
  clearAll(): Promise<void>;
}

export const CHAT_TITLE_MAX_LENGTH = 24;

const ChatHistoryContext = createContext<ChatHistoryContextValue | null>(null);

export function chatConversationTitle(question: string): string {
  const collapsed = question.trim().replace(/\s+/gu, ' ');
  if (!collapsed) return '新的对话';
  return collapsed.length > CHAT_TITLE_MAX_LENGTH ? `${collapsed.slice(0, CHAT_TITLE_MAX_LENGTH)}…` : collapsed;
}

export function createChatId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function ChatHistoryProvider({ children }: PropsWithChildren) {
  const database = useSQLiteContext();
  const repository = useMemo(() => new SQLiteStillAliveRepository(database), [database]);
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const conversationsRef = useRef<AiConversation[]>([]);
  const messagesRef = useRef<AiChatMessage[]>([]);

  const replaceConversations = useCallback((next: AiConversation[]) => {
    conversationsRef.current = next;
    setConversations(next);
  }, []);

  const replaceConversation = useCallback((next: AiConversation) => {
    const others = conversationsRef.current.filter((item) => item.id !== next.id);
    replaceConversations([next, ...others].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)));
  }, [replaceConversations]);

  const refresh = useCallback(async (): Promise<AiConversation[]> => {
    const next = await repository.listAiConversations();
    replaceConversations(next);
    setLoaded(true);
    return next;
  }, [repository, replaceConversations]);

  const open = useCallback(async (conversationId: string | null): Promise<void> => {
    if (!conversationId) {
      setActiveId(null);
      messagesRef.current = [];
      setMessages([]);
      return;
    }
    const next = await repository.listAiChatMessages(conversationId);
    setActiveId(conversationId);
    messagesRef.current = next;
    setMessages(next);
  }, [repository]);

  const start = useCallback(async (question: string): Promise<AiConversation> => {
    const now = new Date().toISOString();
    const conversation: AiConversation = { id: createChatId('ai_conversation'), title: chatConversationTitle(question), createdAt: now, updatedAt: now, messageCount: 0 };
    await repository.createAiConversation(conversation);
    replaceConversations([conversation, ...conversationsRef.current]);
    setActiveId(conversation.id);
    messagesRef.current = [];
    setMessages([]);
    return conversation;
  }, [repository, replaceConversations]);

  const append = useCallback(async (message: AiChatMessage): Promise<void> => {
    const isNew = !messagesRef.current.some((item) => item.id === message.id);
    await repository.saveAiChatMessage(message);
    if (isNew) {
      messagesRef.current = [...messagesRef.current, message];
      setMessages(messagesRef.current);
    }
    const conversation = conversationsRef.current.find((item) => item.id === message.conversationId);
    if (!conversation || !isNew) return;
    const next: AiConversation = { ...conversation, messageCount: conversation.messageCount + 1, updatedAt: message.createdAt };
    await repository.updateAiConversation(next);
    replaceConversation(next);
  }, [repository, replaceConversation]);

  const update = useCallback(async (message: AiChatMessage): Promise<void> => {
    await repository.saveAiChatMessage(message);
    messagesRef.current = messagesRef.current.map((item) => item.id === message.id ? message : item);
    setMessages(messagesRef.current);
  }, [repository]);

  const rename = useCallback(async (conversationId: string, title: string): Promise<void> => {
    const conversation = conversationsRef.current.find((item) => item.id === conversationId);
    const trimmed = title.trim();
    if (!conversation || !trimmed) return;
    const next: AiConversation = { ...conversation, title: trimmed, updatedAt: conversation.updatedAt };
    await repository.updateAiConversation(next);
    replaceConversations(conversationsRef.current.map((item) => item.id === conversationId ? next : item));
  }, [repository, replaceConversations]);

  const remove = useCallback(async (conversationId: string): Promise<void> => {
    await repository.deleteAiConversation(conversationId);
    replaceConversations(conversationsRef.current.filter((item) => item.id !== conversationId));
    if (activeId === conversationId) {
      setActiveId(null);
      messagesRef.current = [];
      setMessages([]);
    }
  }, [activeId, repository, replaceConversations]);

  const clearAll = useCallback(async (): Promise<void> => {
    await repository.clearAiConversations();
    replaceConversations([]);
    setActiveId(null);
    messagesRef.current = [];
    setMessages([]);
  }, [repository, replaceConversations]);

  useEffect(() => {
    void refresh().catch((cause: unknown) => {
      writePersistentError('ai.chat.history.load.failed', cause);
      setLoaded(true);
    });
  }, [refresh]);

  const activeConversation = useMemo(() => conversations.find((item) => item.id === activeId) ?? null, [activeId, conversations]);
  const value = useMemo<ChatHistoryContextValue>(() => ({
    conversations,
    activeConversation,
    messages,
    loaded,
    refresh,
    open,
    start,
    append,
    update,
    rename,
    remove,
    clearAll,
  }), [activeConversation, append, clearAll, conversations, loaded, messages, open, refresh, remove, rename, start]);

  return <ChatHistoryContext.Provider value={value}>{children}</ChatHistoryContext.Provider>;
}

export function useChatHistory(): ChatHistoryContextValue {
  const value = useContext(ChatHistoryContext);
  if (!value) throw new Error('useChatHistory must be used inside ChatHistoryProvider');
  return value;
}
