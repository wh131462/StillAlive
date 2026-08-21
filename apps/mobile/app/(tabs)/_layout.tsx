import { Tabs } from 'expo-router';
import { MaterialSymbols_400Regular } from '@expo-google-fonts/material-symbols/400Regular';
import { useFonts } from 'expo-font';
import { Platform, Pressable, Text, View } from 'react-native';
import type { ColorValue } from 'react-native';
import { colors, typography } from '@still-alive/tokens';
import { useAppState } from '../../src/application/state/app-state';
import { applyColorTheme } from '../../src/shared/theme/app-theme';

type TabIconName = 'space' | 'calendar' | 'people' | 'profile';

const tabIcons = {
  space: '\uf426',
  calendar: '\uebcc',
  people: '\ue7ef',
  profile: '\ue853',
} satisfies Record<TabIconName, string>;

export default function TabsLayout() {
  const [fontsLoaded] = useFonts({ MaterialSymbols_400Regular });
  const { preferences } = useAppState();
  applyColorTheme(preferences.appearanceTheme);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.life,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarLabelStyle: { fontFamily: typography.body, fontSize: 11 },
        tabBarStyle: { backgroundColor: colors.sheet, borderTopColor: colors.line },
        tabBarButton: Platform.OS === 'android' ? ({ ref: _ref, ...props }) => <Pressable {...props} android_ripple={null} /> : undefined,
      }}
    >
      <Tabs.Screen name="index" options={{ title: '空间', tabBarIcon: ({ color }) => <TabIcon color={color} loaded={fontsLoaded} name="space" /> }} />
      <Tabs.Screen name="time" options={{ title: '日历', tabBarIcon: ({ color }) => <TabIcon color={color} loaded={fontsLoaded} name="calendar" /> }} />
      <Tabs.Screen name="people" options={{ title: '人物', tabBarIcon: ({ color }) => <TabIcon color={color} loaded={fontsLoaded} name="people" /> }} />
      <Tabs.Screen name="data" options={{ title: '我的', tabBarIcon: ({ color }) => <TabIcon color={color} loaded={fontsLoaded} name="profile" /> }} />
    </Tabs>
  );
}

function TabIcon({ color, loaded, name }: { color: ColorValue; loaded: boolean; name: TabIconName }) {
  if (!loaded) return <View style={{ width: 22, height: 22 }} />;
  return (
    <Text pointerEvents="none" style={{ width: 22, height: 22, color, fontFamily: 'MaterialSymbols_400Regular', fontSize: 22, lineHeight: 22, textAlign: 'center' }}>{tabIcons[name]}</Text>
  );
}
