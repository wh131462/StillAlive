export interface AiPriceRule {
  /** 模型名前缀匹配；空字符串匹配所有模型 */
  modelPrefix: string;
  currency: 'CNY' | 'USD';
  /** 每百万 token 的输入价格（字符串用于保留厂商展示的精度） */
  inputPerMillion: number;
  cachedInputPerMillion: number | null;
  outputPerMillion: number;
}

export interface AiPriceTable {
  version: string;
  note: string;
  rules: AiPriceRule[];
}

/**
 * 本地价格表：只用于“估算”，不参与计费判断。
 * 厂商价格会调整，因此这里默认不放任何规则——未知价格时用量页只显示 token，不显示金额，避免给出错误数字。
 * 需要估算时，把核对过的价格规则加进来并更新 version；DeepSeek 存在峰谷价与缓存命中价，建议按高峰价作为保守上界。
 */
export const AI_PRICE_TABLE: AiPriceTable = {
  version: 'unconfigured',
  note: '未配置价格表；用量页只统计 token 与请求数，不估算费用。',
  rules: [],
};

export interface AiCostEstimate {
  micros: number;
  currency: 'CNY' | 'USD';
}

export function estimateAiCost(
  table: AiPriceTable,
  input: { modelId: string; inputTokens: number | null; cachedInputTokens: number | null; outputTokens: number | null },
): AiCostEstimate | null {
  const rule = table.rules.find((item) => input.modelId.startsWith(item.modelPrefix));
  if (!rule) return null;
  const inputTokens = input.inputTokens ?? 0;
  const cachedInputTokens = input.cachedInputTokens ?? 0;
  const outputTokens = input.outputTokens ?? 0;
  if (!inputTokens && !outputTokens) return null;
  const cachedPrice = rule.cachedInputPerMillion ?? rule.inputPerMillion;
  const regularInput = Math.max(0, inputTokens - cachedInputTokens);
  const cost = (regularInput * rule.inputPerMillion + cachedInputTokens * cachedPrice + outputTokens * rule.outputPerMillion) / 1_000_000;
  if (!Number.isFinite(cost) || cost <= 0) return null;
  return { micros: Math.round(cost * 1_000_000), currency: rule.currency };
}
