import React, { useCallback, useState } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useCheckinStore } from '../../src/stores/checkinStore';
import { usePersonStore } from '../../src/stores/personStore';
import { useUIStore } from '../../src/stores/uiStore';
import {
  StatusCard,
  BirthdayReminder,
  DailyQuote,
  QuickEntry,
  MissedDayHint,
  CheckinModal,
} from '../../src/components/home';
import { colors } from '../../src/theme/colors';

export default function HomeScreen() {
  const {
    todayCheckedIn,
    isCheckinLoading,
    checkTodayStatus,
    checkinToday,
  } = useCheckinStore();

  const { todayBirthdays, fetchTodayBirthdays } = usePersonStore();

  const {
    isCheckinModalOpen,
    checkinModalStep,
    openCheckinModal,
    closeCheckinModal,
    setCheckinModalStep,
    showToast,
  } = useUIStore();

  const [refreshing, setRefreshing] = useState(false);

  // Fetch data on mount and focus
  useFocusEffect(
    useCallback(() => {
      checkTodayStatus();
      fetchTodayBirthdays();
    }, [checkTodayStatus, fetchTodayBirthdays])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([checkTodayStatus(), fetchTodayBirthdays()]);
    setRefreshing(false);
  };

  const handleCheckinPress = () => {
    if (!todayCheckedIn) {
      openCheckinModal();
    }
  };

  const handleCheckin = async (content?: string) => {
    try {
      await checkinToday(content);
      setCheckinModalStep('success');
      showToast({ type: 'success', message: '打卡成功！' });
    } catch {
      showToast({ type: 'error', message: '打卡失败，请重试' });
    }
  };

  const handleQuickSave = async (content: string) => {
    try {
      await checkinToday(content);
      showToast({ type: 'success', message: '记录已保存' });
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
        {/* Status Card with Checkin Button */}
        <StatusCard
          isCheckedIn={todayCheckedIn}
          onCheckinPress={handleCheckinPress}
          isLoading={isCheckinLoading}
        />

        {/* Birthday Reminder */}
        {todayBirthdays.length > 0 && (
          <View style={styles.section}>
            <BirthdayReminder persons={todayBirthdays} />
          </View>
        )}

        {/* Daily Quote */}
        <View style={styles.section}>
          <DailyQuote />
        </View>

        {/* Quick Entry - only show if not checked in yet */}
        {!todayCheckedIn && (
          <View style={styles.section}>
            <QuickEntry onSave={handleQuickSave} isLoading={isCheckinLoading} />
          </View>
        )}

        {/* Missed Day Hint - show if not checked in */}
        {!todayCheckedIn && (
          <View style={styles.section}>
            <MissedDayHint />
          </View>
        )}
      </ScrollView>

      {/* Checkin Modal */}
      <CheckinModal
        visible={isCheckinModalOpen}
        step={checkinModalStep}
        onClose={closeCheckinModal}
        onCheckin={handleCheckin}
        isLoading={isCheckinLoading}
      />
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
});
