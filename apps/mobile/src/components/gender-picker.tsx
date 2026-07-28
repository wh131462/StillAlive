import { Pressable, Text, View } from 'react-native';
import type { Gender } from '@still-alive/types';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { createThemedStyles } from '../theme/app-theme';

const OPTIONS: Array<{ label: string; value: Gender }> = [
  { label: '女性', value: 'female' },
  { label: '男性', value: 'male' },
  { label: '其他', value: 'other' },
];

export function GenderPickerField({ onChange, value }: { onChange(value: Gender | null): void; value: Gender | null }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>性别</Text>
      <View style={styles.segmented}>
        {OPTIONS.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(selected ? null : option.value)}
              style={[styles.segment, selected && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function formatGender(gender: Gender | null): string {
  return OPTIONS.find((option) => option.value === gender)?.label ?? '未设置';
}

const styles = createThemedStyles(() => ({
  field: { marginTop: spacing.lg },
  label: { marginBottom: spacing.sm, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1 },
  segmented: { flexDirection: 'row', padding: 3, borderRadius: radius.md, backgroundColor: colors.sheet },
  segment: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  segmentActive: { backgroundColor: colors.paper },
  segmentText: { color: colors.inkFaint, fontSize: 11 },
  segmentTextActive: { color: colors.life, fontWeight: '700' },
}));
