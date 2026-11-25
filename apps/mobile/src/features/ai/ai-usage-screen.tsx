import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@still-alive/tokens';
import { useAi } from '../../application/ai/ai-provider';
import type { AiUsageRecord } from '../../infrastructure/ai/ai-types';
import { ToolPageHeader } from '../../shared/components/tool-page-header';
import { createThemedStyles } from '../../shared/theme/app-theme';
import { AiSegmentedControl } from './ai-segmented-control';
import { formatTokens, groupUsage, summarizeUsage, usageErrorLabel } from './ai-copy';

type RangeId = 'today' | 'week' | 'month' | 'all';
const RANGES: ReadonlyArray<{ days: number | null; label: string; value: RangeId }> = [
  { value: 'today', label: '今日', days: 1 },
  { value: 'week', label: '7 天', days: 7 },
  { value: 'month', label: '30 天', days: 30 },
  { value: 'all', label: '全部', days: null },
];

export default function AiUsageScreen() {
  const router = useRouter();
  const { usage, providers } = useAi();
  const [range, setRange] = useState<RangeId>('week');

  const records = useMemo(() => filterByRange(usage, range), [range, usage]);
  const summary = useMemo(() => summarizeUsage(records), [records]);
  const groups = useMemo(() => groupUsage(records), [records]);
  const recent = records.slice(0, 30);

  return <SafeAreaView style={styles.safeArea}>
    <ToolPageHeader onBack={() => router.back()} title="AI 用量" />
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <AiSegmentedControl onChange={(next) => setRange(next)} options={RANGES} value={range} />

      <View style={styles.card}>
        <StatRow label="请求" value={String(summary.requests)} />
        <View style={styles.separator} />
        <StatRow label="成功" value={String(summary.succeeded)} />
        <View style={styles.separator} />
        <StatRow label="失败" value={String(summary.failed + summary.cancelled)} />
        <View style={styles.separator} />
        <StatRow label="输入 token" value={formatTokens(summary.inputTokens)} />
        <View style={styles.separator} />
        <StatRow label="输出 token" value={formatTokens(summary.outputTokens)} />
        <View style={styles.separator} />
        <StatRow label="耗时" value={`${Math.round(summary.durationMs / 1000)} 秒`} />
      </View>

      <Text style={styles.sectionHeader}>按模型</Text>
      <View style={styles.card}>
        {groups.length ? groups.map((group, index) => <View key={group.key} style={[styles.row, index === groups.length - 1 && styles.rowLast]}>
          <View style={styles.rowCopy}>
            <Text numberOfLines={1} style={styles.rowTitle}>{providers.find((provider) => group.key.startsWith(`${provider.id}:`))?.label ?? '模型'} · {group.label}</Text>
            <Text style={styles.rowDetail}>{group.summary.requests} 次 · 输入 {formatTokens(group.summary.inputTokens)} / 输出 {formatTokens(group.summary.outputTokens)}</Text>
          </View>
          <Text style={styles.rowValue}>{Math.round(group.summary.durationMs / 1000)}s</Text>
        </View>) : <View style={styles.emptyRow}><Text style={styles.rowDetail}>这段时间还没有用量</Text></View>}
      </View>

      <Text style={styles.sectionHeader}>最近记录</Text>
      <View style={styles.card}>
        {recent.length ? recent.map((record, index) => <View key={record.id} style={[styles.row, index === recent.length - 1 && styles.rowLast]}>
          <View style={[styles.dot, record.status === 'success' ? styles.dotOk : record.status === 'cancelled' ? styles.dotMuted : styles.dotWarn]} />
          <View style={styles.rowCopy}>
            <Text numberOfLines={1} style={styles.rowTitle}>{record.modelId || '未命名模型'} · {taskLabel(record)}</Text>
            <Text style={styles.rowDetail}>{formatRecordTime(record.createdAt)} · {formatTokens(record.inputTokens)} / {formatTokens(record.outputTokens)} · {Math.round(record.durationMs)}ms{record.errorCode ? ` · ${usageErrorLabel(record.errorCode)}` : ''}</Text>
          </View>
        </View>) : <View style={styles.emptyRow}><Text style={styles.rowDetail}>还没有记录</Text></View>}
      </View>

      <Text style={styles.footer}>全部为本机统计；费用与余额以服务商账单为准。关闭 AI 或删除全部数据会清空这些记录。</Text>
    </ScrollView>
  </SafeAreaView>;
}

function StatRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.statRow}><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text></View>;
}

function taskLabel(record: AiUsageRecord): string {
  if (record.taskId === 'chat' || record.taskId === 'chat.answer') return '问答';
  if (record.taskId === 'connection.probe') return '检测';
  if (record.taskId === 'memory.extract') return '记忆整理';
  return '其它';
}

function filterByRange(records: AiUsageRecord[], range: RangeId): AiUsageRecord[] {
  if (range === 'today') {
    const todayKey = new Date().toDateString();
    return records.filter((record) => new Date(record.createdAt).toDateString() === todayKey);
  }
  const days = RANGES.find((item) => item.value === range)?.days ?? null;
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

const styles = createThemedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  content: { paddingTop: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  card: { marginTop: spacing.md, overflow: 'hidden', borderRadius: 12, backgroundColor: colors.sheet },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 16, backgroundColor: colors.lineSoft },
  statRow: { minHeight: 46, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statLabel: { color: colors.inkSoft, fontSize: typography.size.body },
  statValue: { color: colors.ink, fontSize: typography.size.body, fontWeight: '600' },
  sectionHeader: { marginTop: spacing.xl, marginBottom: spacing.sm, color: colors.inkFaint, fontSize: typography.size.label },
  row: { minHeight: 60, paddingHorizontal: 16, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  rowLast: { borderBottomWidth: 0 },
  rowCopy: { minWidth: 0, flex: 1 },
  rowTitle: { color: colors.ink, fontSize: typography.size.body },
  rowDetail: { marginTop: 3, color: colors.inkFaint, fontSize: typography.size.caption },
  rowValue: { color: colors.inkSoft, fontSize: typography.size.caption },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.inkFaint },
  dotOk: { backgroundColor: colors.life },
  dotWarn: { backgroundColor: colors.danger },
  dotMuted: { backgroundColor: colors.sun },
  emptyRow: { padding: 16 },
  footer: { marginTop: spacing.lg, color: colors.inkFaint, fontSize: typography.size.label, lineHeight: 18 },
}));
