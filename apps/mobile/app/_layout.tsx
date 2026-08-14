import 'react-native-gesture-handler';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import type { NotificationResponse } from 'expo-notifications';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ReaderProvider } from '@epubjs-react-native/core';
import { colors } from '@still-alive/tokens';
import { AppStateProvider, useAppState } from '../src/state/app-state';
import { migrateDatabase } from '../src/data/sqlite-repository';
import { addBirthdayNotificationResponseListener, getLastBirthdayNotificationResponse } from '../src/data/expo-birthday-notifications';
import { applyColorTheme } from '../src/theme/app-theme';
import { AutomaticUpdateChecker } from '../src/components/automatic-update-checker';
import { LaunchScreen } from '../src/components/launch-screen';
import { writePersistentLog } from '../src/data/persistent-log';
import { MusicPlayerProvider } from '../src/state/music-player';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const route = segments.join('/') || 'index';
  useEffect(() => {
    writePersistentLog('INFO', 'app.session.started', { platform: Platform.OS, development: __DEV__ });
    const subscription = AppState.addEventListener('change', (state) => writePersistentLog('INFO', 'app.state.changed', { state }));
    return () => {
      subscription.remove();
      writePersistentLog('INFO', 'app.session.ended');
    };
  }, []);
  useEffect(() => writePersistentLog('INFO', 'navigation.changed', { route }), [route]);
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SQLiteProvider databaseName="still-alive.db" onInit={migrateDatabase}>
        <AppStateProvider>
          <ReaderProvider>
            <MusicPlayerProvider>
              <ThemedNavigator />
            </MusicPlayerProvider>
          </ReaderProvider>
        </AppStateProvider>
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}

function ThemedNavigator() {
  const { preferences, ready } = useAppState();
  const [launchScreenVisible, setLaunchScreenVisible] = useState(true);
  const finishLaunch = useCallback(() => setLaunchScreenVisible(false), []);
  applyColorTheme(preferences.appearanceTheme);
  return (
    <>
      <StatusBar
        style={launchScreenVisible || preferences.appearanceTheme === 'midnight' ? 'light' : 'dark'}
      />
      <Stack screenOptions={{ contentStyle: { backgroundColor: colors.paper }, headerShown: false }} />
      {!launchScreenVisible ? <AutomaticUpdateChecker /> : null}
      {launchScreenVisible ? <LaunchScreen onFinish={finishLaunch} ready={ready} /> : null}
    </>
  );
}
