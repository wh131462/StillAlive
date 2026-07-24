import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import type { ColorValue } from 'react-native';
import { colors, typography } from '@still-alive/tokens';

type TabIconName = 'today' | 'time' | 'people' | 'profile';

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
      <Tabs.Screen name="index" options={{ title: '今日', tabBarIcon: ({ color }) => <TabIcon color={color} name="today" /> }} />
      <Tabs.Screen name="time" options={{ title: '时间', tabBarIcon: ({ color }) => <TabIcon color={color} name="time" /> }} />
      <Tabs.Screen name="people" options={{ title: '人物', tabBarIcon: ({ color }) => <TabIcon color={color} name="people" /> }} />
      <Tabs.Screen name="data" options={{ title: '我的', tabBarIcon: ({ color }) => <TabIcon color={color} name="profile" /> }} />
    </Tabs>
  );
}

function TabIcon({ color, name }: { color: ColorValue; name: TabIconName }) {
  if (name === 'today') {
    return (
      <View pointerEvents="none" style={[styles.icon, styles.calendar, { borderColor: color }]}>
        <View style={[styles.calendarHeader, { backgroundColor: color }]} />
        <View style={[styles.calendarDot, { backgroundColor: color }]} />
      </View>
    );
  }

  if (name === 'time') {
    return (
      <View pointerEvents="none" style={[styles.icon, styles.clock, { borderColor: color }]}>
        <View style={[styles.clockHour, { backgroundColor: color }]} />
        <View style={[styles.clockMinute, { backgroundColor: color }]} />
      </View>
    );
  }

  if (name === 'people') {
    return (
      <View pointerEvents="none" style={styles.icon}>
        <View style={[styles.personHead, styles.personHeadLeft, { borderColor: color }]} />
        <View style={[styles.personHead, styles.personHeadRight, { borderColor: color }]} />
        <View style={[styles.peopleBody, { borderColor: color }]} />
      </View>
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
  calendar: { borderWidth: 1.7, borderRadius: 5 },
  calendarHeader: { position: 'absolute', top: 5, left: 0, right: 0, height: 1.5 },
  calendarDot: { position: 'absolute', top: 10, left: 5, width: 3, height: 3, borderRadius: 1.5 },
  clock: { borderWidth: 1.7, borderRadius: 11 },
  clockHour: { position: 'absolute', top: 5, left: 9.3, width: 1.5, height: 6, borderRadius: 1 },
  clockMinute: { position: 'absolute', top: 10, left: 10, width: 5, height: 1.5, borderRadius: 1, transform: [{ rotate: '28deg' }], transformOrigin: 'left center' },
  personHead: { position: 'absolute', top: 2, width: 7, height: 7, borderWidth: 1.5, borderRadius: 4 },
  personHeadLeft: { left: 3 },
  personHeadRight: { right: 3 },
  peopleBody: { position: 'absolute', left: 1, right: 1, bottom: 1, height: 9, borderWidth: 1.5, borderBottomWidth: 0, borderTopLeftRadius: 9, borderTopRightRadius: 9 },
  profileHead: { position: 'absolute', top: 1, left: 7, width: 8, height: 8, borderWidth: 1.5, borderRadius: 4 },
  profileBody: { position: 'absolute', left: 3, right: 3, bottom: 1, height: 9, borderWidth: 1.5, borderBottomWidth: 0, borderTopLeftRadius: 9, borderTopRightRadius: 9 },
});
