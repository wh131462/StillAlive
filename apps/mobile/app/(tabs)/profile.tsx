import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { useUIStore } from '../../src/stores/uiStore';
import {
  ProfileHeader,
  QuickStats,
  DeathConfirmation,
  SettingsList,
} from '../../src/components/profile';
import { colors } from '../../src/theme/colors';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const {
    totalDays,
    totalPersons,
    emergencyConfig,
    isConfigLoading,
    isConfigUpdating,
    reminderTime,
    fetchQuickStats,
    fetchEmergencyConfig,
    updateEmergencyConfig,
  } = useSettingsStore();
  const { showToast } = useUIStore();

  const [refreshing, setRefreshing] = useState(false);

  // Fetch data on mount and focus
  useFocusEffect(
    useCallback(() => {
      fetchQuickStats();
      fetchEmergencyConfig();
    }, [fetchQuickStats, fetchEmergencyConfig])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchQuickStats(), fetchEmergencyConfig()]);
    setRefreshing(false);
  };

  const handleLogout = () => {
    logout();
    showToast({ type: 'success', message: '已退出登录' });
    router.replace('/(auth)/login');
  };

  const handleEmergencyUpdate = async (data: Parameters<typeof updateEmergencyConfig>[0]) => {
    try {
      await updateEmergencyConfig(data);
      showToast({ type: 'success', message: '设置已保存' });
    } catch {
      showToast({ type: 'error', message: '保存失败' });
    }
  };

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
          totalDays={totalDays}
          onEditPress={() => {
            // TODO: Navigate to edit profile
          }}
        />

        {/* Quick Stats */}
        <View style={styles.section}>
          <QuickStats totalDays={totalDays} totalPersons={totalPersons} />
        </View>

        {/* Death Confirmation Settings */}
        <View style={styles.section}>
          <DeathConfirmation
            config={emergencyConfig}
            isLoading={isConfigLoading || isConfigUpdating}
            onUpdate={handleEmergencyUpdate}
          />
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
