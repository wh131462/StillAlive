import type { DayKey, LedgerTransactionType } from '@still-alive/types';
import { LEDGER_CATEGORIES } from '../../ledger/domain/ledger-categories';

export type AiAppAction =
  | { tool: 'ledger.create'; type: LedgerTransactionType; amountCents: number; category: string; dayKey: DayKey; note: string | null }
  | { tool: 'post.create'; body: string; dayKey: DayKey; personNames: string[]; locationName: string | null }
  | { tool: 'person.create'; name: string }
  | { tool: 'memory.remember'; content: string }
  | { tool: 'checkin.today' };

export interface AiActionProposal {
  tool: string;
  args: Record<string, unknown>;
}

export interface PreparedAiAction {
  title: string;
  /** 这个操作会写进哪里：我的信息 / 人物资料 */
  target: '我的信息' | '人物资料';
  fields: Array<{ label: string; value: string }>;
  error: string | null;
  action: AiAppAction | null;
}

const ACTION_BLOCK_PATTERN = /```(?:still-alive-action|still_alive_action)[ \t]*\r?\n?([\s\S]*?)```/giu;
const MAX_PROPOSALS = 2;

export function parseActionProposals(text: string): { visibleText: string; proposals: AiActionProposal[] } {
  const proposals: AiActionProposal[] = [];
  const visibleText = text.replace(ACTION_BLOCK_PATTERN, (_match, payload: string) => {
    if (proposals.length >= MAX_PROPOSALS) return '';
    try {
      const parsed = JSON.parse(payload.trim()) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return '';
      const record = parsed as Record<string, unknown>;
      if (typeof record.tool !== 'string') return '';
      const args = record.arguments && typeof record.arguments === 'object' && !Array.isArray(record.arguments)
        ? record.arguments as Record<string, unknown>
        : record;
      proposals.push({ tool: record.tool, args });
      return '';
    } catch {
      return '';
    }
  });
  return { visibleText: visibleText.replace(/\n{3,}/gu, '\n\n').trim(), proposals };
}

function isDayKey(value: unknown): value is DayKey {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

function asNumber(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(numeric) ? numeric : null;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** 把模型给出的操作整理成可确认、可执行的本地动作；不合法时给出可读错误。 */
export function prepareAction(proposal: AiActionProposal, options: { today: DayKey }): PreparedAiAction {
  const fail = (title: string, error: string): PreparedAiAction => ({ title, target: proposal.tool === 'person.create' ? '人物资料' : '我的信息', fields: [], error, action: null });
  const today = options.today;

  if (proposal.tool === 'ledger.create') {
    const title = '记一笔账';
    const typeValue = asString(proposal.args.type);
    if (typeValue !== 'expense' && typeValue !== 'income') return fail(title, '没有说清是支出还是收入');
    const type: LedgerTransactionType = typeValue;
    const amount = asNumber(proposal.args.amount);
    if (amount === null || amount <= 0 || amount > 999_999.99) return fail(title, '金额需要是 0.01–999999.99 之间的正数');
    const categoryValue = asString(proposal.args.category);
    const category = LEDGER_CATEGORIES[type].includes(categoryValue) ? categoryValue : '其他';
    const dayKey = isDayKey(proposal.args.dayKey) ? proposal.args.dayKey : today;
    const note = asString(proposal.args.note).slice(0, 200) || null;
    return {
      title,
      target: '我的信息',
      fields: [
        { label: '类型', value: type === 'expense' ? '支出' : '收入' },
        { label: '金额', value: `¥${amount.toFixed(2)}` },
        { label: '分类', value: category },
        { label: '日期', value: dayKey },
        ...(note ? [{ label: '备注', value: note }] : []),
      ],
      error: null,
      action: { tool: 'ledger.create', type, amountCents: Math.round(amount * 100), category, dayKey, note },
    };
  }

  if (proposal.tool === 'post.create') {
    const title = '写一条记录';
    const body = asString(proposal.args.body).slice(0, 5000);
    if (!body) return fail(title, '记录内容为空');
    const dayKey = isDayKey(proposal.args.dayKey) ? proposal.args.dayKey : today;
    const personNames = Array.isArray(proposal.args.personNames)
      ? proposal.args.personNames.map((value) => asString(value)).filter(Boolean).slice(0, 5)
      : [];
    const locationName = asString(proposal.args.locationName).slice(0, 40) || null;
    return {
      title,
      target: '我的信息',
      fields: [
        { label: '日期', value: dayKey },
        ...(personNames.length ? [{ label: '提及', value: personNames.join('、') }] : []),
        ...(locationName ? [{ label: '地点', value: locationName }] : []),
        { label: '正文', value: body.length > 60 ? `${body.slice(0, 60)}…` : body },
      ],
      error: null,
      action: { tool: 'post.create', body, dayKey, personNames, locationName },
    };
  }

  if (proposal.tool === 'person.create') {
    const title = '添加人物';
    const name = asString(proposal.args.name).slice(0, 40);
    if (!name) return fail(title, '人物名字为空');
    return { title, target: '人物资料', fields: [{ label: '名字', value: name }], error: null, action: { tool: 'person.create', name } };
  }

  if (proposal.tool === 'memory.remember') {
    const title = '记住这件事';
    const content = asString(proposal.args.content).slice(0, 200);
    if (content.length < 4) return fail(title, '内容太短');
    return { title, target: '我的信息', fields: [{ label: '内容', value: content }], error: null, action: { tool: 'memory.remember', content } };
  }

  if (proposal.tool === 'checkin.today') {
    return { title: '今天打个卡', target: '我的信息', fields: [{ label: '日期', value: options.today }], error: null, action: { tool: 'checkin.today' } };
  }

  return fail('未知操作', `暂不支持操作：${proposal.tool}`);
}
