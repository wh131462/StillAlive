import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { useKnowledge } from '../../application/knowledge/knowledge-provider';
import { ToolPageHeader, ToolPageHeaderTextAction } from '../../shared/components/tool-page-header';
import { feedback } from '../../shared/feedback';
import { createThemedStyles } from '../../shared/theme/app-theme';
import { formatRelativeTime } from './ai-copy';

export default function AiMemoryScreen() {
  const router = useRouter();
  const knowledge = useKnowledge();
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<'all' | 'user' | 'auto' | 'hidden'>('all');
  const refreshMemories = knowledge.refreshMemories;

  useEffect(() => {
    void refreshMemories().catch(() => undefined);
  }, [refreshMemories]);
  useFocusEffect(useCallback(() => { void refreshMemories().catch(() => undefined); }, [refreshMemories]));

  const active = knowledge.memories.filter((item) => item.status === 'active' && item.validTo === null);
  const hidden = knowledge.memories.filter((item) => item.status === 'archived' || item.status === 'suppressed');
  const visible = filter === 'hidden'
    ? hidden
    : active.filter((item) => filter === 'all' || (filter === 'user' ? item.origin === 'user' : item.origin === 'ai_auto'));
  const archivedCount = knowledge.memories.filter((item) => item.status === 'archived' || item.status === 'suppressed').length;
  const autoCount = active.filter((item) => item.origin === 'ai_auto').length;

  const forget = useCallback((memoryId: string, content: string) => {
    feedback.alert('遗忘这条记忆？', `“${content.slice(0, 40)}${content.length > 40 ? '…' : ''}”\n\n遗忘后不会再被检索；原始记录不受影响。`, [
      { text: '取消', style: 'cancel' },
      { text: '遗忘', style: 'destructive', onPress: () => void knowledge.forgetMemory(memoryId).then(() => feedback.notice('已遗忘这条记忆')).catch((cause: unknown) => feedback.alert('遗忘失败', cause instanceof Error ? cause.message : '请稍后重试')) },
    ]);
  }, [knowledge]);

  const suppress = useCallback((memoryId: string) => {
    void knowledge.suppressMemory(memoryId).then(() => feedback.notice('已设为永不提及')).catch((cause: unknown) => feedback.alert('设置失败', cause instanceof Error ? cause.message : '请稍后重试'));
  }, [knowledge]);

  const undoAuto = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const count = await knowledge.undoAutoMemories();
      if (count > 0) feedback.notice(`已撤销 ${count} 条自动记忆`);
      else feedback.notice('没有可撤销的自动记忆');
    } catch (cause) {
      feedback.alert('撤销失败', cause instanceof Error ? cause.message : '请稍后重试');
    } finally {
      setBusy(false);
    }
  }, [busy, knowledge]);

  const clearAll = useCallback(() => {
    feedback.alert('清空全部记忆？', '只删除本机记忆，日记、人物和其它记录不受影响。清空后无法恢复。', [
      { text: '取消', style: 'cancel' },
      { text: '清空', style: 'destructive', onPress: () => void knowledge.clearMemories().then(() => feedback.notice('已清空记忆')).catch((cause: unknown) => feedback.alert('清空失败', cause instanceof Error ? cause.message : '请稍后重试')) },
    ]);
  }, [knowledge]);

  return <SafeAreaView style={styles.safeArea}>
    <ToolPageHeader onBack={() => router.back()} right={<ToolPageHeaderTextAction accessibilityLabel="清空记忆" label="清空" onPress={clearAll} />} title="记忆" />
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.introCard}>
        <Text style={styles.eyebrow}>MEMORY / LOCAL</Text>
        <Text style={styles.introTitle}>Agent 记得的事</Text>
        <Text style={styles.introText}>记忆由你的问答与记录自动整理，全部保存在本机；每条都能找到来源记录，也可以随时遗忘。自动记忆不会覆盖你手动写下的内容。</Text>
      </View>

      <View style={styles.group}>
        <SwitchRow checked={knowledge.memoryEnabled} hint="关闭后不再读取或写入任何记忆" label="启用记忆" onPress={() => void knowledge.setMemoryEnabled(!knowledge.memoryEnabled).then(() => feedback.notice(!knowledge.memoryEnabled ? '已启用记忆' : '已关闭记忆')).catch(() => feedback.alert('设置失败', '请稍后重试'))} />
        <View style={styles.separator} />
        <SwitchRow checked={knowledge.autoExtract} hint="每次问答后自动整理，可能多一次模型调用" label="自动记忆" onPress={() => void knowledge.setAutoExtract(!knowledge.autoExtract).then(() => feedback.notice(!knowledge.autoExtract ? '已开启自动记忆' : '已关闭自动记忆')).catch(() => feedback.alert('设置失败', '请稍后重试'))} />
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryEyebrow}>ACTIVE MEMORY</Text>
        <Text style={styles.summaryValue}>{active.length}</Text>
        <Text style={styles.summaryLabel}>条生效记忆 · 自动整理 {autoCount} 条{archivedCount ? ` · 已归档 ${archivedCount} 条` : ''}</Text>
      </View>

      <View style={styles.actionRow}>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void undoAuto()} style={({ pressed }) => [styles.actionButton, busy && styles.disabled, pressed && styles.pressed]}><Text style={styles.actionText}>撤销最近自动记忆</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => void knowledge.refreshMemories().then(() => feedback.notice('已刷新')).catch(() => feedback.alert('刷新失败', '请稍后重试'))} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}><Text style={styles.actionText}>刷新</Text></Pressable>
      </View>

      <View style={styles.filterRow}>
        {([['all', '全部'], ['user', '手写'], ['auto', '自动'], ['hidden', '已隐藏']] as const).map(([value, label]) => <Pressable accessibilityRole="button" accessibilityState={{ selected: filter === value }} key={value} onPress={() => setFilter(value)} style={({ pressed }) => [styles.filterChip, filter === value && styles.filterChipActive, pressed && styles.pressed]}><Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{label}{value === 'all' ? ` ${active.length}` : value === 'user' ? ` ${active.filter((item) => item.origin === 'user').length}` : value === 'auto' ? ` ${autoCount}` : ` ${hidden.length}`}</Text></Pressable>)}
      </View>

      <Text style={styles.sectionLabel}>{filter === 'hidden' ? '已隐藏的记忆（可恢复）' : '生效中的记忆'}</Text>
      {!visible.length ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>{filter === 'hidden' ? '没有隐藏的记忆' : '还没有记忆'}</Text><Text style={styles.emptyText}>{filter === 'hidden' ? '遗忘或永不提及的记忆会出现在这里，可以随时恢复。' : '在 AI 对话里多聊几次，或在记录上点“记住这件事”，这里会慢慢长出属于你的记忆。'}</Text></View>
        : visible.map((item) => <View key={item.id} style={styles.memoryRow}>
          <View style={styles.memoryHead}>
            <Text style={styles.memoryOrigin}>{item.origin === 'user' ? '手写' : item.origin === 'derived' ? '整理' : '自动'}{item.kind === 'episodic' ? ' · 经历' : item.kind === 'procedural' ? ' · 偏好' : ' · 事实'}{item.status === 'suppressed' ? ' · 永不提及' : item.status === 'archived' ? ' · 已归档' : ''}</Text>
            <Text style={styles.memoryTime}>{formatRelativeTime(item.lastConfirmedAt ?? item.createdAt)}{item.useCount ? ` · 用过 ${item.useCount} 次` : ''}</Text>
          </View>
          <Text style={styles.memoryContent}>{item.content}</Text>
          <View style={styles.memoryActions}>
            {item.status === 'archived' || item.status === 'suppressed'
              ? <Pressable accessibilityRole="button" onPress={() => void knowledge.restoreMemory(item.id).then(() => feedback.notice('已恢复这条记忆')).catch((cause: unknown) => feedback.alert('恢复失败', cause instanceof Error ? cause.message : '请稍后重试'))} style={({ pressed }) => [styles.miniAction, pressed && styles.pressed]}><Text style={[styles.miniActionText, styles.miniActionRestore]}>恢复</Text></Pressable>
              : <Pressable accessibilityRole="button" onPress={() => suppress(item.id)} style={({ pressed }) => [styles.miniAction, pressed && styles.pressed]}><Text style={styles.miniActionText}>永不提及</Text></Pressable>}
            <Pressable accessibilityRole="button" onPress={() => forget(item.id, item.content)} style={({ pressed }) => [styles.miniAction, pressed && styles.pressed]}><Text style={styles.miniActionText}>遗忘</Text></Pressable>
          </View>
        </View>)}

      <View style={styles.footNote}><Text style={styles.footNoteText}>关闭 AI 总开关或删除全部数据会清理记忆。记忆会随备份导出；知识索引与汇总可重建，不会进入备份。</Text></View>
    </ScrollView>
  </SafeAreaView>;
}

function SwitchRow({ checked, hint, label, onPress }: { checked: boolean; hint: string; label: string; onPress(): void }) {
  return <Pressable accessibilityRole="switch" accessibilityState={{ checked }} onPress={onPress} style={styles.switchRow}><View style={styles.switchCopy}><Text style={styles.switchTitle}>{label}</Text><Text style={styles.switchHint}>{hint}</Text></View><View style={[styles.switchTrack, checked && styles.switchTrackOn]}><View style={[styles.switchThumb, checked && styles.switchThumbOn]} /></View></Pressable>;
}

const styles = createThemedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  introCard: { padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.sheet },
  eyebrow: { color: colors.life, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.2 },
  introTitle: { marginTop: spacing.sm, color: colors.ink, fontFamily: typography.display, fontSize: 24 },
  introText: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: typography.size.body, lineHeight: 22 },
  group: { marginTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.lineSoft },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: spacing.md, backgroundColor: colors.lineSoft },
  switchRow: { minHeight: 76, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center' },
  switchCopy: { minWidth: 0, flex: 1 },
  switchTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  switchHint: { marginTop: 5, color: colors.inkFaint, fontSize: typography.size.meta, lineHeight: 16 },
  switchTrack: { width: 44, height: 26, marginLeft: spacing.md, padding: 2, borderRadius: 13, backgroundColor: colors.line },
  switchTrackOn: { backgroundColor: colors.life },
  switchThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.paper },
  switchThumbOn: { alignSelf: 'flex-end' },
  summaryCard: { marginTop: spacing.lg, paddingVertical: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft },
  summaryEyebrow: { color: colors.life, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.2 },
  summaryValue: { marginTop: spacing.sm, color: colors.ink, fontFamily: typography.display, fontSize: 38 },
  summaryLabel: { marginTop: 4, color: colors.inkFaint, fontSize: typography.size.meta },
  actionRow: { marginTop: spacing.md, flexDirection: 'row', gap: spacing.lg },
  actionButton: { minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: colors.life, fontSize: typography.size.caption, fontWeight: '700' },
  filterRow: { marginTop: spacing.lg, flexDirection: 'row', gap: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  filterChip: { minHeight: 38, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  filterChipActive: { borderBottomColor: colors.life },
  filterText: { color: colors.inkFaint, fontSize: typography.size.meta },
  filterTextActive: { color: colors.life, fontWeight: '700' },
  sectionLabel: { marginTop: spacing.lg, marginBottom: spacing.sm, color: colors.inkFaint, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.2 },
  emptyCard: { paddingVertical: spacing.xl },
  emptyTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  emptyText: { marginTop: spacing.sm, color: colors.inkFaint, fontSize: typography.size.meta, lineHeight: 18 },
  memoryRow: { paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  memoryHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  memoryOrigin: { color: colors.life, fontSize: typography.size.meta, fontWeight: '800' },
  memoryTime: { color: colors.inkFaint, fontSize: typography.size.meta },
  memoryContent: { marginTop: spacing.sm, color: colors.ink, fontFamily: typography.display, fontSize: 15, lineHeight: 25 },
  memoryActions: { marginTop: spacing.sm, flexDirection: 'row', gap: spacing.lg },
  miniAction: { minHeight: 30, alignItems: 'center', justifyContent: 'center' },
  miniActionText: { color: colors.inkFaint, fontSize: typography.size.caption, fontWeight: '600' },
  miniActionRestore: { color: colors.life },
  footNote: { marginTop: spacing.xl, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  footNoteText: { color: colors.inkFaint, fontSize: typography.size.meta, lineHeight: 18 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
}));
