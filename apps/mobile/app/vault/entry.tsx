import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { copyPasswordToClipboard } from '../../src/data/password-vault-clipboard';
import { usePasswordVaultState } from '../../src/state/password-vault-state';
import { createThemedStyles } from '../../src/theme/app-theme';

export default function PasswordVaultEntryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const vault = usePasswordVaultState();
  const entryId = typeof params.id === 'string' ? params.id : null;
  const entry = useMemo(() => entryId ? vault.entries.find((item) => item.id === entryId) : null, [entryId, vault.entries]);
  const [name, setName] = useState(entry?.name ?? '');
  const [username, setUsername] = useState(entry?.username ?? '');
  const [password, setPassword] = useState(entry?.password ?? '');
  const [url, setUrl] = useState(entry?.url ?? '');
  const [note, setNote] = useState(entry?.note ?? '');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (vault.phase === 'unlocked') return;
    setName(''); setUsername(''); setPassword(''); setUrl(''); setNote(''); setPasswordVisible(false);
    router.replace('/vault');
  }, [router, vault.phase]);

  if (vault.phase !== 'unlocked') return null;
  if (entryId && !entry) return <SafeAreaView style={styles.safeArea}><View style={styles.missing}><Text style={styles.missingTitle}>这条记录不存在</Text><Pressable onPress={() => router.replace('/vault')} style={styles.inlineButton}><Text style={styles.inlineButtonText}>返回密码本</Text></Pressable></View></SafeAreaView>;

  const save = async () => {
    try {
      setBusy(true);
      await vault.saveEntry(entryId, { name, username, password, url, note });
      setPassword('');
      router.back();
    } catch (cause: unknown) { Alert.alert('保存失败', errorMessage(cause)); }
    finally { setBusy(false); }
  };

  const copy = async () => {
    try {
      await copyPasswordToClipboard(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 60_000);
    } catch (cause: unknown) { Alert.alert('复制失败', errorMessage(cause)); }
  };

  const confirmDelete = () => Alert.alert('删除这条密码记录？', '删除后无法恢复。', [
    { text: '取消', style: 'cancel' },
    { text: '删除', style: 'destructive', onPress: () => void deleteEntry() },
  ]);

  const deleteEntry = async () => {
    if (!entryId) return;
    try { setBusy(true); await vault.deleteEntry(entryId); setPassword(''); router.back(); }
    catch (cause: unknown) { Alert.alert('删除失败', errorMessage(cause)); }
    finally { setBusy(false); }
  };

  return <SafeAreaView style={styles.safeArea}>
    <View style={styles.header}><Pressable accessibilityLabel="返回密码本" onPress={() => router.back()} style={styles.headerButton}><SymbolView name={{ android: 'chevron_left', ios: 'chevron.left', web: 'chevron_left' }} size={22} tintColor={colors.inkSoft} type="hierarchical" /></Pressable><Text style={styles.headerTitle}>{entry ? '编辑密码记录' : '新建密码记录'}</Text><Pressable accessibilityLabel="保存密码记录" disabled={busy} onPress={() => void save()} style={styles.headerButton}><Text style={[styles.saveText, busy && styles.disabled]}>{busy ? '保存中' : '保存'}</Text></Pressable></View>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.archiveHeader}><View style={styles.archiveNumber}><Text style={styles.archiveNumberText}>{entry ? 'EDIT' : 'NEW'}</Text></View><View style={styles.archiveCopy}><Text style={styles.archiveEyebrow}>PASSWORD ENTRY</Text><Text style={styles.archiveTitle}>密码记录</Text></View></View>
        <View style={styles.formCard}>
          <Field label="名称（必填）"><TextInput autoCorrect={false} maxLength={256} onChangeText={setName} placeholder="例如：邮箱、社交账号" placeholderTextColor={colors.inkFaint} style={styles.input} value={name} /></Field>
          <Field label="账号"><TextInput autoCapitalize="none" autoCorrect={false} importantForAutofill="no" maxLength={1024} onChangeText={setUsername} placeholder="用户名或邮箱" placeholderTextColor={colors.inkFaint} style={styles.input} textContentType="none" value={username} /></Field>
          <Field label="密码（必填）">
            <View style={styles.passwordRow}><TextInput accessibilityLabel="密码" autoCapitalize="none" autoCorrect={false} importantForAutofill="no" maxLength={4096} onChangeText={setPassword} placeholder="输入密码" placeholderTextColor={colors.inkFaint} secureTextEntry={!passwordVisible} style={styles.passwordInput} textContentType="none" value={password} /><Pressable accessibilityLabel={passwordVisible ? '隐藏密码' : '显示密码'} onPress={() => setPasswordVisible((value) => !value)} style={styles.iconButton}><SymbolView name={{ android: passwordVisible ? 'visibility_off' : 'visibility', ios: passwordVisible ? 'eye.slash' : 'eye', web: passwordVisible ? 'visibility_off' : 'visibility' }} size={20} tintColor={colors.life} type="hierarchical" /></Pressable></View>
            {entry ? <View style={styles.passwordActions}><Pressable accessibilityLabel="复制密码" disabled={!password} onPress={() => void copy()} style={[styles.copyButton, !password && styles.disabled]}><SymbolView name={{ android: 'content_copy', ios: 'doc.on.doc', web: 'content_copy' }} size={16} tintColor={colors.life} type="hierarchical" /><Text style={styles.copyText}>复制密码</Text></Pressable><Text style={styles.copyStatus}>{copied ? '已复制，60 秒后尝试清理' : '密码默认保持遮蔽'}</Text></View> : null}
          </Field>
          <Field label="网址"><TextInput autoCapitalize="none" autoCorrect={false} importantForAutofill="no" keyboardType="url" maxLength={4096} onChangeText={setUrl} placeholder="https://" placeholderTextColor={colors.inkFaint} style={styles.input} textContentType="none" value={url} /></Field>
          <Field label="备注"><TextInput autoCorrect={false} maxLength={65_536} multiline onChangeText={setNote} placeholder="只在解锁后显示" placeholderTextColor={colors.inkFaint} style={[styles.input, styles.noteInput]} textAlignVertical="top" value={note} /></Field>
        </View>
        <Text style={styles.securityNote}>保存后，账号、密码及其他内容会加密存储在本机，不会进入日记数据库。</Text>
        {entry ? <Pressable accessibilityRole="button" disabled={busy} onPress={confirmDelete} style={[styles.deleteButton, busy && styles.disabled]}><Text style={styles.deleteText}>删除这条记录</Text></Pressable> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

function Field({ children, label }: { children: ReactNode; label: string }) { return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text>{children}</View>; }
function errorMessage(cause: unknown) { return cause instanceof Error ? cause.message : '请稍后重试。'; }

const styles = createThemedStyles(() => ({
  flex: { flex: 1 }, safeArea: { flex: 1, backgroundColor: colors.paper }, header: { minHeight: 56, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }, headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, headerTitle: { flex: 1, color: colors.ink, fontFamily: typography.display, fontSize: 18, textAlign: 'center' }, saveText: { color: colors.life, fontSize: typography.size.caption, fontWeight: '800' }, content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  archiveHeader: { padding: spacing.lg, flexDirection: 'row', alignItems: 'center', borderTopRightRadius: radius.xl, borderBottomLeftRadius: radius.xl, backgroundColor: colors.lifeDeep }, archiveNumber: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.onLifeLine, borderRadius: 27 }, archiveNumberText: { color: colors.sun, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1 }, archiveCopy: { marginLeft: spacing.md }, archiveEyebrow: { color: colors.onLifeMuted, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.2 }, archiveTitle: { marginTop: 4, color: colors.onLife, fontFamily: typography.display, fontSize: 24 },
  formCard: { marginTop: spacing.lg, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderRadius: radius.lg, backgroundColor: colors.sheet }, field: { marginTop: spacing.lg }, fieldLabel: { marginBottom: 7, color: colors.inkSoft, fontSize: typography.size.meta, fontWeight: '700' }, input: { minHeight: 50, paddingHorizontal: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: radius.md, color: colors.ink, backgroundColor: colors.paper, fontSize: typography.size.body }, passwordRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.paper }, passwordInput: { flex: 1, minHeight: 48, paddingHorizontal: spacing.md, color: colors.ink, fontSize: typography.size.body }, iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }, passwordActions: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, copyButton: { minHeight: 40, flexDirection: 'row', gap: 6, alignItems: 'center' }, copyText: { color: colors.life, fontSize: typography.size.meta, fontWeight: '700' }, copyStatus: { color: colors.inkFaint, fontSize: 8 }, noteInput: { minHeight: 118, paddingTop: spacing.md }, securityNote: { marginTop: spacing.md, color: colors.inkFaint, fontSize: typography.size.meta, lineHeight: 17 }, deleteButton: { minHeight: 50, marginTop: spacing.xl, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.dangerLine, borderRadius: radius.md }, deleteText: { color: colors.danger, fontSize: typography.size.caption, fontWeight: '800' }, missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }, missingTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 20 }, inlineButton: { minHeight: 44, marginTop: spacing.lg, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.lifeLight }, inlineButtonText: { color: colors.life, fontWeight: '700' }, disabled: { opacity: 0.4 },
}));
