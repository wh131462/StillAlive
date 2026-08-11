import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { AppKeyboardAvoidingView } from '../../src/components/app-keyboard-avoiding-view';
import { usePasswordVaultState } from '../../src/state/password-vault-state';
import { createThemedStyles } from '../../src/theme/app-theme';

export default function PasswordVaultSettingsScreen() {
  const router = useRouter();
  const vault = usePasswordVaultState();
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [nextConfirmation, setNextConfirmation] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [busy, setBusy] = useState<'biometric' | 'password' | 'delete' | null>(null);

  useEffect(() => {
    if (vault.phase === 'unlocked' || busy === 'delete') return;
    setCurrentPassword(''); setNextPassword(''); setNextConfirmation(''); setDeletePassword(''); setDeleteConfirmation('');
    router.replace('/vault');
  }, [busy, router, vault.phase]);

  if (vault.phase !== 'unlocked' && busy !== 'delete') return null;

  const toggleBiometrics = async () => {
    try { setBusy('biometric'); await vault.setBiometricsEnabled(!vault.biometricEnabled); }
    catch (cause: unknown) { Alert.alert('快捷解锁设置失败', errorMessage(cause)); }
    finally { setBusy(null); }
  };

  const changePassword = async () => {
    try {
      setBusy('password');
      await vault.changeMasterPassword(currentPassword, nextPassword, nextConfirmation);
      setCurrentPassword(''); setNextPassword(''); setNextConfirmation('');
      Alert.alert('主密码已修改', '数据密钥已使用新主密码重新保护。请记住新主密码。');
    } catch (cause: unknown) { Alert.alert('修改失败', errorMessage(cause)); }
    finally { setBusy(null); }
  };

  const deleteVault = async () => {
    try {
      Keyboard.dismiss();
      setBusy('delete');
      await vault.deleteVault(deletePassword);
      setDeletePassword(''); setDeleteConfirmation('');
      router.replace('/vault');
    } catch (cause: unknown) { Alert.alert('删除失败', errorMessage(cause)); }
    finally { setBusy(null); }
  };

  return <SafeAreaView style={styles.safeArea}>
    <View style={styles.header}><Pressable accessibilityLabel="返回密码本" disabled={busy !== null} onPress={() => router.back()} style={[styles.headerButton, busy !== null && styles.disabled]}><SymbolView name={{ android: 'chevron_left', ios: 'chevron.left', web: 'chevron_left' }} size={22} tintColor={colors.inkSoft} type="hierarchical" /></Pressable><Text style={styles.headerTitle}>密码本安全</Text><View style={styles.headerButton} /></View>
    <AppKeyboardAvoidingView mode="system" style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.securitySummary}><View style={styles.summaryIcon}><SymbolView name={{ android: 'verified_user', ios: 'checkmark.shield', web: 'verified_user' }} size={27} tintColor={colors.sun} type="hierarchical" /></View><Text style={styles.summaryEyebrow}>PASSWORD SECURITY</Text><Text style={styles.summaryTitle}>密码本始终由主密码保护</Text><Text style={styles.summaryText}>生物识别只是这台设备的快捷解锁方式。修改主密码或恢复备份时，仍必须提供正确主密码。</Text></View>

      <Text style={styles.eyebrow}>QUICK UNLOCK</Text>
      <View style={styles.card}>
        <Pressable accessibilityRole="switch" accessibilityState={{ checked: vault.biometricEnabled, disabled: !vault.biometricAvailable }} disabled={!vault.biometricAvailable || busy !== null} onPress={() => void toggleBiometrics()} style={styles.switchRow}><View style={styles.rowIcon}><SymbolView name={{ android: 'fingerprint', ios: 'faceid', web: 'fingerprint' }} size={23} tintColor={colors.life} type="hierarchical" /></View><View style={styles.rowCopy}><Text style={styles.rowTitle}>生物识别快捷解锁</Text><Text style={styles.rowHint}>{vault.biometricAvailable ? '密钥由系统安全存储保护，不保存主密码' : vault.biometricEnabled ? '生物识别暂时不可用，请使用主密码' : '当前设备未配置可用的生物识别'}</Text></View><View style={[styles.switchTrack, vault.biometricEnabled && styles.switchTrackOn]}><View style={[styles.switchThumb, vault.biometricEnabled && styles.switchThumbOn]} /></View></Pressable>
      </View>

      <Text style={styles.eyebrow}>MASTER PASSWORD</Text>
      <View style={styles.cardForm}><Text style={styles.cardTitle}>修改主密码</Text><Text style={styles.cardHint}>需要再次验证当前主密码。只重新保护数据密钥，不生成明文副本。</Text>
        <PasswordInput editable={busy === null} label="当前主密码" onChangeText={setCurrentPassword} placeholder="输入当前主密码" value={currentPassword} />
        <PasswordInput editable={busy === null} label="新主密码" onChangeText={setNextPassword} placeholder="至少 6 个字符" value={nextPassword} />
        <PasswordInput editable={busy === null} label="再次输入新主密码" onChangeText={setNextConfirmation} placeholder="完整重复一次" value={nextConfirmation} />
        <Pressable disabled={busy !== null} onPress={() => void changePassword()} style={[styles.primaryButton, busy !== null && styles.disabled]}><Text style={styles.primaryButtonText}>{busy === 'password' ? '正在修改…' : '修改主密码'}</Text></Pressable>
      </View>

      <Text style={styles.eyebrow}>DANGER ZONE</Text>
      <View style={styles.dangerCard}><Text style={styles.dangerTitle}>永久删除密码本</Text><Text style={styles.dangerHint}>所有账号、密码、网址和备注都将不可恢复。日记、人物与媒体不会被删除。</Text>
        <PasswordInput editable={busy === null} label="再次输入主密码" onChangeText={setDeletePassword} placeholder="验证当前主密码" value={deletePassword} />
        <Text style={styles.fieldLabel}>输入“永久删除”确认</Text><TextInput autoCapitalize="none" autoCorrect={false} editable={busy === null} onChangeText={setDeleteConfirmation} placeholder="永久删除" placeholderTextColor={colors.inkFaint} style={[styles.input, styles.dangerInput]} value={deleteConfirmation} />
        <Pressable disabled={busy !== null || deleteConfirmation !== '永久删除'} onPress={() => Alert.alert('最后确认', '密码本删除后无法恢复。确定继续吗？', [{ text: '取消', style: 'cancel' }, { text: '永久删除', style: 'destructive', onPress: () => void deleteVault() }])} style={[styles.deleteButton, (busy !== null || deleteConfirmation !== '永久删除') && styles.disabled]}><Text style={styles.deleteButtonText}>{busy === 'delete' ? '正在删除…' : '永久删除密码本'}</Text></Pressable>
      </View>
      </ScrollView>
    </AppKeyboardAvoidingView>
  </SafeAreaView>;
}

function PasswordInput({ editable, label, onChangeText, placeholder, value }: { editable: boolean; label: string; onChangeText(value: string): void; placeholder: string; value: string }) {
  return <><Text style={styles.fieldLabel}>{label}</Text><TextInput accessibilityLabel={label} autoCapitalize="none" autoCorrect={false} editable={editable} importantForAutofill="no" onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.inkFaint} secureTextEntry style={styles.input} textContentType="none" value={value} /></>;
}

function errorMessage(cause: unknown) { return cause instanceof Error ? cause.message : '请稍后重试。'; }

const styles = createThemedStyles(() => ({
  flex: { flex: 1 }, safeArea: { flex: 1, backgroundColor: colors.paper }, header: { minHeight: 56, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }, headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, headerTitle: { flex: 1, color: colors.ink, fontFamily: typography.display, fontSize: 18, textAlign: 'center' }, content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  securitySummary: { padding: spacing.xl, borderTopRightRadius: radius.xl, borderBottomLeftRadius: radius.xl, backgroundColor: colors.lifeDeep }, summaryIcon: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.onLifeLine, borderRadius: 27 }, summaryEyebrow: { marginTop: spacing.lg, color: colors.onLifeMuted, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.3 }, summaryTitle: { marginTop: spacing.xs, color: colors.onLife, fontFamily: typography.display, fontSize: 25 }, summaryText: { marginTop: spacing.sm, color: colors.onLifeMuted, fontSize: typography.size.caption, lineHeight: 19 },
  eyebrow: { marginTop: spacing.xl, marginBottom: spacing.sm, color: colors.life, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.3 }, card: { overflow: 'hidden', borderRadius: radius.lg, backgroundColor: colors.sheet }, switchRow: { minHeight: 82, padding: spacing.md, flexDirection: 'row', alignItems: 'center' }, rowIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.lifeLight }, rowCopy: { flex: 1, marginHorizontal: spacing.md }, rowTitle: { color: colors.ink, fontSize: typography.size.body, fontWeight: '700' }, rowHint: { marginTop: 5, color: colors.inkFaint, fontSize: typography.size.meta, lineHeight: 15 }, switchTrack: { width: 44, height: 26, padding: 2, borderRadius: 13, backgroundColor: colors.line }, switchTrackOn: { backgroundColor: colors.life }, switchThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.paper }, switchThumbOn: { alignSelf: 'flex-end' },
  cardForm: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.sheet }, cardTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 20 }, cardHint: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: typography.size.caption, lineHeight: 18 }, fieldLabel: { marginTop: spacing.lg, marginBottom: 7, color: colors.inkSoft, fontSize: typography.size.meta, fontWeight: '700' }, input: { minHeight: 50, paddingHorizontal: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: radius.md, color: colors.ink, backgroundColor: colors.paper, fontSize: typography.size.body }, primaryButton: { minHeight: 50, marginTop: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life }, primaryButtonText: { color: colors.onLife, fontSize: typography.size.caption, fontWeight: '800' },
  dangerCard: { padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.dangerLine, borderRadius: radius.lg, backgroundColor: colors.dangerLight }, dangerTitle: { color: colors.danger, fontFamily: typography.display, fontSize: 20 }, dangerHint: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: typography.size.caption, lineHeight: 18 }, dangerInput: { borderColor: colors.dangerLine }, deleteButton: { minHeight: 50, marginTop: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.danger }, deleteButtonText: { color: colors.onLife, fontSize: typography.size.caption, fontWeight: '800' }, disabled: { opacity: 0.4 },
}));
