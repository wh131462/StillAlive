export type AiProviderKind = 'openai-compatible' | 'anthropic' | 'deepseek';

export type AiProviderProbeStatus = 'ok' | 'auth_failed' | 'network_failed' | 'model_missing' | 'unsupported' | 'unknown';

export type AiErrorCode =
  | 'auth_failed'
  | 'insufficient_balance'
  | 'model_missing'
  | 'rate_limited'
  | 'provider_error'
  | 'timeout'
  | 'cancelled'
  | 'network_failed'
  | 'invalid_config'
  | 'unsupported'
  | 'unknown';

export interface AiProviderProfile {
  id: string;
  label: string;
  kind: AiProviderKind;
  baseUrl: string;
  modelId: string;
  keyHint: string;
  supportsStream: boolean;
  supportsBalance: boolean;
  enabled: boolean;
  isDefault: boolean;
  lastProbeAt: string | null;
  lastProbeStatus: AiProviderProbeStatus | null;
  lastProbeLatencyMs: number | null;
  lastProbeMessage: string | null;
  modelsJson: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiModelOption {
  id: string;
  label: string;
}

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiUsage {
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
}

export interface AiChatResult {
  text: string;
  usage: AiUsage;
  latencyMs: number;
  finishReason: string | null;
}

export interface AiBalance {
  available: boolean;
  currency: 'CNY' | 'USD';
  total: string;
  granted: string;
  toppedUp: string;
}

export interface AiProbeResult {
  status: AiProviderProbeStatus;
  latencyMs: number | null;
  modelCount: number | null;
  message: string;
}

export interface AiChatRequest {
  profile: AiProviderProfile;
  key: string;
  messages: AiMessage[];
  maxOutputTokens?: number | undefined;
  temperature?: number | undefined;
  signal?: AbortSignal | undefined;
}

export interface AiProviderAdapter {
  listModels(profile: AiProviderProfile, key: string, signal?: AbortSignal): Promise<AiModelOption[]>;
  chat(request: AiChatRequest): Promise<AiChatResult>;
  probe(profile: AiProviderProfile, key: string, signal?: AbortSignal): Promise<AiProbeResult>;
  getBalance(profile: AiProviderProfile, key: string, signal?: AbortSignal): Promise<AiBalance | null>;
}

export const AI_USAGE_TASK_IDS = [
  'connection.probe',
  'chat',
  'chat.answer',
  'editor.polish',
  'editor.continue',
  'editor.title',
  'editor.organize',
  'editor.generate',
  'person.impression',
  'ledger.parse',
  'excerpt.explain',
  'memory.extract',
  'aggregate.summarize',
  'unknown',
] as const;

export type AiUsageTaskId = (typeof AI_USAGE_TASK_IDS)[number];

export type AiUsageStatus = 'success' | 'failed' | 'cancelled';

export interface AiUsageRecord {
  id: string;
  providerId: string;
  providerKind: AiProviderKind;
  modelId: string;
  taskId: AiUsageTaskId;
  status: AiUsageStatus;
  errorCode: AiErrorCode | null;
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  durationMs: number;
  estimatedCostMicros: number | null;
  currency: 'CNY' | 'USD' | null;
  createdAt: string;
}

export interface AiConversationSource {
  citationId: string;
  title: string;
  route: string;
  dayKey: string | null;
  personNames: string[];
}

export interface AiChatMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  text: string;
  /** 回答对应的问句；用户消息里与 text 相同，失败重试时复用它 */
  question: string;
  failed: boolean;
  memoryCount: number;
  sources: AiConversationSource[];
  createdAt: string;
}

export interface AiConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export class AiRequestError extends Error {
  readonly code: AiErrorCode;
  readonly status: number | null;

  constructor(code: AiErrorCode, message: string, status: number | null = null) {
    super(message);
    this.name = 'AiRequestError';
    this.code = code;
    this.status = status;
  }
}

export function isAiRequestError(cause: unknown): cause is AiRequestError {
  return cause instanceof AiRequestError;
}
