import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { AppStateProvider } from '../src/state/app-state';
import { migrateDatabase } from '../src/data/sqlite-repository';

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="still-alive.db" onInit={migrateDatabase}>
      <AppStateProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </AppStateProvider>
    </SQLiteProvider>
  );
}
