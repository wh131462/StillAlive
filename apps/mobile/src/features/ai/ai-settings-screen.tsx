import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { useAi } from '../../application/ai/ai-provider';
import { useKnowledge } from '../../application/knowledge/knowledge-provider';
import type { KnowledgeStats } from '../../features/ai/domain/knowledge-types';
import type { AiModelOption } from '../../infrastructure/ai/ai-types';
import { DraggableBottomSheet } from '../../shared/components/draggable-bottom-sheet';
import type { AiProviderProfile } from '../../infrastructure/ai/ai-types';
import { ToolPageHeader } from '../../shared/components/tool-page-header';
import { feedback } from '../../shared/feedback';
import { createThemedStyles } from '../../shared/theme/app-theme';
import { AiProviderFormSheet } from './ai-provider-form-sheet';
import { aiErrorMessage, formatBalance, formatRelativeTime, providerStatusText, providerSubtitle } from './ai-copy';

export default function AiSettingsScreen() {
  const router = useRouter();
  const { enabled, providers, loading, setEnabled, deleteProvider, setDefaultProvider, detectProvider, getBalance, listModels, createProvider, updateProvider, refresh } = useAi();
  const knowledge = useKnowledge();
  const refreshKnowledgeStats = knowledge.stats;
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AiProviderProfile | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [knowledgeStats, setKnowledgeStats] = useState<KnowledgeStats | null>(null);
  const [modelPicker, setModelPicker] = useState<{ providerId: string; models: AiModelOption[] } | null>(null);

  useFocusEffect(useCallback(() => { void refresh().catch(() => undefined); }, [refresh]));
  useFocusEffect(useCallback(() => {
    void refreshKnowledgeStats().then(setKnowledgeStats).catch(() => undefined);
  }, [refreshKnowledgeStats]));

  const indexKnowledge = useCallback(async () => {
    if (busy) return;
    setBusy('index');
    try {
      const result = await knowledge.ensureIndexed();
      setKnowledgeStats(await knowledge.stats());
      feedback.notice(`已整理 ${result.indexed} 个来源、${result.aggregates} 个汇总`);
    } catch (cause) {
      feedback.alert('整理失败', aiErrorMessage(cause));
    } finally {
      setBusy(null);
    }
  }, [busy, knowledge]);

  const toggleEnabled = async (next: boolean) => {
    try {
      await setEnabled(next);
      feedback.notice(next ? '已启用 AI 功能' : '已关闭 AI 功能，所有 AI 入口已隐藏');
    } catch (cause) {
      feedback.alert('设置失败', aiErrorMessage(cause));
    }
  };

  const runDetect = useCallback(async (profile: AiProviderProfile) => {
    if (busy) return;
    setBusy(`detect:${profile.id}`);
    try {
      const result = await detectProvider(profile.id);
      if (result.status === 'ok') feedback.notice(result.message);
      else feedback.alert('检测未通过', result.message);
    } catch (cause) {
      feedback.alert('检测失败', aiErrorMessage(cause));
    } finally {
      setBusy(null);
    }
  }, [busy, detectProvider]);

  const runBalance = useCallback(async (profile: AiProviderProfile) => {
    if (busy) return;
    if (!profile.supportsBalance) {
      feedback.alert('该服务商不提供余额查询', '请到服务商控制台查看余额；本机只统计 token 用量。');
      return;
    }
    setBusy(`balance:${profile.id}`);
    try {
      const balance = await getBalance(profile.id);
      if (balance) feedback.alert('账户余额', formatBalance(balance));
      else feedback.alert('暂时无法查询余额', '服务商没有返回余额信息，请稍后再试。');
    } catch (cause) {
      feedback.alert('余额查询失败', aiErrorMessage(cause));
    } finally {
      setBusy(null);
    }
  }, [busy, getBalance]);

  const chooseModel = useCallback(async (profile: AiProviderProfile) => {
    if (busy) return;
    setBusy(`models:${profile.id}`);
    try {
      const models = await listModels(profile.id);
      if (!models.length) {
        feedback.alert('没有可用模型', '服务商没有返回模型列表，可以直接手动填写模型名。');
        return;
      }
      setModelPicker({ providerId: profile.id, models });
    } catch (cause) {
      feedback.alert('获取模型失败', aiErrorMessage(cause));
    } finally {
      setBusy(null);
    }
  }, [busy, listModels]);

  const confirmDelete = (profile: AiProviderProfile) => {
    feedback.alert(`删除 ${profile.label}？`, '会同时删除本机保存的 API Key；用量历史会保留。', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => void deleteProvider(profile.id).then(() => feedback.notice('已删除服务商与 Key')).catch((cause: unknown) => feedback.alert('删除失败', aiErrorMessage(cause))) },
    ]);
  };

  const makeDefault = (profile: AiProviderProfile) => {
    void setDefaultProvider(profile.id).then(() => feedback.notice(`已将 ${profile.label} 设为默认`)).catch((cause: unknown) => feedback.alert('设置失败', aiErrorMessage(cause)));
  };

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (profile: AiProviderProfile) => { setEditing(profile); setFormOpen(true); };

  return <SafeAreaView style={styles.safeArea}>
    <ToolPageHeader onBack={() => router.back()} title="AI 助手" />
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.introCard}>
        <Text style={styles.eyebrow}>OPTIONAL / LOCAL FIRST</Text>
        <Text style={styles.introTitle}>AI 是可选项</Text>
        <Text style={styles.introText}>关闭时不会发出任何 AI 请求，其它功能不受影响。API Key 只保存在本机安全存储，不进入备份；对话内容只在你主动发起时发送给你选择的服务商。</Text>
      </View>

      <View style={styles.group}>
        <SwitchRow checked={enabled} label="启用 AI 功能" hint={enabled ? '底部 AI 按钮与所有 AI 入口可见；请求只在点击后发出' : '关闭后底部 AI 按钮与所有 AI 入口隐藏，不会发起请求'} onPress={() => void toggleEnabled(!enabled)} />
      </View>

      <Text style={styles.sectionLabel}>服务商</Text>
      {!providers.length ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>{loading ? '正在读取…' : '还没有服务商'}</Text><Text style={styles.emptyText}>添加一个服务商并检测连接后即可使用。支持 DeepSeek、OpenAI 兼容地址和 Anthropic。</Text></View> : providers.map((profile) => {
        const status = providerStatusText(profile);
        return <View key={profile.id} style={styles.providerCard}>
          <View style={styles.providerHead}>
            <View style={styles.providerCopy}>
              <View style={styles.providerTitleRow}>
                <Text numberOfLines={1} style={styles.providerTitle}>{profile.label}</Text>
                {profile.isDefault ? <Text style={styles.defaultBadge}>默认</Text> : null}
              </View>
              <Text numberOfLines={1} style={styles.providerSubtitle}>{providerSubtitle(profile)}</Text>
              <View style={styles.providerStatusRow}>
                <View style={[styles.statusDot, status.tone === 'ok' && styles.statusDotOk, status.tone === 'warn' && styles.statusDotWarn]} />
                <Text numberOfLines={1} style={[styles.providerStatus, status.tone === 'warn' && styles.providerStatusWarn]}>{status.text}{profile.lastProbeAt ? ` · ${formatRelativeTime(profile.lastProbeAt)}` : ''}</Text>
              </View>
            </View>
          </View>
          <View style={styles.providerActions}>
            <CardAction disabled={!enabled || busy !== null} label={busy === `detect:${profile.id}` ? '检测中…' : '检测'} onPress={() => void runDetect(profile)} />
            <CardAction disabled={!enabled || busy !== null} label={busy === `balance:${profile.id}` ? '查询中…' : '余额'} onPress={() => void runBalance(profile)} />
            <CardAction disabled={!enabled || busy !== null} label="模型" onPress={() => void chooseModel(profile)} />
            <CardAction label="编辑" onPress={() => openEdit(profile)} />
            {profile.isDefault ? null : <CardAction label="设为默认" onPress={() => makeDefault(profile)} />}
            <CardAction danger label="删除" onPress={() => confirmDelete(profile)} />
          </View>
        </View>;
      })}
      {!enabled ? <Text style={styles.disabledHint}>启用 AI 功能后才能添加、检测与查询余额。</Text> : null}
      <Pressable accessibilityRole="button" disabled={!enabled} onPress={openCreate} style={({ pressed }) => [styles.addButton, !enabled && styles.disabled, pressed && styles.pressed]}>
        <Text style={styles.addButtonText}>＋ 添加服务商</Text>
      </Pressable>

      <Text style={styles.sectionLabel}>用量</Text>
      <Pressable accessibilityRole="button" onPress={() => router.push('/ai-usage' as RelativePathString)} style={({ pressed }) => [styles.usageCard, pressed && styles.pressed]}>
        <View>
          <Text style={styles.usageTitle}>用量统计</Text>
          <Text style={styles.usageHint}>本机记录请求数、token 与耗时；费用与余额以服务商为准。</Text>
        </View>
        <Text style={styles.usageChevron}>›</Text>
      </Pressable>

      <Text style={styles.sectionLabel}>知识库与记忆</Text>
      <View style={styles.usageCard}>
        <View style={styles.knowledgeCopy}>
          <Text style={styles.usageTitle}>本机知识库</Text>
          <Text style={styles.usageHint}>{knowledgeStats?.backfillDone ? `已整理 ${knowledgeStats.chunks} 个片段 · ${knowledgeStats.aggregates} 个汇总
上次整理 ${knowledge.lastIndexedAt ? formatRelativeTime(knowledge.lastIndexedAt) : '—'}` : '尚未整理；首次问答会自动整理本机记录'}</Text>
        </View>
        <Pressable accessibilityRole="button" disabled={busy !== null} onPress={() => void indexKnowledge()} style={({ pressed }) => [styles.smallButton, busy !== null && styles.disabled, pressed && styles.pressed]}><Text style={styles.smallButtonText}>{knowledge.indexing ? '整理中…' : '立即整理'}</Text></Pressable>
      </View>
      {enabled ? <>
        <Pressable accessibilityRole="button" onPress={() => router.push('/ai' as RelativePathString)} style={({ pressed }) => [styles.linkCard, pressed && styles.pressed]}><View><Text style={styles.usageTitle}>AI 对话</Text><Text style={styles.usageHint}>完整对话与记忆回溯；日常更推荐从底部 AI 按钮进入</Text></View><Text style={styles.usageChevron}>›</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push('/ai-memory' as RelativePathString)} style={({ pressed }) => [styles.linkCard, pressed && styles.pressed]}><View><Text style={styles.usageTitle}>记忆</Text><Text style={styles.usageHint}>{knowledge.memories.filter((item) => item.status === 'active').length} 条生效 · 自动整理{knowledge.autoExtract ? '已开启' : '已关闭'}</Text></View><Text style={styles.usageChevron}>›</Text></Pressable>
      </> : null}

      <View style={styles.footNote}><Text style={styles.footNoteText}>关闭 AI 或删除全部数据会清理本机保存的 Key。服务商价格与余额可能变化，估算值不能替代账单。</Text></View>
    </ScrollView>
    <DraggableBottomSheet accessibilityLabel="选择模型" onClose={() => setModelPicker(null)} open={Boolean(modelPicker)} sheetStyle={styles.modelSheet}>
      <Text style={styles.modelSheetTitle}>选择模型</Text>
      <Text style={styles.modelSheetHint}>来自服务商当前返回的模型列表</Text>
      <ScrollView style={styles.modelList} showsVerticalScrollIndicator={false}>
        {(modelPicker?.models ?? []).map((model) => {
          const provider = providers.find((item) => item.id === modelPicker?.providerId);
          const selected = provider?.modelId === model.id;
          return <Pressable accessibilityRole="button" accessibilityState={{ selected }} key={model.id} onPress={() => {
            if (!provider) return;
            void updateProvider(provider.id, { kind: provider.kind, label: provider.label, baseUrl: provider.baseUrl, modelId: model.id })
              .then(() => { feedback.notice(`已选择 ${model.id}`); setModelPicker(null); })
              .catch((cause: unknown) => feedback.alert('保存模型失败', aiErrorMessage(cause)));
          }} style={({ pressed }) => [styles.modelRow, pressed && styles.pressed]}><Text numberOfLines={1} style={[styles.modelName, selected && styles.modelNameSelected]}>{model.id}</Text>{selected ? <Text style={styles.modelSelected}>当前</Text> : null}</Pressable>;
        })}
      </ScrollView>
      <Pressable accessibilityRole="button" onPress={() => setModelPicker(null)} style={({ pressed }) => [styles.modelCancel, pressed && styles.pressed]}><Text style={styles.modelCancelText}>取消</Text></Pressable>
    </DraggableBottomSheet>
    <AiProviderFormSheet
      editing={editing}
      onClose={() => setFormOpen(false)}
      onSubmit={async (input) => {
        if (editing) {
          await updateProvider(editing.id, input);
          feedback.notice('服务商已更新');
          return;
        }
        const created = await createProvider(input);
        void runDetect(created);
      }}
      open={formOpen}
    />
  </SafeAreaView>;
}

function SwitchRow({ checked, hint, label, onPress }: { checked: boolean; hint: string; label: string; onPress(): void }) {
  return <Pressable accessibilityRole="switch" accessibilityState={{ checked }} onPress={onPress} style={styles.switchRow}><View style={styles.switchCopy}><Text style={styles.switchTitle}>{label}</Text><Text style={styles.switchHint}>{hint}</Text></View><View style={[styles.switchTrack, checked && styles.switchTrackOn]}><View style={[styles.switchThumb, checked && styles.switchThumbOn]} /></View></Pressable>;
}

function CardAction({ danger = false, disabled = false, label, onPress }: { danger?: boolean; disabled?: boolean; label: string; onPress(): void }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.cardAction, disabled && styles.disabled, pressed && styles.pressed]}><Text style={[styles.cardActionText, danger && styles.cardActionDanger]}>{label}</Text></Pressable>;
}

const styles = createThemedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  introCard: { paddingVertical: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  eyebrow: { color: colors.life, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.2 },
  introTitle: { marginTop: spacing.sm, color: colors.ink, fontFamily: typography.display, fontSize: 26 },
  introText: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: typography.size.body, lineHeight: 22 },
  group: { marginTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.lineSoft },
  sectionLabel: { marginTop: spacing.xl, marginBottom: spacing.sm, color: colors.inkFaint, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.2 },
  emptyCard: { paddingVertical: spacing.xl },
  emptyTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  emptyText: { marginTop: spacing.sm, color: colors.inkFaint, fontSize: typography.size.meta, lineHeight: 18 },
  providerCard: { paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  providerHead: { flexDirection: 'row', alignItems: 'flex-start' },
  providerCopy: { minWidth: 0, flex: 1 },
  providerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  providerTitle: { maxWidth: '74%', color: colors.ink, fontFamily: typography.display, fontSize: 17 },
  defaultBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.sm, overflow: 'hidden', color: colors.life, backgroundColor: colors.lifeLight, fontSize: 10, fontWeight: '800' },
  providerSubtitle: { marginTop: 4, color: colors.inkSoft, fontSize: typography.size.meta },
  providerStatusRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 6, height: 6, marginRight: 5, borderRadius: 3, backgroundColor: colors.inkFaint },
  statusDotOk: { backgroundColor: colors.life },
  statusDotWarn: { backgroundColor: colors.sun },
  providerStatus: { flex: 1, color: colors.inkFaint, fontSize: typography.size.meta },
  providerStatusWarn: { color: colors.danger },
  providerActions: { marginTop: spacing.sm, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  cardAction: { minHeight: 30, alignItems: 'center', justifyContent: 'center' },
  cardActionText: { color: colors.life, fontSize: typography.size.meta, fontWeight: '700' },
  cardActionDanger: { color: colors.danger },
  addButton: { minHeight: 46, marginTop: spacing.md, alignItems: 'center', justifyContent: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft },
  addButtonText: { color: colors.life, fontSize: typography.size.caption, fontWeight: '800' },
  disabledHint: { marginTop: spacing.sm, color: colors.inkFaint, fontSize: typography.size.meta, lineHeight: 17 },
  usageCard: { paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  usageTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  usageHint: { marginTop: 5, color: colors.inkFaint, fontSize: typography.size.meta, lineHeight: 17 },
  usageChevron: { marginLeft: spacing.md, color: colors.inkFaint, fontSize: 24 },
  knowledgeCopy: { minWidth: 0, flex: 1 },
  smallButton: { marginLeft: spacing.md, minHeight: 34, paddingHorizontal: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  smallButtonText: { color: colors.life, fontSize: typography.size.caption, fontWeight: '800' },
  linkCard: { paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  footNote: { marginTop: spacing.xl, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  footNoteText: { color: colors.inkFaint, fontSize: typography.size.meta, lineHeight: 18 },
  switchRow: { minHeight: 76, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center' },
  switchCopy: { minWidth: 0, flex: 1 },
  switchTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  switchHint: { marginTop: 5, color: colors.inkFaint, fontSize: typography.size.meta, lineHeight: 16 },
  switchTrack: { width: 44, height: 26, marginLeft: spacing.md, padding: 2, borderRadius: 13, backgroundColor: colors.line },
  switchTrackOn: { backgroundColor: colors.life },
  switchThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.paper },
  switchThumbOn: { alignSelf: 'flex-end' },
  modelSheet: { paddingBottom: spacing.xl },
  modelSheetTitle: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, color: colors.ink, fontFamily: typography.display, fontSize: 22 },
  modelSheetHint: { paddingHorizontal: spacing.lg, marginTop: 5, marginBottom: spacing.sm, color: colors.inkFaint, fontSize: typography.size.meta },
  modelList: { maxHeight: 340 },
  modelRow: { minHeight: 48, marginHorizontal: spacing.lg, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  modelName: { flex: 1, color: colors.ink, fontSize: typography.size.body },
  modelNameSelected: { color: colors.life, fontWeight: '700' },
  modelSelected: { marginLeft: spacing.md, color: colors.life, fontSize: typography.size.meta, fontWeight: '700' },
  modelCancel: { minHeight: 46, marginTop: spacing.md, marginHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.paper },
  modelCancelText: { color: colors.inkSoft, fontSize: typography.size.caption, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
}));
