import React, { useCallback, useState } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useCheckinStore } from '../../src/stores/checkinStore';
import { StatsOverview, Calendar, RecordList } from '../../src/components/checkin';
import { colors } from '../../src/theme/colors';

export default function CheckinScreen() {
  const {
    stats,
    isStatsLoading,
    fetchStats,
    currentMonth,
    monthlyCheckins,
    isCalendarLoading,
    setCurrentMonth,
    fetchMonthlyCheckins,
    checkins,
    isListLoading,
    hasMore,
    fetchCheckinHistory,
    loadMoreHistory,
  } = useCheckinStore();

  const [refreshing, setRefreshing] = useState(false);

  // Fetch data on mount and focus
  useFocusEffect(
    useCallback(() => {
      fetchStats();
      fetchMonthlyCheckins();
      fetchCheckinHistory();
    }, [fetchStats, fetchMonthlyCheckins, fetchCheckinHistory])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchStats(),
      fetchMonthlyCheckins(),
      fetchCheckinHistory(),
    ]);
    setRefreshing(false);
  };

  const handleMonthChange = (date: Date) => {
    setCurrentMonth(date);
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
          />
        </View>

        {/* Recent Records */}
        <View style={styles.section}>
          <RecordList
            records={checkins}
            isLoading={isListLoading}
            hasMore={hasMore}
            onLoadMore={loadMoreHistory}
          />
        </View>
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
});
