import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { CheckinStats } from '@still-alive/types';
import { colors } from '../../theme/colors';

interface StatsOverviewProps {
  stats: CheckinStats | null;
  isLoading?: boolean;
}

export default function StatsOverview({ stats, isLoading }: StatsOverviewProps) {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={[styles.value, { color: colors.primary }]}>
          {stats?.totalDays ?? '-'}
        </Text>
        <Text style={styles.label}>总打卡天数</Text>
      </View>
      <View style={styles.card}>
        <Text style={[styles.value, { color: colors.accent }]}>
          {stats?.streak ?? '-'}
        </Text>
        <Text style={styles.label}>连续打卡</Text>
      </View>
      <View style={styles.card}>
        <Text style={[styles.value, { color: colors.amber500 }]}>
          {stats?.totalRecords ?? '-'}
        </Text>
        <Text style={styles.label}>记录条数</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
  },
  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  value: {
    fontSize: 24,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
