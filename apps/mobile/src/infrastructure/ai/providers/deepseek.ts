import { AiRequestError } from '../ai-types';
import type { AiBalance, AiProviderAdapter, AiProviderProfile } from '../ai-types';
import { normalizeHttpsBaseUrl, requestAiJson } from '../ai-http';
import { chatWithOpenAiCompatible, listOpenAiCompatibleModels, probeOpenAiCompatible } from './openai-compatible';
import type { OpenAiCompatibleEndpoints } from './openai-compatible';

interface DeepSeekBalanceResponse {
  is_available?: unknown;
  balance_infos?: Array<{
    currency?: unknown;
    total_balance?: unknown;
    granted_balance?: unknown;
    topped_up_balance?: unknown;
  }>;
}

export function resolveDeepSeekEndpoints(profile: AiProviderProfile): OpenAiCompatibleEndpoints {
  const base = normalizeHttpsBaseUrl(profile.baseUrl);
  if (base.endsWith('/anthropic')) throw new AiRequestError('invalid_config', '当前填写的是 Anthropic 格式地址，请改为 https://api.deepseek.com');
  return { chat: `${base}/chat/completions`, models: `${base}/models` };
}

async function readDeepSeekBalance(profile: AiProviderProfile, key: string, signal?: AbortSignal): Promise<AiBalance | null> {
  const base = normalizeHttpsBaseUrl(profile.baseUrl);
  const origin = new URL(base).origin;
  const payload = await requestAiJson<DeepSeekBalanceResponse>({
    url: `${origin}/user/balance`,
    headers: { Authorization: `Bearer ${key}` },
    signal,
    timeoutMs: 15_000,
    providerLabel: profile.label,
  });
  const infos = Array.isArray(payload.balance_infos) ? payload.balance_infos : [];
  const info = infos.find((item) => item.currency === 'CNY' || item.currency === 'USD') ?? infos[0];
  if (!info || (info.currency !== 'CNY' && info.currency !== 'USD')) return null;
  const readText = (value: unknown): string => (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '0');
  return {
    available: payload.is_available === true,
    currency: info.currency,
    total: readText(info.total_balance),
    granted: readText(info.granted_balance),
    toppedUp: readText(info.topped_up_balance),
  };
}

export const deepSeekAdapter: AiProviderAdapter = {
  async listModels(profile, key, signal) {
    return listOpenAiCompatibleModels(resolveDeepSeekEndpoints(profile), profile, key, signal);
  },
  async chat(request) {
    return chatWithOpenAiCompatible(resolveDeepSeekEndpoints(request.profile), request);
  },
  async probe(profile, key, signal) {
    return probeOpenAiCompatible(resolveDeepSeekEndpoints(profile), profile, key, signal);
  },
  async getBalance(profile, key, signal) {
    return readDeepSeekBalance(profile, key, signal);
  },
};
