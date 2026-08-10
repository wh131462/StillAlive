import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { File } from 'expo-file-system';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { useAppState } from '../src/state/app-state';
import { createThemedStyles } from '../src/theme/app-theme';
import { backupContainsPasswordVault, createBackupArchive, localPasswordVaultExists, materializeBackupMedia, parseBackupArchive, removeMaterializedMedia, restorePasswordVaultFromBackup } from '../src/data/local-backup';
import type { MaterializedBackup, ParsedBackup } from '../src/data/local-backup';

export default function BackupScreen() {
  const router = useRouter();
  const { createBackupSnapshot, deleteAllLocalData, media, people, posts, preferences, recordBackupExport, restoreBackupSnapshot } = useAppState();
  const [busy, setBusy] = useState<'export' | 'restore' | null>(null);
  const [selectedBackup, setSelectedBackup] = useState<ParsedBackup | null>(null);
  const [backupMasterPassword, setBackupMasterPassword] = useState('');
  const [currentMasterPassword, setCurrentMasterPassword] = useState('');
  const hasLocalVault = localPasswordVaultExists();
  const estimatedBytes = media.reduce((total, item) => {
    const file = new File(item.localPath);
    return total + (file.exists ? file.size : 0);
  }, posts.reduce((total, post) => total + post.bodyMarkdown.length * 2, 4096));

  const exportBackup = async () => {
    try {
      setBusy('export');
      const archive = await createBackupArchive(await createBackupSnapshot());
      if (!await Sharing.isAvailableAsync()) { Alert.alert('备份已经生成', `文件大小 ${formatBytes(archive.size)}，但当前设备不支持系统分享。`); return; }
      await Sharing.shareAsync(archive.uri, { dialogTitle: '导出“仍在”备份', mimeType: 'application/zip', UTI: 'public.zip-archive' });
      await recordBackupExport();
    } catch (cause: unknown) { Alert.alert('导出失败', errorMessage(cause)); }
    finally { setBusy(null); }
  };

  const chooseBackup = async () => {
    try {
      setBusy('restore');
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false, type: ['application/zip', 'application/x-zip-compressed'] });
      if (result.canceled) return;
      setSelectedBackup(await parseBackupArchive(result.assets[0].uri));
      setBackupMasterPassword('');
      setCurrentMasterPassword('');
    } catch (cause: unknown) { Alert.alert('无法读取备份', errorMessage(cause)); }
    finally { setBusy(null); }
  };

  const confirmRestore = (parsed: ParsedBackup) => {
    const { snapshot } = parsed;
    Alert.alert('检查到有效备份', `导出于 ${formatDateTime(parsed.exportedAt)}\n包含 ${snapshot.posts.length} 篇日记、${snapshot.people.length} 个人物和 ${snapshot.media.length} 个媒体文件。\n\n继续后，当前设备上的全部内容将被替换。`, [
      { text: '取消', style: 'cancel' },
      { text: '继续', onPress: () => Alert.alert('最后确认', '恢复无法撤销。建议先导出当前数据，再覆盖恢复。', [
        { text: '暂不恢复', style: 'cancel' },
        { text: '覆盖并恢复', style: 'destructive', onPress: () => void executeRestore(parsed) },
      ]) },
    ]);
  };

  const executeRestore = async (parsed: ParsedBackup) => {
    let materialized: MaterializedBackup | null = null;
    try {
      setBusy('restore');
      materialized = materializeBackupMedia(parsed);
      await restoreBackupSnapshot(materialized.snapshot);
      Alert.alert('恢复完成', '备份中的日记、人物和媒体已经恢复到本机。');
    } catch (cause: unknown) {
      if (materialized) removeMaterializedMedia(materialized);
      Alert.alert('恢复失败', errorMessage(cause));
    } finally { setBusy(null); }
  };

  const confirmVaultRestore = (parsed: ParsedBackup) => {
    if (!backupMasterPassword) { Alert.alert('请输入备份主密码', '需要先验证备份中密码本对应的主密码。'); return; }
    if (hasLocalVault && !currentMasterPassword) { Alert.alert('请输入当前主密码', '替换当前密码本前，需要先验证当前密码本。'); return; }
    Alert.alert(hasLocalVault ? '替换当前密码本？' : '恢复备份中的密码本？', hasLocalVault ? '当前密码本会被备份中的加密密码本替换。日记和媒体不受这一步影响。' : '将把备份中的加密密码本恢复到本机。生物识别快捷解锁不会随备份恢复。', [
      { text: '取消', style: 'cancel' },
      { text: hasLocalVault ? '验证并替换' : '验证并恢复', style: hasLocalVault ? 'destructive' : 'default', onPress: () => void executeVaultRestore(parsed) },
    ]);
  };

  const executeVaultRestore = async (parsed: ParsedBackup) => {
    try {
      setBusy('restore');
      await restorePasswordVaultFromBackup(parsed, backupMasterPassword, hasLocalVault ? currentMasterPassword : null);
      setBackupMasterPassword('');
      setCurrentMasterPassword('');
      Alert.alert('密码本恢复完成', '请使用备份对应的主密码进入密码本。如需快捷解锁，请重新启用生物识别。');
    } catch (cause: unknown) { Alert.alert('密码本恢复失败', errorMessage(cause)); }
    finally { setBusy(null); }
  };

  const confirmDeleteAll = () => {
    Alert.alert('删除这台设备上的全部内容？', '日记、草稿、人物、图片、密码本和设置都会被真实删除。之前导出的备份文件不会被删除。', [
      { text: '取消', style: 'cancel' },
      { text: '继续', onPress: () => Alert.alert('最后确认', '这个操作无法撤销。确定清空“仍在”的全部本地数据吗？', [
        { text: '保留数据', style: 'cancel' },
        { text: '全部删除', style: 'destructive', onPress: () => void deleteAllLocalData().then(() => router.replace('/'), (cause: unknown) => Alert.alert('删除失败', errorMessage(cause))) },
      ]) },
    ]);
  };

  const disabled = busy !== null;
  return <SafeAreaView style={styles.safeArea}>
    <View style={styles.header}><Pressable accessibilityLabel="返回" onPress={() => router.back()} style={styles.headerButton}><SymbolView name={{ android: 'chevron_left', ios: 'chevron.left', web: 'chevron_left' }} size={22} tintColor={colors.inkSoft} type="hierarchical" /></Pressable><Text style={styles.headerTitle}>数据管理</Text><View style={styles.headerButton} /></View>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.summary}><View style={styles.summaryIcon}><SymbolView name={{ android: 'inventory_2', ios: 'archivebox', web: 'inventory_2' }} size={25} tintColor={colors.life} type="hierarchical" /></View><View style={styles.summaryCopy}><Text style={styles.summaryTitle}>当前本地数据</Text><Text style={styles.summaryMeta}>{posts.length} 篇日记 · {people.length} 个人物 · {media.length} 个媒体文件</Text><Text style={styles.summaryMeta}>预计 {formatBytes(estimatedBytes)}</Text></View></View>

      <Text style={styles.eyebrow}>EXPORT</Text><Text style={styles.sectionTitle}>导出完整备份</Text><Text style={styles.sectionText}>生成 ZIP 文件，包含结构化数据、Markdown 正文和原始媒体文件。密码本存在时，只附加原始加密文件，不生成明文密码清单。</Text>
      <Pressable accessibilityRole="button" disabled={disabled} onPress={() => void exportBackup()} style={({ pressed }) => [styles.primaryButton, disabled && styles.disabled, pressed && styles.pressed]}><SymbolView name={{ android: 'ios_share', ios: 'square.and.arrow.up', web: 'ios_share' }} size={19} tintColor={colors.onLife} type="hierarchical" /><Text style={styles.primaryText}>{busy === 'export' ? '正在生成备份…' : '导出备份'}</Text></Pressable>
      <Text style={styles.lastExport}>{preferences.lastExportAt ? `上次导出 ${formatDateTime(preferences.lastExportAt)}` : '尚未导出过备份'}</Text>

      <View style={styles.rule} /><Text style={styles.eyebrow}>RESTORE</Text><Text style={styles.sectionTitle}>从备份恢复</Text><Text style={styles.sectionText}>先校验 ZIP。日记数据和密码本分别确认；旧备份或仅恢复日记时，会保留当前密码本。</Text>
      <Pressable accessibilityRole="button" disabled={disabled} onPress={() => void chooseBackup()} style={({ pressed }) => [styles.secondaryButton, disabled && styles.disabled, pressed && styles.pressed]}><SymbolView name={{ android: 'restore', ios: 'arrow.counterclockwise', web: 'restore' }} size={19} tintColor={colors.life} type="hierarchical" /><Text style={styles.secondaryText}>{busy === 'restore' ? '正在读取备份…' : '选择备份文件'}</Text></Pressable>
      {selectedBackup ? <View style={styles.selectedBackup}>
        <Text style={styles.selectedEyebrow}>VALID BACKUP</Text><Text style={styles.selectedTitle}>已通过结构与摘要校验</Text><Text style={styles.selectedMeta}>导出于 {formatDateTime(selectedBackup.exportedAt)}</Text><Text style={styles.selectedMeta}>{selectedBackup.snapshot.posts.length} 篇日记 · {selectedBackup.snapshot.people.length} 个人物 · {selectedBackup.snapshot.media.length} 个媒体文件</Text>
        <Pressable disabled={disabled} onPress={() => confirmRestore(selectedBackup)} style={[styles.restoreDataButton, disabled && styles.disabled]}><Text style={styles.restoreDataText}>恢复日记、人物和媒体</Text></Pressable>
        {backupContainsPasswordVault(selectedBackup) ? <View style={styles.vaultRestore}>
          <View style={styles.vaultRestoreHeading}><View style={styles.vaultRestoreIcon}><SymbolView name={{ android: 'key', ios: 'key', web: 'key' }} size={20} tintColor={colors.sun} type="hierarchical" /></View><View style={styles.vaultRestoreCopy}><Text style={styles.vaultRestoreTitle}>备份包含加密密码本</Text><Text style={styles.vaultRestoreHint}>{hasLocalVault ? '验证两边主密码后，才会替换当前密码本。' : '输入备份主密码完成认证解密验证。'}</Text></View></View>
          <Text style={styles.inputLabel}>备份密码本主密码</Text><TextInput accessibilityLabel="备份密码本主密码" autoCapitalize="none" autoCorrect={false} importantForAutofill="no" onChangeText={setBackupMasterPassword} placeholder="输入备份对应的主密码" placeholderTextColor={colors.inkFaint} secureTextEntry style={styles.input} textContentType="none" value={backupMasterPassword} />
          {hasLocalVault ? <><Text style={styles.inputLabel}>当前密码本主密码</Text><TextInput accessibilityLabel="当前密码本主密码" autoCapitalize="none" autoCorrect={false} importantForAutofill="no" onChangeText={setCurrentMasterPassword} placeholder="验证当前密码本" placeholderTextColor={colors.inkFaint} secureTextEntry style={styles.input} textContentType="none" value={currentMasterPassword} /></> : null}
          <Pressable disabled={disabled} onPress={() => confirmVaultRestore(selectedBackup)} style={[styles.restoreVaultButton, disabled && styles.disabled]}><Text style={styles.restoreVaultText}>{hasLocalVault ? '验证并替换密码本' : '验证并恢复密码本'}</Text></Pressable>
        </View> : <Text style={styles.noVaultText}>这个历史备份不包含密码本；恢复日记不会删除当前密码本。</Text>}
      </View> : null}
      <View style={styles.notice}><SymbolView name={{ android: 'lock_outline', ios: 'lock', web: 'lock_outline' }} size={17} tintColor={colors.inkFaint} type="hierarchical" /><Text style={styles.noticeText}>备份只会在你主动导出时离开应用私有目录。</Text></View>

      <View style={styles.rule} />
      <Text style={styles.dangerEyebrow}>DANGER ZONE</Text>
      <Text style={styles.sectionTitle}>危险操作</Text>
      <Pressable accessibilityRole="button" disabled={disabled} onPress={confirmDeleteAll} style={({ pressed }) => [styles.deleteButton, disabled && styles.disabled, pressed && styles.pressed]}><Text style={styles.deleteTitle}>删除全部本地数据</Text><Text style={styles.deleteHint}>不可撤销；建议先导出备份</Text></Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

function formatBytes(bytes: number) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
function formatDateTime(iso: string) { const date = new Date(iso); if (Number.isNaN(date.getTime())) return iso; return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`; }
function errorMessage(cause: unknown) { return cause instanceof Error ? cause.message : '请稍后重试。'; }

const styles = createThemedStyles(() => ({
  flex: { flex: 1 }, safeArea: { flex: 1, backgroundColor: colors.paper }, header: { minHeight: 56, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }, headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, headerTitle: { flex: 1, color: colors.ink, fontFamily: typography.display, fontSize: 18, textAlign: 'center' }, content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  summary: { padding: spacing.lg, flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, backgroundColor: colors.sheet }, summaryIcon: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 26, backgroundColor: colors.lifeLight }, summaryCopy: { flex: 1, marginLeft: spacing.md }, summaryTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 18 }, summaryMeta: { marginTop: 5, color: colors.inkFaint, fontSize: 9 },
  eyebrow: { marginTop: spacing.xl, color: colors.life, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1.3 }, sectionTitle: { marginTop: spacing.sm, color: colors.ink, fontFamily: typography.display, fontSize: 24 }, sectionText: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: 10, lineHeight: 19 }, primaryButton: { minHeight: 52, marginTop: spacing.lg, flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life }, primaryText: { color: colors.onLife, fontSize: 11, fontWeight: '700' }, lastExport: { marginTop: spacing.sm, color: colors.inkFaint, fontSize: 8, textAlign: 'center' }, rule: { height: StyleSheet.hairlineWidth, marginTop: spacing.xl, backgroundColor: colors.line }, secondaryButton: { minHeight: 52, marginTop: spacing.lg, flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.life, borderRadius: radius.md }, secondaryText: { color: colors.life, fontSize: 11, fontWeight: '700' }, notice: { marginTop: spacing.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, noticeText: { marginLeft: spacing.sm, color: colors.inkFaint, fontSize: 9 }, disabled: { opacity: 0.4 }, pressed: { opacity: 0.72 },
  dangerEyebrow: { marginTop: spacing.xl, color: colors.danger, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1.3 }, deleteButton: { minHeight: 72, marginTop: spacing.lg, paddingHorizontal: spacing.md, justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.dangerLine, borderRadius: radius.md }, deleteTitle: { color: colors.danger, fontSize: typography.size.caption, fontWeight: '800' }, deleteHint: { marginTop: 5, color: colors.inkFaint, fontSize: typography.size.meta },
  selectedBackup: { marginTop: spacing.lg, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderRadius: radius.lg, backgroundColor: colors.sheet }, selectedEyebrow: { color: colors.life, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.2 }, selectedTitle: { marginTop: spacing.xs, color: colors.ink, fontFamily: typography.display, fontSize: 19 }, selectedMeta: { marginTop: 5, color: colors.inkFaint, fontSize: typography.size.meta }, restoreDataButton: { minHeight: 48, marginTop: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.lifeLight }, restoreDataText: { color: colors.life, fontSize: typography.size.caption, fontWeight: '800' }, vaultRestore: { marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }, vaultRestoreHeading: { flexDirection: 'row', alignItems: 'center' }, vaultRestoreIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: colors.sunLight }, vaultRestoreCopy: { flex: 1, marginLeft: spacing.md }, vaultRestoreTitle: { color: colors.ink, fontSize: typography.size.caption, fontWeight: '800' }, vaultRestoreHint: { marginTop: 4, color: colors.inkFaint, fontSize: typography.size.meta, lineHeight: 15 }, inputLabel: { marginTop: spacing.md, marginBottom: 6, color: colors.inkSoft, fontSize: typography.size.meta, fontWeight: '700' }, input: { minHeight: 48, paddingHorizontal: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: radius.md, color: colors.ink, backgroundColor: colors.paper }, restoreVaultButton: { minHeight: 48, marginTop: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.lifeDeep }, restoreVaultText: { color: colors.onLife, fontSize: typography.size.caption, fontWeight: '800' }, noVaultText: { marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, color: colors.inkFaint, fontSize: typography.size.meta, lineHeight: 16 },
}));
