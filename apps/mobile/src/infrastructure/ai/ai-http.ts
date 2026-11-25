import { fetch as expoFetch } from 'expo/fetch';
import { AiRequestError } from './ai-types';

const DEFAULT_TIMEOUT_MS = 45_000;

export interface AiHttpRequest {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal | undefined;
  timeoutMs?: number;
  providerLabel: string;
}

/** 只接受 https 地址；拒绝带账号密码、query 或 hash 的地址，避免把 Key 发到意外位置。 */
export function normalizeHttpsBaseUrl(value: string, label = '服务地址'): string {
  const trimmed = value.trim();
  if (!trimmed) throw new AiRequestError('invalid_config', `${label}不能为空`);
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new AiRequestError('invalid_config', `${label}格式不正确，需要完整的 https 地址`);
  }
  if (url.protocol !== 'https:') throw new AiRequestError('invalid_config', `${label}必须以 https:// 开头`);
  if (url.username || url.password) throw new AiRequestError('invalid_config', `${label}不能包含账号或密码`);
  if (url.search || url.hash) throw new AiRequestError('invalid_config', `${label}不能包含查询参数或锚点`);
  if (!url.hostname) throw new AiRequestError('invalid_config', `${label}缺少域名`);
  const path = url.pathname.replace(/\/+$/u, '');
  return `${url.origin}${path}`;
}

export async function requestAiJson<T>(request: AiHttpRequest): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, request.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const externalSignal = request.signal;
  const abortFromExternal = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', abortFromExternal);
  }

  try {
    const headers: Record<string, string> = { Accept: 'application/json', ...request.headers };
    if (request.body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await expoFetch(request.url, {
      method: request.method ?? 'GET',
      headers,
      redirect: 'manual',
      signal: controller.signal,
      ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
    });
    if (response.status >= 300 && response.status < 400) {
      throw new AiRequestError('invalid_config', '服务地址发生了重定向，请填写最终地址（不要填跳转链接）', response.status);
    }
    if (!response.ok) throw mapHttpError(response.status, request.providerLabel);
    const text = await response.text();
    if (!text.trim()) throw new AiRequestError('provider_error', '服务商返回了空响应', response.status);
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new AiRequestError('provider_error', '服务商返回的内容不是有效 JSON', response.status);
    }
  } catch (cause) {
    if (cause instanceof AiRequestError) throw cause;
    if (externalSignal?.aborted) throw new AiRequestError('cancelled', '请求已取消');
    if (timedOut) throw new AiRequestError('timeout', '请求超时，请检查网络后重试');
    if (cause instanceof Error && cause.name === 'AbortError') throw new AiRequestError('cancelled', '请求已取消');
    throw new AiRequestError('network_failed', '网络不可用，AI 功能暂时无法使用');
  } finally {
    clearTimeout(timer);
    if (externalSignal) externalSignal.removeEventListener('abort', abortFromExternal);
  }
}

export function mapHttpError(status: number, providerLabel: string): AiRequestError {
  if (status === 401 || status === 403) return new AiRequestError('auth_failed', `${providerLabel}的 API Key 未通过验证`, status);
  if (status === 402) return new AiRequestError('insufficient_balance', `${providerLabel}账户余额不足，请充值后重试`, status);
  if (status === 404) return new AiRequestError('model_missing', `${providerLabel}找不到该模型或接口`, status);
  if (status === 429) return new AiRequestError('rate_limited', `${providerLabel}请求过于频繁，请稍后再试`, status);
  if (status >= 500) return new AiRequestError('provider_error', `${providerLabel}暂时不可用，请稍后重试`, status);
  return new AiRequestError('provider_error', `${providerLabel}返回了错误（HTTP ${status}）`, status);
}

export function normalizeError(cause: unknown): AiRequestError {
  if (cause instanceof AiRequestError) return cause;
  if (cause instanceof Error && cause.name === 'AbortError') return new AiRequestError('cancelled', '请求已取消');
  return new AiRequestError('unknown', cause instanceof Error && cause.message ? cause.message : 'AI 请求失败');
}
