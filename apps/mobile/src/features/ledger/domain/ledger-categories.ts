import type { LedgerTransactionType } from '@still-alive/types';

export const LEDGER_CATEGORIES: Record<LedgerTransactionType, string[]> = {
  expense: ['餐饮', '交通', '购物', '居住', '娱乐', '医疗', '教育', '其他'],
  income: ['工资', '奖金', '兼职', '理财', '红包', '退款', '报销', '其他'],
};
