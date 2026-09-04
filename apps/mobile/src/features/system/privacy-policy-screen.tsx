import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@still-alive/tokens';
import { createThemedStyles } from '../../shared/theme/app-theme';
import { ToolPageHeader } from '../../shared/components/tool-page-header';

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  return <SafeAreaView style={styles.safeArea}>
    <ToolPageHeader onBack={() => router.back()} title="隐私协议" />
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>PRIVACY POLICY</Text>
      <Text style={styles.title}>仍在隐私协议</Text>
      <Text style={styles.updated}>更新日期：2026 年 7 月 31 日</Text>

      <View style={styles.article}>
        <Text style={styles.lead}>感谢你使用“仍在”。我们重视你的记录和个人信息。本协议说明应用如何保存、使用和保护你在当前设备中创建的内容。</Text>

        <PolicySection index="一" title="适用范围">本协议适用于“仍在”移动应用及其提供的记录、打卡、人物、相册、密码本和设置等功能。</PolicySection>
        <PolicySection index="二" title="数据保存与处理">你的记录、打卡、地点文字、人物、照片、语音、密码本和设置，均保存在当前设备的应用私有目录。“仍在”不提供账号服务，也不提供云端同步。除非你主动发起导出、备份或分享，应用不会将这些内容上传至第三方服务。</PolicySection>
        <PolicySection index="三" title="系统权限">只有在你使用相关功能时，应用才会请求照片、麦克风、位置或通知权限。位置权限仅用于生成你选择保存的地点文字或打卡城市，应用不保存经纬度。你可以随时在设备系统设置中查看或关闭相关权限；关闭权限可能会影响对应功能的使用。</PolicySection>
        <PolicySection index="四" title="导出与分享">只有当你主动备份、导出或分享时，相关内容才会通过系统文件选择器或系统分享面板离开应用私有目录。导出文件的保存位置、传输方式和后续使用，取决于你选择的系统功能或第三方应用。</PolicySection>
        <PolicySection index="五" title="数据删除">你可以在应用设置中删除全部本地数据。删除操作仅作用于当前设备中的应用数据，不会删除你已经保存到应用外部位置的备份文件或分享内容。</PolicySection>
        <PolicySection index="六" title="第三方追踪">“仍在”不进行第三方行为追踪，不基于你的使用行为建立广告画像。</PolicySection>
        <PolicySection index="七" title="协议变更">如隐私处理方式发生变化，我们会在应用内更新本页面并标注新的更新日期。你继续使用应用，即表示你已阅读并理解更新后的内容。</PolicySection>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

function PolicySection({ children, index, title }: { children: string; index: string; title: string }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}><Text style={styles.sectionIndex}>{index}、</Text>{title}</Text><Text style={styles.sectionText}>{children}</Text></View>;
}

const styles = createThemedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  eyebrow: { marginTop: spacing.xl, color: colors.life, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.3 },
  title: { marginTop: spacing.sm, color: colors.ink, fontFamily: typography.display, fontSize: 28 },
  updated: { marginTop: spacing.sm, color: colors.inkFaint, fontFamily: typography.mono, fontSize: typography.size.meta },
  article: { marginTop: spacing.xl },
  lead: { color: colors.inkSoft, fontSize: typography.size.body, lineHeight: 23 },
  section: { marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  sectionTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 18, lineHeight: 24 },
  sectionIndex: { color: colors.life },
  sectionText: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: typography.size.body, lineHeight: 23 },
}));
