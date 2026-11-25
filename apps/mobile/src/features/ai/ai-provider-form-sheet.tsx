import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { AI_PROVIDER_KIND_META, AI_PROVIDER_KINDS } from '../../infrastructure/ai/ai-adapters';
import type { AiProviderKind, AiProviderProfile } from '../../infrastructure/ai/ai-types';
import type { AiProviderInput } from '../../application/ai/ai-provider';
import { createThemedStyles } from '../../shared/theme/app-theme';
import { DraggableBottomSheet } from '../../shared/components/draggable-bottom-sheet';
import { aiErrorMessage } from './ai-copy';

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
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const nextKind: AiProviderKind = editing?.kind ?? 'deepseek';
    setKind(nextKind);
    setLabel(editing?.label ?? '');
    setBaseUrl(editing?.baseUrl ?? AI_PROVIDER_KIND_META[nextKind].defaultBaseUrl);
    setModelId(editing?.modelId ?? '');
    setApiKey('');
    setSaving(false);
    setError(null);
  }, [editing, open]);

  const selectKind = (next: AiProviderKind) => {
    setKind(next);
    if (!editing || baseUrl === AI_PROVIDER_KIND_META[kind].defaultBaseUrl) setBaseUrl(AI_PROVIDER_KIND_META[next].defaultBaseUrl);
  };

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ kind, label, baseUrl, modelId, apiKey });
      onClose();
    } catch (cause) {
      setError(aiErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  return <DraggableBottomSheet accessibilityLabel="服务商设置" dismissDisabled={saving} keyboardAvoiding open={open} onClose={onClose}>
    <View style={styles.header}>
      <Text style={styles.eyebrow}>AI PROVIDER</Text>
      <Text style={styles.title}>{editing ? '编辑服务商' : '添加服务商'}</Text>
      <Text style={styles.lead}>Key 只保存在本机安全存储，不进入备份，也不会随记录导出。</Text>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={styles.formScroll}>
      <View style={styles.form}>
      <Text style={styles.fieldLabel}>类型</Text>
      <View style={styles.kindRow}>
        {AI_PROVIDER_KINDS.map((item) => <Pressable accessibilityRole="button" accessibilityState={{ selected: kind === item }} key={item} onPress={() => selectKind(item)} style={({ pressed }) => [styles.kindChip, kind === item && styles.kindChipActive, pressed && styles.pressed]}>
          <Text style={[styles.kindChipText, kind === item && styles.kindChipTextActive]}>{AI_PROVIDER_KIND_META[item].label}</Text>
        </Pressable>)}
      </View>
      <Text style={styles.kindHint}>{AI_PROVIDER_KIND_META[kind].hint}</Text>

      <Text style={styles.fieldLabel}>名称（可选）</Text>
      <TextInput autoCapitalize="none" onChangeText={setLabel} placeholder={AI_PROVIDER_KIND_META[kind].label} placeholderTextColor={colors.inkFaint} style={styles.input} value={label} />

      <Text style={styles.fieldLabel}>服务地址 *</Text>
      <TextInput autoCapitalize="none" autoCorrect={false} keyboardType="url" onChangeText={setBaseUrl} placeholder={AI_PROVIDER_KIND_META[kind].baseUrlPlaceholder} placeholderTextColor={colors.inkFaint} style={styles.input} value={baseUrl} />

      <Text style={styles.fieldLabel}>模型</Text>
      <TextInput autoCapitalize="none" autoCorrect={false} onChangeText={setModelId} placeholder="保存后可点“检测”获取模型列表" placeholderTextColor={colors.inkFaint} style={styles.input} value={modelId} />
      <Text style={styles.fieldHint}>可以先留空保存；填写模型名后才能对话。</Text>

      <Text style={styles.fieldLabel}>API Key {editing ? '（留空不修改）' : '*'}</Text>
      <TextInput autoCapitalize="none" autoCorrect={false} onChangeText={setApiKey} placeholder={editing ? '留空表示不修改已保存的 Key' : '粘贴 API Key'} placeholderTextColor={colors.inkFaint} secureTextEntry style={styles.input} value={apiKey} />
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
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  eyebrow: { color: colors.life, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.2 },
  title: { marginTop: 4, color: colors.ink, fontFamily: typography.display, fontSize: 22 },
  lead: { marginTop: 6, color: colors.inkFaint, fontSize: typography.size.meta, lineHeight: 17 },
  formScroll: { maxHeight: 460 },
  form: { paddingHorizontal: spacing.lg },
  fieldLabel: { marginTop: spacing.md, color: colors.inkSoft, fontSize: 12, fontWeight: '700' },
  input: { minHeight: 44, marginTop: 4, paddingHorizontal: 2, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, color: colors.ink, fontSize: typography.size.body },
  fieldHint: { marginTop: 5, color: colors.inkFaint, fontSize: typography.size.meta },
  kindRow: { flexDirection: 'row', gap: spacing.lg, marginTop: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  kindChip: { minHeight: 40, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  kindChipActive: { borderBottomColor: colors.life },
  kindChipText: { color: colors.inkSoft, fontSize: typography.size.caption, fontWeight: '700' },
  kindChipTextActive: { color: colors.life },
  kindHint: { marginTop: spacing.sm, color: colors.inkFaint, fontSize: typography.size.meta },
  error: { marginTop: spacing.sm, color: colors.danger, fontSize: typography.size.meta, lineHeight: 17 },
  actions: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg },
  primaryButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.life },
  primaryText: { color: colors.onLife, fontSize: typography.size.caption, fontWeight: '800' },
  secondaryButton: { minWidth: 96, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.paper },
  secondaryText: { color: colors.inkSoft, fontSize: typography.size.caption, fontWeight: '700' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.7 },
}));
