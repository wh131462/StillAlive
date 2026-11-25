import { useRef } from 'react';
import { Tabs, usePathname, useRouter } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import { MaterialSymbols_400Regular } from '@expo-google-fonts/material-symbols/400Regular';
import { useFonts } from 'expo-font';
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { colors, typography } from '@still-alive/tokens';
import { useAppState } from '../../src/application/state/app-state';
import { useAi } from '../../src/application/ai/ai-provider';
import { applyColorTheme, createThemedStyles } from '../../src/shared/theme/app-theme';
import { haptic } from '../../src/shared/haptics';

const BAR_HEIGHT = 64;
const TAB_ROW_TOP = 6;
const AI_SIZE = 56;
const AI_RADIUS = AI_SIZE / 2;
/** 凹槽比球大的那圈缝隙，保证球与弧线始终不相接。 */
const AI_GAP = 10;
/** 球心低于栏顶的距离，也就是球“坐进”去多深。 */
const AI_SEAT = 16;
const AI_SOCKET_RADIUS = AI_RADIUS + AI_GAP;
const AI_SOCKET_HALF = Math.sqrt(AI_SOCKET_RADIUS ** 2 - AI_SEAT ** 2);
const AI_DOCK_HEIGHT = 66;

/** 标签栏顶部为 AI 球留出的圆弧凹槽：半径比球大 AI_GAP，四周留出等宽缝隙。 */
function dockedBarPath(width: number, bottom: number): string {
  const cx = width / 2;
  return [
    `M0 0`,
    `H${cx - AI_SOCKET_HALF}`,
    `A${AI_SOCKET_RADIUS} ${AI_SOCKET_RADIUS} 0 0 0 ${cx + AI_SOCKET_HALF} 0`,
    `H${width}`,
    `V${bottom}`,
    'H0',
    'Z',
  ].join(' ');
}

function dockedTopPath(width: number): string {
  const cx = width / 2;
  return [
    `M0 0`,
    `H${cx - AI_SOCKET_HALF}`,
    `A${AI_SOCKET_RADIUS} ${AI_SOCKET_RADIUS} 0 0 0 ${cx + AI_SOCKET_HALF} 0`,
    `H${width}`,
  ].join(' ');
}

function flatBarPath(width: number, bottom: number): string {
  return `M0 0 H${width} V${bottom} H0 Z`;
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
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { configLoaded, enabled: aiEnabled } = useAi();
  const showAi = configLoaded && aiEnabled;
  const pathname = usePathname();
  const aiActive = pathname.startsWith('/ai');
  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
  const totalHeight = BAR_HEIGHT + Math.max(insets.bottom, 8);

  return <View style={[styles.barWrap, { height: totalHeight }]}>
    <Svg height={totalHeight} pointerEvents="none" style={StyleSheet.absoluteFill} width={width}>
      <Path d={showAi ? dockedBarPath(width, totalHeight) : flatBarPath(width, totalHeight)} fill={colors.sheet} />
      <Path d={showAi ? dockedTopPath(width) : `M0 0 H${width}`} fill="none" stroke={colors.line} strokeWidth={StyleSheet.hairlineWidth} />
    </Svg>
    <View style={styles.barRow}>
      {showAi ? <>
        {TAB_ITEMS.slice(0, 2).map((item) => <TabItem active={isActive(item.href)} fontsLoaded={fontsLoaded} item={item} key={item.key} onPress={() => router.navigate(item.href as RelativePathString)} />)}
        <View style={styles.centerGap} />
        {TAB_ITEMS.slice(2).map((item) => <TabItem active={isActive(item.href)} fontsLoaded={fontsLoaded} item={item} key={item.key} onPress={() => router.navigate(item.href as RelativePathString)} />)}
      </> : TAB_ITEMS.map((item) => <TabItem active={isActive(item.href)} fontsLoaded={fontsLoaded} item={item} key={item.key} onPress={() => router.navigate(item.href as RelativePathString)} />)}
    </View>
    {showAi ? <AiDockButton active={aiActive} onPress={() => { haptic('selection'); router.push('/ai' as RelativePathString); }} /> : null}
  </View>;
}

function AiDockButton({ active, onPress }: { active: boolean; onPress(): void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const sheen = useRef(new Animated.Value(0)).current;
  const animateIn = () => {
    Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 26, bounciness: 0 }).start();
    sheen.setValue(0);
    Animated.timing(sheen, { toValue: 1, duration: 360, useNativeDriver: true }).start();
  };
  const animateOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 9 }).start();
  };
  const sheenTranslate = sheen.interpolate({ inputRange: [0, 1], outputRange: [-46, 46] });
  const sheenOpacity = sheen.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 0.34, 0] });

  return <View pointerEvents="box-none" style={styles.aiDock}>
    <Animated.View style={[styles.aiScale, { transform: [{ scale }] }]}>
      <Pressable accessibilityLabel="AI 问答" accessibilityHint="在设置里关闭 AI 后会隐藏这个按钮" accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} onPressIn={animateIn} onPressOut={animateOut} style={[styles.aiButton, active && styles.aiButtonActive]}>
        <Svg height={AI_SIZE} pointerEvents="none" style={StyleSheet.absoluteFill} viewBox={`0 0 ${AI_SIZE} ${AI_SIZE}`}>
          <Defs>
            <LinearGradient id="ai-ball" x1="0" x2="0.15" y1="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.22} />
              <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity={0} />
              <Stop offset="1" stopColor="#000000" stopOpacity={0.12} />
            </LinearGradient>
          </Defs>
          <Circle cx={AI_RADIUS} cy={AI_RADIUS} fill="url(#ai-ball)" r={AI_RADIUS} />
        </Svg>
        <Animated.View pointerEvents="none" style={[styles.aiSheen, { opacity: sheenOpacity, transform: [{ translateX: sheenTranslate }, { rotate: '24deg' }] }]} />
        <Text style={styles.aiText}>AI</Text>
      </Pressable>
    </Animated.View>
  </View>;
}

function TabItem({ active, fontsLoaded, item, onPress }: { active: boolean; fontsLoaded: boolean; item: (typeof TAB_ITEMS)[number]; onPress(): void }) {
  return <Pressable accessibilityLabel={item.label} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.tabItem, pressed && styles.pressed]}>
    {fontsLoaded ? <Text style={[styles.tabGlyph, active && styles.tabGlyphActive]}>{item.glyph}</Text> : <View style={styles.tabGlyphPlaceholder} />}
    <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{item.label}</Text>
  </Pressable>;
}

const styles = createThemedStyles(() => ({
  barWrap: { backgroundColor: 'transparent', overflow: 'visible' },
  barRow: { position: 'absolute', top: TAB_ROW_TOP, left: 0, right: 0, height: BAR_HEIGHT - TAB_ROW_TOP, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 },
  tabItem: { flex: 1, height: 48, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabGlyph: { width: 22, height: 22, color: colors.inkFaint, fontFamily: 'MaterialSymbols_400Regular', fontSize: 22, lineHeight: 22, textAlign: 'center' },
  tabGlyphActive: { color: colors.life },
  tabGlyphPlaceholder: { width: 22, height: 22 },
  tabLabel: { color: colors.inkFaint, fontFamily: typography.body, fontSize: 10 },
  tabLabelActive: { color: colors.life, fontWeight: '700' },
  centerGap: { width: 80 },
  aiDock: { position: 'absolute', top: -17, left: 0, right: 0, height: AI_DOCK_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  aiScale: { width: AI_SIZE, height: AI_SIZE },
  aiButton: { width: AI_SIZE, height: AI_SIZE, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: AI_RADIUS, backgroundColor: colors.life, shadowColor: colors.ink, shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  aiButtonActive: { backgroundColor: colors.lifeDeep },
  aiSheen: { position: 'absolute', top: -18, width: 26, height: AI_SIZE + 36, backgroundColor: 'rgba(255, 255, 255, 0.4)' },
  aiText: { color: colors.onLife, fontFamily: typography.display, fontSize: 15, fontWeight: '700', letterSpacing: 1.8 },
  pressed: { opacity: 0.65 },
}));
