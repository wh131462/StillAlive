import { useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import type { DayKey, LedgerTransaction, LedgerTransactionType } from '@still-alive/types';
import { useAppState } from '../../application/state/app-state';
import { feedback } from '../../shared/feedback';
import { DraggableBottomSheet } from '../../shared/components/draggable-bottom-sheet';
import { ToolPageHeader, ToolPageHeaderTextAction } from '../../shared/components/tool-page-header';
import { createThemedStyles } from '../../shared/theme/app-theme';
import { DatePickerField } from '../people/date-time-picker';
import type { DateParts } from '../people/date-time-picker';

const CATEGORIES: Record<LedgerTransactionType, string[]> = {
  expense: ['餐饮', '交通', '购物', '居住', '娱乐', '医疗', '教育', '其他'],
  income: ['工资', '奖金', '兼职', '理财', '红包', '退款', '报销', '其他'],
};
const AMOUNT_KEYPAD_ROWS = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['0', '.']] as const;
const KEYPAD_HEIGHT = 200;
const KEYPAD_ROW_GAP = spacing.xs;
const KEYPAD_ROW_HEIGHT = (KEYPAD_HEIGHT - KEYPAD_ROW_GAP * (AMOUNT_KEYPAD_ROWS.length - 1)) / AMOUNT_KEYPAD_ROWS.length;
type Filter = 'all' | LedgerTransactionType;

export default function LedgerScreen() {
  const router = useRouter();
  const { createLedgerTransaction, deleteLedgerTransaction, ledgerTransactions, today, updateLedgerTransaction } = useAppState();
  const [activeMonth, setActiveMonth] = useState(today.slice(0, 7));
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<LedgerTransaction | null>(null);
  const [actionTransaction, setActionTransaction] = useState<LedgerTransaction | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const monthTransactions = useMemo(() => ledgerTransactions.filter((item) => item.dayKey.startsWith(activeMonth)), [activeMonth, ledgerTransactions]);
  const visibleTransactions = useMemo(() => monthTransactions.filter((item) => filter === 'all' || item.type === filter), [filter, monthTransactions]);
  const summary = useMemo(() => ({
    expense: monthTransactions.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amountCents, 0),
    income: monthTransactions.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amountCents, 0),
  }), [monthTransactions]);
  const categoryTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const item of monthTransactions) if (item.type === 'expense') totals.set(item.category, (totals.get(item.category) ?? 0) + item.amountCents);
    const items = [...totals.entries()].sort(([, left], [, right]) => right - left);
    return { items, max: items[0]?.[1] ?? 0 };
  }, [monthTransactions]);
  const groups = useMemo(() => {
    const grouped = new Map<DayKey, LedgerTransaction[]>();
    for (const item of visibleTransactions) grouped.set(item.dayKey, [...(grouped.get(item.dayKey) ?? []), item]);
    return [...grouped.entries()].sort(([left], [right]) => right.localeCompare(left));
  }, [visibleTransactions]);

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (transaction: LedgerTransaction) => { setEditing(transaction); setFormOpen(true); };
  const closeForm = () => { Keyboard.dismiss(); setFormOpen(false); };
  const editActionTransaction = () => {
    const transaction = actionTransaction;
    setActionTransaction(null);
    if (transaction) openEdit(transaction);
  };
  const deleteActionTransaction = () => {
    const transaction = actionTransaction;
    setActionTransaction(null);
    if (!transaction) return;
    feedback.alert('删除这笔账单？', '删除后无法恢复。', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => void deleteLedgerTransaction(transaction.id).catch((cause) => feedback.alert('删除失败', cause instanceof Error ? cause.message : '请稍后重试。')) },
    ]);
  };
  const moveMonth = (offset: number) => setActiveMonth(shiftMonth(activeMonth, offset));

  return <SafeAreaView edges={['top']} style={styles.safeArea}>
    <ToolPageHeader onBack={() => router.back()} right={<ToolPageHeaderTextAction accessibilityLabel="查看账本汇总" label="汇总" onPress={() => router.push('/ledger-summary')} />} title="账本" />
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}><Text style={styles.summaryEyebrow}>LEDGER / {activeMonth}</Text><Text style={styles.summaryTitle}>{formatMoney(summary.expense)}</Text><Text style={styles.summaryLabel}>本月支出</Text></View>
        <View style={styles.summaryStats}><SummaryStat label="收入" value={summary.income} /><View style={styles.summaryDivider} /><SummaryStat label="结余" value={summary.income - summary.expense} /></View>
      </View>

      <View style={styles.monthRow}><Pressable accessibilityLabel="上个月" accessibilityRole="button" onPress={() => moveMonth(-1)} style={styles.monthButton}><Text style={styles.monthButtonText}>‹</Text></Pressable><Text style={styles.monthTitle}>{formatMonth(activeMonth)}</Text><Pressable accessibilityLabel="下个月" accessibilityRole="button" onPress={() => moveMonth(1)} style={styles.monthButton}><Text style={styles.monthButtonText}>›</Text></Pressable></View>
      <View style={styles.filters}>{(['all', 'expense', 'income'] as const).map((item) => <Pressable accessibilityRole="button" accessibilityState={{ selected: filter === item }} key={item} onPress={() => setFilter(item)} style={[styles.filter, filter === item && styles.filterActive]}><Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item === 'all' ? '全部' : item === 'expense' ? '支出' : '收入'}</Text></Pressable>)}</View>

      {categoryTotals.items.length ? <View style={styles.categorySummary}><Text style={styles.categorySummaryTitle}>本月支出构成</Text>{categoryTotals.items.slice(0, 6).map(([name, value]) => <View key={name} style={styles.categorySummaryRow}><View style={styles.categorySummaryMeta}><Text style={styles.categorySummaryName}>{name}</Text><Text style={styles.categorySummaryValue}>{formatMoney(value)}</Text></View><View style={styles.categoryBar}><View style={[styles.categoryBarFill, { width: `${Math.max(8, (value / categoryTotals.max) * 100)}%` }]} /></View></View>)}</View> : null}

      {groups.length ? groups.map(([dayKey, items]) => <View key={dayKey} style={styles.dayGroup}><Text style={styles.dayTitle}>{formatDay(dayKey)}</Text>{items.map((item) => <TransactionRow key={item.id} item={item} onMore={() => setActionTransaction(item)} onPress={() => openEdit(item)} />)}</View>) : <View style={styles.empty}><Text style={styles.emptyTitle}>{monthTransactions.length ? '没有符合条件的账单' : '开始记账吧~'}</Text>{monthTransactions.length ? <Text style={styles.emptyText}>换一个筛选条件试试。</Text> : null}</View>}
    </ScrollView>
    <Pressable accessibilityLabel="记一笔" accessibilityRole="button" onPress={openCreate} style={({ pressed }) => [styles.floatingAdd, pressed && styles.pressed]}><Text style={styles.floatingAddText}>＋ 记一笔</Text></Pressable>
    <DraggableBottomSheet accessibilityLabel="账单操作，向下拖动关闭" accessibilityRole="menu" onClose={() => setActionTransaction(null)} open={Boolean(actionTransaction)} sheetStyle={styles.actionSheet}>
      <View style={styles.actionHeader}><Text style={styles.actionLabel}>账本</Text><Text numberOfLines={1} style={styles.actionTitle}>{actionTransaction?.category ?? '账单操作'}</Text><Text style={styles.actionMeta}>{actionTransaction ? `${actionTransaction.type === 'expense' ? '支出' : '收入'} ${formatMoney(actionTransaction.amountCents)}` : ''}</Text></View>
      <LedgerActionOption icon={{ android: 'edit', ios: 'pencil', web: 'edit' }} label="编辑" onPress={editActionTransaction} />
      <LedgerActionOption destructive icon={{ android: 'delete_outline', ios: 'trash', web: 'delete_outline' }} label="删除" onPress={deleteActionTransaction} />
      <Pressable accessibilityRole="button" onPress={() => setActionTransaction(null)} style={({ pressed }) => [styles.actionCancel, pressed && styles.pressed]}><Text style={styles.actionCancelText}>取消</Text></Pressable>
    </DraggableBottomSheet>
    <TransactionSheet editing={editing} open={formOpen} onClose={closeForm} onCreate={createLedgerTransaction} onUpdate={updateLedgerTransaction} today={today} />
  </SafeAreaView>;
}

function SummaryStat({ label, value }: { label: string; value: number }) { return <View style={styles.summaryStat}><Text style={styles.summaryStatValue}>{formatMoney(value)}</Text><Text style={styles.summaryStatLabel}>{label}</Text></View>; }

function TransactionRow({ item, onMore, onPress }: { item: LedgerTransaction; onMore(): void; onPress(): void }) {
  return <View style={styles.transactionRow}><Pressable accessibilityLabel={`${item.type === 'expense' ? '支出' : '收入'} ${formatMoney(item.amountCents)}，${item.category}`} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.transactionMain, pressed && styles.pressed]}><View style={[styles.categoryDot, item.type === 'income' && styles.categoryDotIncome]}><Text style={styles.categoryDotText}>{item.category.slice(0, 1)}</Text></View><View style={styles.transactionCopy}><Text style={styles.transactionCategory}>{item.category}</Text><Text numberOfLines={1} style={styles.transactionNote}>{item.note || (item.type === 'expense' ? '支出' : '收入')}</Text></View><Text style={[styles.transactionAmount, item.type === 'income' && styles.transactionAmountIncome]}>{item.type === 'expense' ? '-' : '+'}{formatMoney(item.amountCents)}</Text></Pressable><Pressable accessibilityLabel={`更多账单操作：${item.category}`} accessibilityRole="button" onPress={onMore} style={({ pressed }) => [styles.moreButton, pressed && styles.pressed]}><SymbolView name={{ android: 'more_vert', ios: 'ellipsis', web: 'more_vert' }} size={20} tintColor={colors.inkFaint} type="hierarchical" /></Pressable></View>;
}

function LedgerActionOption({ destructive = false, icon, label, onPress }: { destructive?: boolean; icon: ComponentProps<typeof SymbolView>['name']; label: string; onPress(): void }) {
  return <Pressable accessibilityRole="menuitem" onPress={onPress} style={({ pressed }) => [styles.actionOption, pressed && styles.pressed]}><SymbolView name={icon} size={20} tintColor={destructive ? colors.danger : colors.ink} type="hierarchical" /><Text style={[styles.actionOptionText, destructive && styles.actionOptionDanger]}>{label}</Text></Pressable>;
}

function TransactionSheet({ editing, open, onClose, onCreate, onUpdate, today }: { editing: LedgerTransaction | null; open: boolean; onClose(): void; onCreate(transaction: LedgerTransaction): Promise<void>; onUpdate(transaction: LedgerTransaction): Promise<void>; today: DayKey }) {
  const [type, setType] = useState<LedgerTransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(CATEGORIES.expense[0]);
  const [dayParts, setDayParts] = useState<DateParts>(() => parseDayKey(today));
  const [note, setNote] = useState('');
  const deleteRepeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deleteLongPressedRef = useRef(false);
  useEffect(() => {
    if (!open) return;
    const initialType = editing?.type ?? 'expense';
    setType(initialType); setAmount(editing ? (editing.amountCents / 100).toFixed(2) : ''); setCategory(editing?.category ?? CATEGORIES[initialType][0]); setDayParts(parseDayKey(editing?.dayKey ?? today)); setNote(editing?.note ?? '');
    return () => {
      if (deleteRepeatRef.current) clearInterval(deleteRepeatRef.current);
      deleteRepeatRef.current = null;
    };
  }, [editing, open, today]);

  const save = async () => {
    const numericAmount = Number(amount.replace(',', '.'));
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 9999999999) { feedback.alert('金额无效', '请输入大于 0 的金额。'); return; }
    const cents = Math.round(numericAmount * 100);
    if (!Number.isSafeInteger(cents) || cents <= 0) { feedback.alert('金额无效', '金额最多保留两位小数。'); return; }
    const dayKey = formatDayKey(dayParts);
    const now = new Date().toISOString();
    const transaction: LedgerTransaction = { id: editing?.id ?? `ledger_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`, type, amountCents: cents, category, dayKey: dayKey as DayKey, note: note.trim() || null, createdAt: editing?.createdAt ?? now, updatedAt: now };
    try { if (editing) await onUpdate(transaction); else await onCreate(transaction); onClose(); } catch (cause) { feedback.alert('保存失败', cause instanceof Error ? cause.message : '请稍后重试。'); }
  };
  return <DraggableBottomSheet accessibilityLabel="编辑账单，向下拖动关闭" keyboardAvoiding onClose={onClose} open={open} sheetStyle={styles.sheet}>
    <View style={sheetLayoutStyles.sheetContent}>
      <View style={sheetLayoutStyles.sheetHeader}><Text style={sheetLayoutStyles.sheetTitle}>{editing ? '编辑账单' : '记一笔'}</Text></View>
      <View style={sheetLayoutStyles.controlRow}>
        <View style={sheetLayoutStyles.typeRow}>{(['expense', 'income'] as const).map((item) => <Pressable accessibilityRole="button" accessibilityState={{ selected: type === item }} key={item} onPress={() => { if (item === type) return; setType(item); setCategory(CATEGORIES[item][0]); }} style={[sheetLayoutStyles.typeButton, type === item && sheetLayoutStyles.typeButtonActive]}><Text style={[sheetLayoutStyles.typeButtonText, type === item && sheetLayoutStyles.typeButtonTextActive]}>{item === 'expense' ? '支出' : '收入'}</Text></Pressable>)}</View>
        <DatePickerField fieldStyle={sheetLayoutStyles.compactDateField} formatValue={(value) => `${value.month} 月 ${value.day} 日`} label="日期" maximumDate={new Date(2100, 11, 31)} onChange={setDayParts} value={dayParts} />
      </View>
      <View accessible accessibilityLabel={`金额 ${amount || '0.00'} 元`} style={sheetLayoutStyles.amountDisplay}><Text style={sheetLayoutStyles.currency}>¥</Text><Text adjustsFontSizeToFit minimumFontScale={0.55} numberOfLines={1} style={sheetLayoutStyles.amountText}>{amount || '0.00'}</Text></View>
      <View style={sheetLayoutStyles.amountDivider} />
      <View accessibilityLabel={`选择${type === 'expense' ? '支出' : '收入'}分类`} style={sheetLayoutStyles.categoryGrid}>{CATEGORIES[type].map((item) => <Pressable accessibilityRole="button" accessibilityState={{ selected: category === item }} key={item} onPress={() => setCategory(item)} style={sheetLayoutStyles.categoryButton}><View style={[sheetLayoutStyles.categoryIcon, category === item && sheetLayoutStyles.categoryIconActive]}><Text style={[sheetLayoutStyles.categoryIconText, category === item && sheetLayoutStyles.categoryIconTextActive]}>{item.slice(0, 1)}</Text></View><Text style={[sheetLayoutStyles.categoryButtonText, category === item && sheetLayoutStyles.categoryButtonTextActive]}>{item}</Text></Pressable>)}</View>
      <TextInput accessibilityLabel="备注" maxLength={200} onChangeText={setNote} onSubmitEditing={() => Keyboard.dismiss()} placeholder="添加备注（可选）" placeholderTextColor={colors.inkFaint} returnKeyType="done" style={sheetLayoutStyles.noteInput} value={note} />
      <View style={sheetLayoutStyles.spacer} />
      <View accessibilityLabel="金额键盘" style={sheetLayoutStyles.keypadAndConfirm}>
        <View style={sheetLayoutStyles.keypad}>{AMOUNT_KEYPAD_ROWS.map((row, rowIndex) => <View key={`amount_row_${rowIndex}`} style={sheetLayoutStyles.keypadRow}>{row.map((key) => <Pressable accessibilityLabel={key === '.' ? '小数点' : `数字 ${key}`} accessibilityRole="button" key={key} onPress={() => setAmount((current) => key === '.' ? appendAmountDecimal(current) : appendAmountDigit(current, key))} style={({ pressed }) => [sheetLayoutStyles.keypadKey, key === '0' && sheetLayoutStyles.keypadZeroKey, pressed && styles.pressed]}><Text style={sheetLayoutStyles.keypadKeyText}>{key}</Text></Pressable>)}</View>)}</View>
        <View style={sheetLayoutStyles.keypadActions}><Pressable accessibilityHint="长按连续删除" accessibilityLabel="删除最后一位" accessibilityRole="button" delayLongPress={360} onLongPress={() => { deleteLongPressedRef.current = true; setAmount(deleteAmountDigit); deleteRepeatRef.current = setInterval(() => setAmount(deleteAmountDigit), 80); }} onPress={() => { if (!deleteLongPressedRef.current) setAmount(deleteAmountDigit); deleteLongPressedRef.current = false; }} onPressIn={() => { deleteLongPressedRef.current = false; }} onPressOut={() => { if (deleteRepeatRef.current) clearInterval(deleteRepeatRef.current); deleteRepeatRef.current = null; }} style={({ pressed }) => [sheetLayoutStyles.deleteKey, pressed && styles.pressed]}><Text style={sheetLayoutStyles.deleteKeyText}>⌫</Text></Pressable><Pressable accessibilityLabel={editing ? '确认修改账单' : '确认保存账单'} accessibilityRole="button" onPress={() => void save()} style={({ pressed }) => [sheetLayoutStyles.confirmKey, pressed && styles.pressed]}><Text style={sheetLayoutStyles.confirmKeyText}>确认</Text></Pressable></View>
      </View>
    </View>
  </DraggableBottomSheet>;
}

function formatMoney(cents: number): string { return `¥${(cents / 100).toFixed(2)}`; }
function parseDayKey(value: string): DateParts { const [year, month, day] = value.split('-').map(Number); return { year, month, day }; }
function formatDayKey(value: DateParts): DayKey { return `${value.year}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}` as DayKey; }
function appendAmountDigit(current: string, digit: string): string {
  const decimalLength = current.split('.')[1]?.length ?? 0;
  if (decimalLength >= 2) return current;
  if (!current || current === '0') return current === '0' && digit === '0' ? current : digit;
  return `${current}${digit}`;
}
function appendAmountDecimal(current: string): string { return current.includes('.') ? current : `${current || '0'}.`; }
function deleteAmountDigit(current: string): string { return current.slice(0, -1); }
function formatMonth(month: string): string { const [year, value] = month.split('-'); return `${year} 年 ${Number(value)} 月`; }
function formatDay(dayKey: DayKey): string { const date = new Date(`${dayKey}T00:00:00`); return `${Number(dayKey.slice(5, 7))} 月 ${Number(dayKey.slice(8))} 日 星期${['日', '一', '二', '三', '四', '五', '六'][date.getDay()]}`; }
function shiftMonth(month: string, offset: number): string { const [year, value] = month.split('-').map(Number); const date = new Date(year, value - 1 + offset, 1); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; }

const sheetLayoutStyles = StyleSheet.create({
  sheetContent: { flex: 1 },
  sheetHeader: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 22 },
  controlRow: { minHeight: 42, marginTop: spacing.xs, flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm },
  typeRow: { flex: 1, padding: 3, flexDirection: 'row', borderRadius: 8, backgroundColor: colors.sheet },
  typeButton: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  typeButtonActive: { backgroundColor: colors.lifeLight },
  typeButtonText: { color: colors.inkFaint, fontSize: 12 },
  typeButtonTextActive: { color: colors.life, fontWeight: '800' },
  compactDateField: { flex: 0.9, minHeight: 42, marginTop: 0, paddingHorizontal: spacing.sm },
  amountDisplay: { minWidth: 0, minHeight: 56, marginTop: spacing.xs, flexDirection: 'row', alignItems: 'center' },
  currency: { marginRight: spacing.sm, color: colors.ink, fontFamily: typography.display, fontSize: 27 },
  amountText: { minWidth: 0, flex: 1, color: colors.ink, fontFamily: typography.display, fontSize: 44 },
  amountDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  categoryGrid: { marginTop: spacing.sm, flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.xs },
  categoryButton: { width: '25%', height: 54, alignItems: 'center', justifyContent: 'center' },
  categoryIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: colors.sheet },
  categoryIconActive: { backgroundColor: colors.life },
  categoryIconText: { color: colors.inkSoft, fontFamily: typography.display, fontSize: 13 },
  categoryIconTextActive: { color: colors.onLife },
  categoryButtonText: { marginTop: spacing.xs, color: colors.inkFaint, fontSize: 10 },
  categoryButtonTextActive: { color: colors.life, fontWeight: '800' },
  noteInput: { minHeight: 40, paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, color: colors.ink, fontSize: 12, textAlignVertical: 'center' },
  spacer: { minHeight: spacing.xs, flex: 1 },
  keypadAndConfirm: { height: KEYPAD_HEIGHT, marginTop: spacing.xs, flexDirection: 'row', gap: spacing.xs, overflow: 'hidden', borderRadius: 0, backgroundColor: colors.paper },
  keypad: { flex: 3, gap: spacing.xs },
  keypadRow: { flex: 1, flexDirection: 'row', gap: spacing.xs },
  keypadKey: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sheet },
  keypadZeroKey: { flexGrow: 2, flexShrink: 1, flexBasis: spacing.xs },
  keypadKeyText: { color: colors.ink, fontFamily: typography.mono, fontSize: 21 },
  keypadActions: { flex: 1, gap: spacing.xs },
  deleteKey: { flex: 0, height: KEYPAD_ROW_HEIGHT, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sheet },
  deleteKeyText: { color: colors.life, fontSize: 21 },
  confirmKey: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.life },
  confirmKeyText: { color: colors.onLife, fontSize: 13, fontWeight: '800', lineHeight: 21, textAlign: 'center' },
});

const styles = createThemedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: colors.paper }, content: { padding: spacing.lg, paddingBottom: 120 }, headerAdd: { minHeight: 38, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.lifeLight }, headerAddText: { color: colors.life, fontSize: 11, fontWeight: '800' }, summaryCard: { overflow: 'hidden', borderTopRightRadius: radius.xl, borderBottomLeftRadius: radius.xl, backgroundColor: colors.life }, summaryHeader: { padding: spacing.lg }, summaryEyebrow: { color: colors.onLife, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1.2, opacity: 0.8 }, summaryTitle: { marginTop: spacing.md, color: colors.onLife, fontFamily: typography.display, fontSize: 40 }, summaryLabel: { marginTop: 2, color: colors.onLife, fontSize: 11, opacity: 0.8 }, summaryStats: { minHeight: 68, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.lifeDeep }, summaryStat: { flex: 1 }, summaryStatValue: { color: colors.onLife, fontFamily: typography.mono, fontSize: 16 }, summaryStatLabel: { marginTop: 3, color: colors.onLife, fontSize: 10, opacity: 0.8 }, summaryDivider: { width: StyleSheet.hairlineWidth, height: 32, marginHorizontal: spacing.md, backgroundColor: colors.onLife, opacity: 0.3 }, monthRow: { marginTop: spacing.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, monthTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 22 }, monthButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.sheet }, monthButtonText: { color: colors.life, fontSize: 28, lineHeight: 30 }, filters: { marginTop: spacing.md, padding: 3, flexDirection: 'row', borderRadius: 8, backgroundColor: colors.sheet }, filter: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 6 }, filterActive: { backgroundColor: colors.lifeLight }, filterText: { color: colors.inkFaint, fontSize: 11 }, filterTextActive: { color: colors.life, fontWeight: '800' }, categorySummary: { marginTop: spacing.lg, padding: spacing.md, borderTopRightRadius: radius.lg, borderBottomLeftRadius: radius.lg, backgroundColor: colors.sheet }, categorySummaryTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 17 }, categorySummaryRow: { marginTop: spacing.md }, categorySummaryMeta: { flexDirection: 'row', justifyContent: 'space-between' }, categorySummaryName: { color: colors.inkSoft, fontSize: 10 }, categorySummaryValue: { color: colors.ink, fontFamily: typography.mono, fontSize: 10 }, categoryBar: { height: 6, marginTop: 5, overflow: 'hidden', borderRadius: 3, backgroundColor: colors.lifeLight }, categoryBarFill: { height: '100%', borderRadius: 3, backgroundColor: colors.life }, dayGroup: { marginTop: spacing.xl }, dayTitle: { marginBottom: spacing.sm, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 10, letterSpacing: 0.8 }, transactionRow: { minHeight: 68, marginBottom: spacing.sm, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', borderTopRightRadius: radius.md, borderBottomLeftRadius: radius.md, backgroundColor: colors.sheet }, transactionMain: { flex: 1, minWidth: 0, minHeight: 68, flexDirection: 'row', alignItems: 'center' }, categoryDot: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: colors.lifeLight }, categoryDotIncome: { backgroundColor: colors.sunLight }, categoryDotText: { color: colors.life, fontFamily: typography.display, fontSize: 16 }, transactionCopy: { minWidth: 0, flex: 1, marginLeft: spacing.md }, transactionCategory: { color: colors.ink, fontFamily: typography.display, fontSize: 16 }, transactionNote: { marginTop: 3, color: colors.inkFaint, fontSize: 10 }, transactionAmount: { color: colors.ink, fontFamily: typography.mono, fontSize: 13 }, transactionAmountIncome: { color: colors.life }, moreButton: { width: 42, height: 54, alignItems: 'center', justifyContent: 'center' }, actionSheet: { padding: spacing.lg, paddingBottom: spacing.xxl, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.sheet }, actionHeader: { minHeight: 72, paddingBottom: spacing.md, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }, actionLabel: { color: colors.life, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1 }, actionTitle: { marginTop: 3, color: colors.ink, fontFamily: typography.display, fontSize: 18 }, actionMeta: { marginTop: 3, color: colors.inkFaint, fontSize: 10 }, actionOption: { minHeight: 54, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft }, actionOptionText: { color: colors.ink, fontSize: 12 }, actionOptionDanger: { color: colors.danger }, actionCancel: { minHeight: 48, marginTop: spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: colors.paper }, actionCancelText: { color: colors.inkSoft, fontSize: 11, fontWeight: '600' }, empty: { marginTop: spacing.xxl, padding: spacing.xl, alignItems: 'center', borderTopRightRadius: radius.lg, borderBottomLeftRadius: radius.lg, backgroundColor: colors.sheet }, emptyTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 20 }, emptyText: { marginTop: spacing.sm, color: colors.inkFaint, fontSize: 11, lineHeight: 18, textAlign: 'center' }, emptyAction: { minHeight: 44, marginTop: spacing.lg, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.life }, emptyActionText: { color: colors.onLife, fontSize: 11, fontWeight: '800' }, floatingAdd: { position: 'absolute', right: spacing.lg, bottom: spacing.lg, minHeight: 48, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: colors.life, shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 }, floatingAddText: { color: colors.onLife, fontSize: 12, fontWeight: '800' }, sheet: { width: '100%', height: '92%', maxHeight: 590, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, backgroundColor: colors.paper }, pressed: { opacity: 0.68, transform: [{ scale: 0.985 }] },
}));
