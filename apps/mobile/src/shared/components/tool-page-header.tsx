import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { createThemedStyles } from '../theme/app-theme';

interface ToolPageHeaderProps {
  backAccessibilityLabel?: string;
  backDisabled?: boolean;
  onBack(): void;
  right?: ReactNode;
  subtitle?: string;
  title: string;
}

interface ToolPageHeaderActionProps {
  accessibilityLabel: string;
  active?: boolean;
  children: ReactNode;
  disabled?: boolean;
  onPress(): void;
}

interface ToolPageHeaderTextActionProps {
  accessibilityLabel?: string;
  disabled?: boolean;
  emphasized?: boolean;
  label: string;
  onPress(): void;
}

interface ToolPageOverviewProps {
  eyebrow: string;
  icon: ReactNode;
  subtitle: string;
  title: string;
  trailing?: ReactNode;
}

export function ToolPageHeader({ backAccessibilityLabel = '返回', backDisabled = false, onBack, right, subtitle, title }: ToolPageHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerSide}>
        <Pressable accessibilityLabel={backAccessibilityLabel} accessibilityRole="button" disabled={backDisabled} onPress={onBack} style={({ pressed }) => [styles.headerButton, backDisabled && styles.disabled, pressed && styles.pressed]}>
          <SymbolView name={{ android: 'chevron_left', ios: 'chevron.left', web: 'chevron_left' }} size={22} tintColor={colors.inkSoft} type="hierarchical" />
        </Pressable>
      </View>
      <View style={styles.headerCopy}><Text numberOfLines={1} style={styles.headerTitle}>{title}</Text>{subtitle ? <Text numberOfLines={1} style={styles.headerSubtitle}>{subtitle}</Text> : null}</View>
      <View style={styles.headerRight}>{right}</View>
    </View>
  );
}

export function ToolPageHeaderAction({ accessibilityLabel, active = false, children, disabled = false, onPress }: ToolPageHeaderActionProps) {
  return (
    <Pressable accessibilityLabel={accessibilityLabel} accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.headerButton, active && styles.headerButtonActive, disabled && styles.disabled, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

export function ToolPageHeaderTextAction({ accessibilityLabel, disabled = false, emphasized = false, label, onPress }: ToolPageHeaderTextActionProps) {
  return (
    <Pressable accessibilityLabel={accessibilityLabel ?? label} accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.headerTextButton, emphasized && styles.headerTextButtonEmphasized, disabled && styles.disabled, pressed && styles.pressed]}>
      <Text numberOfLines={1} style={[styles.headerText, emphasized && styles.headerTextEmphasized]}>{label}</Text>
    </Pressable>
  );
}

export function ToolPageOverview({ eyebrow, icon, subtitle, title, trailing }: ToolPageOverviewProps) {
  return (
    <View style={styles.overview}>
      <View pointerEvents="none" style={styles.overviewIcon}>{icon}</View>
      <View style={styles.overviewCopy}>
        <Text style={styles.overviewEyebrow}>{eyebrow}</Text>
        <Text numberOfLines={1} style={styles.overviewTitle}>{title}</Text>
        <Text numberOfLines={2} style={styles.overviewSubtitle}>{subtitle}</Text>
      </View>
      {trailing ? <View style={styles.overviewTrailing}>{trailing}</View> : null}
    </View>
  );
}

const styles = createThemedStyles(() => ({
  header: { minHeight: 56, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  headerSide: { width: 88, alignItems: 'flex-start' },
  headerRight: { width: 88, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  headerButtonActive: { backgroundColor: colors.lifeLight },
  headerCopy: { minWidth: 0, flex: 1, alignItems: 'center' },
  headerTitle: { maxWidth: '100%', color: colors.ink, fontFamily: typography.display, fontSize: 18, textAlign: 'center' },
  headerSubtitle: { maxWidth: '100%', marginTop: 2, color: colors.inkFaint, fontSize: typography.size.meta, textAlign: 'center' },
  headerTextButton: { minWidth: 44, maxWidth: 88, height: 44, paddingHorizontal: spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  headerTextButtonEmphasized: { minWidth: 68, height: 40, backgroundColor: colors.life },
  headerText: { color: colors.life, fontSize: typography.size.caption, fontWeight: '800' },
  headerTextEmphasized: { color: colors.onLife },
  overview: { minHeight: 112, padding: spacing.md, flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderTopRightRadius: radius.xl, borderBottomLeftRadius: radius.xl, backgroundColor: colors.sheet },
  overviewIcon: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderTopRightRadius: radius.md, borderBottomLeftRadius: radius.md, backgroundColor: colors.lifeLight },
  overviewCopy: { minWidth: 0, flex: 1, marginLeft: spacing.md },
  overviewEyebrow: { color: colors.life, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.1 },
  overviewTitle: { marginTop: 4, color: colors.ink, fontFamily: typography.display, fontSize: 21 },
  overviewSubtitle: { marginTop: 5, color: colors.inkFaint, fontSize: typography.size.meta, lineHeight: 16 },
  overviewTrailing: { marginLeft: spacing.sm },
  disabled: { opacity: 0.38 },
  pressed: { opacity: 0.62 },
}));
