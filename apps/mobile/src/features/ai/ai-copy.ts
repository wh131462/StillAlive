import type { AiBalance, AiProviderProfile, AiUsageRecord } from '../../infrastructure/ai/ai-types';
import { isAiRequestError } from '../../infrastructure/ai/ai-types';
import { providerKindLabel } from '../../infrastructure/ai/ai-adapters';

export function aiErrorMessage(cause: unknown): string {
  if (isAiRequestError(cause)) return cause.message;
  if (cause instanceof Error && cause.message) return cause.message;
  return 'AI 请求失败，请稍后重试';
}

export function providerStatusText(profile: AiProviderProfile): { text: string; tone: 'ok' | 'warn' | 'muted' } {
  if (!profile.lastProbeAt) return { text: '尚未检测', tone: 'muted' };
  if (profile.lastProbeStatus === 'ok') {
    return { text: profile.lastProbeLatencyMs ? `已连接 · ${profile.lastProbeLatencyMs}ms` : '已连接', tone: 'ok' };
  }
  if (profile.lastProbeStatus === 'auth_failed') return { text: 'Key 未通过验证', tone: 'warn' };
  if (profile.lastProbeStatus === 'network_failed') return { text: '网络不可达', tone: 'warn' };
  if (profile.lastProbeStatus === 'unsupported') return { text: '地址不兼容', tone: 'warn' };
  return { text: profile.lastProbeMessage || '检测失败', tone: 'warn' };
}

export function providerSubtitle(profile: AiProviderProfile): string {
  return `${providerKindLabel(profile.kind)} · ${profile.modelId.trim() || '未选择模型'}${profile.keyHint ? ` · ${profile.keyHint}` : ''}`;
}

export function formatRelativeTime(iso: string | null, now = Date.now()): string {
  if (!iso) return '—';
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return '—';
  const diff = Math.max(0, now - time);
  const minute = 60_000;
  if (diff < minute) return '刚刚';
  if (diff < 60 * minute) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < 24 * 60 * minute) return `${Math.floor(diff / (60 * minute))} 小时前`;
  if (diff < 30 * 24 * 60 * minute) return `${Math.floor(diff / (24 * 60 * minute))} 天前`;
  return iso.slice(0, 10).replaceAll('-', '.');
}

export function formatTokens(value: number | null): string {
  if (value === null) return '—';
  if (value < 1_000) return String(value);
  if (value < 1_000_000) return `${(value / 1_000).toFixed(1)}k`;
  return `${(value / 1_000_000).toFixed(2)}M`;
}

export function formatBalance(balance: AiBalance): string {
  const symbol = balance.currency === 'CNY' ? '¥' : '$';
  return [
    `可用：${symbol}${balance.total}`,
    `赠送：${symbol}${balance.granted}`,
    `充值：${symbol}${balance.toppedUp}`,
    balance.available ? '状态：可用' : '状态：余额不足',
  ].join('\n');
}

export interface AiUsageSummary {
  requests: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

export function summarizeUsage(records: AiUsageRecord[]): AiUsageSummary {
  const summary: AiUsageSummary = { requests: records.length, succeeded: 0, failed: 0, cancelled: 0, inputTokens: 0, outputTokens: 0, durationMs: 0 };
  for (const record of records) {
    if (record.status === 'success') summary.succeeded += 1;
    else if (record.status === 'cancelled') summary.cancelled += 1;
    else summary.failed += 1;
    summary.inputTokens += record.inputTokens ?? 0;
    summary.outputTokens += record.outputTokens ?? 0;
    summary.durationMs += record.durationMs;
  }
  return summary;
}

export function groupUsage(records: AiUsageRecord[]): Array<{ key: string; label: string; summary: AiUsageSummary }> {
  const groups = new Map<string, AiUsageRecord[]>();
  for (const record of records) {
    const key = `${record.providerId}:${record.modelId}`;
    const list = groups.get(key) ?? [];
    list.push(record);
    groups.set(key, list);
  }
  return [...groups.entries()].map(([key, list]) => ({
    key,
    label: list[0]?.modelId?.trim() || '未命名模型',
    summary: summarizeUsage(list),
  }));
}
