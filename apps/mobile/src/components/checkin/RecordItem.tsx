import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import dayjs from 'dayjs';
import type { LocalCheckin, MoodType } from '@still-alive/local-storage';
import { colors } from '../../theme/colors';

interface RecordItemProps {
  record: LocalCheckin;
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

// 心情配置
const MOOD_CONFIG: Record<MoodType, { emoji: string; label: string }> = {
  happy: { emoji: '😊', label: '开心' },
  calm: { emoji: '😌', label: '平静' },
  tired: { emoji: '😫', label: '疲惫' },
  sad: { emoji: '😢', label: '难过' },
  anxious: { emoji: '😰', label: '焦虑' },
  excited: { emoji: '🤩', label: '兴奋' },
};

export default function RecordItem({ record }: RecordItemProps) {
  const date = dayjs(record.date);
  const dateStr = date.format('YYYY-MM-DD');
  const weekday = WEEKDAYS[date.day()];
  const moodInfo = record.mood ? MOOD_CONFIG[record.mood] : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.date}>{dateStr} · {weekday}</Text>
          {moodInfo && (
            <Text style={styles.mood}>{moodInfo.emoji} {moodInfo.label}</Text>
          )}
        </View>
        <View style={styles.badges}>
          {record.isMakeup && (
            <View style={styles.makeupBadge}>
              <Text style={styles.makeupBadgeText}>补签</Text>
            </View>
          )}
          <View style={styles.badge}>
            <Text style={styles.badgeText}>已打卡</Text>
          </View>
        </View>
      </View>

      {record.content ? (
        <Text style={styles.content} numberOfLines={3}>
          {record.content}
        </Text>
      ) : (
        <Text style={styles.emptyContent}>纯打卡，未记录内容</Text>
      )}

      {record.photo && (
        <View style={styles.photoContainer}>
          <Image source={{ uri: record.photo }} style={styles.photo} />
        </View>
      )}
    </View>
  );
}

interface MissedDayItemProps {
  date: string;
}

export function MissedDayItem({ date }: MissedDayItemProps) {
  const d = dayjs(date);
  const dateStr = d.format('YYYY-MM-DD');
  const weekday = WEEKDAYS[d.day()];

  return (
    <View style={[styles.container, styles.missedContainer]}>
      <View style={styles.header}>
        <Text style={styles.date}>{dateStr} · {weekday}</Text>
        <View style={styles.missedBadge}>
          <Text style={styles.missedBadgeText}>未打卡</Text>
        </View>
      </View>
      <Text style={styles.missedContent}>这一天没有记录</Text>
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
    marginBottom: 12,
  },
  missedContainer: {
    opacity: 0.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  headerLeft: {
    flex: 1,
  },
  date: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  mood: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 12,
    color: colors.primaryDark,
    fontWeight: '500',
  },
  makeupBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  makeupBadgeText: {
    fontSize: 12,
    color: '#D97706',
    fontWeight: '500',
  },
  missedBadge: {
    backgroundColor: colors.slate100,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  missedBadgeText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  content: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  emptyContent: {
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  missedContent: {
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  photoContainer: {
    marginTop: 12,
    flexDirection: 'row',
  },
  photo: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: colors.slate100,
  },
});
