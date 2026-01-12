import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface QuickStatsProps {
  totalDays: number;
  totalPersons: number;
}

export default function QuickStats({ totalDays, totalPersons }: QuickStatsProps) {
  return (
    <View style={styles.container}>
      <View style={[styles.card, styles.daysCard]}>
        <View style={styles.iconRow}>
          <Ionicons name="heart" size={16} color={colors.primary} />
          <Text style={styles.label}>生存天数</Text>
        </View>
        <Text style={[styles.value, { color: colors.primaryDark }]}>{totalDays}</Text>
      </View>
      <View style={[styles.card, styles.peopleCard]}>
        <View style={styles.iconRow}>
          <Ionicons name="people" size={16} color="#3b82f6" />
          <Text style={styles.label}>记录人物</Text>
        </View>
        <Text style={[styles.value, { color: '#1d4ed8' }]}>{totalPersons}</Text>
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
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  daysCard: {
    backgroundColor: colors.primaryLight,
    borderColor: '#a7f3d0',
  },
  peopleCard: {
    backgroundColor: '#dbeafe',
    borderColor: '#93c5fd',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 6,
  },
  value: {
    fontSize: 24,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
