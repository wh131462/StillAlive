import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface MilestoneBadgesProps {
  totalDays: number;
}

interface Badge {
  days: number;
  name: string;
  icon: string;
  color: string;
  bgColor: string;
}

const BADGES: Badge[] = [
  { days: 7, name: '初来乍到', icon: 'leaf', color: '#10b981', bgColor: '#d1fae5' },
  { days: 30, name: '月度坚持', icon: 'moon', color: '#3b82f6', bgColor: '#dbeafe' },
  { days: 100, name: '百日成就', icon: 'star', color: '#f59e0b', bgColor: '#fef3c7' },
  { days: 365, name: '一周年', icon: 'trophy', color: '#ec4899', bgColor: '#fce7f3' },
  { days: 1000, name: '千日传奇', icon: 'diamond', color: '#8b5cf6', bgColor: '#ede9fe' },
];

export default function MilestoneBadges({ totalDays }: MilestoneBadgesProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="ribbon-outline" size={20} color={colors.textPrimary} />
        <Text style={styles.title}>里程碑徽章</Text>
      </View>

      <View style={styles.badgesGrid}>
        {BADGES.map((badge) => {
          const achieved = totalDays >= badge.days;
          const progress = Math.min(totalDays / badge.days, 1);

          return (
            <View key={badge.days} style={styles.badgeItem}>
              <View
                style={[
                  styles.badgeIcon,
                  achieved
                    ? { backgroundColor: badge.bgColor }
                    : styles.badgeIconLocked,
                ]}
              >
                <Ionicons
                  name={badge.icon as any}
                  size={24}
                  color={achieved ? badge.color : colors.textMuted}
                />
                {achieved && (
                  <View style={[styles.checkMark, { backgroundColor: badge.color }]}>
                    <Ionicons name="checkmark" size={10} color={colors.white} />
                  </View>
                )}
              </View>
              <Text
                style={[
                  styles.badgeName,
                  !achieved && styles.badgeNameLocked,
                ]}
                numberOfLines={1}
              >
                {badge.name}
              </Text>
              <Text style={styles.badgeDays}>{badge.days}天</Text>

              {/* Progress bar for locked badges */}
              {!achieved && (
                <View style={styles.progressContainer}>
                  <View
                    style={[
                      styles.progressBar,
                      { width: `${progress * 100}%`, backgroundColor: badge.color },
                    ]}
                  />
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Next milestone hint */}
      {totalDays < 1000 && (
        <View style={styles.nextMilestone}>
          <Text style={styles.nextMilestoneText}>
            距离下一个徽章还差{' '}
            <Text style={styles.nextMilestoneHighlight}>
              {BADGES.find((b) => b.days > totalDays)!.days - totalDays}
            </Text>{' '}
            天
          </Text>
        </View>
      )}
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
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  badgeItem: {
    width: '18%',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    position: 'relative',
  },
  badgeIconLocked: {
    backgroundColor: colors.slate100,
  },
  checkMark: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  badgeName: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  badgeNameLocked: {
    color: colors.textMuted,
  },
  badgeDays: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  progressContainer: {
    width: '100%',
    height: 3,
    backgroundColor: colors.slate100,
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  nextMilestone: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  nextMilestoneText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  nextMilestoneHighlight: {
    fontWeight: '700',
    color: colors.primary,
  },
});
