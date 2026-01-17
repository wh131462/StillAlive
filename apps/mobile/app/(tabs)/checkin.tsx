import React, { useCallback, useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { MoodType } from '@still-alive/local-storage';
import { useCheckinStore } from '../../src/stores/checkinStore';
import { useUIStore } from '../../src/stores/uiStore';
import {
  StatsOverview,
  Calendar,
  RecordList,
  MakeupCheckinModal,
  MilestoneModal,
} from '../../src/components/checkin';
import { colors } from '../../src/theme/colors';

// 里程碑定义
const MILESTONES = [
  { days: 7, name: '初来乍到' },
  { days: 30, name: '月度坚持' },
  { days: 100, name: '百日成就' },
  { days: 365, name: '一周年纪念' },
  { days: 1000, name: '千日传奇' },
];

export default function CheckinScreen() {
  const {
    stats,
    isStatsLoading,
    calculateStats,
    currentMonth,
    monthlyCheckins,
    isCalendarLoading,
    setCurrentMonth,
    fetchMonthlyCheckins,
    checkins,
    isListLoading,
    fetchAllCheckins,
    makeupCount,
    makeupLimit,
    isMakeupLoading,
    getMakeupCount,
    canMakeup,
    makeupCheckin,
  } = useCheckinStore();

  const { showToast } = useUIStore();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showMakeupModal, setShowMakeupModal] = useState(false);
  const [showMilestone, setShowMilestone] = useState(false);
  const [currentMilestone, setCurrentMilestone] = useState<{ days: number; name: string } | null>(null);

  // Fetch data on mount and focus
  useFocusEffect(
    useCallback(() => {
      calculateStats();
      fetchMonthlyCheckins();
      fetchAllCheckins();
      getMakeupCount();
    }, [calculateStats, fetchMonthlyCheckins, fetchAllCheckins, getMakeupCount])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchMonthlyCheckins(),
      fetchAllCheckins(),
    ]);
    calculateStats();
    getMakeupCount();
    setRefreshing(false);
  };

  const handleMonthChange = (date: Date) => {
    setCurrentMonth(date);
  };

  const handleDayPress = (date: string) => {
    // 检查是否是已打卡的日期
    const hasCheckin = checkins.some((c) => c.date === date);
    if (hasCheckin) {
      // 已打卡，暂时不做处理（未来可以查看详情）
      return;
    }

    // 检查是否是今天
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (date === todayStr) {
      // 今天，不通过补签流程
      return;
    }

    // 检查是否是未来日期
    if (date > todayStr) {
      return;
    }

    // 打开补签弹窗
    setSelectedDate(date);
    setShowMakeupModal(true);
  };

  const handleMakeupSubmit = async (data: { date: string; content?: string; mood?: MoodType }) => {
    try {
      const oldTotalDays = stats?.totalDays || 0;
      await makeupCheckin(data.date, data.content, data.mood);
      setShowMakeupModal(false);
      setSelectedDate(null);

      // 检查里程碑
      const newTotalDays = oldTotalDays + 1;
      const milestone = MILESTONES.find((m) => m.days === newTotalDays);
      if (milestone) {
        setCurrentMilestone(milestone);
        setShowMilestone(true);
      } else {
        showToast({ type: 'success', message: '补签成功！' });
      }
    } catch {
      showToast({ type: 'error', message: '补签失败，请重试' });
    }
  };

  const handleMakeupClose = () => {
    setShowMakeupModal(false);
    setSelectedDate(null);
  };

  const handleMilestoneClose = () => {
    setShowMilestone(false);
    setCurrentMilestone(null);
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
        {/* Stats Overview */}
        <StatsOverview stats={stats} isLoading={isStatsLoading} />

        {/* Calendar */}
        <View style={styles.section}>
          <Calendar
            currentMonth={currentMonth}
            checkins={monthlyCheckins}
            onMonthChange={handleMonthChange}
            onDayPress={handleDayPress}
          />
        </View>

        {/* Recent Records */}
        <View style={styles.section}>
          <RecordList
            records={checkins.slice(0, 10)}
            isLoading={isListLoading}
          />
        </View>
      </ScrollView>

      {/* Makeup Checkin Modal */}
      <MakeupCheckinModal
        visible={showMakeupModal}
        date={selectedDate}
        remainingCount={makeupLimit - makeupCount}
        maxCount={makeupLimit}
        onClose={handleMakeupClose}
        onSubmit={handleMakeupSubmit}
        isLoading={isMakeupLoading}
      />

      {/* Milestone Modal */}
      <MilestoneModal
        visible={showMilestone}
        milestone={currentMilestone}
        onClose={handleMilestoneClose}
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
