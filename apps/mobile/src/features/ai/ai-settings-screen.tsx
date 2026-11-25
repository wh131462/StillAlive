import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { colors, spacing, typography } from '@still-alive/tokens';
import { useAi } from '../../application/ai/ai-provider';
import { useKnowledge } from '../../application/knowledge/knowledge-provider';
import type { KnowledgeStats } from '../../features/ai/domain/knowledge-types';
import type { AiModelOption, AiProviderProfile } from '../../infrastructure/ai/ai-types';
import { DraggableBottomSheet } from '../../shared/components/draggable-bottom-sheet';
import { ToolPageHeader } from '../../shared/components/tool-page-header';
import { feedback } from '../../shared/feedback';
import type { FeedbackButton } from '../../shared/feedback';
import { createThemedStyles } from '../../shared/theme/app-theme';
import { AiProviderFormSheet } from './ai-provider-form-sheet';
import { aiErrorMessage, formatBalance, providerStatusText, providerSubtitle } from './ai-copy';

export default function AiSettingsScreen() {
  const router = useRouter();
  const { enabled, providers, loading, usage, setEnabled, deleteProvider, setDefaultProvider, detectProvider, getBalance, listModels, createProvider, updateProvider, refresh } = useAi();
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
      feedback.notice(`已整理 ${result.indexed} 个来源`);
    } catch (cause) {
      feedback.alert('整理失败', aiErrorMessage(cause));
    } finally {
      setBusy(null);
    }
  }, [busy, knowledge]);

  const toggleEnabled = async (next: boolean) => {
    try {
      await setEnabled(next);
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
      feedback.alert('该服务商不提供余额查询', '请到服务商控制台查看余额。');
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
        feedback.alert('没有可用模型', '服务商没有返回模型列表，可以在编辑里手动填写模型名。');
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
    feedback.alert(`删除 ${profile.label}？`, '会同时删除本机保存的 API Key。', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => void deleteProvider(profile.id).catch((cause: unknown) => feedback.alert('删除失败', aiErrorMessage(cause))) },
    ]);
  };

  const makeDefault = (profile: AiProviderProfile) => {
    void setDefaultProvider(profile.id).catch((cause: unknown) => feedback.alert('设置失败', aiErrorMessage(cause)));
  };

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (profile: AiProviderProfile) => { setEditing(profile); setFormOpen(true); };

  const openProviderMenu = (profile: AiProviderProfile) => {
    const status = providerStatusText(profile);
    const actions: FeedbackButton[] = [{ text: '取消', style: 'cancel' }];
    if (enabled) {
      actions.push({ text: '检测连接', onPress: () => void runDetect(profile) });
      if (profile.supportsBalance) actions.push({ text: '查询余额', onPress: () => void runBalance(profile) });
      actions.push({ text: '选择模型', onPress: () => void chooseModel(profile) });
    }
    actions.push({ text: '编辑', onPress: () => openEdit(profile) });
    if (enabled && !profile.isDefault) actions.push({ text: '设为默认', onPress: () => makeDefault(profile) });
    actions.push({ text: '删除', style: 'destructive', onPress: () => confirmDelete(profile) });
    feedback.alert(profile.label, `${providerSubtitle(profile)}\n${status.text}`, actions);
  };

  const activeMemoryCount = knowledge.memories.filter((item) => item.status === 'active').length;
  const knowledgeDetail = knowledgeStats?.backfillDone
    ? `${knowledgeStats.chunks} 个片段 · ${knowledgeStats.aggregates} 个汇总`
    : '尚未整理，首次问答会自动整理';

  return <SafeAreaView style={styles.safeArea}>
    <ToolPageHeader onBack={() => router.back()} title="AI 助手" />
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <View style={styles.switchRow}>
          <Text style={styles.rowTitle}>启用 AI</Text>
          <Switch
            ios_backgroundColor={colors.line}
            onValueChange={(next) => void toggleEnabled(next)}
            style={styles.switchControl}
            thumbColor={colors.paper}
            trackColor={{ false: colors.line, true: colors.life }}
            value={enabled}
          />
        </View>
      </View>
      <Text style={styles.footer}>{enabled ? '底部 AI 入口可见，请求只在你发送时发出。' : '关闭后底部 AI 入口隐藏，不会发出任何请求。'}</Text>

      <Text style={styles.sectionHeader}>服务商</Text>
      <View style={styles.card}>
        {providers.map((profile) => {
          const status = providerStatusText(profile);
          return <Pressable
            accessibilityRole="button"
            key={profile.id}
            onPress={() => openProviderMenu(profile)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={styles.rowCopy}>
              <Text numberOfLines={1} style={styles.rowTitle}>{profile.label}</Text>
              <Text numberOfLines={1} style={styles.rowDetail}>{providerSubtitle(profile)}</Text>
              <Text numberOfLines={1} style={[styles.rowStatus, status.tone === 'warn' && styles.rowStatusWarn]}>{status.text}</Text>
            </View>
            {profile.isDefault ? <Text style={styles.defaultBadge}>默认</Text> : null}
            <SymbolView name={{ android: 'chevron_right', ios: 'chevron.right', web: 'chevron_right' }} size={13} tintColor={colors.inkFaint} type="hierarchical" />
          </Pressable>;
        })}
        {!providers.length ? <View style={styles.row}><Text style={styles.rowDetail}>{loading ? '正在读取…' : '还没有服务商'}</Text></View> : null}
        <Pressable
          accessibilityRole="button"
          disabled={!enabled}
          onPress={openCreate}
          style={({ pressed }) => [styles.row, styles.rowLast, !enabled && styles.disabled, pressed && styles.pressed]}
        >
          <Text style={[styles.rowTitle, styles.accent, !enabled && styles.accentDisabled]}>添加服务商</Text>
        </Pressable>
      </View>
      <Text style={styles.footer}>支持 DeepSeek、OpenAI 兼容地址与 Anthropic。Key 只保存在本机安全存储，不进入备份。</Text>

      <Text style={styles.sectionHeader}>本机数据</Text>
      <View style={styles.card}>
        <Pressable accessibilityRole="button" disabled={busy !== null} onPress={() => void indexKnowledge()} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>知识库</Text>
            <Text numberOfLines={1} style={styles.rowDetail}>{knowledgeDetail}</Text>
          </View>
          {knowledge.indexing ? <ActivityIndicator color={colors.inkFaint} size="small" /> : <Text style={styles.rowAction}>整理</Text>}
        </Pressable>
        <SettingsLink detail={`${activeMemoryCount} 条生效`} onPress={() => router.push('/ai-memory' as RelativePathString)} title="记忆" />
        <SettingsLink detail={usage.length ? `${usage.length} 次请求` : '还没有记录'} last onPress={() => router.push('/ai-usage' as RelativePathString)} title="用量" />
      </View>
      <Text style={styles.footer}>费用与余额以服务商账单为准，估算值不能替代账单。</Text>
    </ScrollView>

    <DraggableBottomSheet accessibilityLabel="选择模型" onClose={() => setModelPicker(null)} open={Boolean(modelPicker)} sheetStyle={styles.modelSheet}>
      <Text style={styles.modelSheetTitle}>选择模型</Text>
      <ScrollView style={styles.modelList} showsVerticalScrollIndicator={false}>
        {(modelPicker?.models ?? []).map((model) => {
          const provider = providers.find((item) => item.id === modelPicker?.providerId);
          const selected = provider?.modelId === model.id;
          return <Pressable accessibilityRole="button" accessibilityState={{ selected }} key={model.id} onPress={() => {
            if (!provider) return;
            void updateProvider(provider.id, { kind: provider.kind, label: provider.label, baseUrl: provider.baseUrl, modelId: model.id })
              .then(() => { feedback.notice(`已选择 ${model.id}`); setModelPicker(null); })
              .catch((cause: unknown) => feedback.alert('保存模型失败', aiErrorMessage(cause)));
          }} style={({ pressed }) => [styles.modelRow, pressed && styles.pressed]}>
            <Text numberOfLines={1} style={styles.modelName}>{model.id}</Text>
            {selected ? <Text style={styles.modelSelected}>当前</Text> : null}
          </Pressable>;
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

function SettingsLink({ detail, last = false, onPress, title }: { detail: string; last?: boolean; onPress(): void; title: string }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, last && styles.rowLast, pressed && styles.pressed]}>
    <View style={styles.rowCopy}>
      <Text style={styles.rowTitle}>{title}</Text>
      <Text numberOfLines={1} style={styles.rowDetail}>{detail}</Text>
    </View>
    <SymbolView name={{ android: 'chevron_right', ios: 'chevron.right', web: 'chevron_right' }} size={13} tintColor={colors.inkFaint} type="hierarchical" />
  </Pressable>;
}

const styles = createThemedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  content: { paddingTop: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  card: { overflow: 'hidden', borderRadius: 12, backgroundColor: colors.sheet },
  sectionHeader: { marginTop: spacing.xl, marginBottom: spacing.sm, color: colors.inkFaint, fontSize: typography.size.label },
  footer: { marginTop: spacing.sm, color: colors.inkFaint, fontSize: typography.size.label, lineHeight: 18 },
  row: { minHeight: 52, paddingHorizontal: 16, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  rowLast: { borderBottomWidth: 0 },
  rowCopy: { minWidth: 0, flex: 1, justifyContent: 'center' },
  rowTitle: { color: colors.ink, fontSize: typography.size.bodyLarge },
  rowDetail: { marginTop: 2, color: colors.inkFaint, fontSize: typography.size.caption },
  rowStatus: { marginTop: 2, color: colors.inkSoft, fontSize: typography.size.caption },
  rowStatusWarn: { color: colors.danger },
  rowAction: { color: colors.life, fontSize: typography.size.body },
  defaultBadge: { color: colors.inkFaint, fontSize: typography.size.caption },
  switchRow: { minHeight: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchControl: { alignSelf: 'center' },
  accent: { color: colors.life },
  accentDisabled: { color: colors.inkFaint },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.6 },
  modelSheet: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  modelSheetTitle: { paddingTop: spacing.xs, paddingBottom: spacing.sm, color: colors.ink, fontSize: typography.size.title, fontWeight: '700' },
  modelList: { maxHeight: 360, flexGrow: 0 },
  modelRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  modelName: { flex: 1, color: colors.ink, fontSize: typography.size.body },
  modelSelected: { marginLeft: spacing.md, color: colors.life, fontSize: typography.size.caption },
  modelCancel: { marginTop: spacing.md, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.paper },
  modelCancelText: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '600' },
}));
