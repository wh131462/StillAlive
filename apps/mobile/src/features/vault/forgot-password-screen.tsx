import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { feedback } from '../../shared/feedback';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { AppKeyboardAvoidingView } from '../../shared/components/app-keyboard-avoiding-view';
import { usePasswordVaultState } from './password-vault-state';
import { createThemedStyles } from '../../shared/theme/app-theme';

const DELETE_CONFIRMATION = '永久删除密码本';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const vault = usePasswordVaultState();
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const canDelete = confirmation === DELETE_CONFIRMATION;

  const deleteVault = async () => {
    try {
      Keyboard.dismiss();
      setBusy(true);
      await vault.forceDeleteVault();
      router.replace('/vault');
    } catch (cause: unknown) {
      feedback.alert('删除失败', errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  return <SafeAreaView style={styles.safeArea}>
    <View style={styles.header}><Pressable accessibilityLabel="返回密码本" accessibilityRole="button" disabled={busy} onPress={() => router.back()} style={[styles.headerButton, busy && styles.disabled]}><SymbolView name={{ android: 'chevron_left', ios: 'chevron.left', web: 'chevron_left' }} size={22} tintColor={colors.inkSoft} type="hierarchical" /></Pressable><Text style={styles.headerTitle}>忘记主密码</Text><View style={styles.headerButton} /></View>
    <AppKeyboardAvoidingView mode="system" style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.notice}><View style={styles.noticeIcon}><SymbolView name={{ android: 'lock', ios: 'lock.fill', web: 'lock' }} size={28} tintColor={colors.life} type="hierarchical" /></View><Text style={styles.noticeTitle}>主密码无法找回</Text><Text style={styles.noticeText}>为了保护密码数据，主密码不能重置或绕过。你可以返回后再次尝试输入。</Text></View>

        <View style={styles.dangerCard}><Text style={styles.dangerTitle}>永久删除密码本</Text><Text style={styles.dangerText}>删除后，密码本中的账号、密码、网址和备注将无法恢复，生物识别解锁材料也会一并清除。</Text><Text style={styles.unaffectedText}>日记、人物和媒体不受影响。</Text><Text style={styles.fieldLabel}>输入“{DELETE_CONFIRMATION}”确认</Text><TextInput accessibilityLabel={`输入“${DELETE_CONFIRMATION}”确认`} autoCapitalize="none" autoCorrect={false} editable={!busy} onChangeText={setConfirmation} placeholder={DELETE_CONFIRMATION} placeholderTextColor={colors.inkFaint} style={styles.input} value={confirmation} /><Pressable accessibilityRole="button" disabled={busy || !canDelete} onPress={() => void deleteVault()} style={({ pressed }) => [styles.deleteButton, (busy || !canDelete) && styles.disabled, pressed && styles.pressed]}><Text style={styles.deleteButtonText}>{busy ? '正在删除…' : '永久删除密码本'}</Text></Pressable></View>
      </ScrollView>
    </AppKeyboardAvoidingView>
  </SafeAreaView>;
}

function errorMessage(cause: unknown) { return cause instanceof Error ? cause.message : '请稍后重试。'; }

const styles = createThemedStyles(() => ({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.paper },
  header: { minHeight: 56, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: colors.ink, fontFamily: typography.display, fontSize: 18, textAlign: 'center' },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  notice: { padding: spacing.xl, alignItems: 'center' },
  noticeIcon: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lifeLine, borderRadius: 34, backgroundColor: colors.sheet },
  noticeTitle: { marginTop: spacing.lg, color: colors.ink, fontFamily: typography.display, fontSize: 24, textAlign: 'center' },
  noticeText: { maxWidth: 300, marginTop: spacing.sm, color: colors.inkSoft, fontSize: typography.size.caption, lineHeight: 19, textAlign: 'center' },
  dangerCard: { marginTop: spacing.md, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.dangerLine, borderRadius: radius.lg, backgroundColor: colors.dangerLight },
  dangerTitle: { color: colors.danger, fontFamily: typography.display, fontSize: 20 },
  dangerText: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: typography.size.caption, lineHeight: 19 },
  unaffectedText: { marginTop: spacing.sm, color: colors.ink, fontSize: typography.size.caption, fontWeight: '700' },
  fieldLabel: { marginTop: spacing.lg, marginBottom: spacing.sm, color: colors.inkSoft, fontSize: typography.size.meta, fontWeight: '700' },
  input: { minHeight: 50, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.dangerLine, borderRadius: radius.md, color: colors.ink, backgroundColor: colors.paper, fontSize: typography.size.body },
  deleteButton: { minHeight: 50, marginTop: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.danger },
  deleteButtonText: { color: colors.onLife, fontSize: typography.size.caption, fontWeight: '800' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.72 },
}));
