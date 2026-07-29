import { useRouter } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { createThemedStyles } from '../src/theme/app-theme';
import { checkForAndroidUpdate, downloadAndInstallAndroidUpdate, getCurrentAndroidVersion } from '../src/update/android-update';

export default function AboutScreen() {
  const router = useRouter();
  const [updateState, setUpdateState] = useState<'idle' | 'checking' | 'downloading'>('idle');
  const currentVersion = getCurrentAndroidVersion();

  const checkUpdate = async () => {
    setUpdateState('checking');
    try {
      const result = await checkForAndroidUpdate();
      if (result.status === 'not-configured') {
        Alert.alert('暂未配置更新服务器', '请先填写 Android 更新清单地址。');
      } else if (result.status === 'unsupported') {
        Alert.alert('当前平台不支持', 'APK 自动更新仅支持 Android 安装包。');
      } else if (result.status === 'current') {
        Alert.alert('已是最新版本', `当前版本 ${currentVersion.versionName}`);
      } else {
        const { manifest } = result;
        Alert.alert(`发现新版本 ${manifest.versionName}`, manifest.releaseNotes || '新版本已经可以下载。', [
          { text: '取消', style: 'cancel' },
          { text: '下载更新', onPress: () => void installUpdate(manifest) },
        ]);
      }
    } catch (cause) {
      Alert.alert('检查更新失败', errorMessage(cause));
    } finally {
      setUpdateState('idle');
    }
  };

  const installUpdate = async (manifest: Parameters<typeof downloadAndInstallAndroidUpdate>[0]) => {
    setUpdateState('downloading');
    try {
      const result = await downloadAndInstallAndroidUpdate(manifest);
      if (result === 'permission-required') Alert.alert('需要安装权限', '请允许“仍在”安装未知应用，返回后再次检查更新。');
    } catch (cause) {
      Alert.alert('更新失败', errorMessage(cause));
    } finally {
      setUpdateState('idle');
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
        <Pressable accessibilityRole="button" disabled={updateState !== 'idle'} onPress={() => void checkUpdate()} style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
          <View style={styles.linkIcon}><SymbolView name={{ android: 'system_update', ios: 'arrow.down.circle', web: 'system_update' }} size={20} tintColor={colors.life} type="hierarchical" /></View>
          <View style={styles.linkCopy}>
            <Text style={styles.linkText}>{updateState === 'checking' ? '正在检查更新…' : updateState === 'downloading' ? '正在下载更新…' : '检查更新'}</Text>
            <Text style={styles.linkHint}>{Platform.OS === 'android' ? '启动时也会自动检查' : '仅 Android APK 支持'}</Text>
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
