import { useState } from 'react';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { File } from 'expo-file-system';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { useAppState } from '../../src/state/app-state';
import {
  createBackupArchive,
  materializeBackupMedia,
  parseBackupArchive,
  removeMaterializedMedia,
} from '../../src/data/local-backup';
import type { ParsedBackup } from '../../src/data/local-backup';

export default function DataScreen() {
  const router = useRouter();
  const { createBackupSnapshot, media, people, posts, recordBackupExport, restoreBackupSnapshot } = useAppState();
  const [busy, setBusy] = useState<'export' | 'restore' | null>(null);
  const estimatedBytes = media.reduce((total, item) => {
    const file = new File(item.localPath);
    return total + (file.exists ? file.size : 0);
  }, posts.reduce((total, post) => total + post.bodyMarkdown.length * 2, 4096));

  const handleExport = async () => {
    try {
      setBusy('export');
      const snapshot = await createBackupSnapshot();
      const archive = await createBackupArchive(snapshot);
      if (!await Sharing.isAvailableAsync()) {
        Alert.alert('备份已经生成', `文件大小 ${formatBytes(archive.size)}，但当前设备不支持系统分享。`);
        return;
      }
      await Sharing.shareAsync(archive.uri, {
        dialogTitle: '导出“仍在”备份',
        mimeType: 'application/zip',
        UTI: 'public.zip-archive',
      });
      await recordBackupExport();
    } catch (cause: unknown) {
      Alert.alert('导出失败', errorMessage(cause));
    } finally {
      setBusy(null);
    }
  };

  const handleChooseBackup = async () => {
    try {
      setBusy('restore');
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: ['application/zip', 'application/x-zip-compressed'],
      });
      if (result.canceled) return;
      const parsed = await parseBackupArchive(result.assets[0].uri);
      confirmRestore(parsed);
    } catch (cause: unknown) {
      Alert.alert('无法读取备份', errorMessage(cause));
    } finally {
      setBusy(null);
    }
  };

  const confirmRestore = (parsed: ParsedBackup) => {
    const { snapshot } = parsed;
    Alert.alert(
      '检查到有效备份',
      `导出于 ${formatDateTime(parsed.exportedAt)}\n包含 ${snapshot.posts.length} 篇日记、${snapshot.people.length} 个人物和 ${snapshot.media.length} 张图片。\n\n继续后，当前设备上的全部内容将被替换。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '继续',
          onPress: () => Alert.alert(
            '最后确认',
            '恢复无法撤销。建议先导出当前数据，再覆盖恢复。',
            [
              { text: '暂不恢复', style: 'cancel' },
              { text: '覆盖并恢复', style: 'destructive', onPress: () => void executeRestore(parsed) },
            ],
          ),
        },
      ],
    );
  };

  const executeRestore = async (parsed: ParsedBackup) => {
    let materialized: ReturnType<typeof materializeBackupMedia> | null = null;
    try {
      setBusy('restore');
      materialized = materializeBackupMedia(parsed);
      await restoreBackupSnapshot(materialized);
      Alert.alert('恢复完成', '备份中的日记、人物和图片已经恢复到本机。');
    } catch (cause: unknown) {
      if (materialized) removeMaterializedMedia(materialized);
      Alert.alert('恢复失败', errorMessage(cause));
    } finally {
      setBusy(null);
    }
  };

  const disabled = busy !== null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>YOURS, ALWAYS</Text>
        <Text style={styles.title}>你的日子，{`\n`}只属于你。</Text>
        <Text style={styles.description}>没有账号，也没有云端副本。主动导出，是把这份生命档案真正拿在自己手里。</Text>

        <View style={styles.stats}>
          <Stat value={posts.length} label="篇日记" />
          <View style={styles.statDivider} />
          <Stat value={people.length} label="个人物" />
          <View style={styles.statDivider} />
          <Stat value={media.length} label="张图片" />
        </View>

        <View style={styles.card}>
          <View style={styles.cardMark} />
          <Text style={styles.cardEyebrow}>完整备份</Text>
          <Text style={styles.cardTitle}>带走所有留下的内容</Text>
          <Text style={styles.cardText}>ZIP 中包含结构化 JSON、可直接阅读的 Markdown 和原始图片，并附带完整性校验清单。预计约 {formatBytes(estimatedBytes)}，导出后由系统选择保存位置。</Text>
          <Pressable accessibilityRole="button" disabled={disabled} onPress={() => void handleExport()} style={({ pressed }) => [styles.primaryButton, disabled && styles.disabled, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>{busy === 'export' ? '正在整理备份…' : '导出完整备份'}</Text>
          </Pressable>
        </View>

        <View style={styles.restoreSection}>
          <Text style={styles.restoreTitle}>从备份恢复</Text>
          <Text style={styles.restoreText}>只接受“仍在”导出的 ZIP。恢复前会校验文件，确认后整体替换当前数据。</Text>
          <Pressable accessibilityRole="button" disabled={disabled} onPress={() => void handleChooseBackup()} style={({ pressed }) => [styles.secondaryButton, disabled && styles.disabled, pressed && styles.pressed]}>
            <Text style={styles.secondaryButtonText}>{busy === 'restore' ? '正在处理备份…' : '选择备份文件'}</Text>
          </Pressable>
        </View>

        <Pressable accessibilityRole="button" onPress={() => router.push('/settings')} style={({ pressed }) => [styles.settingsRow, pressed && styles.pressed]}>
          <View><Text style={styles.settingsTitle}>偏好与隐私</Text><Text style={styles.settingsHint}>昵称、出生日期、回忆开关和本地数据</Text></View>
          <Text style={styles.settingsArrow}>›</Text>
        </Pressable>

        <View style={styles.privacyNote}>
          <Text style={styles.privacySymbol}>○</Text>
          <Text style={styles.privacyText}>除非你主动导出，正文、人物和图片不会离开这台设备。</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : '请稍后重试。';
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  container: { padding: spacing.lg, paddingBottom: spacing.xxl },
  label: { color: colors.life, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1.5 },
  title: { marginTop: spacing.lg, color: colors.ink, fontFamily: typography.display, fontSize: 36, lineHeight: 47 },
  description: { marginTop: spacing.md, maxWidth: 330, color: colors.inkSoft, fontSize: 12, lineHeight: 21 },
  stats: { minHeight: 82, marginTop: spacing.xl, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: colors.ink, fontFamily: typography.display, fontSize: 24 },
  statLabel: { marginTop: 2, color: colors.inkFaint, fontSize: 9 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: colors.line },
  card: { marginTop: spacing.xl, padding: spacing.lg, overflow: 'hidden', borderTopRightRadius: radius.xl, borderBottomLeftRadius: radius.xl, backgroundColor: colors.life },
  cardMark: { position: 'absolute', top: -44, right: -34, width: 128, height: 128, borderRadius: 64, borderWidth: 22, borderColor: 'rgba(255,255,255,0.08)' },
  cardEyebrow: { color: colors.onLifeMuted, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1.2 },
  cardTitle: { marginTop: spacing.md, color: colors.onLife, fontFamily: typography.display, fontSize: 23 },
  cardText: { marginTop: spacing.sm, color: colors.onLifeMuted, fontSize: 11, lineHeight: 20 },
  primaryButton: { height: 50, marginTop: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.sheet },
  primaryButtonText: { color: colors.life, fontSize: 11, fontWeight: '700' },
  restoreSection: { marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  restoreTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 19 },
  restoreText: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: 11, lineHeight: 20 },
  secondaryButton: { height: 48, marginTop: spacing.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.life, borderRadius: radius.md },
  secondaryButtonText: { color: colors.life, fontSize: 11, fontWeight: '700' },
  privacyNote: { marginTop: spacing.xl, flexDirection: 'row', alignItems: 'center' },
  privacySymbol: { color: colors.sun, fontSize: 18 },
  privacyText: { flex: 1, marginLeft: spacing.sm, color: colors.inkFaint, fontSize: 9, lineHeight: 17 },
  settingsRow: { minHeight: 72, marginTop: spacing.xl, paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  settingsTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 16 },
  settingsHint: { marginTop: 4, color: colors.inkFaint, fontSize: 9 },
  settingsArrow: { color: colors.inkFaint, fontFamily: typography.display, fontSize: 24 },
  disabled: { opacity: 0.42 },
  pressed: { opacity: 0.76 },
});
