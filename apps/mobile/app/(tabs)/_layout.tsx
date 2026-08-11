import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { SymbolViewProps } from 'expo-symbols';
import { Platform, Pressable } from 'react-native';
import type { ColorValue } from 'react-native';
import { colors, typography } from '@still-alive/tokens';
import { useAppState } from '../../src/state/app-state';
import { applyColorTheme } from '../../src/theme/app-theme';

type TabIconName = 'space' | 'calendar' | 'people' | 'profile';

const tabIcons = {
  space: { android: 'orbit', ios: 'atom', web: 'orbit' },
  calendar: { android: 'calendar_month', ios: 'calendar', web: 'calendar_month' },
  people: { android: 'group', ios: 'person.2', web: 'group' },
  profile: { android: 'account_circle', ios: 'person.crop.circle', web: 'account_circle' },
} satisfies Record<TabIconName, SymbolViewProps['name']>;

export default function TabsLayout() {
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
      <Tabs.Screen name="index" options={{ title: '空间', tabBarIcon: ({ color }) => <TabIcon color={color} name="space" /> }} />
      <Tabs.Screen name="time" options={{ title: '日历', tabBarIcon: ({ color }) => <TabIcon color={color} name="calendar" /> }} />
      <Tabs.Screen name="people" options={{ title: '人物', tabBarIcon: ({ color }) => <TabIcon color={color} name="people" /> }} />
      <Tabs.Screen name="data" options={{ title: '我的', tabBarIcon: ({ color }) => <TabIcon color={color} name="profile" /> }} />
    </Tabs>
  );
}

function TabIcon({ color, name }: { color: ColorValue; name: TabIconName }) {
  return (
    <SymbolView
      name={tabIcons[name]}
      pointerEvents="none"
      size={22}
      tintColor={color}
      type="monochrome"
      weight="regular"
    />
  );
}
