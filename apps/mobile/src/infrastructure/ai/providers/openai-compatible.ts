import { AiRequestError } from '../ai-types';
import type { AiChatRequest, AiChatResult, AiModelOption, AiProbeResult, AiProviderAdapter, AiProviderProfile, AiUsage } from '../ai-types';
import { normalizeError, normalizeHttpsBaseUrl, requestAiJson } from '../ai-http';

export interface OpenAiCompatibleEndpoints {
  chat: string;
  models: string;
}

interface OpenAiChatResponse {
  choices?: Array<{ message?: { content?: unknown }; finish_reason?: unknown }>;
  usage?: {
    prompt_tokens?: unknown;
    completion_tokens?: unknown;
    prompt_tokens_details?: { cached_tokens?: unknown };
  };
}

interface OpenAiModelsResponse {
  data?: Array<{ id?: unknown; name?: unknown }>;
}

export function resolveOpenAiCompatibleEndpoints(profile: AiProviderProfile): OpenAiCompatibleEndpoints {
  const base = normalizeHttpsBaseUrl(profile.baseUrl);
  const root = base.endsWith('/v1') ? base : `${base}/v1`;
  return { chat: `${root}/chat/completions`, models: `${root}/models` };
}

export async function listOpenAiCompatibleModels(
  endpoints: OpenAiCompatibleEndpoints,
  profile: AiProviderProfile,
  key: string,
  signal?: AbortSignal,
): Promise<AiModelOption[]> {
  const payload = await requestAiJson<OpenAiModelsResponse>({
    url: endpoints.models,
    headers: { Authorization: `Bearer ${key}` },
    signal,
    timeoutMs: 15_000,
    providerLabel: profile.label,
  });
  const items = Array.isArray(payload.data) ? payload.data : [];
  return items.flatMap((item) => typeof item.id === 'string' && item.id ? [{ id: item.id, label: typeof item.name === 'string' && item.name ? item.name : item.id }] : []);
}

export async function chatWithOpenAiCompatible(
  endpoints: OpenAiCompatibleEndpoints,
  request: AiChatRequest,
): Promise<AiChatResult> {
  const { profile, key, messages, signal } = request;
  if (!profile.modelId.trim()) throw new AiRequestError('invalid_config', '还没有选择模型，请先在服务商设置里填写模型名');
  const startedAt = Date.now();
  const payload = await requestAiJson<OpenAiChatResponse>({
    url: endpoints.chat,
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: {
      model: profile.modelId.trim(),
      messages,
      stream: false,
      max_tokens: request.maxOutputTokens ?? 1024,
      ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
      ...(request.reasoningEffort === 'off' ? {} : { reasoning_effort: request.reasoningEffort }),
    },
    signal,
    providerLabel: profile.label,
  });
  const choice = Array.isArray(payload.choices) ? payload.choices[0] : undefined;
  const text = readContent(choice?.message?.content);
  if (!text.trim()) throw new AiRequestError('provider_error', '服务商没有返回可用的正文');
  return {
    text,
    usage: readOpenAiUsage(payload.usage),
    latencyMs: Date.now() - startedAt,
    finishReason: typeof choice?.finish_reason === 'string' ? choice.finish_reason : null,
  };
}

export async function probeOpenAiCompatible(
  endpoints: OpenAiCompatibleEndpoints,
  profile: AiProviderProfile,
  key: string,
  signal?: AbortSignal,
): Promise<AiProbeResult> {
  const startedAt = Date.now();
  try {
    const models = await listOpenAiCompatibleModels(endpoints, profile, key, signal);
    return {
      status: 'ok',
      latencyMs: Date.now() - startedAt,
      modelCount: models.length,
      message: models.length ? `连接正常，可用模型 ${models.length} 个` : '连接正常，但没有返回可用模型',
    };
  } catch (cause) {
    const error = normalizeError(cause);
    return {
      status: probeStatusFromError(error),
      latencyMs: Date.now() - startedAt,
      modelCount: null,
      message: error.code === 'model_missing'
        ? '该地址不支持模型列表；可以先手动填写模型名，在对话时验证是否可用'
        : error.message,
    };
  }
}

function readContent(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.flatMap((part) => (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string' ? [part.text] : [])).join('');
  }
  return '';
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readOpenAiUsage(usage: OpenAiChatResponse['usage']): AiUsage {
  return {
    inputTokens: readNumber(usage?.prompt_tokens),
    cachedInputTokens: readNumber(usage?.prompt_tokens_details?.cached_tokens),
    outputTokens: readNumber(usage?.completion_tokens),
  };
}

export function probeStatusFromError(error: AiRequestError): AiProbeResult['status'] {
  if (error.code === 'auth_failed') return 'auth_failed';
  if (error.code === 'network_failed' || error.code === 'timeout') return 'network_failed';
  if (error.code === 'model_missing') return 'model_missing';
  if (error.code === 'invalid_config' || error.code === 'unsupported') return 'unsupported';
  return 'unknown';
}

export const openAiCompatibleAdapter: AiProviderAdapter = {
  async listModels(profile, key, signal) {
    return listOpenAiCompatibleModels(resolveOpenAiCompatibleEndpoints(profile), profile, key, signal);
  },
  async chat(request) {
    return chatWithOpenAiCompatible(resolveOpenAiCompatibleEndpoints(request.profile), request);
  },
  async probe(profile, key, signal) {
    return probeOpenAiCompatible(resolveOpenAiCompatibleEndpoints(profile), profile, key, signal);
  },
  async getBalance() {
    return null;
  },
};
