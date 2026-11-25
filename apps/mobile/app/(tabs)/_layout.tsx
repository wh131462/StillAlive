import { Tabs, usePathname, useRouter } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import { MaterialSymbols_400Regular } from '@expo-google-fonts/material-symbols/400Regular';
import { useFonts } from 'expo-font';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography } from '@still-alive/tokens';
import { useAppState } from '../../src/application/state/app-state';
import { useAi } from '../../src/application/ai/ai-provider';
import { applyColorTheme, createThemedStyles } from '../../src/shared/theme/app-theme';

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
      tabBar={() => <AppTabBar fontsLoaded={fontsLoaded} />}
    >
      <Tabs.Screen name="index" options={{ title: '空间' }} />
      <Tabs.Screen name="time" options={{ title: '日历' }} />
      <Tabs.Screen name="people" options={{ title: '人物' }} />
      <Tabs.Screen name="data" options={{ title: '我的' }} />
    </Tabs>
  );
}

function AppTabBar({ fontsLoaded }: { fontsLoaded: boolean }) {
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
    {showAi ? <Pressable accessibilityLabel="AI 对话" accessibilityHint="在设置里关闭 AI 后会隐藏这个按钮" accessibilityRole="button" accessibilityState={{ selected: aiActive }} onPress={() => router.push('/ai' as RelativePathString)} style={({ pressed }) => [styles.aiButton, aiActive && styles.aiButtonActive, pressed && styles.aiButtonPressed]}>
      <Text style={[styles.aiText, aiActive && styles.aiTextActive]}>AI</Text>
    </Pressable> : null}
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
  aiButton: { position: 'absolute', top: -21, left: '50%', marginLeft: -27, width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 27, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, backgroundColor: colors.paper, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  aiButtonActive: { borderColor: colors.lifeLine, backgroundColor: colors.lifeLight },
  aiButtonPressed: { opacity: 0.75 },
  aiText: { color: colors.inkSoft, fontFamily: typography.display, fontSize: 16, fontWeight: '700', letterSpacing: 1.4 },
  aiTextActive: { color: colors.life },
  pressed: { opacity: 0.65 },
}));
