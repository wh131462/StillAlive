import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { colors, spacing, typography } from '@still-alive/tokens';
import { AI_PROVIDER_KIND_META, AI_PROVIDER_KINDS } from '../../infrastructure/ai/ai-adapters';
import type { AiProviderKind, AiProviderProfile, AiReasoningEffort } from '../../infrastructure/ai/ai-types';
import type { AiProviderInput } from '../../application/ai/ai-provider';
import { createThemedStyles } from '../../shared/theme/app-theme';
import { DraggableBottomSheet } from '../../shared/components/draggable-bottom-sheet';
import { AiSegmentedControl } from './ai-segmented-control';
import { AI_REASONING_EFFORT_OPTIONS, aiErrorMessage } from './ai-copy';

interface AiProviderFormSheetProps {
  open: boolean;
  editing: AiProviderProfile | null;
  onClose(): void;
  onSubmit(input: AiProviderInput): Promise<void>;
}

export function AiProviderFormSheet({ open, editing, onClose, onSubmit }: AiProviderFormSheetProps) {
  const initialKind: AiProviderKind = editing?.kind ?? 'deepseek';
  const [kind, setKind] = useState<AiProviderKind>(initialKind);
  const [label, setLabel] = useState(editing?.label ?? '');
  const [baseUrl, setBaseUrl] = useState(editing?.baseUrl ?? AI_PROVIDER_KIND_META[initialKind].defaultBaseUrl);
  const [modelId, setModelId] = useState(editing?.modelId ?? '');
  const [reasoningEffort, setReasoningEffort] = useState<AiReasoningEffort>(editing?.reasoningEffort ?? 'off');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const nextKind: AiProviderKind = editing?.kind ?? 'deepseek';
    setKind(nextKind);
    setLabel(editing?.label ?? '');
    setBaseUrl(editing?.baseUrl ?? AI_PROVIDER_KIND_META[nextKind].defaultBaseUrl);
    setModelId(editing?.modelId ?? '');
    setReasoningEffort(editing?.reasoningEffort ?? 'off');
    setApiKey('');
    setSaving(false);
    setError(null);
  }, [editing, open]);

  const selectKind = (next: AiProviderKind) => {
    setKind(next);
    if (next === 'anthropic') setReasoningEffort('off');
    if (!editing || baseUrl === AI_PROVIDER_KIND_META[kind].defaultBaseUrl) setBaseUrl(AI_PROVIDER_KIND_META[next].defaultBaseUrl);
  };

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ kind, label, baseUrl, modelId, reasoningEffort: kind === 'anthropic' ? 'off' : reasoningEffort, apiKey });
      onClose();
    } catch (cause) {
      setError(aiErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  return <DraggableBottomSheet accessibilityLabel="服务商设置" dismissDisabled={saving} keyboardAvoiding open={open} onClose={onClose}>
    <View style={styles.header}>
      <Text style={styles.title}>{editing ? '编辑服务商' : '添加服务商'}</Text>
      <Text style={styles.lead}>Key 只保存在本机安全存储，不进入备份。</Text>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={styles.formScroll}>
      <View style={styles.form}>
        <AiSegmentedControl onChange={selectKind} options={AI_PROVIDER_KINDS.map((item) => ({ label: AI_PROVIDER_KIND_META[item].label, value: item }))} value={kind} />
        <Text style={styles.kindHint}>{AI_PROVIDER_KIND_META[kind].hint}</Text>

        <Text style={styles.fieldLabel}>名称</Text>
        <TextInput autoCapitalize="none" onChangeText={setLabel} placeholder={`可选，默认 ${AI_PROVIDER_KIND_META[kind].label}`} placeholderTextColor={colors.inkFaint} style={styles.input} value={label} />

        <Text style={styles.fieldLabel}>服务地址</Text>
        <TextInput autoCapitalize="none" autoCorrect={false} keyboardType="url" onChangeText={setBaseUrl} placeholder={AI_PROVIDER_KIND_META[kind].baseUrlPlaceholder} placeholderTextColor={colors.inkFaint} style={styles.input} value={baseUrl} />

        <Text style={styles.fieldLabel}>模型</Text>
        <TextInput autoCapitalize="none" autoCorrect={false} onChangeText={setModelId} placeholder="可以先留空，保存后再选择" placeholderTextColor={colors.inkFaint} style={styles.input} value={modelId} />

        {kind !== 'anthropic' ? <>
          <Text style={styles.fieldLabel}>深度思考</Text>
          <AiSegmentedControl onChange={(next: AiReasoningEffort) => setReasoningEffort(next)} options={AI_REASONING_EFFORT_OPTIONS} value={reasoningEffort} />
          <Text style={styles.kindHint}>关闭时不发送 reasoning_effort；只对支持该参数的模型生效。</Text>
        </> : null}

        <Text style={styles.fieldLabel}>API Key</Text>
        <TextInput autoCapitalize="none" autoCorrect={false} onChangeText={setApiKey} placeholder={editing ? '留空表示不修改' : '粘贴 API Key'} placeholderTextColor={colors.inkFaint} secureTextEntry style={styles.input} value={apiKey} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </ScrollView>
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" disabled={saving} onPress={onClose} style={({ pressed }) => [styles.secondaryButton, saving && styles.disabled, pressed && styles.pressed]}><Text style={styles.secondaryText}>取消</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={saving} onPress={() => void submit()} style={({ pressed }) => [styles.primaryButton, saving && styles.disabled, pressed && styles.pressed]}><Text style={styles.primaryText}>{saving ? '保存中…' : '保存'}</Text></Pressable>
    </View>
  </DraggableBottomSheet>;
}

const styles = createThemedStyles(() => ({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.md },
  title: { color: colors.ink, fontSize: typography.size.title, fontWeight: '700' },
  lead: { marginTop: 4, color: colors.inkFaint, fontSize: typography.size.label, lineHeight: 17 },
  formScroll: { maxHeight: 460 },
  form: { paddingHorizontal: spacing.lg },
  kindHint: { marginTop: spacing.sm, color: colors.inkFaint, fontSize: typography.size.label, lineHeight: 17 },
  fieldLabel: { marginTop: spacing.lg, marginBottom: 6, color: colors.inkSoft, fontSize: typography.size.label },
  input: { minHeight: 46, paddingHorizontal: spacing.md, borderRadius: 10, backgroundColor: colors.paper, color: colors.ink, fontSize: typography.size.bodyLarge },
  error: { marginTop: spacing.sm, color: colors.danger, fontSize: typography.size.label, lineHeight: 17 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg },
  primaryButton: { flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.life },
  primaryText: { color: colors.onLife, fontSize: typography.size.bodyLarge, fontWeight: '600' },
  secondaryButton: { minWidth: 88, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  secondaryText: { color: colors.inkSoft, fontSize: typography.size.bodyLarge },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.7 },
}));
