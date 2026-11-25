import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { useAi } from '../../application/ai/ai-provider';
import type { AiUsageRecord } from '../../infrastructure/ai/ai-types';
import { ToolPageHeader } from '../../shared/components/tool-page-header';
import { createThemedStyles } from '../../shared/theme/app-theme';
import { formatTokens, groupUsage, summarizeUsage, usageErrorLabel } from './ai-copy';

type RangeId = 'today' | 'week' | 'month' | 'all';
const RANGES: Array<{ id: RangeId; label: string; days: number | null }> = [
  { id: 'today', label: '今日', days: 1 },
  { id: 'week', label: '7 天', days: 7 },
  { id: 'month', label: '30 天', days: 30 },
  { id: 'all', label: '全部', days: null },
];

export default function AiUsageScreen() {
  const router = useRouter();
  const { usage, refreshUsage, providers } = useAi();
  const [range, setRange] = useState<RangeId>('week');

  const records = useMemo(() => filterByRange(usage, range), [range, usage]);
  const summary = useMemo(() => summarizeUsage(records), [records]);
  const groups = useMemo(() => groupUsage(records), [records]);

  return <SafeAreaView style={styles.safeArea}>
    <ToolPageHeader onBack={() => router.back()} title="AI 用量" />
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.rangeRow}>
        {RANGES.map((item) => <Pressable accessibilityRole="button" accessibilityState={{ selected: range === item.id }} key={item.id} onPress={() => setRange(item.id)} style={({ pressed }) => [styles.rangeChip, range === item.id && styles.rangeChipActive, pressed && styles.pressed]}><Text style={[styles.rangeChipText, range === item.id && styles.rangeChipTextActive]}>{item.label}</Text></Pressable>)}
        <Pressable accessibilityRole="button" onPress={() => void refreshUsage()} style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}><Text style={styles.refreshText}>刷新</Text></Pressable>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <SummaryStat label="请求" value={String(summary.requests)} />
          <SummaryStat label="成功" value={String(summary.succeeded)} />
          <SummaryStat label="失败" value={String(summary.failed + summary.cancelled)} />
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryRow}>
          <SummaryStat label="输入 token" value={formatTokens(summary.inputTokens)} />
          <SummaryStat label="输出 token" value={formatTokens(summary.outputTokens)} />
          <SummaryStat label="总耗时" value={`${Math.round(summary.durationMs / 1000)}s`} />
        </View>
      </View>

      <Text style={styles.sectionLabel}>按模型</Text>
      {groups.length ? groups.map((group) => <View key={group.key} style={styles.groupRow}>
        <View style={styles.groupCopy}>
          <Text numberOfLines={1} style={styles.groupTitle}>{providers.find((provider) => group.key.startsWith(`${provider.id}:`))?.label ?? '模型'} · {group.label}</Text>
          <Text style={styles.groupMeta}>{group.summary.requests} 次请求 · 输入 {formatTokens(group.summary.inputTokens)} / 输出 {formatTokens(group.summary.outputTokens)}</Text>
        </View>
        <Text style={styles.groupDuration}>{Math.round(group.summary.durationMs / 1000)}s</Text>
      </View>) : <View style={styles.emptyCard}><Text style={styles.emptyTitle}>还没有 AI 用量</Text><Text style={styles.emptyText}>启用 AI 并完成一次对话或检测后，这里会记录请求数、token 与耗时。</Text></View>}

      <Text style={styles.sectionLabel}>最近记录</Text>
      {records.slice(0, 30).map((record) => <View key={record.id} style={styles.recordRow}>
        <View style={[styles.recordDot, record.status === 'success' ? styles.recordDotOk : record.status === 'cancelled' ? styles.recordDotMuted : styles.recordDotWarn]} />
        <View style={styles.recordCopy}>
          <Text numberOfLines={1} style={styles.recordTitle}>{record.modelId || '未命名模型'} · {record.taskId === 'chat' ? '对话' : record.taskId === 'connection.probe' ? '检测' : '其它'}</Text>
          <Text style={styles.recordMeta}>{formatRecordTime(record.createdAt)} · 输入 {formatTokens(record.inputTokens)} / 输出 {formatTokens(record.outputTokens)} · {Math.round(record.durationMs)}ms{record.errorCode ? ` · ${usageErrorLabel(record.errorCode)}` : ''}</Text>
        </View>
      </View>)}

      <View style={styles.footNote}><Text style={styles.footNoteText}>以上全部为本机统计。费用与余额以服务商账单为准；未配置本地价格表时只显示 token，不估算金额。关闭 AI 或删除全部数据会清空这些记录。</Text></View>
    </ScrollView>
  </SafeAreaView>;
}

function filterByRange(records: AiUsageRecord[], range: RangeId): AiUsageRecord[] {
  if (range === 'today') {
    const todayKey = new Date().toDateString();
    return records.filter((record) => new Date(record.createdAt).toDateString() === todayKey);
  }
  const days = RANGES.find((item) => item.id === range)?.days ?? null;
  if (days === null) return records;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return records.filter((record) => {
    const time = new Date(record.createdAt).getTime();
    return Number.isFinite(time) && time >= cutoff;
  });
}

function formatRecordTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return <View style={styles.summaryStat}><Text style={styles.summaryValue}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>;
}

const styles = createThemedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  rangeChip: { minHeight: 36, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: 18 },
  rangeChipActive: { borderColor: colors.life, backgroundColor: colors.lifeLight },
  rangeChipText: { color: colors.inkSoft, fontSize: typography.size.caption, fontWeight: '700' },
  rangeChipTextActive: { color: colors.life },
  refreshButton: { marginLeft: 'auto', minHeight: 36, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center' },
  refreshText: { color: colors.life, fontSize: typography.size.caption, fontWeight: '700' },
  summaryCard: { marginTop: spacing.md, padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.sheet },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryStat: { flex: 1, alignItems: 'center' },
  summaryValue: { color: colors.ink, fontFamily: typography.display, fontSize: 22 },
  summaryLabel: { marginTop: 4, color: colors.inkFaint, fontSize: typography.size.meta },
  summaryDivider: { height: StyleSheet.hairlineWidth, marginVertical: spacing.md, backgroundColor: colors.line },
  sectionLabel: { marginTop: spacing.xl, marginBottom: spacing.sm, color: colors.inkFaint, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.2 },
  groupRow: { minHeight: 64, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, borderRadius: radius.md, backgroundColor: colors.sheet },
  groupCopy: { minWidth: 0, flex: 1 },
  groupTitle: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  groupMeta: { marginTop: 4, color: colors.inkFaint, fontSize: typography.size.meta },
  groupDuration: { marginLeft: spacing.md, color: colors.inkSoft, fontFamily: typography.mono, fontSize: typography.size.meta },
  emptyCard: { padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.sheet },
  emptyTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  emptyText: { marginTop: spacing.sm, color: colors.inkFaint, fontSize: typography.size.meta, lineHeight: 18 },
  recordRow: { minHeight: 56, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  recordDot: { width: 6, height: 6, marginRight: spacing.sm, borderRadius: 3, backgroundColor: colors.inkFaint },
  recordDotOk: { backgroundColor: colors.life },
  recordDotWarn: { backgroundColor: colors.danger },
  recordDotMuted: { backgroundColor: colors.sun },
  recordCopy: { minWidth: 0, flex: 1 },
  recordTitle: { color: colors.inkSoft, fontSize: 12, fontWeight: '600' },
  recordMeta: { marginTop: 3, color: colors.inkFaint, fontSize: typography.size.meta },
  footNote: { marginTop: spacing.xl, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  footNoteText: { color: colors.inkFaint, fontSize: typography.size.meta, lineHeight: 18 },
  pressed: { opacity: 0.7 },
}));
