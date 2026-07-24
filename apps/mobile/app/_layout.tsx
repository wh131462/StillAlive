import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import type { NotificationResponse } from 'expo-notifications';
import { useEffect } from 'react';
import { AppStateProvider } from '../src/state/app-state';
import { migrateDatabase } from '../src/data/sqlite-repository';
import { addBirthdayNotificationResponseListener, getLastBirthdayNotificationResponse } from '../src/data/expo-birthday-notifications';

export default function RootLayout() {
  const router = useRouter();
  useEffect(() => {
    const openPerson = (response: NotificationResponse | null) => {
      const personId = response?.notification.request.content.data?.personId;
      if (typeof personId === 'string' && personId) router.push({ pathname: '/person/[id]', params: { id: personId } });
    };
    openPerson(getLastBirthdayNotificationResponse());
    const subscription = addBirthdayNotificationResponseListener(openPerson);
    return () => subscription.remove();
  }, [router]);
  return (
    <SQLiteProvider databaseName="still-alive.db" onInit={migrateDatabase}>
      <AppStateProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </AppStateProvider>
    </SQLiteProvider>
  );
}
