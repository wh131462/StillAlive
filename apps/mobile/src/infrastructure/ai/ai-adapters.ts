import type { AiProviderAdapter, AiProviderKind, AiProviderProfile } from './ai-types';
import { openAiCompatibleAdapter } from './providers/openai-compatible';
import { anthropicAdapter } from './providers/anthropic';
import { deepSeekAdapter } from './providers/deepseek';

export interface AiProviderKindMeta {
  kind: AiProviderKind;
  label: string;
  hint: string;
  defaultBaseUrl: string;
  supportsBalance: boolean;
  baseUrlPlaceholder: string;
}

export const AI_PROVIDER_KIND_META: Record<AiProviderKind, AiProviderKindMeta> = {
  deepseek: {
    kind: 'deepseek',
    label: 'DeepSeek',
    hint: 'OpenAI 兼容格式，支持查询余额。',
    defaultBaseUrl: 'https://api.deepseek.com',
    supportsBalance: true,
    baseUrlPlaceholder: 'https://api.deepseek.com',
  },
  'openai-compatible': {
    kind: 'openai-compatible',
    label: 'OpenAI 兼容',
    hint: 'OpenAI、OneAPI、LiteLLM 等 /v1 兼容服务。',
    defaultBaseUrl: 'https://api.openai.com/v1',
    supportsBalance: false,
    baseUrlPlaceholder: 'https://api.openai.com/v1',
  },
  anthropic: {
    kind: 'anthropic',
    label: 'Anthropic',
    hint: 'Claude Messages API；标准 Key 不提供余额查询。',
    defaultBaseUrl: 'https://api.anthropic.com',
    supportsBalance: false,
    baseUrlPlaceholder: 'https://api.anthropic.com',
  },
};

export const AI_PROVIDER_KINDS: AiProviderKind[] = ['deepseek', 'openai-compatible', 'anthropic'];

export function adapterForProvider(profile: AiProviderProfile): AiProviderAdapter {
  if (profile.kind === 'anthropic') return anthropicAdapter;
  if (profile.kind === 'deepseek') return deepSeekAdapter;
  return openAiCompatibleAdapter;
}

export function providerKindLabel(kind: AiProviderKind): string {
  return AI_PROVIDER_KIND_META[kind].label;
}
