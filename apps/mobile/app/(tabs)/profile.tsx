import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { useSettingsStore, type ThemeMode } from '../../src/stores/settingsStore';
import { useCheckinStore } from '../../src/stores/checkinStore';
import { useUIStore } from '../../src/stores/uiStore';
import {
  ProfileHeader,
  QuickStats,
  SettingsList,
  MilestoneBadges,
  YearHeatmap,
  ThemeToggle,
} from '../../src/components/profile';
import { colors } from '../../src/theme/colors';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const {
    totalPersons,
    reminderTime,
    theme,
    setTheme,
  } = useSettingsStore();
  const { checkins, stats, fetchAllCheckins, calculateStats } = useCheckinStore();
  const { showToast } = useUIStore();

  const [refreshing, setRefreshing] = useState(false);

  // Fetch data on mount and focus
  useFocusEffect(
    useCallback(() => {
      fetchAllCheckins();
      calculateStats();
    }, [fetchAllCheckins, calculateStats])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAllCheckins();
    calculateStats();
    setRefreshing(false);
  };

  const handleLogout = () => {
    logout();
    showToast({ type: 'success', message: '已退出登录' });
    router.replace('/(auth)/login');
  };

  const handleThemeChange = (newTheme: ThemeMode) => {
    setTheme(newTheme);
    showToast({ type: 'success', message: '主题已切换' });
  };

  // Use local stats
  const localTotalDays = stats?.totalDays || 0;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Profile Header */}
        <ProfileHeader
          user={user}
          totalDays={localTotalDays}
          onEditPress={() => {
            // TODO: Navigate to edit profile
          }}
        />

        {/* Milestone Badges */}
        <View style={styles.section}>
          <MilestoneBadges totalDays={localTotalDays} />
        </View>

        {/* Year Heatmap */}
        <View style={styles.section}>
          <YearHeatmap checkins={checkins} />
        </View>

        {/* Quick Stats */}
        <View style={styles.section}>
          <QuickStats totalDays={localTotalDays} totalPersons={totalPersons} />
        </View>

        {/* Theme Toggle */}
        <View style={styles.section}>
          <ThemeToggle value={theme} onChange={handleThemeChange} />
        </View>

        {/* Settings List */}
        <View style={styles.section}>
          <SettingsList
            reminderTime={reminderTime}
            onReminderPress={() => {
              // TODO: Navigate to reminder settings
            }}
            onNotificationPress={() => {
              // TODO: Navigate to notification settings
            }}
            onPrivacyPress={() => {
              // TODO: Navigate to privacy settings
            }}
            onBackupPress={() => {
              // TODO: Navigate to backup settings
            }}
            onAboutPress={() => {
              // TODO: Navigate to about page
            }}
            onHelpPress={() => {
              // TODO: Navigate to help page
            }}
            onLogoutPress={handleLogout}
          />
        </View>

        {/* Version */}
        <Text style={styles.version}>版本 1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingTop: 60,
    paddingBottom: 100,
  },
  section: {
    marginTop: 16,
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 24,
  },
});
