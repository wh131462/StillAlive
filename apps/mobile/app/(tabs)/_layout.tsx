import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';
import type { ColorValue } from 'react-native';
import { colors, typography } from '@still-alive/tokens';

type TabIconName = 'space' | 'calendar' | 'people' | 'profile';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.life,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarLabelStyle: { fontFamily: typography.body, fontSize: 11 },
        tabBarStyle: { backgroundColor: colors.sheet, borderTopColor: colors.line },
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
  if (name === 'space') {
    return (
      <View pointerEvents="none" style={[styles.icon, styles.spaceIcon, { borderColor: color }]}>
        <View style={[styles.spaceCore, { backgroundColor: color }]} />
        <View style={[styles.spaceOrbit, { borderColor: color }]} />
      </View>
    );
  }

  if (name === 'calendar') {
    return (
      <View pointerEvents="none" style={[styles.icon, styles.calendar, { borderColor: color }]}>
        <View style={[styles.calendarHeader, { backgroundColor: color }]} />
        <View style={[styles.calendarDot, { backgroundColor: color }]} />
      </View>
    );
  }

  if (name === 'people') {
    return (
      <SymbolView
        name={{ android: 'group', ios: 'person.2', web: 'group' }}
        pointerEvents="none"
        size={22}
        tintColor={color}
        type="hierarchical"
      />
    );
  }

  return (
    <View pointerEvents="none" style={styles.icon}>
      <View style={[styles.profileHead, { borderColor: color }]} />
      <View style={[styles.profileBody, { borderColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  icon: { width: 22, height: 22 },
  spaceIcon: { alignItems: 'center', justifyContent: 'center' },
  spaceCore: { width: 7, height: 7, borderRadius: 4 },
  spaceOrbit: { position: 'absolute', width: 18, height: 18, borderWidth: 1.5, borderRadius: 9 },
  calendar: { borderWidth: 1.7, borderRadius: 5 },
  calendarHeader: { position: 'absolute', top: 5, left: 0, right: 0, height: 1.5 },
  calendarDot: { position: 'absolute', top: 10, left: 5, width: 3, height: 3, borderRadius: 1.5 },
  profileHead: { position: 'absolute', top: 1, left: 7, width: 8, height: 8, borderWidth: 1.5, borderRadius: 4 },
  profileBody: { position: 'absolute', left: 3, right: 3, bottom: 1, height: 9, borderWidth: 1.5, borderBottomWidth: 0, borderTopLeftRadius: 9, borderTopRightRadius: 9 },
});
