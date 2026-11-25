import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { DraggableBottomSheet } from '../../shared/components/draggable-bottom-sheet';
import { createThemedStyles } from '../../shared/theme/app-theme';

interface AiResultSheetProps {
  open: boolean;
  loading: boolean;
  title: string;
  hint?: string;
  text: string;
  error: string | null;
  actionLabel?: string;
  onAction?(): void;
  onClose(): void;
}

/** 统一的 AI 结果预览：加载、错误、结果与采纳动作都在同一个底部面板里。 */
export function AiResultSheet({ actionLabel, error, hint, loading, onAction, onClose, open, text, title }: AiResultSheetProps) {
  return <DraggableBottomSheet accessibilityLabel={title} onClose={onClose} open={open} sheetStyle={styles.sheet}>
    <View style={styles.header}><Text style={styles.title}>{title}</Text>{hint ? <Text style={styles.hint}>{hint}</Text> : null}</View>
    <View style={styles.body}>
      {loading ? <View style={styles.loadingRow}><ActivityIndicator color={colors.life} size="small" /><Text style={styles.loadingText}>正在生成…</Text></View>
        : error ? <Text style={styles.error}>{error}</Text>
          : <ScrollView style={styles.textScroll}><Text selectable style={styles.text}>{text}</Text></ScrollView>}
    </View>
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}><Text style={styles.secondaryText}>关闭</Text></Pressable>
      {actionLabel && onAction && !loading && !error ? <Pressable accessibilityRole="button" onPress={onAction} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}><Text style={styles.primaryText}>{actionLabel}</Text></Pressable> : null}
    </View>
  </DraggableBottomSheet>;
}

const styles = createThemedStyles(() => ({
  sheet: { paddingBottom: spacing.xl },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  title: { color: colors.ink, fontFamily: typography.display, fontSize: 22 },
  hint: { marginTop: 5, color: colors.inkFaint, fontSize: typography.size.meta, lineHeight: 17 },
  body: { marginTop: spacing.md, marginHorizontal: spacing.lg },
  loadingRow: { minHeight: 96, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radius.md, backgroundColor: colors.paper },
  loadingText: { color: colors.inkFaint, fontSize: typography.size.meta },
  error: { padding: spacing.md, color: colors.danger, fontSize: typography.size.body, lineHeight: 22, borderRadius: radius.md, backgroundColor: colors.dangerLight },
  textScroll: { maxHeight: 280, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.paper },
  text: { color: colors.ink, fontFamily: typography.display, fontSize: 15, lineHeight: 25 },
  actions: { marginTop: spacing.md, paddingHorizontal: spacing.lg, flexDirection: 'row', gap: spacing.sm },
  primary: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.life },
  primaryText: { color: colors.onLife, fontSize: typography.size.caption, fontWeight: '800' },
  secondary: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.paper },
  secondaryText: { color: colors.inkSoft, fontSize: typography.size.caption, fontWeight: '700' },
  pressed: { opacity: 0.7 },
}));
