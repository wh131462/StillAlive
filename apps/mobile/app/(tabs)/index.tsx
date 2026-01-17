import React, { useCallback, useState, useMemo } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { MoodType } from '@still-alive/local-storage';
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
  CheckinSuccessOverlay,
} from '../../src/components/home';
import { colors } from '../../src/theme/colors';

// 里程碑定义
const MILESTONES = [
  { days: 7, name: '初来乍到' },
  { days: 30, name: '月度坚持' },
  { days: 100, name: '百日成就' },
  { days: 365, name: '一周年纪念' },
  { days: 1000, name: '千日传奇' },
];

export default function HomeScreen() {
  const {
    todayCheckedIn,
    isCheckinLoading,
    checkTodayStatus,
    checkinToday,
    stats,
  } = useCheckinStore();

  const { todayBirthdays, checkTodayBirthdays } = usePersonStore();

  const {
    isCheckinModalOpen,
    openCheckinModal,
    closeCheckinModal,
    showToast,
  } = useUIStore();

  const [refreshing, setRefreshing] = useState(false);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [currentMilestone, setCurrentMilestone] = useState<{ days: number; name: string } | null>(null);

  // 检查是否达到里程碑
  const checkMilestone = useMemo(() => {
    return (totalDays: number) => {
      return MILESTONES.find((m) => m.days === totalDays) || null;
    };
  }, []);

  // Fetch data on mount and focus
  useFocusEffect(
    useCallback(() => {
      checkTodayStatus();
      checkTodayBirthdays();
    }, [checkTodayStatus, checkTodayBirthdays])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([checkTodayStatus(), checkTodayBirthdays()]);
    setRefreshing(false);
  };

  const handleCheckinPress = () => {
    if (!todayCheckedIn) {
      openCheckinModal();
    }
  };

  const handleCheckin = async (data: { content?: string; mood?: MoodType }) => {
    try {
      await checkinToday(data.content, undefined, data.mood);
      closeCheckinModal();

      // 检查里程碑
      const newTotalDays = (stats?.totalDays || 0) + 1;
      const milestone = checkMilestone(newTotalDays);
      setCurrentMilestone(milestone);

      // 显示成功浮层
      setShowSuccessOverlay(true);
    } catch {
      showToast({ type: 'error', message: '打卡失败，请重试' });
    }
  };

  const handleSuccessOverlayDismiss = () => {
    setShowSuccessOverlay(false);
    setCurrentMilestone(null);
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
        onClose={closeCheckinModal}
        onCheckin={handleCheckin}
        isLoading={isCheckinLoading}
      />

      {/* Success Overlay */}
      <CheckinSuccessOverlay
        visible={showSuccessOverlay}
        onDismiss={handleSuccessOverlayDismiss}
        streak={stats?.streak}
        milestone={currentMilestone}
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
