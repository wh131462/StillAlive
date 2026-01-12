import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import type { Checkin } from '@still-alive/types';
import { colors } from '../../theme/colors';
import CalendarDay from './CalendarDay';

interface CalendarProps {
  currentMonth: Date;
  checkins: Checkin[];
  onMonthChange: (date: Date) => void;
  onDayPress?: (date: string) => void;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export default function Calendar({
  currentMonth,
  checkins,
  onMonthChange,
  onDayPress,
}: CalendarProps) {
  const today = dayjs();
  const monthStart = dayjs(currentMonth).startOf('month');
  const monthEnd = dayjs(currentMonth).endOf('month');
  const startDay = monthStart.day();
  const daysInMonth = monthEnd.date();

  const goToPrevMonth = () => {
    onMonthChange(dayjs(currentMonth).subtract(1, 'month').toDate());
  };

  const goToNextMonth = () => {
    onMonthChange(dayjs(currentMonth).add(1, 'month').toDate());
  };

  // Create a set of checked dates for quick lookup
  const checkedDates = new Set(
    checkins.map((c) => dayjs(c.date).format('YYYY-MM-DD'))
  );

  const renderDays = () => {
    const days: React.ReactNode[] = [];

    // Empty cells before month starts
    for (let i = 0; i < startDay; i++) {
      days.push(<View key={`empty-${i}`} style={styles.dayCell} />);
    }

    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = dayjs(currentMonth).date(day).format('YYYY-MM-DD');
      const isToday = today.format('YYYY-MM-DD') === dateStr;
      const isChecked = checkedDates.has(dateStr);
      const isPast = dayjs(dateStr).isBefore(today, 'day');

      days.push(
        <CalendarDay
          key={dateStr}
          day={day}
          isToday={isToday}
          isChecked={isChecked}
          isPast={isPast && !isChecked}
          onPress={() => onDayPress?.(dateStr)}
        />
      );
    }

    return days;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goToPrevMonth} style={styles.navButton}>
          <Ionicons name="chevron-back" size={24} color={colors.textMuted} />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>
          {dayjs(currentMonth).format('YYYY年M月')}
        </Text>
        <TouchableOpacity onPress={goToNextMonth} style={styles.navButton}>
          <Ionicons name="chevron-forward" size={24} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Weekday labels */}
      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((day) => (
          <Text key={day} style={styles.weekdayLabel}>
            {day}
          </Text>
        ))}
      </View>

      {/* Days grid */}
      <View style={styles.daysGrid}>{renderDays()}</View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
          <Text style={styles.legendText}>已打卡</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.legendDotToday]} />
          <Text style={styles.legendText}>今天</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.slate200 }]} />
          <Text style={styles.legendText}>未打卡</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navButton: {
    padding: 8,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    color: colors.textSecondary,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 4,
  },
  legendDotToday: {
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  legendText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
