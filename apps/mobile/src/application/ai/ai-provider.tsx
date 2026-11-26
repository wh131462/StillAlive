import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { SQLiteStillAliveRepository } from '../../infrastructure/database/sqlite-repository';
import { AI_PROVIDER_KIND_META, adapterForProvider } from '../../infrastructure/ai/ai-adapters';
import type {
  AiBalance,
  AiChatResult,
  AiErrorCode,
  AiModelOption,
  AiProbeResult,
  AiProviderKind,
  AiProviderProfile,
  AiReasoningEffort,
  AiUsageRecord,
  AiUsageTaskId,
} from '../../infrastructure/ai/ai-types';
import { AiRequestError } from '../../infrastructure/ai/ai-types';
import { createAiProviderId, deleteAiKey, readAiKey, saveAiKey } from '../../infrastructure/ai/ai-key-store';
import { normalizeHttpsBaseUrl } from '../../infrastructure/ai/ai-http';
import { AI_PRICE_TABLE, estimateAiCost } from '../../infrastructure/ai/ai-price-table';
import { writePersistentError } from '../../infrastructure/platform/persistent-log';

export interface AiProviderInput {
  kind: AiProviderKind;
  label?: string;
  baseUrl: string;
  modelId: string;
  /** 供应商默认推理强度；缺省保持现状。 */
  reasoningEffort?: AiReasoningEffort;
  /** 新建必填；编辑时留空表示不修改 Key */
  apiKey?: string;
}

export interface AiChatOptions {
  providerId?: string;
  taskId?: AiUsageTaskId;
  maxOutputTokens?: number;
  temperature?: number;
  /** 只覆盖本次请求；缺省用服务商配置。 */
  reasoningEffort?: AiReasoningEffort;
  signal?: AbortSignal;
}

export interface AiContextValue {
  enabled: boolean;
  providers: AiProviderProfile[];
  usage: AiUsageRecord[];
  loading: boolean;
  configLoaded: boolean;
  defaultProvider: AiProviderProfile | null;
  refresh(): Promise<void>;
  setEnabled(enabled: boolean): Promise<void>;
  createProvider(input: AiProviderInput): Promise<AiProviderProfile>;
  updateProvider(providerId: string, input: AiProviderInput): Promise<void>;
  deleteProvider(providerId: string): Promise<void>;
  setDefaultProvider(providerId: string): Promise<void>;
  detectProvider(providerId: string): Promise<AiProbeResult>;
  getBalance(providerId: string): Promise<AiBalance | null>;
  listModels(providerId: string): Promise<AiModelOption[]>;
  chat(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>, options?: AiChatOptions): Promise<AiChatResult>;
  refreshUsage(): Promise<void>;
}

const AiContext = createContext<AiContextValue | null>(null);

export function AiProvider({ children }: PropsWithChildren) {
  const database = useSQLiteContext();
  const repository = useMemo(() => new SQLiteStillAliveRepository(database), [database]);
  const [enabled, setEnabledState] = useState(false);
  const [providers, setProviders] = useState<AiProviderProfile[]>([]);
  const [usage, setUsage] = useState<AiUsageRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);

  const refreshUsage = useCallback(async () => {
    const records = await repository.listAiUsageRecords();
    setUsage(records);
  }, [repository]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [nextProviders, nextEnabled, records] = await Promise.all([
        repository.listAiProviders(),
        repository.getAiEnabled(),
        repository.listAiUsageRecords(),
      ]);
      setProviders(nextProviders);
      setEnabledState(nextEnabled);
      setUsage(records);
    } finally {
      setLoading(false);
      setConfigLoaded(true);
    }
  }, [repository]);

  useEffect(() => {
    void refresh().catch((cause: unknown) => {
      writePersistentError('ai.config.load.failed', cause);
      setLoading(false);
    });
  }, [refresh]);

  const setEnabled = useCallback(async (next: boolean) => {
    await repository.setAiEnabled(next);
    setEnabledState(next);
  }, [repository]);

  const createProvider = useCallback(async (input: AiProviderInput): Promise<AiProviderProfile> => {
    const meta = AI_PROVIDER_KIND_META[input.kind];
    const baseUrl = normalizeHttpsBaseUrl(input.baseUrl, '服务地址');
    const apiKey = (input.apiKey ?? '').trim();
    if (!apiKey) throw new AiRequestError('invalid_config', '请填写 API Key');
    const now = new Date().toISOString();
    const id = createAiProviderId();
    const isFirst = (await repository.listAiProviders()).length === 0;
    const keyHint = await saveAiKey(id, apiKey);
    const profile: AiProviderProfile = {
      id,
      label: input.label?.trim() || meta.label,
      kind: input.kind,
      baseUrl,
      modelId: input.modelId.trim(),
      reasoningEffort: input.reasoningEffort ?? 'off',
      keyHint,
      supportsStream: true,
      supportsBalance: meta.supportsBalance,
      enabled: true,
      isDefault: isFirst,
      lastProbeAt: null,
      lastProbeStatus: null,
      lastProbeLatencyMs: null,
      lastProbeMessage: null,
      modelsJson: null,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await repository.saveAiProvider(profile);
    } catch (cause) {
      await deleteAiKey(id).catch(() => undefined);
      throw cause;
    }
    await refresh();
    return profile;
  }, [refresh, repository]);

  const updateProvider = useCallback(async (providerId: string, input: AiProviderInput): Promise<void> => {
    const existing = (await repository.listAiProviders()).find((item) => item.id === providerId);
    if (!existing) throw new AiRequestError('invalid_config', '找不到这个服务商');
    const meta = AI_PROVIDER_KIND_META[input.kind];
    const baseUrl = normalizeHttpsBaseUrl(input.baseUrl, '服务地址');
    const apiKey = (input.apiKey ?? '').trim();
    const keyHint = apiKey ? await saveAiKey(providerId, apiKey) : existing.keyHint;
    await repository.saveAiProvider({
      ...existing,
      label: input.label?.trim() || meta.label,
      kind: input.kind,
      baseUrl,
      modelId: input.modelId.trim(),
      reasoningEffort: input.reasoningEffort ?? existing.reasoningEffort,
      keyHint,
      supportsBalance: meta.supportsBalance,
      updatedAt: new Date().toISOString(),
    });
    await refresh();
  }, [refresh, repository]);

  const deleteProvider = useCallback(async (providerId: string): Promise<void> => {
    await repository.deleteAiProvider(providerId);
    await deleteAiKey(providerId).catch((cause: unknown) => writePersistentError('ai.key.delete.failed', cause));
    await refresh();
  }, [refresh, repository]);

  const setDefaultProvider = useCallback(async (providerId: string): Promise<void> => {
    await repository.setDefaultAiProvider(providerId);
    await refresh();
  }, [refresh, repository]);

  const requireProvider = useCallback(async (providerId?: string): Promise<{ profile: AiProviderProfile; key: string }> => {
    if (!enabled) throw new AiRequestError('unsupported', 'AI 功能还没有启用');
    const list = await repository.listAiProviders();
    const profile = providerId ? list.find((item) => item.id === providerId) : list.find((item) => item.isDefault) ?? list.find((item) => item.enabled);
    if (!profile) throw new AiRequestError('invalid_config', '还没有配置 AI 服务商，请先在设置里添加');
    if (!profile.enabled) throw new AiRequestError('invalid_config', '这个服务商已停用');
    const key = await readAiKey(profile.id);
    if (!key) throw new AiRequestError('auth_failed', '这个服务商没有保存 API Key，请重新填写');
    return { profile, key };
  }, [enabled, repository]);

  const detectProvider = useCallback(async (providerId: string): Promise<AiProbeResult> => {
    const existing = (await repository.listAiProviders()).find((item) => item.id === providerId);
    if (!existing) throw new AiRequestError('invalid_config', '找不到这个服务商');
    const key = await readAiKey(providerId);
    if (!key) throw new AiRequestError('auth_failed', '这个服务商没有保存 API Key，请重新填写');
    const startedAt = Date.now();
    const result = await adapterForProvider(existing).probe(existing, key);
    const now = new Date().toISOString();
    await repository.saveAiProvider({
      ...existing,
      lastProbeAt: now,
      lastProbeStatus: result.status,
      lastProbeLatencyMs: result.latencyMs,
      lastProbeMessage: result.message,
      updatedAt: now,
    });
    await repository.createAiUsageRecord({
      id: `ai_usage_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      providerId: existing.id,
      providerKind: existing.kind,
      modelId: existing.modelId,
      taskId: 'connection.probe',
      status: result.status === 'ok' ? 'success' : 'failed',
      errorCode: result.status === 'ok' ? null : probeErrorCode(result.status),
      inputTokens: null,
      cachedInputTokens: null,
      outputTokens: null,
      durationMs: Date.now() - startedAt,
      estimatedCostMicros: null,
      currency: null,
      createdAt: now,
    });
    await refresh();
    return result;
  }, [refresh, repository]);

  const getBalance = useCallback(async (providerId: string): Promise<AiBalance | null> => {
    const profile = (await repository.listAiProviders()).find((item) => item.id === providerId);
    if (!profile) throw new AiRequestError('invalid_config', '找不到这个服务商');
    if (!profile.supportsBalance) return null;
    const key = await readAiKey(providerId);
    if (!key) throw new AiRequestError('auth_failed', '这个服务商没有保存 API Key，请重新填写');
    return adapterForProvider(profile).getBalance(profile, key);
  }, [repository]);

  const listModels = useCallback(async (providerId: string): Promise<AiModelOption[]> => {
    const profile = (await repository.listAiProviders()).find((item) => item.id === providerId);
    if (!profile) throw new AiRequestError('invalid_config', '找不到这个服务商');
    const key = await readAiKey(providerId);
    if (!key) throw new AiRequestError('auth_failed', '这个服务商没有保存 API Key，请重新填写');
    return adapterForProvider(profile).listModels(profile, key);
  }, [repository]);

  const chat = useCallback(async (messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>, options?: AiChatOptions): Promise<AiChatResult> => {
    const { profile, key } = await requireProvider(options?.providerId);
    const startedAt = Date.now();
    const baseUsage = {
      id: `ai_usage_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      providerId: profile.id,
      providerKind: profile.kind,
      modelId: profile.modelId,
      taskId: (options?.taskId ?? 'chat') as AiUsageTaskId,
      inputTokens: null,
      cachedInputTokens: null,
      outputTokens: null,
      estimatedCostMicros: null,
      currency: null,
      createdAt: new Date().toISOString(),
    };
    try {
      const result = await adapterForProvider(profile).chat({
        profile,
        key,
        messages,
        maxOutputTokens: options?.maxOutputTokens,
        temperature: options?.temperature,
        reasoningEffort: options?.reasoningEffort ?? profile.reasoningEffort,
        signal: options?.signal,
      });
      const estimate = estimateAiCost(AI_PRICE_TABLE, { modelId: profile.modelId, inputTokens: result.usage.inputTokens, cachedInputTokens: result.usage.cachedInputTokens, outputTokens: result.usage.outputTokens });
      const successRecord: AiUsageRecord = {
        ...baseUsage,
        status: 'success',
        errorCode: null,
        inputTokens: result.usage.inputTokens,
        cachedInputTokens: result.usage.cachedInputTokens,
        outputTokens: result.usage.outputTokens,
        durationMs: result.latencyMs,
        estimatedCostMicros: estimate?.micros ?? null,
        currency: estimate?.currency ?? null,
      };
      await repository.createAiUsageRecord(successRecord).catch((cause: unknown) => writePersistentError('ai.usage.record.failed', cause));
      setUsage((current) => [successRecord, ...current].slice(0, 2000));
      return result;
    } catch (cause) {
      const error = cause instanceof AiRequestError ? cause : new AiRequestError('unknown', cause instanceof Error ? cause.message : 'AI 请求失败');
      const cancelled = error.code === 'cancelled';
      const failedRecord: AiUsageRecord = {
        ...baseUsage,
        status: cancelled ? 'cancelled' : 'failed',
        errorCode: error.code,
        durationMs: Date.now() - startedAt,
      };
      await repository.createAiUsageRecord(failedRecord).catch((usageCause: unknown) => writePersistentError('ai.usage.record.failed', usageCause));
      setUsage((current) => [failedRecord, ...current].slice(0, 2000));
      throw error;
    }
  }, [repository, requireProvider]);

  const defaultProvider = useMemo(() => providers.find((item) => item.isDefault) ?? providers[0] ?? null, [providers]);
  const value = useMemo<AiContextValue>(() => ({
    enabled,
    providers,
    usage,
    loading,
    configLoaded,
    defaultProvider,
    refresh,
    setEnabled,
    createProvider,
    updateProvider,
    deleteProvider,
    setDefaultProvider,
    detectProvider,
    getBalance,
    listModels,
    chat,
    refreshUsage,
  }), [chat, configLoaded, createProvider, defaultProvider, deleteProvider, detectProvider, enabled, getBalance, listModels, loading, providers, refresh, refreshUsage, setDefaultProvider, setEnabled, updateProvider, usage]);

  return <AiContext.Provider value={value}>{children}</AiContext.Provider>;
}

function probeErrorCode(status: AiProbeResult['status']): AiErrorCode {
  if (status === 'auth_failed') return 'auth_failed';
  if (status === 'network_failed') return 'network_failed';
  if (status === 'model_missing') return 'model_missing';
  if (status === 'unsupported') return 'unsupported';
  return 'unknown';
}

export function useAi(): AiContextValue {
  const value = useContext(AiContext);
  if (!value) throw new Error('useAi must be used inside AiProvider');
  return value;
}

