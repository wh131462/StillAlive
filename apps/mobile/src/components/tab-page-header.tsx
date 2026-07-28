import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { colors, spacing, typography } from '@still-alive/tokens';
import { createThemedStyles } from '../theme/app-theme';

interface TabPageHeaderProps {
  action?: ReactNode;
  eyebrow: string;
  subtitle: string;
  title: string;
}

export function TabPageHeader({ action, eyebrow, subtitle, title }: TabPageHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = createThemedStyles(() => ({
  header: { minHeight: 104, paddingBottom: spacing.lg, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  copy: { flex: 1, paddingRight: spacing.md },
  eyebrow: { color: colors.life, fontFamily: typography.mono, fontSize: 8, letterSpacing: 1.4 },
  title: { marginTop: 4, color: colors.ink, fontFamily: typography.display, fontSize: 34, lineHeight: 42 },
  subtitle: { marginTop: 4, color: colors.inkFaint, fontSize: 10, lineHeight: 17 },
  action: { minHeight: 44, marginLeft: spacing.sm, alignItems: 'flex-end', justifyContent: 'flex-start' },
}));
