import { AiRequestError } from '../ai-types';
import type { AiChatRequest, AiChatResult, AiModelOption, AiProbeResult, AiProviderAdapter, AiProviderProfile, AiUsage } from '../ai-types';
import { normalizeError, normalizeHttpsBaseUrl, requestAiJson } from '../ai-http';
import { probeStatusFromError } from './openai-compatible';

const ANTHROPIC_VERSION = '2023-06-01';

interface AnthropicMessagesResponse {
  content?: Array<{ type?: unknown; text?: unknown }>;
  stop_reason?: unknown;
  usage?: { input_tokens?: unknown; output_tokens?: unknown; cache_read_input_tokens?: unknown };
}

interface AnthropicModelsResponse {
  data?: Array<{ id?: unknown; display_name?: unknown }>;
}

function resolveAnthropicBase(profile: AiProviderProfile): string {
  const base = normalizeHttpsBaseUrl(profile.baseUrl);
  return base.endsWith('/v1') ? base : `${base}/v1`;
}

function anthropicHeaders(key: string): Record<string, string> {
  return { 'x-api-key': key, 'anthropic-version': ANTHROPIC_VERSION };
}

async function listAnthropicModels(profile: AiProviderProfile, key: string, signal?: AbortSignal): Promise<AiModelOption[]> {
  const payload = await requestAiJson<AnthropicModelsResponse>({
    url: `${resolveAnthropicBase(profile)}/models`,
    headers: anthropicHeaders(key),
    signal,
    timeoutMs: 15_000,
    providerLabel: profile.label,
  });
  const items = Array.isArray(payload.data) ? payload.data : [];
  return items.flatMap((item) => typeof item.id === 'string' && item.id ? [{ id: item.id, label: typeof item.display_name === 'string' && item.display_name ? item.display_name : item.id }] : []);
}

export const anthropicAdapter: AiProviderAdapter = {
  async listModels(profile, key, signal) {
    return listAnthropicModels(profile, key, signal);
  },

  async chat(request: AiChatRequest): Promise<AiChatResult> {
    const { profile, key, messages, signal } = request;
    if (!profile.modelId.trim()) throw new AiRequestError('invalid_config', '还没有选择模型，请先在服务商设置里填写模型名');
    const system = messages.filter((item) => item.role === 'system').map((item) => item.content).join('\n\n');
    const conversation = messages.filter((item) => item.role !== 'system').map((item) => ({ role: item.role, content: item.content }));
    if (!conversation.length) throw new AiRequestError('invalid_config', '没有可发送的消息');
    const startedAt = Date.now();
    const payload = await requestAiJson<AnthropicMessagesResponse>({
      url: `${resolveAnthropicBase(profile)}/messages`,
      method: 'POST',
      headers: anthropicHeaders(key),
      body: {
        model: profile.modelId.trim(),
        max_tokens: request.maxOutputTokens ?? 1024,
        ...(system ? { system } : {}),
        ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
        messages: conversation,
      },
      signal,
      providerLabel: profile.label,
    });
    const text = (Array.isArray(payload.content) ? payload.content : [])
      .flatMap((part) => (part.type === 'text' && typeof part.text === 'string' ? [part.text] : []))
      .join('');
    if (!text.trim()) throw new AiRequestError('provider_error', '服务商没有返回可用的正文');
    return {
      text,
      usage: readAnthropicUsage(payload.usage),
      latencyMs: Date.now() - startedAt,
      finishReason: typeof payload.stop_reason === 'string' ? payload.stop_reason : null,
    };
  },

  async probe(profile: AiProviderProfile, key: string, signal?: AbortSignal): Promise<AiProbeResult> {
    const startedAt = Date.now();
    try {
      const models = await listAnthropicModels(profile, key, signal);
      return {
        status: 'ok',
        latencyMs: Date.now() - startedAt,
        modelCount: models.length,
        message: models.length ? `连接正常，可用模型 ${models.length} 个` : '连接正常，但模型列表为空',
      };
    } catch (cause) {
      const error = normalizeError(cause);
      return { status: probeStatusFromError(error), latencyMs: Date.now() - startedAt, modelCount: null, message: error.message };
    }
  },

  async getBalance() {
    return null;
  },
};

function readAnthropicUsage(usage: AnthropicMessagesResponse['usage']): AiUsage {
  const read = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
  return {
    inputTokens: read(usage?.input_tokens),
    cachedInputTokens: read(usage?.cache_read_input_tokens),
    outputTokens: read(usage?.output_tokens),
  };
}
