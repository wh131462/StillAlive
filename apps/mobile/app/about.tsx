import { useRouter } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import * as Sharing from 'expo-sharing';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { createThemedStyles } from '../src/theme/app-theme';
import { AndroidUpdateDialog, type AndroidUpdateNotice } from '../src/components/android-update-dialog';
import { checkForAndroidUpdate, getCurrentAndroidVersion, type AndroidUpdateManifest } from '../src/update/android-update';
import { getPersistentLogFile, writePersistentError, writePersistentLog } from '../src/data/persistent-log';

export default function AboutScreen() {
  const router = useRouter();
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateManifest, setUpdateManifest] = useState<AndroidUpdateManifest | null>(null);
  const [updateNotice, setUpdateNotice] = useState<AndroidUpdateNotice | null>(null);
  const [sharingLog, setSharingLog] = useState(false);
  const currentVersion = getCurrentAndroidVersion();

  const shareLog = async () => {
    setSharingLog(true);
    try {
      writePersistentLog('INFO', 'diagnostic.share.requested', { platform: Platform.OS, versionCode: currentVersion.versionCode, versionName: currentVersion.versionName });
      if (!await Sharing.isAvailableAsync()) {
        Alert.alert('当前设备不支持分享', '诊断日志已保存在应用目录中，但无法打开系统分享面板。');
        return;
      }
      await Sharing.shareAsync(getPersistentLogFile().uri, { dialogTitle: '分享“仍在”诊断日志', mimeType: 'text/plain', UTI: 'public.plain-text' });
      writePersistentLog('INFO', 'diagnostic.share.finished');
    } catch (cause) {
      writePersistentError('diagnostic.share.failed', cause);
      Alert.alert('分享日志失败', errorMessage(cause));
    } finally {
      setSharingLog(false);
    }
  };

  const checkUpdate = async () => {
    setUpdateManifest(null);
    setUpdateNotice(null);
    setCheckingUpdate(true);
    try {
      const result = await checkForAndroidUpdate();
      if (result.status === 'not-configured') {
        setUpdateNotice({ title: '更新服务未配置', status: '不可用', message: '请先填写 Android 更新清单地址。' });
      } else if (result.status === 'unsupported') {
        setUpdateNotice({ title: '当前平台不支持', status: '不可用', message: 'APK 自动更新仅支持 Android 安装包。' });
      } else if (result.status === 'current') {
        setUpdateNotice({ title: '已是最新版本', status: '最新', message: `当前版本 v${currentVersion.versionName}，暂无可用更新。` });
      } else {
        setUpdateManifest(result.manifest);
      }
    } catch (cause) {
      setUpdateNotice({ title: '检查更新失败', status: '失败', message: errorMessage(cause), error: true });
    } finally {
      setCheckingUpdate(false);
    }
  };

  return <SafeAreaView style={styles.safeArea}>
    <View style={styles.header}>
      <Pressable accessibilityLabel="返回" accessibilityRole="button" onPress={() => router.back()} style={styles.headerButton}><SymbolView name={{ android: 'chevron_left', ios: 'chevron.left', web: 'chevron_left' }} size={22} tintColor={colors.inkSoft} type="hierarchical" /></Pressable>
      <Text style={styles.headerTitle}>关于</Text>
      <View style={styles.headerButton} />
    </View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Pressable accessibilityLabel="仍在 Logo" accessibilityRole="button" onPress={() => router.push('/debug' as RelativePathString)} style={({ pressed }) => [styles.logoButton, pressed && styles.pressed]}>
          <Image accessibilityLabel="仍在 Logo" source={require('../assets/icon.png')} style={styles.logo} />
        </Pressable>
        <Text style={styles.name}>仍在 Still Alive</Text>
        <Text style={styles.version}>VERSION {currentVersion.versionName} ({currentVersion.versionCode})</Text>
        <Text style={styles.tagline}>把日子留下来，也把自己留在时间里。</Text>
      </View>

      <View style={styles.aboutCard}>
        <Text style={styles.aboutEyebrow}>ABOUT STILL ALIVE</Text>
        <Text style={styles.aboutTitle}>记录当下，也能回望过去</Text>
        <Text style={styles.aboutText}>“仍在”是一款面向个人的生活记录应用。你可以用打卡、日记、人物和相册，留下值得记住的日子。</Text>
      </View>
      <View style={styles.links}>
        <Pressable accessibilityRole="button" disabled={checkingUpdate} onPress={() => void checkUpdate()} style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
          <View style={styles.linkIcon}><SymbolView name={{ android: 'system_update', ios: 'arrow.down.circle', web: 'system_update' }} size={20} tintColor={colors.life} type="hierarchical" /></View>
          <View style={styles.linkCopy}>
            <Text style={styles.linkText}>{checkingUpdate ? '正在检查更新…' : '检查更新'}</Text>
            <Text style={styles.linkHint}>{checkingUpdate ? '正在连接更新服务' : Platform.OS === 'android' ? '启动时也会自动检查' : '仅 Android APK 支持'}</Text>
          </View>
          {checkingUpdate ? <ActivityIndicator color={colors.life} size="small" /> : <SymbolView name={{ android: 'chevron_right', ios: 'chevron.right', web: 'chevron_right' }} size={18} tintColor={colors.inkFaint} type="hierarchical" />}
        </Pressable>
        <View style={styles.separator} />
        <Pressable accessibilityRole="button" disabled={sharingLog} onPress={() => void shareLog()} style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
          <View style={styles.linkIcon}><SymbolView name={{ android: 'share', ios: 'square.and.arrow.up', web: 'share' }} size={20} tintColor={colors.life} type="hierarchical" /></View>
          <View style={styles.linkCopy}>
            <Text style={styles.linkText}>{sharingLog ? '正在准备日志…' : '分享诊断日志'}</Text>
            <Text style={styles.linkHint}>仅包含运行状态，不包含你的记录内容</Text>
          </View>
          <SymbolView name={{ android: 'chevron_right', ios: 'chevron.right', web: 'chevron_right' }} size={18} tintColor={colors.inkFaint} type="hierarchical" />
        </Pressable>
        <View style={styles.separator} />
        <Pressable accessibilityRole="button" onPress={() => router.push('/privacy-policy' as RelativePathString)} style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
          <View style={styles.linkIcon}><SymbolView name={{ android: 'shield', ios: 'checkmark.shield', web: 'shield' }} size={20} tintColor={colors.life} type="hierarchical" /></View>
          <View style={styles.linkCopy}><Text style={styles.linkText}>隐私协议</Text></View>
          <SymbolView name={{ android: 'chevron_right', ios: 'chevron.right', web: 'chevron_right' }} size={18} tintColor={colors.inkFaint} type="hierarchical" />
        </Pressable>
      </View>
    </ScrollView>
    <AndroidUpdateDialog checking={checkingUpdate} manifest={updateManifest} notice={updateNotice} onDismiss={() => { setUpdateManifest(null); setUpdateNotice(null); }} />
  </SafeAreaView>;
}

const styles = createThemedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  header: { minHeight: 56, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: colors.ink, fontFamily: typography.display, fontSize: 18, textAlign: 'center' },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  hero: { alignItems: 'center', paddingVertical: spacing.xl },
  logoButton: { width: 132, height: 132, overflow: 'hidden', borderRadius: 34, backgroundColor: colors.life, shadowColor: colors.ink, shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  logo: { width: '100%', height: '100%' },
  name: { marginTop: spacing.lg, color: colors.ink, fontFamily: typography.display, fontSize: 26 },
  version: { marginTop: spacing.sm, color: colors.life, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.2 },
  tagline: { marginTop: spacing.md, color: colors.inkSoft, fontSize: typography.size.caption },
  aboutCard: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.sheet },
  aboutEyebrow: { color: colors.life, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.1 },
  aboutTitle: { marginTop: spacing.sm, color: colors.ink, fontFamily: typography.display, fontSize: 20 },
  aboutText: { marginTop: spacing.md, color: colors.inkSoft, fontSize: typography.size.caption, lineHeight: 20 },
  links: { marginTop: spacing.md, overflow: 'hidden', borderRadius: radius.lg, backgroundColor: colors.sheet },
  link: { minHeight: 64, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center' },
  linkIcon: { width: 36, height: 36, marginRight: spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: colors.lifeLight },
  linkCopy: { flex: 1 },
  linkText: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  linkHint: { marginTop: 4, color: colors.inkFaint, fontSize: typography.size.meta },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 64, backgroundColor: colors.line },
  pressed: { opacity: 0.76, transform: [{ scale: 0.97 }] },
}));

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : '请稍后重试。';
}
