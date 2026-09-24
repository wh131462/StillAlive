import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Circle, Path, Svg } from 'react-native-svg';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { DayKey, LedgerTransaction } from '@still-alive/types';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { useAppState } from '../../application/state/app-state';
import { ToolPageHeader } from '../../shared/components/tool-page-header';
import { createThemedStyles } from '../../shared/theme/app-theme';
import { toDayKey } from '../../shared/core/day-key';
import { DatePickerField } from '../people/date-time-picker';
import type { DateParts } from '../people/date-time-picker';

type RangePreset = 'day' | 'week' | 'month' | 'year' | 'custom';
interface DateRange { start: DayKey; end: DayKey }
interface CategorySegment { name: string; value: number; color: string; percent: number }

const RANGE_OPTIONS: Array<{ key: RangePreset; label: string }> = [
  { key: 'day', label: '日' },
  { key: 'week', label: '周' },
  { key: 'month', label: '月' },
  { key: 'year', label: '年' },
  { key: 'custom', label: '自定义' },
];
const PIE_COLORS = [colors.life, colors.sun, colors.danger, colors.inkSoft, colors.lifeDeep, colors.sunLight, colors.inkFaint, colors.lifeLine];

export default function LedgerSummaryScreen() {
  const router = useRouter();
  const { ledgerTransactions, today } = useAppState();
  const [preset, setPreset] = useState<RangePreset>('month');
  const [summaryType, setSummaryType] = useState<LedgerTransaction['type']>('expense');
  const [customStart, setCustomStart] = useState<DateParts>(() => parseDayKey(today));
  const [customEnd, setCustomEnd] = useState<DateParts>(() => parseDayKey(today));
  const range = useMemo(() => resolveRange(preset, today, customStart, customEnd), [customEnd, customStart, preset, today]);
  const transactions = useMemo(() => ledgerTransactions.filter((item) => item.dayKey >= range.start && item.dayKey <= range.end), [ledgerTransactions, range]);
  const expense = useMemo(() => totalFor(transactions, 'expense'), [transactions]);
  const income = useMemo(() => totalFor(transactions, 'income'), [transactions]);
  const summaryTransactions = useMemo(() => transactions.filter((item) => item.type === summaryType), [summaryType, transactions]);
  const summaryTotal = summaryType === 'expense' ? expense : income;
  const segments = useMemo(() => buildCategorySegments(summaryTransactions, summaryTotal), [summaryTotal, summaryTransactions]);
  const average = summaryTransactions.length ? Math.round(summaryTotal / summaryTransactions.length) : 0;
  const summaryLabel = summaryType === 'expense' ? '支出' : '收入';

  return <SafeAreaView edges={['top']} style={styles.safeArea}>
    <ToolPageHeader onBack={() => router.back()} title="账本汇总" />
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.rangeLabel}>{formatRange(range)}</Text>

      <View style={styles.rangeTabs}>{RANGE_OPTIONS.map((option) => <Pressable accessibilityRole="button" accessibilityState={{ selected: preset === option.key }} key={option.key} onPress={() => setPreset(option.key)} style={[styles.rangeTab, preset === option.key && styles.rangeTabActive]}><Text style={[styles.rangeTabText, preset === option.key && styles.rangeTabTextActive]}>{option.label}</Text></Pressable>)}</View>
      {preset === 'custom' ? <View style={styles.customDates}><DatePickerField fieldStyle={styles.customDateField} label="开始日期" maximumDate={new Date()} onChange={setCustomStart} value={customStart} /><DatePickerField fieldStyle={styles.customDateField} label="结束日期" maximumDate={new Date()} onChange={setCustomEnd} value={customEnd} /></View> : null}

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>本期结余</Text>
        <Text style={styles.summaryTotal}>{formatMoney(income - expense)}</Text>
        <View style={styles.summaryStats}><SummaryStat label="支出" value={expense} /><View style={styles.summaryDivider} /><SummaryStat label="收入" value={income} /></View>
      </View>

      <View style={styles.typeTabs}>{(['expense', 'income'] as const).map((type) => <Pressable accessibilityRole="button" accessibilityState={{ selected: summaryType === type }} key={type} onPress={() => setSummaryType(type)} style={[styles.typeTab, summaryType === type && styles.typeTabActive]}><Text style={[styles.typeTabText, summaryType === type && styles.typeTabTextActive]}>{type === 'expense' ? '支出汇总' : '收入汇总'}</Text></Pressable>)}</View>

      <View style={styles.typeSummary}>
        <Text style={styles.typeSummaryLabel}>本期{summaryLabel}</Text>
        <Text style={styles.typeSummaryAmount}>{formatMoney(summaryTotal)}</Text>
        <View style={styles.metricGrid}><Metric label="记录笔数" value={`${summaryTransactions.length} 笔`} /><Metric label="平均每笔" value={formatMoney(average)} /><Metric label="主要分类" value={segments[0]?.name ?? '—'} /></View>
      </View>

      {segments.length ? <View style={styles.chartCard}>
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{summaryLabel}分类</Text><Text style={styles.sectionMeta}>{segments.length} 类</Text></View>
        <PieChart label={summaryLabel} segments={segments} total={summaryTotal} />
        <View style={styles.categoryList}>{segments.map((segment) => <View key={segment.name} style={styles.categoryRow}><View style={styles.categoryMeta}><View style={[styles.categoryDot, { backgroundColor: segment.color }]} /><Text numberOfLines={1} style={styles.categoryName}>{segment.name}</Text><Text style={styles.categoryPercent}>{Math.round(segment.percent * 100)}%</Text><Text style={styles.categoryValue}>{formatMoney(segment.value)}</Text></View><View style={styles.categoryBar}><View style={[styles.categoryBarFill, { backgroundColor: segment.color, width: `${Math.max(4, segment.percent * 100)}%` }]} /></View></View>)}</View>
      </View> : <View style={styles.empty}><Text style={styles.emptyTitle}>这段时间还没有{summaryLabel}</Text><Text style={styles.emptyText}>换个日期范围，或开始记下一笔。</Text></View>}
    </ScrollView>
  </SafeAreaView>;
}

function SummaryStat({ label, value }: { label: string; value: number }) { return <View style={styles.summaryStat}><Text style={styles.summaryStatValue}>{formatMoney(value)}</Text><Text style={styles.summaryStatLabel}>{label}</Text></View>; }
function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text adjustsFontSizeToFit minimumFontScale={0.75} numberOfLines={1} style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }

function PieChart({ label, segments, total }: { label: string; segments: CategorySegment[]; total: number }) {
  const size = 188;
  const center = size / 2;
  const radiusValue = 84;
  let cursor = -Math.PI / 2;
  return <View style={styles.chartWrap}>
    <Svg accessibilityLabel={`${label}分类饼图`} height={size} viewBox={`0 0 ${size} ${size}`} width={size}>
      <Circle cx={center} cy={center} fill={colors.lifeLight} r={radiusValue} />
      {segments.map((segment) => {
        const next = cursor + segment.percent * Math.PI * 2;
        const path = segment.percent >= 0.999 ? null : piePath(center, center, radiusValue, cursor, next);
        cursor = next;
        return path ? <Path d={path} fill={segment.color} key={segment.name} /> : <Circle cx={center} cy={center} fill={segment.color} key={segment.name} r={radiusValue} />;
      })}
      <Circle cx={center} cy={center} fill={colors.sheet} r={radiusValue * 0.52} />
    </Svg>
    <View pointerEvents="none" style={styles.chartCenter}><Text adjustsFontSizeToFit minimumFontScale={0.7} numberOfLines={1} style={styles.chartCenterValue}>{formatMoney(total)}</Text><Text style={styles.chartCenterLabel}>总{label}</Text></View>
  </View>;
}

function piePath(cx: number, cy: number, radiusValue: number, start: number, end: number): string {
  const startPoint = polarPoint(cx, cy, radiusValue, start);
  const endPoint = polarPoint(cx, cy, radiusValue, end);
  const largeArc = end - start > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${startPoint.x} ${startPoint.y} A ${radiusValue} ${radiusValue} 0 ${largeArc} 1 ${endPoint.x} ${endPoint.y} Z`;
}

function polarPoint(cx: number, cy: number, radiusValue: number, angle: number): { x: number; y: number } { return { x: cx + radiusValue * Math.cos(angle), y: cy + radiusValue * Math.sin(angle) }; }

function buildCategorySegments(transactions: LedgerTransaction[], total: number): CategorySegment[] {
  if (!total) return [];
  const totals = new Map<string, number>();
  for (const item of transactions) totals.set(item.category, (totals.get(item.category) ?? 0) + item.amountCents);
  return [...totals.entries()].sort(([, left], [, right]) => right - left).map(([name, value], index) => ({ name, value, color: PIE_COLORS[index % PIE_COLORS.length], percent: value / total }));
}

function totalFor(transactions: LedgerTransaction[], type: LedgerTransaction['type']): number { return transactions.filter((item) => item.type === type).reduce((sum, item) => sum + item.amountCents, 0); }

function resolveRange(preset: RangePreset, today: DayKey, customStart: DateParts, customEnd: DateParts): DateRange {
  if (preset === 'custom') {
    const start = formatDayKey(customStart);
    const end = formatDayKey(customEnd);
    return start <= end ? { start, end } : { start: end, end: start };
  }
  const date = new Date(`${today}T00:00:00`);
  if (preset === 'day') return { start: today, end: today };
  if (preset === 'week') {
    const start = new Date(date); start.setDate(date.getDate() - date.getDay());
    const end = new Date(start); end.setDate(start.getDate() + 6);
    return { start: toDayKey(start), end: toDayKey(end) };
  }
  if (preset === 'year') return { start: `${date.getFullYear()}-01-01` as DayKey, end: `${date.getFullYear()}-12-31` as DayKey };
  return { start: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01` as DayKey, end: toDayKey(new Date(date.getFullYear(), date.getMonth() + 1, 0)) };
}

function formatRange(range: DateRange): string { return range.start === range.end ? range.start : `${range.start} — ${range.end}`; }
function parseDayKey(value: string): DateParts { const [year, month, day] = value.split('-').map(Number); return { year, month, day }; }
function formatDayKey(value: DateParts): DayKey { return `${value.year}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}` as DayKey; }
function formatMoney(cents: number): string { return `${cents < 0 ? '-' : ''}¥${(Math.abs(cents) / 100).toFixed(2)}`; }

const styles = createThemedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  rangeLabel: { color: colors.inkSoft, fontFamily: typography.mono, fontSize: 11 },
  rangeTabs: { marginTop: spacing.sm, padding: 3, flexDirection: 'row', borderRadius: 8, backgroundColor: colors.sheet },
  rangeTab: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  rangeTabActive: { backgroundColor: colors.lifeLight },
  rangeTabText: { color: colors.inkFaint, fontSize: 11 },
  rangeTabTextActive: { color: colors.life, fontWeight: '800' },
  customDates: { flexDirection: 'row', gap: spacing.sm },
  customDateField: { minWidth: 0, flex: 1, marginTop: spacing.md, paddingHorizontal: spacing.sm },
  summaryCard: { marginTop: spacing.lg, overflow: 'hidden', borderTopRightRadius: radius.xl, borderBottomLeftRadius: radius.xl, backgroundColor: colors.life },
  summaryLabel: { paddingTop: spacing.lg, paddingHorizontal: spacing.lg, color: colors.onLife, fontSize: 11, opacity: 0.8 },
  summaryTotal: { paddingHorizontal: spacing.lg, color: colors.onLife, fontFamily: typography.display, fontSize: 40 },
  summaryStats: { minHeight: 68, marginTop: spacing.md, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.lifeDeep },
  summaryStat: { flex: 1 },
  summaryStatValue: { color: colors.onLife, fontFamily: typography.mono, fontSize: 14 },
  summaryStatLabel: { marginTop: 3, color: colors.onLife, fontSize: 10, opacity: 0.8 },
  summaryDivider: { width: StyleSheet.hairlineWidth, height: 30, marginHorizontal: spacing.md, backgroundColor: colors.onLife, opacity: 0.3 },
  typeTabs: { marginTop: spacing.lg, padding: 3, flexDirection: 'row', borderRadius: 8, backgroundColor: colors.sheet },
  typeTab: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  typeTabActive: { backgroundColor: colors.lifeLight },
  typeTabText: { color: colors.inkFaint, fontSize: 11 },
  typeTabTextActive: { color: colors.life, fontWeight: '800' },
  typeSummary: { marginTop: spacing.sm, padding: spacing.lg, borderTopRightRadius: radius.lg, borderBottomLeftRadius: radius.lg, backgroundColor: colors.sheet },
  typeSummaryLabel: { color: colors.inkFaint, fontSize: 10 },
  typeSummaryAmount: { marginTop: spacing.xs, color: colors.ink, fontFamily: typography.display, fontSize: 32 },
  metricGrid: { marginTop: spacing.md, flexDirection: 'row', gap: spacing.sm },
  metric: { minWidth: 0, flex: 1, minHeight: 62, padding: spacing.sm, justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.paper },
  metricValue: { color: colors.ink, fontFamily: typography.mono, fontSize: 11 },
  metricLabel: { marginTop: 4, color: colors.inkFaint, fontSize: 9 },
  chartCard: { marginTop: spacing.lg, padding: spacing.lg, borderTopRightRadius: radius.xl, borderBottomLeftRadius: radius.xl, backgroundColor: colors.sheet },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 19 },
  sectionMeta: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9 },
  chartWrap: { width: 188, height: 188, marginTop: spacing.md, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  chartCenter: { position: 'absolute', top: 70, right: 0, bottom: 70, left: 0, alignItems: 'center', justifyContent: 'center' },
  chartCenterValue: { maxWidth: 86, color: colors.ink, fontFamily: typography.mono, fontSize: 13, textAlign: 'center' },
  chartCenterLabel: { marginTop: 3, color: colors.inkFaint, fontSize: 9 },
  categoryList: { marginTop: spacing.md },
  categoryRow: { marginTop: spacing.md },
  categoryMeta: { flexDirection: 'row', alignItems: 'center' },
  categoryDot: { width: 8, height: 8, marginRight: spacing.sm, borderRadius: 4 },
  categoryName: { minWidth: 0, flex: 1, color: colors.inkSoft, fontSize: 11 },
  categoryPercent: { width: 42, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9, textAlign: 'right' },
  categoryValue: { width: 84, marginLeft: spacing.sm, color: colors.ink, fontFamily: typography.mono, fontSize: 10, textAlign: 'right' },
  categoryBar: { height: 4, marginTop: 6, overflow: 'hidden', borderRadius: 2, backgroundColor: colors.paper },
  categoryBarFill: { height: '100%', borderRadius: 2 },
  empty: { marginTop: spacing.lg, padding: spacing.xl, alignItems: 'center', borderTopRightRadius: radius.lg, borderBottomLeftRadius: radius.lg, backgroundColor: colors.sheet },
  emptyTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 18 },
  emptyText: { marginTop: spacing.sm, color: colors.inkFaint, fontSize: 11 },
}));
