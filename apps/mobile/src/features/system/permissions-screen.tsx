import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { AndroidSymbol, SFSymbol } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { createThemedStyles } from '../../shared/theme/app-theme';
import { openAppSettings } from '../../infrastructure/platform/app-permissions';

interface PermissionGuide {
  androidIcon: AndroidSymbol;
  description: string;
  icon: SFSymbol;
  title: string;
}

const permissionGuides: PermissionGuide[] = [
  {
    androidIcon: 'notifications',
    description: Platform.OS === 'android'
      ? '用于人物生日、回忆提醒和常驻快捷栏。开启对应功能时，系统会询问。'
      : '用于人物生日和回忆提醒。开启对应的提醒开关时，系统会询问。',
    icon: 'bell.badge',
    title: '通知',
  },
  { androidIcon: 'location_on', description: '用于添加当前地点文字或打卡城市。只在使用定位功能时读取，不保存经纬度。', icon: 'location', title: '位置' },
  { androidIcon: 'photo_camera', description: '用于直接拍摄头像或图片。点击拍摄入口时，系统会询问。', icon: 'camera', title: '相机' },
  {
    androidIcon: 'photo_library',
    description: Platform.OS === 'android'
      ? '用于选择头像、图片或视频。Android 使用系统照片选择器，不需要开放整个相册。'
      : '用于选择头像、图片或视频。打开照片选择器时，系统会询问。',
    icon: 'photo.on.rectangle',
    title: '照片',
  },
  { androidIcon: 'mic', description: '用于在日记中录制语音。开始录音时，系统会询问。', icon: 'mic', title: '麦克风' },
];

export default function PermissionsScreen() {
  const router = useRouter();
  const settingsStep = Platform.OS === 'ios'
    ? '在“仍在”的设置页中，找到“照片”“相机”“麦克风”“位置”或“通知”，只开启当前功能需要的一项。'
    : '在“仍在”的应用信息页中，进入“权限”或“通知”，只开启当前功能需要的一项。不同手机的入口名称可能略有不同。';

  return <SafeAreaView style={styles.safeArea}>
    <View style={styles.header}>
      <Pressable accessibilityLabel="返回" accessibilityRole="button" onPress={() => router.back()} style={styles.headerButton}><SymbolView name={{ android: 'chevron_left', ios: 'chevron.left', web: 'chevron_left' }} size={22} tintColor={colors.inkSoft} type="hierarchical" /></Pressable>
      <Text style={styles.headerTitle}>系统权限</Text><View style={styles.headerButton} />
    </View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.summary}>
        <View style={styles.summaryIcon}><SymbolView name={{ android: 'verified_user', ios: 'checkmark.shield', web: 'verified_user' }} size={26} tintColor={colors.life} type="hierarchical" /></View>
        <Text style={styles.summaryTitle}>不需要一次全部开启</Text>
        <Text style={styles.summaryText}>“仍在”只会在你使用相关功能时申请权限。某项功能不可用时，只需处理它对应的权限。</Text>
      </View>

      <Text style={styles.eyebrow}>HOW TO ENABLE</Text>
      <Text style={styles.sectionTitle}>按这 4 步开启</Text>
      <View style={styles.steps}>
        <GuideStep number="1" title="先使用一次对应功能" description="首次使用时，直接在系统询问中选择允许。如果之前已经拒绝，请继续下一步。" />
        <GuideStep number="2" title="打开“仍在”的系统设置" description="点击下方按钮，会直接进入当前应用的系统设置页。" />
        <Pressable accessibilityRole="button" onPress={() => void openAppSettings()} style={({ pressed }) => [styles.settingsButton, pressed && styles.pressed]}>
          <SymbolView name={{ android: 'settings', ios: 'gearshape', web: 'settings' }} size={19} tintColor={colors.onLife} type="hierarchical" />
          <Text style={styles.settingsButtonText}>打开系统设置</Text>
        </Pressable>
        <GuideStep number="3" title="只开启需要的权限" description={settingsStep} />
        <GuideStep last number="4" title="回到“仍在”重试" description="无需重新启动应用。返回后，再执行刚才的操作即可。" />
      </View>

      <Text style={styles.eyebrow}>WHAT EACH ONE DOES</Text>
      <Text style={styles.sectionTitle}>该开启哪一项</Text>
      <View style={styles.permissionList}>
        {permissionGuides.map((item, index) => <View key={item.title}>
          <View style={styles.permissionRow}>
            <View style={styles.permissionIcon}><SymbolView name={{ android: item.androidIcon, ios: item.icon, web: item.androidIcon }} size={21} tintColor={colors.life} type="hierarchical" /></View>
            <View style={styles.permissionCopy}><Text style={styles.permissionTitle}>{item.title}</Text><Text style={styles.permissionDescription}>{item.description}</Text></View>
          </View>
          {index < permissionGuides.length - 1 ? <View style={styles.separator} /> : null}
        </View>)}
      </View>

      <View style={styles.notice}>
        <SymbolView name={{ android: 'info', ios: 'info.circle', web: 'info' }} size={18} tintColor={colors.inkFaint} type="hierarchical" />
        <Text style={styles.noticeText}>系统设置中没有某项权限时，先回到应用使用一次对应功能，让系统显示授权询问。</Text>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

function GuideStep({ description, last = false, number, title }: { description: string; last?: boolean; number: string; title: string }) {
  return <View style={styles.step}>
    <View style={styles.stepRail}><View style={styles.stepNumber}><Text style={styles.stepNumberText}>{number}</Text></View>{!last ? <View style={styles.stepLine} /> : null}</View>
    <View style={styles.stepCopy}><Text style={styles.stepTitle}>{title}</Text><Text style={styles.stepDescription}>{description}</Text></View>
  </View>;
}

const styles = createThemedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: colors.paper }, header: { minHeight: 56, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }, headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, headerTitle: { flex: 1, color: colors.ink, fontFamily: typography.display, fontSize: 18, textAlign: 'center' },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl }, summary: { padding: spacing.lg, alignItems: 'flex-start', borderRadius: radius.lg, backgroundColor: colors.lifeLight }, summaryIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.sheet }, summaryTitle: { marginTop: spacing.md, color: colors.ink, fontFamily: typography.display, fontSize: 20 }, summaryText: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: typography.size.caption, lineHeight: 19 },
  eyebrow: { marginTop: spacing.xl, color: colors.life, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.3 }, sectionTitle: { marginTop: spacing.sm, color: colors.ink, fontFamily: typography.display, fontSize: 24 },
  steps: { marginTop: spacing.lg }, step: { minHeight: 78, flexDirection: 'row' }, stepRail: { width: 36, alignItems: 'center' }, stepNumber: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.life }, stepNumberText: { color: colors.onLife, fontFamily: typography.mono, fontSize: typography.size.meta, fontWeight: '800' }, stepLine: { flex: 1, width: StyleSheet.hairlineWidth, marginVertical: 5, backgroundColor: colors.line }, stepCopy: { flex: 1, paddingLeft: spacing.sm, paddingBottom: spacing.lg }, stepTitle: { color: colors.ink, fontSize: typography.size.label, fontWeight: '700' }, stepDescription: { marginTop: 5, color: colors.inkSoft, fontSize: typography.size.caption, lineHeight: 18 },
  settingsButton: { minHeight: 50, marginLeft: 44, marginBottom: spacing.lg, flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life }, settingsButtonText: { color: colors.onLife, fontSize: typography.size.caption, fontWeight: '800' },
  permissionList: { marginTop: spacing.lg, overflow: 'hidden', borderRadius: radius.lg, backgroundColor: colors.sheet }, permissionRow: { minHeight: 88, padding: spacing.md, flexDirection: 'row', alignItems: 'center' }, permissionIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.lifeLight }, permissionCopy: { flex: 1, marginLeft: spacing.md }, permissionTitle: { color: colors.ink, fontSize: typography.size.label, fontWeight: '700' }, permissionDescription: { marginTop: 5, color: colors.inkFaint, fontSize: typography.size.caption, lineHeight: 18 }, separator: { height: StyleSheet.hairlineWidth, marginLeft: 72, backgroundColor: colors.line },
  notice: { marginTop: spacing.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderRadius: radius.md }, noticeText: { flex: 1, marginLeft: spacing.sm, color: colors.inkFaint, fontSize: typography.size.meta, lineHeight: 17 }, pressed: { opacity: 0.72 },
}));
