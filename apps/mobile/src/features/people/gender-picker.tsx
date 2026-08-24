import { Pressable, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import type { SymbolViewProps } from 'expo-symbols';
import type { Gender } from '@still-alive/types';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { createThemedStyles } from '../../shared/theme/app-theme';

export const GENDER_OPTIONS: Array<{ glyph: string; icon: SymbolViewProps['name']; label: string; value: Gender }> = [
  { glyph: '♂', icon: { android: 'male', web: 'male' }, label: '男', value: 'male' },
  { glyph: '♀', icon: { android: 'female', web: 'female' }, label: '女', value: 'female' },
  { glyph: '⚧', icon: { android: 'transgender', web: 'transgender' }, label: '其他', value: 'other' },
];

export function GenderPickerField({ onChange, value }: { onChange(value: Gender | null): void; value: Gender | null }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>性别</Text>
      <View style={styles.segmented}>
        {GENDER_OPTIONS.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(selected ? null : option.value)}
              style={[styles.segment, selected && styles.segmentActive]}
            >
              <SymbolView fallback={<Text style={[styles.symbolFallback, selected && styles.segmentTextActive]}>{option.glyph}</Text>} name={option.icon} size={15} tintColor={selected ? colors.life : colors.inkFaint} type="hierarchical" />
              <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function genderOption(gender: Gender | null) {
  return GENDER_OPTIONS.find((option) => option.value === gender) ?? null;
}

export function formatGender(gender: Gender | null): string {
  return genderOption(gender)?.label ?? '未设置';
}

const styles = createThemedStyles(() => ({
  field: { marginTop: spacing.lg },
  label: { marginBottom: spacing.sm, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1 },
  segmented: { flexDirection: 'row', padding: 3, borderRadius: radius.md, backgroundColor: colors.sheet },
  segment: { flex: 1, minHeight: 42, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  segmentActive: { backgroundColor: colors.paper },
  segmentText: { color: colors.inkFaint, fontSize: 11 },
  symbolFallback: { width: 15, color: colors.inkFaint, fontSize: 15, lineHeight: 18, textAlign: 'center' },
  segmentTextActive: { color: colors.life, fontWeight: '700' },
}));
