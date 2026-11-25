import { Tabs, usePathname, useRouter } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import { MaterialSymbols_400Regular } from '@expo-google-fonts/material-symbols/400Regular';
import { BlurView } from 'expo-blur';
import { useFonts } from 'expo-font';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography } from '@still-alive/tokens';
import { useAppState } from '../../src/application/state/app-state';
import { useAi } from '../../src/application/ai/ai-provider';
import { applyColorTheme, createThemedStyles } from '../../src/shared/theme/app-theme';

type ThemeColors = typeof colors;

function hexToRgba(value: string, alpha: number): string {
  const match = /^#([0-9a-f]{6})$/iu.exec(value.trim());
  if (!match?.[1]) return value;
  const numeric = Number.parseInt(match[1], 16);
  const red = (numeric >> 16) & 0xff;
  const green = (numeric >> 8) & 0xff;
  const blue = numeric & 0xff;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}


function aiGlassFill(theme: ThemeColors, alpha: number): string {
  return hexToRgba(theme.sheet, alpha);
}

function aiGlassAccent(base: string, alpha: number): string {
  return hexToRgba(base, alpha);
}

const TAB_ITEMS = [
  { key: 'space', href: '/', label: '空间', glyph: '\uf426' },
  { key: 'calendar', href: '/time', label: '日历', glyph: '\uebcc' },
  { key: 'people', href: '/people', label: '人物', glyph: '\ue7ef' },
  { key: 'profile', href: '/data', label: '我的', glyph: '\ue853' },
] as const;

export default function TabsLayout() {
  const [fontsLoaded] = useFonts({ MaterialSymbols_400Regular });
  const { preferences } = useAppState();
  applyColorTheme(preferences.appearanceTheme);
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.paper } }}
      tabBar={() => <AppTabBar dark={preferences.appearanceTheme === 'midnight'} fontsLoaded={fontsLoaded} />}
    >
      <Tabs.Screen name="index" options={{ title: '空间' }} />
      <Tabs.Screen name="time" options={{ title: '日历' }} />
      <Tabs.Screen name="people" options={{ title: '人物' }} />
      <Tabs.Screen name="data" options={{ title: '我的' }} />
    </Tabs>
  );
}

function AppTabBar({ dark, fontsLoaded }: { dark: boolean; fontsLoaded: boolean }) {
  const router = useRouter();
  const { configLoaded, enabled: aiEnabled } = useAi();
  const showAi = configLoaded && aiEnabled;
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const aiActive = pathname.startsWith('/ai');
  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  return <View style={[styles.barWrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
    <View style={styles.bar}>
      {showAi ? <>
        {TAB_ITEMS.slice(0, 2).map((item) => <TabItem active={isActive(item.href)} fontsLoaded={fontsLoaded} item={item} key={item.key} onPress={() => router.navigate(item.href as RelativePathString)} />)}
        <View style={styles.centerGap} />
        {TAB_ITEMS.slice(2).map((item) => <TabItem active={isActive(item.href)} fontsLoaded={fontsLoaded} item={item} key={item.key} onPress={() => router.navigate(item.href as RelativePathString)} />)}
      </> : TAB_ITEMS.map((item) => <TabItem active={isActive(item.href)} fontsLoaded={fontsLoaded} item={item} key={item.key} onPress={() => router.navigate(item.href as RelativePathString)} />)}
    </View>
    {showAi ? <View pointerEvents="box-none" style={styles.aiHalo}>
      <Pressable accessibilityLabel="AI 对话" accessibilityHint="在设置里关闭 AI 后会隐藏这个按钮" accessibilityRole="button" accessibilityState={{ selected: aiActive }} onPress={() => router.push('/ai' as RelativePathString)} style={({ pressed }) => [styles.aiButton, aiActive && styles.aiButtonActive, pressed && styles.aiButtonPressed]}>
        {Platform.OS === 'web' ? <View pointerEvents="none" style={styles.aiBlurFallback} /> : <BlurView experimentalBlurMethod="dimezisBlurView" intensity={dark ? 38 : 46} pointerEvents="none" style={StyleSheet.absoluteFill} tint={dark ? 'dark' : 'light'} />}
        <View pointerEvents="none" style={[styles.aiSheen, dark && styles.aiSheenDark]} />
        <View pointerEvents="none" style={[styles.aiAccentWash, aiActive && styles.aiAccentWashActive]} />
        <View pointerEvents="none" style={[styles.aiInnerRing, dark && styles.aiInnerRingDark]} />
        <Text style={[styles.aiText, aiActive && styles.aiTextActive]}>AI</Text>
        <View pointerEvents="none" style={[styles.aiGlint, aiActive && styles.aiGlintActive]} />
      </Pressable>
    </View> : null}
  </View>;
}

function TabItem({ active, fontsLoaded, item, onPress }: { active: boolean; fontsLoaded: boolean; item: (typeof TAB_ITEMS)[number]; onPress(): void }) {
  return <Pressable accessibilityLabel={item.label} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.tabItem, pressed && styles.pressed]}>
    {fontsLoaded ? <Text style={[styles.tabGlyph, active && styles.tabGlyphActive]}>{item.glyph}</Text> : <View style={styles.tabGlyphPlaceholder} />}
    <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{item.label}</Text>
  </Pressable>;
}

const styles = createThemedStyles(() => ({
  barWrap: { backgroundColor: colors.sheet, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  bar: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 },
  tabItem: { flex: 1, height: 52, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabGlyph: { width: 22, height: 22, color: colors.inkFaint, fontFamily: 'MaterialSymbols_400Regular', fontSize: 22, lineHeight: 22, textAlign: 'center' },
  tabGlyphActive: { color: colors.life },
  tabGlyphPlaceholder: { width: 22, height: 22 },
  tabLabel: { color: colors.inkFaint, fontFamily: typography.body, fontSize: 10 },
  tabLabelActive: { color: colors.life, fontWeight: '700' },
  centerGap: { width: 72 },
  aiHalo: { position: 'absolute', top: -23, left: '50%', marginLeft: -29, width: 58, height: 58, borderRadius: 29, shadowColor: colors.ink, shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  aiButton: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 29, borderWidth: 1, borderColor: colors.line, backgroundColor: aiGlassFill(colors, 0.58) },
  aiButtonActive: { borderColor: colors.lifeLine, backgroundColor: aiGlassFill(colors, 0.7) },
  aiButtonPressed: { opacity: 0.82, transform: [{ scale: 0.97 }] },
  aiBlurFallback: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: aiGlassFill(colors, 0.7) },
  aiSheen: { position: 'absolute', top: 0, left: 5, right: 5, height: '52%', borderTopLeftRadius: 25, borderTopRightRadius: 25, backgroundColor: 'rgba(255, 255, 255, 0.34)' },
  aiSheenDark: { backgroundColor: 'rgba(255, 255, 255, 0.10)' },
  aiAccentWash: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: aiGlassAccent(colors.life, 0.08) },
  aiAccentWashActive: { backgroundColor: aiGlassAccent(colors.life, 0.18) },
  aiInnerRing: { position: 'absolute', top: 1, left: 1, right: 1, bottom: 1, borderRadius: 28, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255, 255, 255, 0.55)' },
  aiInnerRingDark: { borderColor: 'rgba(255, 255, 255, 0.2)' },
  aiText: { color: colors.inkSoft, fontFamily: typography.display, fontSize: 16, fontWeight: '700', letterSpacing: 1.6 },
  aiTextActive: { color: colors.life },
  aiGlint: { position: 'absolute', bottom: 9, width: 10, height: 1.5, borderRadius: 1, backgroundColor: aiGlassAccent(colors.life, 0.5) },
  aiGlintActive: { width: 18, backgroundColor: colors.life },
  pressed: { opacity: 0.65 },
}));
