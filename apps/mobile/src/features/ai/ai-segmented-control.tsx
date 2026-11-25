import { Pressable, Text, View } from 'react-native';
import { colors, spacing, typography } from '@still-alive/tokens';
import { createThemedStyles } from '../../shared/theme/app-theme';

interface AiSegmentedControlProps<T extends string> {
  options: ReadonlyArray<{ label: string; value: T }>;
  value: T;
  onChange(value: T): void;
}

/** iOS 分段控件：同一屏内切换筛选条件，不做选中态以外的装饰。 */
export function AiSegmentedControl<T extends string>({ onChange, options, value }: AiSegmentedControlProps<T>) {
  return <View style={styles.track}>
    {options.map((option) => {
      const selected = option.value === value;
      return <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        key={option.value}
        onPress={() => onChange(option.value)}
        style={({ pressed }) => [styles.segment, selected && styles.segmentActive, pressed && styles.pressed]}
      >
        <Text numberOfLines={1} style={[styles.label, selected && styles.labelActive]}>{option.label}</Text>
      </Pressable>;
    })}
  </View>;
}

const styles = createThemedStyles(() => ({
  track: { padding: 2, flexDirection: 'row', borderRadius: 9, backgroundColor: colors.lineSoft },
  segment: { flex: 1, minHeight: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 7 },
  segmentActive: { backgroundColor: colors.sheet, shadowColor: colors.ink, shadowOpacity: 0.06, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  label: { color: colors.inkSoft, fontSize: typography.size.label },
  labelActive: { color: colors.ink, fontWeight: '600' },
  pressed: { opacity: 0.6 },
}));
