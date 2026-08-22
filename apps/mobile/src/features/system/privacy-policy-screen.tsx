import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { createThemedStyles } from '../../shared/theme/app-theme';
import { ToolPageHeader } from '../../shared/components/tool-page-header';

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  return <SafeAreaView style={styles.safeArea}>
    <ToolPageHeader onBack={() => router.back()} title="隐私协议" />
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>PRIVACY</Text>
      <Text style={styles.title}>你的记录属于你</Text>
      <Text style={styles.updated}>更新日期：2026 年 7 月 31 日</Text>
      <Text style={styles.intro}>本协议说明“仍在”如何在当前设备上保存和处理你的内容。</Text>

      <View style={styles.policyCard}>
        <PolicySection title="数据保存">日记、打卡、地点文字、人物、照片、语音、密码本和设置保存在当前设备的应用私有目录。“仍在”不提供账号或云端同步。</PolicySection>
        <View style={styles.separator} />
        <PolicySection title="系统权限">只有在你使用相关功能时，应用才会请求照片、麦克风、位置或通知权限。位置仅用于生成你选择保存的地点文字或打卡城市，不保存经纬度。你可以随时在设备系统设置中关闭权限。</PolicySection>
        <View style={styles.separator} />
        <PolicySection title="导出与分享">只有当你主动备份、导出或分享时，相关内容才会通过系统文件选择器或分享面板离开应用私有目录。</PolicySection>
        <View style={styles.separator} />
        <PolicySection title="删除数据">你可以在设置中删除全部本地数据。该操作不会删除已经保存到应用外部位置的备份文件。</PolicySection>
        <View style={styles.separator} />
        <PolicySection title="第三方追踪">“仍在”不进行第三方行为追踪。</PolicySection>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

function PolicySection({ children, title }: { children: string; title: string }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionText}>{children}</Text></View>;
}

const styles = createThemedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  eyebrow: { marginTop: spacing.xl, color: colors.life, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.3 },
  title: { marginTop: spacing.sm, color: colors.ink, fontFamily: typography.display, fontSize: 28 },
  updated: { marginTop: spacing.sm, color: colors.inkFaint, fontFamily: typography.mono, fontSize: typography.size.meta },
  intro: { marginTop: spacing.md, color: colors.inkSoft, fontSize: typography.size.caption, lineHeight: 19 },
  policyCard: { marginTop: spacing.lg, overflow: 'hidden', borderRadius: radius.lg, backgroundColor: colors.sheet },
  section: { padding: spacing.lg },
  sectionTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 17 },
  sectionText: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: typography.size.caption, lineHeight: 20 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: spacing.lg, backgroundColor: colors.line },
}));
