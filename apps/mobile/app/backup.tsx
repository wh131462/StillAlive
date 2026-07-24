import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { File } from 'expo-file-system';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { useAppState } from '../src/state/app-state';
import { createBackupArchive, materializeBackupMedia, parseBackupArchive, removeMaterializedMedia } from '../src/data/local-backup';
import type { MaterializedBackup, ParsedBackup } from '../src/data/local-backup';

export default function BackupScreen() {
  const router = useRouter();
  const { createBackupSnapshot, media, people, posts, preferences, recordBackupExport, restoreBackupSnapshot } = useAppState();
  const [busy, setBusy] = useState<'export' | 'restore' | null>(null);
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
      confirmRestore(await parseBackupArchive(result.assets[0].uri));
    } catch (cause: unknown) { Alert.alert('无法读取备份', errorMessage(cause)); }
    finally { setBusy(null); }
  };

  const confirmRestore = (parsed: ParsedBackup) => {
    const { snapshot } = parsed;
    Alert.alert('检查到有效备份', `导出于 ${formatDateTime(parsed.exportedAt)}\n包含 ${snapshot.posts.length} 篇日记、${snapshot.people.length} 个人物和 ${snapshot.media.length} 张图片。\n\n继续后，当前设备上的全部内容将被替换。`, [
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
      Alert.alert('恢复完成', '备份中的日记、人物和图片已经恢复到本机。');
    } catch (cause: unknown) {
      if (materialized) removeMaterializedMedia(materialized);
      Alert.alert('恢复失败', errorMessage(cause));
    } finally { setBusy(null); }
  };

  const disabled = busy !== null;
  return <SafeAreaView style={styles.safeArea}>
    <View style={styles.header}><Pressable accessibilityLabel="返回" onPress={() => router.back()} style={styles.headerButton}><SymbolView name={{ android: 'chevron_left', ios: 'chevron.left', web: 'chevron_left' }} size={22} tintColor={colors.inkSoft} type="hierarchical" /></Pressable><Text style={styles.headerTitle}>备份与恢复</Text><View style={styles.headerButton} /></View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.summary}><View style={styles.summaryIcon}><SymbolView name={{ android: 'inventory_2', ios: 'archivebox', web: 'inventory_2' }} size={25} tintColor={colors.life} type="hierarchical" /></View><View style={styles.summaryCopy}><Text style={styles.summaryTitle}>当前本地数据</Text><Text style={styles.summaryMeta}>{posts.length} 篇日记 · {people.length} 个人物 · {media.length} 个媒体文件</Text><Text style={styles.summaryMeta}>预计 {formatBytes(estimatedBytes)}</Text></View></View>

      <Text style={styles.eyebrow}>EXPORT</Text><Text style={styles.sectionTitle}>导出完整备份</Text><Text style={styles.sectionText}>生成 ZIP 文件，包含结构化数据、Markdown 正文和原始媒体文件。</Text>
      <Pressable accessibilityRole="button" disabled={disabled} onPress={() => void exportBackup()} style={({ pressed }) => [styles.primaryButton, disabled && styles.disabled, pressed && styles.pressed]}><SymbolView name={{ android: 'ios_share', ios: 'square.and.arrow.up', web: 'ios_share' }} size={19} tintColor={colors.onLife} type="hierarchical" /><Text style={styles.primaryText}>{busy === 'export' ? '正在生成备份…' : '导出备份'}</Text></Pressable>
      <Text style={styles.lastExport}>{preferences.lastExportAt ? `上次导出 ${formatDateTime(preferences.lastExportAt)}` : '尚未导出过备份'}</Text>

      <View style={styles.rule} /><Text style={styles.eyebrow}>RESTORE</Text><Text style={styles.sectionTitle}>从备份恢复</Text><Text style={styles.sectionText}>恢复会先校验文件，确认后使用备份内容替换当前设备上的全部数据。</Text>
      <Pressable accessibilityRole="button" disabled={disabled} onPress={() => void chooseBackup()} style={({ pressed }) => [styles.secondaryButton, disabled && styles.disabled, pressed && styles.pressed]}><SymbolView name={{ android: 'restore', ios: 'arrow.counterclockwise', web: 'restore' }} size={19} tintColor={colors.life} type="hierarchical" /><Text style={styles.secondaryText}>{busy === 'restore' ? '正在读取备份…' : '选择备份文件'}</Text></Pressable>
      <View style={styles.notice}><SymbolView name={{ android: 'lock_outline', ios: 'lock', web: 'lock_outline' }} size={17} tintColor={colors.inkFaint} type="hierarchical" /><Text style={styles.noticeText}>备份只会在你主动导出时离开应用私有目录。</Text></View>
    </ScrollView>
  </SafeAreaView>;
}

function formatBytes(bytes: number) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
function formatDateTime(iso: string) { const date = new Date(iso); if (Number.isNaN(date.getTime())) return iso; return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`; }
function errorMessage(cause: unknown) { return cause instanceof Error ? cause.message : '请稍后重试。'; }

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper }, header: { minHeight: 56, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }, headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, headerTitle: { flex: 1, color: colors.ink, fontFamily: typography.display, fontSize: 18, textAlign: 'center' }, content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  summary: { padding: spacing.lg, flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, backgroundColor: colors.sheet }, summaryIcon: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 26, backgroundColor: colors.lifeLight }, summaryCopy: { flex: 1, marginLeft: spacing.md }, summaryTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 18 }, summaryMeta: { marginTop: 5, color: colors.inkFaint, fontSize: 9 },
  eyebrow: { marginTop: spacing.xl, color: colors.life, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1.3 }, sectionTitle: { marginTop: spacing.sm, color: colors.ink, fontFamily: typography.display, fontSize: 24 }, sectionText: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: 10, lineHeight: 19 }, primaryButton: { minHeight: 52, marginTop: spacing.lg, flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life }, primaryText: { color: colors.onLife, fontSize: 11, fontWeight: '700' }, lastExport: { marginTop: spacing.sm, color: colors.inkFaint, fontSize: 8, textAlign: 'center' }, rule: { height: StyleSheet.hairlineWidth, marginTop: spacing.xl, backgroundColor: colors.line }, secondaryButton: { minHeight: 52, marginTop: spacing.lg, flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.life, borderRadius: radius.md }, secondaryText: { color: colors.life, fontSize: 11, fontWeight: '700' }, notice: { marginTop: spacing.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, noticeText: { marginLeft: spacing.sm, color: colors.inkFaint, fontSize: 9 }, disabled: { opacity: 0.4 }, pressed: { opacity: 0.72 },
});
