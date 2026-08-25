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
import { AppStateProvider, useAppState } from '../src/application/state/app-state';
import { migrateDatabase } from '../src/infrastructure/database/sqlite-schema';
import { addBirthdayNotificationResponseListener, getLastBirthdayNotificationResponse } from '../src/infrastructure/notifications/expo-notifications';
import { applyColorTheme } from '../src/shared/theme/app-theme';
import { AutomaticUpdateChecker } from '../src/features/system/automatic-update-checker';
import { LaunchScreen } from '../src/features/onboarding/launch-screen';
import { installGlobalErrorLogging, writePersistentError, writePersistentLog } from '../src/infrastructure/platform/persistent-log';
import { MusicPlayerProvider } from '../src/features/music/music-player-state';
import { FeedbackProvider } from '../src/application/feedback-provider';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const route = segments.join('/') || 'index';
  useEffect(() => {
    installGlobalErrorLogging();
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
      try {
        const data = response?.notification.request.content.data;
        writePersistentLog('INFO', 'notification.response.received', { data });
        const postId = data?.postId;
        if (typeof postId === 'string' && postId) {
          router.push({ pathname: '/post/[id]', params: { id: postId } });
          return;
        }
        const personId = data?.personId;
        if (typeof personId === 'string' && personId) router.push({ pathname: '/person/[id]', params: { id: personId } });
      } catch (cause) {
        writePersistentError('notification.response.open.failed', cause);
      }
    };
    openNotification(getLastBirthdayNotificationResponse());
    const subscription = addBirthdayNotificationResponseListener(openNotification);
    return () => subscription.remove();
  }, [router]);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <FeedbackProvider>
        <SQLiteProvider databaseName="still-alive.db" onInit={initializeDatabase}>
          <AppStateProvider>
            <ReaderProvider>
              <MusicPlayerProvider>
                <ThemedNavigator />
              </MusicPlayerProvider>
            </ReaderProvider>
          </AppStateProvider>
        </SQLiteProvider>
      </FeedbackProvider>
    </GestureHandlerRootView>
  );
}

async function initializeDatabase(database: Parameters<typeof migrateDatabase>[0]): Promise<void> {
  writePersistentLog('INFO', 'database.migration.started');
  try {
    await migrateDatabase(database);
    writePersistentLog('INFO', 'database.migration.finished');
  } catch (cause) {
    writePersistentError('database.migration.failed', cause);
    throw cause;
  }
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
      <Stack screenOptions={{ contentStyle: { backgroundColor: colors.paper }, headerShown: false }}>
        <Stack.Screen
          name="music-player"
          options={{ animation: 'slide_from_bottom', animationDuration: 280, gestureDirection: 'vertical', gestureEnabled: true }}
        />
      </Stack>
      {!launchScreenVisible ? <AutomaticUpdateChecker /> : null}
      {launchScreenVisible ? <LaunchScreen onFinish={finishLaunch} ready={ready} /> : null}
    </>
  );
}
