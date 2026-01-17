import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import dayjs from 'dayjs';
import type { LocalCheckin } from '@still-alive/local-storage';
import { colors } from '../../theme/colors';

interface YearHeatmapProps {
  checkins: LocalCheckin[];
  year?: number;
}

const CELL_SIZE = 10;
const CELL_GAP = 2;
const WEEKS_IN_YEAR = 53;
const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

// 热力图颜色等级
const HEAT_COLORS = [
  colors.slate100,    // 0: no activity
  '#c6e48b',          // 1: low
  '#7bc96f',          // 2: medium-low
  '#239a3b',          // 3: medium-high
  '#196127',          // 4: high
];

export default function YearHeatmap({ checkins, year }: YearHeatmapProps) {
  const currentYear = year || dayjs().year();

  // 构建日期到打卡的映射
  const checkinMap = useMemo(() => {
    const map = new Map<string, number>();
    checkins.forEach((c) => {
      const dateStr = c.date;
      // 计算活跃度（有内容 +1，有心情 +1）
      let activity = 1;
      if (c.content) activity++;
      if (c.mood) activity++;
      map.set(dateStr, activity);
    });
    return map;
  }, [checkins]);

  // 获取年度统计
  const yearStats = useMemo(() => {
    const startOfYear = dayjs(`${currentYear}-01-01`);
    const endOfYear = dayjs(`${currentYear}-12-31`);
    let count = 0;

    checkins.forEach((c) => {
      const date = dayjs(c.date);
      if (date.year() === currentYear) {
        count++;
      }
    });

    return { total: count };
  }, [checkins, currentYear]);

  // 生成热力图数据
  const heatmapData = useMemo(() => {
    const startOfYear = dayjs(`${currentYear}-01-01`);
    const endOfYear = dayjs(`${currentYear}-12-31`);

    // 从年初第一天的周日开始
    let current = startOfYear.startOf('week');
    const weeks: Array<Array<{ date: string; level: number; isCurrentYear: boolean }>> = [];

    while (current.isBefore(endOfYear) || current.isSame(endOfYear, 'week')) {
      const week: Array<{ date: string; level: number; isCurrentYear: boolean }> = [];

      for (let d = 0; d < 7; d++) {
        const day = current.add(d, 'day');
        const dateStr = day.format('YYYY-MM-DD');
        const isCurrentYear = day.year() === currentYear;
        const activity = checkinMap.get(dateStr) || 0;

        // 计算颜色等级 (0-4)
        let level = 0;
        if (activity > 0) {
          level = Math.min(activity, 4);
        }

        week.push({
          date: dateStr,
          level: isCurrentYear ? level : 0,
          isCurrentYear,
        });
      }

      weeks.push(week);
      current = current.add(1, 'week');
    }

    return weeks;
  }, [currentYear, checkinMap]);

  // 计算月份标签位置
  const monthPositions = useMemo(() => {
    const positions: Array<{ month: number; x: number }> = [];
    let lastMonth = -1;

    heatmapData.forEach((week, weekIndex) => {
      const firstDayOfWeek = dayjs(week[0].date);
      const month = firstDayOfWeek.month();

      if (month !== lastMonth && firstDayOfWeek.year() === currentYear) {
        positions.push({ month, x: weekIndex * (CELL_SIZE + CELL_GAP) });
        lastMonth = month;
      }
    });

    return positions;
  }, [heatmapData, currentYear]);

  const { width: SCREEN_WIDTH } = Dimensions.get('window');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{currentYear}年活动</Text>
        <Text style={styles.stats}>
          <Text style={styles.statsHighlight}>{yearStats.total}</Text> 次打卡
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View>
          {/* Month labels */}
          <View style={styles.monthLabels}>
            {monthPositions.map(({ month, x }) => (
              <Text key={month} style={[styles.monthLabel, { left: x }]}>
                {MONTH_LABELS[month]}
              </Text>
            ))}
          </View>

          {/* Heatmap grid */}
          <View style={styles.gridContainer}>
            {/* Weekday labels */}
            <View style={styles.weekdayLabels}>
              {WEEKDAY_LABELS.map((label, i) => (
                <Text
                  key={label}
                  style={[
                    styles.weekdayLabel,
                    i % 2 === 0 && styles.weekdayLabelHidden,
                  ]}
                >
                  {label}
                </Text>
              ))}
            </View>

            {/* Grid */}
            <View style={styles.grid}>
              {heatmapData.map((week, weekIndex) => (
                <View key={weekIndex} style={styles.weekColumn}>
                  {week.map((day, dayIndex) => (
                    <View
                      key={day.date}
                      style={[
                        styles.cell,
                        { backgroundColor: day.isCurrentYear ? HEAT_COLORS[day.level] : 'transparent' },
                      ]}
                    />
                  ))}
                </View>
              ))}
            </View>
          </View>

          {/* Legend */}
          <View style={styles.legend}>
            <Text style={styles.legendText}>少</Text>
            {HEAT_COLORS.map((color, i) => (
              <View key={i} style={[styles.legendCell, { backgroundColor: color }]} />
            ))}
            <Text style={styles.legendText}>多</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  stats: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  statsHighlight: {
    fontWeight: '700',
    color: colors.primary,
  },
  scrollContent: {
    paddingRight: 16,
  },
  monthLabels: {
    height: 20,
    position: 'relative',
    marginLeft: 24,
  },
  monthLabel: {
    position: 'absolute',
    fontSize: 10,
    color: colors.textMuted,
  },
  gridContainer: {
    flexDirection: 'row',
  },
  weekdayLabels: {
    width: 20,
    marginRight: 4,
  },
  weekdayLabel: {
    height: CELL_SIZE + CELL_GAP,
    fontSize: 9,
    color: colors.textMuted,
    lineHeight: CELL_SIZE + CELL_GAP,
  },
  weekdayLabelHidden: {
    color: 'transparent',
  },
  grid: {
    flexDirection: 'row',
    gap: CELL_GAP,
  },
  weekColumn: {
    gap: CELL_GAP,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 2,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 4,
  },
  legendText: {
    fontSize: 10,
    color: colors.textMuted,
    marginHorizontal: 4,
  },
  legendCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 2,
  },
});
