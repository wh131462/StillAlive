import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { File } from 'expo-file-system';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { feedback } from '../../shared/feedback';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { AppKeyboardAvoidingView } from '../../shared/components/app-keyboard-avoiding-view';
import { DraggableBottomSheet } from '../../shared/components/draggable-bottom-sheet';
import { useAppState } from '../../application/state/app-state';
import { createThemedStyles } from '../../shared/theme/app-theme';
import { ToolPageHeader } from '../../shared/components/tool-page-header';
import { backupContainsPasswordVault, createBackupArchive, localPasswordVaultExists, materializeBackupMedia, mergeBackupSnapshots, parseBackupArchive, releaseParsedBackup, removeMaterializedMedia, restorePasswordVaultFromBackup } from './local-backup';
import type { MaterializedBackup, ParsedBackup } from './local-backup';

export default function BackupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { createBackupSnapshot, deleteAllLocalData, media, people, posts, preferences, recordBackupExport, restoreBackupSnapshot } = useAppState();
  const [busy, setBusy] = useState<'export' | 'restore' | null>(null);
  const [selectedBackup, setSelectedBackup] = useState<ParsedBackup | null>(null);
  const [importSheetVisible, setImportSheetVisible] = useState(false);
  const [vaultRestoreExpanded, setVaultRestoreExpanded] = useState(false);
  const selectedBackupRef = useRef<ParsedBackup | null>(null);
  const mountedRef = useRef(true);
  const [backupMasterPassword, setBackupMasterPassword] = useState('');
  const [currentMasterPassword, setCurrentMasterPassword] = useState('');
  const hasLocalVault = localPasswordVaultExists();
  const replaceSelectedBackup = (next: ParsedBackup | null) => {
    const previous = selectedBackupRef.current;
    if (previous && previous !== next) releaseParsedBackup(previous);
    selectedBackupRef.current = next;
    setSelectedBackup(next);
  };
  useEffect(() => () => {
    mountedRef.current = false;
    if (selectedBackupRef.current) releaseParsedBackup(selectedBackupRef.current);
  }, []);
  const estimatedBytes = media.reduce((total, item) => {
    const file = new File(item.localPath);
    return total + (file.exists ? file.size : 0);
  }, posts.reduce((total, post) => total + post.bodyMarkdown.length * 2, 4096));

  const exportBackup = async () => {
    try {
      setBusy('export');
      const archive = await createBackupArchive(await createBackupSnapshot());
      if (!await Sharing.isAvailableAsync()) { feedback.alert('备份已经生成', `文件大小 ${formatBytes(archive.size)}，但当前设备不支持系统分享。`); return; }
      await Sharing.shareAsync(archive.uri, { dialogTitle: '导出“仍在”备份', mimeType: 'application/zip', UTI: 'public.zip-archive' });
      await recordBackupExport();
    } catch (cause: unknown) { feedback.alert('导出失败', errorMessage(cause)); }
    finally { setBusy(null); }
  };

  const chooseBackup = async () => {
    try {
      setBusy('restore');
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false, type: ['application/zip', 'application/x-zip-compressed'] });
      if (result.canceled) return;
      setBackupMasterPassword('');
      setCurrentMasterPassword('');
      setVaultRestoreExpanded(false);
      const parsed = await parseBackupArchive(result.assets[0].uri);
      if (!mountedRef.current) { releaseParsedBackup(parsed); return; }
      replaceSelectedBackup(parsed);
      setImportSheetVisible(true);
    } catch (cause: unknown) { feedback.alert('无法读取备份', errorMessage(cause)); }
    finally { setBusy(null); }
  };

  const confirmRestore = (parsed: ParsedBackup) => {
    const { snapshot } = parsed;
    feedback.alert('选择导入方式', `导出于 ${formatDateTime(parsed.exportedAt)}\n包含 ${snapshot.posts.length} 条记录、${snapshot.people.length} 个人物和 ${snapshot.media.length} 个媒体文件。\n\n合并会保留当前设置并补充备份内容；覆盖会替换当前记录。`, [
      { text: '取消', style: 'cancel' },
      { text: '合并导入', onPress: () => void executeRestore(parsed, 'merge') },
      { text: '覆盖恢复', style: 'destructive', onPress: () => feedback.alert('最后确认', '覆盖恢复无法撤销。建议先导出当前数据，再继续。', [
        { text: '暂不恢复', style: 'cancel' },
        { text: '覆盖并恢复', style: 'destructive', onPress: () => void executeRestore(parsed, 'replace') },
      ]) },
    ]);
  };

  const executeRestore = async (parsed: ParsedBackup, mode: 'merge' | 'replace') => {
    let materialized: MaterializedBackup | null = null;
    try {
      setBusy('restore');
      if (mode === 'merge') {
        const current = await createBackupSnapshot();
        const snapshot = mergeBackupSnapshots(current, parsed.snapshot);
        materialized = materializeBackupMedia(parsed, { snapshot, retainedMedia: current.media });
      } else {
        materialized = materializeBackupMedia(parsed);
      }
      await restoreBackupSnapshot(materialized.snapshot);
      setImportSheetVisible(false);
      feedback.alert(mode === 'merge' ? '合并完成' : '恢复完成', mode === 'merge' ? '当前数据已保留，备份中的新内容和较新记录已经导入。' : '备份中的记录、人物和媒体已经恢复到本机。');
    } catch (cause: unknown) {
      if (materialized) removeMaterializedMedia(materialized);
      feedback.alert('恢复失败', errorMessage(cause));
    } finally { setBusy(null); }
  };

  const confirmVaultRestore = (parsed: ParsedBackup) => {
    if (!backupMasterPassword) { feedback.alert('请输入备份主密码', '需要先验证备份中密码本对应的主密码。'); return; }
    if (hasLocalVault && !currentMasterPassword) { feedback.alert('请输入当前主密码', '替换当前密码本前，需要先验证当前密码本。'); return; }
    feedback.alert(hasLocalVault ? '替换当前密码本？' : '恢复备份中的密码本？', hasLocalVault ? '当前密码本会被备份中的加密密码本替换。记录和媒体不受这一步影响。' : '将把备份中的加密密码本恢复到本机。生物识别快捷解锁不会随备份恢复。', [
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
      setImportSheetVisible(false);
      feedback.alert('密码本恢复完成', '请使用备份对应的主密码进入密码本。如需快捷解锁，请重新启用生物识别。');
    } catch (cause: unknown) { feedback.alert('密码本恢复失败', errorMessage(cause)); }
    finally { setBusy(null); }
  };

  const confirmDeleteAll = () => {
    feedback.alert('删除这台设备上的全部内容？', '记录、草稿、人物、媒体、密码本和设置都会被真实删除。之前导出的备份文件不会被删除。', [
      { text: '取消', style: 'cancel' },
      { text: '继续', onPress: () => feedback.alert('最后确认', '这个操作无法撤销。确定清空“仍在”的全部本地数据吗？', [
        { text: '保留数据', style: 'cancel' },
        { text: '全部删除', style: 'destructive', onPress: () => void deleteAllLocalData().then(() => router.replace('/'), (cause: unknown) => feedback.alert('删除失败', errorMessage(cause))) },
      ]) },
    ]);
  };

  const disabled = busy !== null;
  return <SafeAreaView style={styles.safeArea}>
    <ToolPageHeader onBack={() => router.back()} title="数据管理" />
    <AppKeyboardAvoidingView style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.summary}><View style={styles.summaryIcon}><SymbolView name={{ android: 'inventory_2', ios: 'archivebox', web: 'inventory_2' }} size={25} tintColor={colors.life} type="hierarchical" /></View><View style={styles.summaryCopy}><Text style={styles.summaryTitle}>当前本地数据</Text><Text style={styles.summaryMeta}>{posts.length} 条记录 / {people.length} 个人物 / {media.length} 个媒体文件</Text><Text style={styles.summaryMeta}>预计 {formatBytes(estimatedBytes)}</Text></View></View>

      <Text style={styles.eyebrow}>IMPORT</Text><Text style={styles.sectionTitle}>导入备份</Text><Text style={styles.sectionText}>选择由“仍在”导出的 ZIP 备份。校验、导入方式和密码本恢复都在下一步抽屉中完成。</Text>
      <Pressable accessibilityRole="button" disabled={disabled} onPress={() => void chooseBackup()} style={({ pressed }) => [styles.primaryButton, disabled && styles.disabled, pressed && styles.pressed]}><SymbolView name={{ android: 'move_to_inbox', ios: 'tray.and.arrow.down', web: 'move_to_inbox' }} size={19} tintColor={colors.onLife} type="hierarchical" /><Text style={styles.primaryText}>{busy === 'restore' ? '正在读取并校验…' : selectedBackup ? '继续导入备份' : '选择备份并开始导入'}</Text></Pressable>

      <View style={styles.rule} /><Text style={styles.eyebrow}>EXPORT</Text><Text style={styles.sectionTitle}>导出完整备份</Text><Text style={styles.sectionText}>生成 ZIP 文件，包含结构化数据、Markdown 正文和原始媒体文件。密码本存在时，只附加原始加密文件，不生成明文密码清单。</Text>
      <Pressable accessibilityRole="button" disabled={disabled} onPress={() => void exportBackup()} style={({ pressed }) => [styles.secondaryButton, disabled && styles.disabled, pressed && styles.pressed]}><SymbolView name={{ android: 'ios_share', ios: 'square.and.arrow.up', web: 'ios_share' }} size={19} tintColor={colors.life} type="hierarchical" /><Text style={styles.secondaryText}>{busy === 'export' ? '正在生成备份…' : '导出备份'}</Text></Pressable>
      <Text style={styles.lastExport}>{preferences.lastExportAt ? `上次导出 ${formatDateTime(preferences.lastExportAt)}` : '尚未导出过备份'}</Text>
      <View style={styles.notice}><SymbolView name={{ android: 'lock_outline', ios: 'lock', web: 'lock_outline' }} size={17} tintColor={colors.inkFaint} type="hierarchical" /><Text style={styles.noticeText}>备份只会在你主动导出时离开应用私有目录。</Text></View>

      <View style={styles.rule} />
      <Text style={styles.dangerEyebrow}>DANGER ZONE</Text>
      <Text style={styles.sectionTitle}>危险操作</Text>
      <View style={styles.dangerCard}>
        <View style={styles.dangerHeading}><View style={styles.dangerIcon}><SymbolView name={{ android: 'warning', ios: 'exclamationmark.triangle', web: 'warning' }} pointerEvents="none" size={22} tintColor={colors.danger} type="hierarchical" /></View><View style={styles.dangerCopy}><Text style={styles.dangerTitle}>删除全部本地数据</Text><Text style={styles.dangerHint}>不可撤销；建议先导出备份</Text></View></View>
        <Pressable accessibilityRole="button" disabled={disabled} onPress={confirmDeleteAll} style={({ pressed }) => [styles.deleteButton, disabled && styles.disabled, pressed && styles.deletePressed]}><SymbolView name={{ android: 'delete_outline', ios: 'trash', web: 'delete_outline' }} pointerEvents="none" size={18} tintColor={colors.onLife} type="hierarchical" /><Text style={styles.deleteButtonText}>删除全部本地数据</Text></Pressable>
      </View>
      </ScrollView>
    </AppKeyboardAvoidingView>
    <DraggableBottomSheet accessibilityLabel="导入备份，向下拖动关闭" accessibilityRole="menu" dismissDisabled={busy === 'restore'} keyboardAvoiding onClose={() => { setImportSheetVisible(false); setVaultRestoreExpanded(false); }} open={importSheetVisible} sheetStyle={[styles.importSheet, { paddingBottom: Math.max(spacing.xl, insets.bottom + spacing.md) }]}>
      <ScrollView contentContainerStyle={styles.importSheetContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.sheetTitle}>导入备份</Text><Text style={styles.sheetSubtitle}>{selectedBackup ? '备份已校验，可以继续导入。' : '选择 ZIP 备份文件，应用会自动完成校验。'}</Text>
        <Pressable accessibilityRole="button" disabled={disabled} onPress={() => void chooseBackup()} style={({ pressed }) => [selectedBackup ? styles.secondaryButton : styles.primaryButton, disabled && styles.disabled, pressed && styles.pressed]}><SymbolView name={{ android: 'move_to_inbox', ios: 'tray.and.arrow.down', web: 'move_to_inbox' }} size={19} tintColor={selectedBackup ? colors.life : colors.onLife} type="hierarchical" /><Text style={selectedBackup ? styles.secondaryText : styles.primaryText}>{busy === 'restore' ? '正在读取并校验…' : selectedBackup ? '重新选择备份文件' : '选择备份并开始导入'}</Text></Pressable>
        {selectedBackup ? <View style={styles.selectedBackup}>
          <Text style={styles.selectedEyebrow}>VALID BACKUP</Text><Text style={styles.selectedTitle}>已通过结构与摘要校验</Text><Text style={styles.selectedMeta}>导出于 {formatDateTime(selectedBackup.exportedAt)}</Text><Text style={styles.selectedMeta}>{selectedBackup.snapshot.posts.length} 条记录 / {selectedBackup.snapshot.people.length} 个人物 / {selectedBackup.snapshot.media.length} 个媒体文件</Text>
          <Pressable accessibilityRole="button" disabled={disabled} onPress={() => confirmRestore(selectedBackup)} style={({ pressed }) => [styles.restoreDataButton, disabled && styles.disabled, pressed && styles.pressed]}><Text style={styles.restoreDataText}>继续选择导入方式</Text></Pressable>
          {backupContainsPasswordVault(selectedBackup) ? <View style={styles.vaultRestore}>
            <Pressable accessibilityRole="button" disabled={disabled} onPress={() => setVaultRestoreExpanded((value) => !value)} style={({ pressed }) => [styles.vaultRestoreToggle, pressed && styles.pressed]}><View style={styles.vaultRestoreToggleCopy}><SymbolView name={{ android: 'key', ios: 'key', web: 'key' }} size={18} tintColor={colors.sun} type="hierarchical" /><Text style={styles.vaultRestoreToggleText}>恢复备份中的密码本</Text></View><SymbolView name={{ android: vaultRestoreExpanded ? 'expand_less' : 'expand_more', ios: vaultRestoreExpanded ? 'chevron.up' : 'chevron.down', web: vaultRestoreExpanded ? 'expand_less' : 'expand_more' }} size={18} tintColor={colors.inkFaint} type="hierarchical" /></Pressable>
            {vaultRestoreExpanded ? <><Text style={styles.vaultRestoreHint}>{hasLocalVault ? '验证两边主密码后，才会替换当前密码本。' : '输入备份主密码完成认证解密验证。'}</Text><Text style={styles.inputLabel}>备份密码本主密码</Text><TextInput accessibilityLabel="备份密码本主密码" autoCapitalize="none" autoCorrect={false} importantForAutofill="no" onChangeText={setBackupMasterPassword} placeholder="输入备份对应的主密码" placeholderTextColor={colors.inkFaint} secureTextEntry style={styles.input} textContentType="none" value={backupMasterPassword} />
              {hasLocalVault ? <><Text style={styles.inputLabel}>当前密码本主密码</Text><TextInput accessibilityLabel="当前密码本主密码" autoCapitalize="none" autoCorrect={false} importantForAutofill="no" onChangeText={setCurrentMasterPassword} placeholder="验证当前密码本" placeholderTextColor={colors.inkFaint} secureTextEntry style={styles.input} textContentType="none" value={currentMasterPassword} /></> : null}
              <Pressable disabled={disabled} onPress={() => confirmVaultRestore(selectedBackup)} style={[styles.restoreVaultButton, disabled && styles.disabled]}><Text style={styles.restoreVaultText}>{hasLocalVault ? '验证并替换密码本' : '验证并恢复密码本'}</Text></Pressable></> : null}
          </View> : <Text style={styles.noVaultText}>这个历史备份不包含密码本。</Text>}
        </View> : null}
      </ScrollView>
    </DraggableBottomSheet>
  </SafeAreaView>;
}

function formatBytes(bytes: number) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
function formatDateTime(iso: string) { const date = new Date(iso); if (Number.isNaN(date.getTime())) return iso; return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`; }
function errorMessage(cause: unknown) { return cause instanceof Error ? cause.message : '请稍后重试。'; }

const styles = createThemedStyles(() => ({
  flex: { flex: 1 }, safeArea: { flex: 1, backgroundColor: colors.paper }, content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  summary: { padding: spacing.lg, flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, backgroundColor: colors.sheet }, summaryIcon: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 26, backgroundColor: colors.lifeLight }, summaryCopy: { flex: 1, marginLeft: spacing.md }, summaryTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 18 }, summaryMeta: { marginTop: 5, color: colors.inkFaint, fontSize: 9 },
  eyebrow: { marginTop: spacing.xl, color: colors.life, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1.3 }, sectionTitle: { marginTop: spacing.sm, color: colors.ink, fontFamily: typography.display, fontSize: 24 }, sectionText: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: 10, lineHeight: 19 }, primaryButton: { minHeight: 52, marginTop: spacing.lg, flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life }, primaryText: { color: colors.onLife, fontSize: 11, fontWeight: '700' }, lastExport: { marginTop: spacing.sm, color: colors.inkFaint, fontSize: 8, textAlign: 'center' }, rule: { height: StyleSheet.hairlineWidth, marginTop: spacing.xl, backgroundColor: colors.line }, secondaryButton: { minHeight: 52, marginTop: spacing.lg, flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.life, borderRadius: radius.md }, secondaryText: { color: colors.life, fontSize: 11, fontWeight: '700' }, notice: { marginTop: spacing.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, noticeText: { marginLeft: spacing.sm, color: colors.inkFaint, fontSize: 9 }, disabled: { opacity: 0.4 }, pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  importSheet: { maxHeight: '90%', paddingHorizontal: spacing.lg, backgroundColor: colors.paper }, importSheetContent: { paddingBottom: spacing.md }, sheetTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 22 }, sheetSubtitle: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: 10, lineHeight: 18 },
  vaultRestoreToggle: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, vaultRestoreToggleCopy: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, vaultRestoreToggleText: { color: colors.ink, fontSize: typography.size.caption, fontWeight: '800' },
  dangerEyebrow: { marginTop: spacing.xl, color: colors.danger, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1.3 }, dangerCard: { marginTop: spacing.lg, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.dangerLine, borderRadius: radius.lg, backgroundColor: colors.dangerLight }, dangerHeading: { minHeight: 48, flexDirection: 'row', alignItems: 'center' }, dangerIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.sheet }, dangerCopy: { flex: 1, marginLeft: spacing.md }, dangerTitle: { color: colors.danger, fontFamily: typography.display, fontSize: 18 }, dangerHint: { marginTop: 4, color: colors.inkSoft, fontSize: typography.size.meta, lineHeight: 16 }, deleteButton: { minHeight: 50, marginTop: spacing.md, flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.danger }, deleteButtonText: { color: colors.onLife, fontSize: typography.size.caption, fontWeight: '800' }, deletePressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  selectedBackup: { marginTop: spacing.lg, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lifeLine, borderRadius: radius.lg, backgroundColor: colors.sheet }, selectedEyebrow: { color: colors.life, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.2 }, selectedTitle: { marginTop: spacing.xs, color: colors.ink, fontFamily: typography.display, fontSize: 19 }, selectedMeta: { marginTop: 5, color: colors.inkFaint, fontSize: typography.size.meta }, restoreDataButton: { minHeight: 48, marginTop: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life }, restoreDataText: { color: colors.onLife, fontSize: typography.size.caption, fontWeight: '800' }, vaultRestore: { marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }, vaultRestoreHint: { marginTop: 4, color: colors.inkFaint, fontSize: typography.size.meta, lineHeight: 15 }, inputLabel: { marginTop: spacing.md, marginBottom: 6, color: colors.inkSoft, fontSize: typography.size.meta, fontWeight: '700' }, input: { minHeight: 48, paddingHorizontal: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: radius.md, color: colors.ink, backgroundColor: colors.paper }, restoreVaultButton: { minHeight: 48, marginTop: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.lifeDeep }, restoreVaultText: { color: colors.onLife, fontSize: typography.size.caption, fontWeight: '800' }, noVaultText: { marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, color: colors.inkFaint, fontSize: typography.size.meta, lineHeight: 16 },
}));
