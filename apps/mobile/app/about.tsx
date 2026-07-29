import { useRouter } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { createThemedStyles } from '../src/theme/app-theme';

export default function AboutScreen() {
  const router = useRouter();
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
        <Text style={styles.version}>VERSION 0.1.0</Text>
        <Text style={styles.tagline}>把日子留下来，也把自己留在时间里。</Text>
      </View>

      <View style={styles.aboutCard}>
        <Text style={styles.aboutEyebrow}>ABOUT STILL ALIVE</Text>
        <Text style={styles.aboutTitle}>记录当下，也能回望过去</Text>
        <Text style={styles.aboutText}>“仍在”是一款面向个人的生活记录应用。你可以用打卡、日记、人物和相册，留下值得记住的日子。</Text>
      </View>
      <View style={styles.links}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/privacy-policy' as RelativePathString)} style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
          <View style={styles.linkIcon}><SymbolView name={{ android: 'shield', ios: 'checkmark.shield', web: 'shield' }} size={20} tintColor={colors.life} type="hierarchical" /></View>
          <Text style={styles.linkText}>隐私协议</Text>
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
  linkText: { flex: 1, color: colors.ink, fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.76, transform: [{ scale: 0.97 }] },
}));
