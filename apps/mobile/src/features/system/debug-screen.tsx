import { isRunningInExpoGo } from 'expo';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { getLastBirthdayNotificationResponse, expoBirthdayNotificationAdapter, scheduleDebugNotification } from '../../infrastructure/notifications/expo-notifications';
import { AndroidUpdateDialog } from './android-update-dialog';
import { createThemedStyles } from '../../shared/theme/app-theme';
import { ToolPageHeader } from '../../shared/components/tool-page-header';
import type { AndroidUpdateManifest } from './android-update';

type Permission = 'granted' | 'denied' | 'undetermined';

const DEBUG_UPDATE_MANIFEST: AndroidUpdateManifest = {
  versionCode: 999_999,
  versionName: '9.9.9',
  apkUrl: '',
  releaseNotes: '全新更新下载面板\n实时展示下载进度、速度与剩余时间\n优化安装授权和失败重试提示',
};

export default function DebugScreen() {
  const router = useRouter();
  const [permission, setPermission] = useState<Permission>('undetermined');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [updatePreviewVisible, setUpdatePreviewVisible] = useState(false);

  const refreshPermission = async () => setPermission(await expoBirthdayNotificationAdapter.getPermission());
  useEffect(() => { void refreshPermission(); }, []);

  const testNotification = async () => {
    setBusy(true);
    setMessage('正在安排测试通知…');
    try {
      await scheduleDebugNotification();
      setPermission('granted');
      setMessage('已安排，约 1 秒后检查系统通知栏。');
    } catch (cause: unknown) {
      await refreshPermission();
      setMessage(cause instanceof Error ? cause.message : '通知测试失败，请稍后重试。');
    } finally {
      setBusy(false);
    }
  };

  const lastResponse = getLastBirthdayNotificationResponse();
  return <SafeAreaView style={styles.safeArea}>
    <ToolPageHeader onBack={() => router.back()} title="调试" />
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>NOTIFICATION LAB</Text>
      <Text style={styles.title}>通知测试</Text>
      <Text style={styles.subtitle}>这条测试消息只在本机安排，不会发送到任何其他设备。</Text>

      <View style={styles.statusCard}>
        <StatusRow label="系统" value={Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : Platform.OS} />
        <View style={styles.separator} />
        <StatusRow label="运行方式" value={Platform.OS === 'android' && isRunningInExpoGo() ? 'Expo Go（Android 不支持）' : '开发构建 / 独立构建'} />
        <View style={styles.separator} />
        <StatusRow label="通知权限" value={permission === 'granted' ? '已允许' : permission === 'denied' ? '未允许' : '尚未询问'} />
      </View>

      <Pressable accessibilityRole="button" disabled={busy} onPress={() => void testNotification()} style={({ pressed }) => [styles.primaryButton, busy && styles.disabled, pressed && styles.pressed]}>
        <Text style={styles.primaryButtonText}>{busy ? '测试中…' : '发送测试通知'}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => void refreshPermission()} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
        <Text style={styles.secondaryButtonText}>刷新权限状态</Text>
      </Pressable>
      {message ? <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text> : null}
      <Text style={styles.detail}>最近一次通知响应：{lastResponse ? '有记录' : '暂无记录'}</Text>

      <Pressable accessibilityRole="button" onPress={() => setUpdatePreviewVisible(true)} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
        <Text style={styles.secondaryButtonText}>模拟更新流程</Text>
      </Pressable>
    </ScrollView>
    <AndroidUpdateDialog manifest={updatePreviewVisible ? DEBUG_UPDATE_MANIFEST : null} onDismiss={() => setUpdatePreviewVisible(false)} simulateDownload />
  </SafeAreaView>;
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.statusRow}><Text style={styles.statusLabel}>{label}</Text><Text style={styles.statusValue}>{value}</Text></View>;
}

const styles = createThemedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  eyebrow: { marginTop: spacing.xl, color: colors.life, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.3 },
  title: { marginTop: spacing.sm, color: colors.ink, fontFamily: typography.display, fontSize: 30 },
  subtitle: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: typography.size.caption, lineHeight: 18 },
  statusCard: { marginTop: spacing.xl, overflow: 'hidden', borderRadius: radius.lg, backgroundColor: colors.sheet },
  statusRow: { minHeight: 58, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusLabel: { color: colors.inkFaint, fontSize: typography.size.caption },
  statusValue: { maxWidth: '68%', color: colors.ink, fontSize: typography.size.caption, fontWeight: '600', textAlign: 'right' },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: spacing.md, backgroundColor: colors.line },
  primaryButton: { minHeight: 52, marginTop: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life },
  primaryButtonText: { color: colors.onLife, fontSize: typography.size.caption, fontWeight: '700' },
  secondaryButton: { minHeight: 48, marginTop: spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.sheet },
  secondaryButtonText: { color: colors.life, fontSize: typography.size.caption, fontWeight: '700' },
  message: { marginTop: spacing.md, color: colors.life, fontSize: typography.size.caption, lineHeight: 18, textAlign: 'center' },
  detail: { marginTop: spacing.xl, color: colors.inkFaint, fontFamily: typography.mono, fontSize: typography.size.meta, textAlign: 'center' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.76 },
}));
