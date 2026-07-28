import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import type { NotificationResponse } from 'expo-notifications';
import { useEffect } from 'react';
import { colors } from '@still-alive/tokens';
import { AppStateProvider, useAppState } from '../src/state/app-state';
import { migrateDatabase } from '../src/data/sqlite-repository';
import { addBirthdayNotificationResponseListener, getLastBirthdayNotificationResponse } from '../src/data/expo-birthday-notifications';
import { applyColorTheme } from '../src/theme/app-theme';

export default function RootLayout() {
  const router = useRouter();
  useEffect(() => {
    const openNotification = (response: NotificationResponse | null) => {
      const data = response?.notification.request.content.data;
      const postId = data?.postId;
      if (typeof postId === 'string' && postId) {
        router.push({ pathname: '/post/[id]', params: { id: postId } });
        return;
      }
      const personId = data?.personId;
      if (typeof personId === 'string' && personId) router.push({ pathname: '/person/[id]', params: { id: personId } });
    };
    openNotification(getLastBirthdayNotificationResponse());
    const subscription = addBirthdayNotificationResponseListener(openNotification);
    return () => subscription.remove();
  }, [router]);
  return (
    <SQLiteProvider databaseName="still-alive.db" onInit={migrateDatabase}>
      <AppStateProvider>
        <ThemedNavigator />
      </AppStateProvider>
    </SQLiteProvider>
  );
}

function ThemedNavigator() {
  const { preferences } = useAppState();
  applyColorTheme(preferences.appearanceTheme);
  return (
    <>
      <StatusBar style={preferences.appearanceTheme === 'midnight' ? 'light' : 'dark'} />
      <Stack screenOptions={{ contentStyle: { backgroundColor: colors.paper }, headerShown: false }} />
    </>
  );
}
