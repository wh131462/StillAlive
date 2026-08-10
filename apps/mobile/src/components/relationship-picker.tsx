import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { createThemedStyles } from '../theme/app-theme';

const RELATION_PRESETS = ['爸爸', '妈妈', '伴侣', '孩子', '兄弟姐妹', '亲人', '朋友', '挚友', '同学', '同事', '老师', '邻居'] as const;

interface RelationshipPickerProps {
  onChange(value: string): void;
  value: string;
}

export function RelationshipPicker({ onChange, value }: RelationshipPickerProps) {
  const normalizedValue = value.trim();
  const presetSelected = RELATION_PRESETS.some((preset) => preset === normalizedValue);
  const [open, setOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');

  const openPicker = () => {
    setCustomValue(presetSelected ? '' : value);
    setOpen(true);
  };

  const selectValue = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
  };

  const applyCustomValue = () => {
    const nextValue = customValue.trim();
    if (nextValue) selectValue(nextValue);
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>与我的关系</Text>
      <Pressable accessibilityLabel={`与我的关系，${normalizedValue || '未选择'}`} accessibilityRole="button" onPress={openPicker} style={({ pressed }) => [styles.selector, pressed && styles.selectorPressed]}>
        <Text numberOfLines={1} style={[styles.selectorText, !normalizedValue && styles.selectorPlaceholder]}>{normalizedValue || '选择或自定义关系'}</Text>
        <Text accessibilityElementsHidden style={styles.selectorArrow}>›</Text>
      </Pressable>

      <Modal animationType="slide" onRequestClose={() => setOpen(false)} transparent visible={open}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
          <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.backdrop}>
            <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
              <View style={styles.handle} />
              <Text style={styles.sheetTitle}>选择关系</Text>
              <Text style={styles.sheetHint}>选择一个常用关系，或写下更准确的称呼。</Text>

              <View style={styles.presets}>
                {RELATION_PRESETS.map((preset) => {
                  const selected = normalizedValue === preset;
                  return (
                    <Pressable
                      key={preset}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => selectValue(preset)}
                      style={({ pressed }) => [styles.preset, selected && styles.presetSelected, pressed && styles.presetPressed]}
                    >
                      <Text style={[styles.presetText, selected && styles.presetTextSelected]}>{preset}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.divider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>自定义</Text><View style={styles.dividerLine} /></View>
              <View style={styles.customRow}>
                <TextInput
                  accessibilityLabel="自定义关系"
                  maxLength={40}
                  onChangeText={setCustomValue}
                  onSubmitEditing={applyCustomValue}
                  placeholder="例如：室友、导师、旅行伙伴"
                  placeholderTextColor={colors.inkFaint}
                  returnKeyType="done"
                  style={styles.customInput}
                  value={customValue}
                />
                <Pressable accessibilityRole="button" disabled={!customValue.trim()} onPress={applyCustomValue} style={({ pressed }) => [styles.applyButton, !customValue.trim() && styles.applyButtonDisabled, pressed && styles.applyButtonPressed]}>
                  <Text style={styles.applyText}>使用</Text>
                </Pressable>
              </View>

              {normalizedValue ? <Pressable accessibilityRole="button" onPress={() => selectValue('')} style={styles.clearSelection}><Text style={styles.clearSelectionText}>暂不定义关系</Text></Pressable> : null}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = createThemedStyles(() => ({
  flex: { flex: 1 },
  field: { marginTop: spacing.lg },
  label: { marginBottom: spacing.sm, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1 },
  selector: { minHeight: 52, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, backgroundColor: colors.sheet },
  selectorPressed: { opacity: 0.72 },
  selectorText: { flex: 1, color: colors.ink, fontSize: 15 },
  selectorPlaceholder: { color: colors.inkFaint },
  selectorArrow: { marginLeft: spacing.sm, color: colors.life, fontFamily: typography.display, fontSize: 24, lineHeight: 28 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.backdrop },
  sheet: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.sheet },
  handle: { width: 38, height: 4, alignSelf: 'center', marginVertical: spacing.md, borderRadius: 2, backgroundColor: colors.line },
  sheetTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 25 },
  sheetHint: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: typography.size.caption, lineHeight: 18 },
  presets: { marginTop: spacing.lg, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  preset: { minHeight: 36, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderRadius: 18, backgroundColor: colors.sheet },
  presetSelected: { borderColor: colors.life, backgroundColor: colors.life },
  presetPressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  presetText: { color: colors.inkSoft, fontSize: typography.size.meta },
  presetTextSelected: { color: colors.onLife, fontWeight: '700' },
  divider: { marginTop: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  dividerText: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1 },
  customRow: { marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  customInput: { flex: 1, minHeight: 48, paddingHorizontal: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderRadius: radius.md, backgroundColor: colors.sheet, color: colors.ink, fontSize: 14 },
  applyButton: { width: 68, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life },
  applyButtonDisabled: { opacity: 0.35 },
  applyButtonPressed: { opacity: 0.78 },
  applyText: { color: colors.onLife, fontSize: typography.size.meta, fontWeight: '700' },
  clearSelection: { minHeight: 44, marginTop: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  clearSelectionText: { color: colors.inkFaint, fontSize: typography.size.meta },
}));
