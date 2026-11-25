import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { colors, spacing, typography } from '@still-alive/tokens';
import { useKnowledge } from '../../application/knowledge/knowledge-provider';
import { ToolPageHeader, ToolPageHeaderTextAction } from '../../shared/components/tool-page-header';
import { feedback } from '../../shared/feedback';
import { createThemedStyles } from '../../shared/theme/app-theme';
import { AiSegmentedControl } from './ai-segmented-control';
import { formatRelativeTime } from './ai-copy';

type MemoryFilter = 'all' | 'user' | 'auto' | 'hidden';

const FILTERS: ReadonlyArray<{ label: string; value: MemoryFilter }> = [
  { value: 'all', label: '全部' },
  { value: 'user', label: '手写' },
  { value: 'auto', label: '自动' },
  { value: 'hidden', label: '已隐藏' },
];

export default function AiMemoryScreen() {
  const router = useRouter();
  const knowledge = useKnowledge();
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<MemoryFilter>('all');
  const refreshMemories = knowledge.refreshMemories;

  useEffect(() => {
    void refreshMemories().catch(() => undefined);
  }, [refreshMemories]);
  useFocusEffect(useCallback(() => { void refreshMemories().catch(() => undefined); }, [refreshMemories]));

  const active = knowledge.memories.filter((item) => item.status === 'active' && item.validTo === null);
  const autoActive = active.filter((item) => item.origin === 'ai_auto');
  const hidden = knowledge.memories.filter((item) => item.status === 'archived' || item.status === 'suppressed');
  const visible = filter === 'hidden'
    ? hidden
    : active.filter((item) => filter === 'all' || (filter === 'user' ? item.origin === 'user' : item.origin === 'ai_auto'));

  const forget = useCallback((memoryId: string, content: string) => {
    feedback.alert('遗忘这条记忆？', `“${content.slice(0, 40)}${content.length > 40 ? '…' : ''}”\n\n遗忘后不会再被检索；原始记录不受影响。`, [
      { text: '取消', style: 'cancel' },
      { text: '遗忘', style: 'destructive', onPress: () => void knowledge.forgetMemory(memoryId).then(() => feedback.notice('已遗忘这条记忆')).catch((cause: unknown) => feedback.alert('遗忘失败', cause instanceof Error ? cause.message : '请稍后重试')) },
    ]);
  }, [knowledge]);

  const suppress = useCallback((memoryId: string) => {
    void knowledge.suppressMemory(memoryId).then(() => feedback.notice('已设为永不提及')).catch((cause: unknown) => feedback.alert('设置失败', cause instanceof Error ? cause.message : '请稍后重试'));
  }, [knowledge]);

  const restore = useCallback((memoryId: string) => {
    void knowledge.restoreMemory(memoryId).then(() => feedback.notice('已恢复这条记忆')).catch((cause: unknown) => feedback.alert('恢复失败', cause instanceof Error ? cause.message : '请稍后重试'));
  }, [knowledge]);

  const undoAuto = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const count = await knowledge.undoAutoMemories();
      feedback.notice(count > 0 ? `已撤销 ${count} 条自动记忆` : '没有可撤销的自动记忆');
    } catch (cause) {
      feedback.alert('撤销失败', cause instanceof Error ? cause.message : '请稍后重试');
    } finally {
      setBusy(false);
    }
  }, [busy, knowledge]);

  const cleanupAuto = useCallback(() => {
    if (busy || !autoActive.length) return;
    feedback.alert('清理自动整理的记忆？', `将遗忘 ${autoActive.length} 条自动记忆，手写记忆保留；清理后可在“已隐藏”里逐条恢复。`, [
      { text: '取消', style: 'cancel' },
      { text: '清理', style: 'destructive', onPress: () => {
        setBusy(true);
        void (async () => {
          try {
            for (const item of autoActive) await knowledge.forgetMemory(item.id);
            feedback.notice(`已清理 ${autoActive.length} 条自动记忆`);
          } catch (cause) {
            feedback.alert('清理失败', cause instanceof Error ? cause.message : '请稍后重试');
          } finally {
            setBusy(false);
          }
        })();
      } },
    ]);
  }, [autoActive, busy, knowledge]);

  const clearAll = useCallback(() => {
    feedback.alert('清空全部记忆？', '只删除本机记忆，日记、人物和其它记录不受影响。清空后无法恢复。', [
      { text: '取消', style: 'cancel' },
      { text: '清空', style: 'destructive', onPress: () => void knowledge.clearMemories().then(() => feedback.notice('已清空记忆')).catch((cause: unknown) => feedback.alert('清空失败', cause instanceof Error ? cause.message : '请稍后重试')) },
    ]);
  }, [knowledge]);

  return <SafeAreaView style={styles.safeArea}>
    <ToolPageHeader onBack={() => router.back()} right={<ToolPageHeaderTextAction accessibilityLabel="清空记忆" label="清空" onPress={clearAll} />} title="记忆" />
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <SwitchRow checked={knowledge.memoryEnabled} label="启用记忆" onPress={() => void knowledge.setMemoryEnabled(!knowledge.memoryEnabled).catch(() => feedback.alert('设置失败', '请稍后重试'))} />
        <View style={styles.separator} />
        <SwitchRow checked={knowledge.autoExtract} label="自动记忆" onPress={() => void knowledge.setAutoExtract(!knowledge.autoExtract).catch(() => feedback.alert('设置失败', '请稍后重试'))} />
        <View style={styles.separator} />
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void undoAuto()} style={({ pressed }) => [styles.actionRow, busy && styles.disabled, pressed && styles.pressed]}>
          <Text style={styles.actionRowText}>撤销最近的自动记忆</Text>
          {busy ? <ActivityIndicator color={colors.inkFaint} size="small" /> : null}
        </Pressable>
        {autoActive.length ? <>
          <View style={styles.separator} />
          <Pressable accessibilityRole="button" disabled={busy} onPress={cleanupAuto} style={({ pressed }) => [styles.actionRow, busy && styles.disabled, pressed && styles.pressed]}>
            <Text style={styles.actionRowText}>清理 {autoActive.length} 条自动记忆</Text>
          </Pressable>
        </> : null}
      </View>
      <Text style={styles.footer}>关闭后不再读写记忆；自动记忆只在原文能验证时才会写入，会多两次模型调用。</Text>

      <View style={styles.filterBar}>
        <AiSegmentedControl onChange={(next) => setFilter(next)} options={FILTERS} value={filter} />
      </View>

      <Text style={styles.sectionHeader}>{filter === 'hidden' ? '已隐藏' : '生效中'} · {visible.length} 条</Text>
      <View style={styles.card}>
        {visible.length ? visible.map((item, index) => <View key={item.id} style={[styles.memoryRow, index === visible.length - 1 && styles.memoryRowLast]}>
          <Text style={styles.memoryMeta}>
            {item.origin === 'user' ? '手写' : item.origin === 'derived' ? '整理' : '自动'}
            {item.kind === 'episodic' ? ' · 经历' : item.kind === 'procedural' ? ' · 偏好' : ' · 事实'}
            {item.status === 'suppressed' ? ' · 永不提及' : item.status === 'archived' ? ' · 已归档' : ''}
            {' · '}{formatRelativeTime(item.lastConfirmedAt ?? item.createdAt)}
          </Text>
          <Text selectable style={styles.memoryContent}>{item.content}</Text>
          <View style={styles.memoryActions}>
            {item.status === 'archived' || item.status === 'suppressed'
              ? <Pressable accessibilityRole="button" hitSlop={8} onPress={() => restore(item.id)}><Text style={[styles.memoryAction, styles.memoryActionRestore]}>恢复</Text></Pressable>
              : <Pressable accessibilityRole="button" hitSlop={8} onPress={() => suppress(item.id)}><Text style={styles.memoryAction}>永不提及</Text></Pressable>}
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => forget(item.id, item.content)}><Text style={[styles.memoryAction, styles.memoryActionDanger]}>遗忘</Text></Pressable>
          </View>
        </View>) : <View style={styles.emptyRow}>
          <Text style={styles.emptyTitle}>{filter === 'hidden' ? '没有隐藏的记忆' : '还没有记忆'}</Text>
          <Text style={styles.emptyText}>{filter === 'hidden' ? '遗忘或永不提及的记忆会出现在这里，可以随时恢复。' : '在 AI 问答里多聊几次，或是在记录上点“记住这件事”，这里会慢慢积累。'}</Text>
        </View>}
      </View>
      <Text style={styles.footer}>关闭 AI 或删除全部数据会清理记忆。记忆会随备份导出；知识索引与汇总可重建，不会进入备份。</Text>
    </ScrollView>
  </SafeAreaView>;
}

function SwitchRow({ checked, label, onPress }: { checked: boolean; label: string; onPress(): void }) {
  return <View style={styles.switchRow}>
    <Text style={styles.switchLabel}>{label}</Text>
    <Switch
      ios_backgroundColor={colors.line}
      onValueChange={onPress}
      style={styles.switchControl}
      thumbColor={colors.paper}
      trackColor={{ false: colors.line, true: colors.life }}
      value={checked}
    />
  </View>;
}

const styles = createThemedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  content: { paddingTop: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  card: { overflow: 'hidden', borderRadius: 12, backgroundColor: colors.sheet },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 16, backgroundColor: colors.lineSoft },
  switchRow: { minHeight: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { color: colors.ink, fontSize: typography.size.bodyLarge },
  /* RN 的 iOS Switch 自带 alignSelf: 'flex-start'，必须显式覆盖才能垂直居中 */
  switchControl: { alignSelf: 'center' },
  actionRow: { minHeight: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actionRowText: { color: colors.ink, fontSize: typography.size.bodyLarge },
  footer: { marginTop: spacing.sm, color: colors.inkFaint, fontSize: typography.size.label, lineHeight: 18 },
  filterBar: { marginTop: spacing.lg },
  sectionHeader: { marginTop: spacing.xl, marginBottom: spacing.sm, color: colors.inkFaint, fontSize: typography.size.label },
  memoryRow: { paddingHorizontal: 16, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  memoryRowLast: { borderBottomWidth: 0 },
  memoryMeta: { color: colors.inkFaint, fontSize: typography.size.caption },
  memoryContent: { marginTop: 6, color: colors.ink, fontSize: typography.size.bodyLarge, lineHeight: 24 },
  memoryActions: { marginTop: spacing.sm, flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.lg },
  memoryAction: { color: colors.inkSoft, fontSize: typography.size.caption },
  memoryActionRestore: { color: colors.life, fontWeight: '600' },
  memoryActionDanger: { color: colors.danger },
  emptyRow: { padding: 16 },
  emptyTitle: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '600' },
  emptyText: { marginTop: 6, color: colors.inkFaint, fontSize: typography.size.caption, lineHeight: 18 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.6 },
}));
