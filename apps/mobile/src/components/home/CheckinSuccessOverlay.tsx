import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface CheckinSuccessOverlayProps {
  visible: boolean;
  onDismiss: () => void;
  streak?: number;
  milestone?: { days: number; name: string } | null;
}

const ENCOURAGE_MESSAGES = [
  { title: '恭喜你又活过了一天！', subtitle: '今天也辛苦了' },
  { title: '又是元气满满的一天！', subtitle: '你很棒' },
  { title: '生存确认成功！', subtitle: '继续加油' },
  { title: '今天也在好好活着呢！', subtitle: '明天见' },
  { title: '打卡成功！', subtitle: '每一天都值得被记录' },
  { title: '活着真好！', subtitle: '珍惜当下' },
  { title: '又度过了一天！', subtitle: '你是最棒的' },
  { title: '存活确认！', subtitle: '期待明天的你' },
];

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function CheckinSuccessOverlay({
  visible,
  onDismiss,
  streak,
  milestone,
}: CheckinSuccessOverlayProps) {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const randomMessage = useMemo(() => {
    const index = Math.floor(Math.random() * ENCOURAGE_MESSAGES.length);
    return ENCOURAGE_MESSAGES[index];
  }, [visible]);

  useEffect(() => {
    if (visible) {
      // Reset values
      scaleAnim.setValue(0.8);
      opacityAnim.setValue(0);

      // Animate in
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss after 2 seconds
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 0.9,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          onDismiss();
        });
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [visible, scaleAnim, opacityAnim, onDismiss]);

  if (!visible) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      <Animated.View
        style={[
          styles.card,
          {
            opacity: opacityAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <View style={styles.iconContainer}>
          <Ionicons name="checkmark" size={48} color={colors.primary} />
        </View>

        <Text style={styles.title}>{randomMessage.title}</Text>
        <Text style={styles.subtitle}>{randomMessage.subtitle}</Text>

        {streak && streak > 1 && (
          <View style={styles.streakBadge}>
            <Ionicons name="flame" size={16} color={colors.accent} />
            <Text style={styles.streakText}>连续打卡 {streak} 天</Text>
          </View>
        )}

        {milestone && (
          <View style={styles.milestoneBadge}>
            <Ionicons name="trophy" size={16} color={colors.warning} />
            <Text style={styles.milestoneText}>
              解锁成就「{milestone.name}」
            </Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    maxWidth: SCREEN_WIDTH * 0.85,
  },
  iconContainer: {
    width: 96,
    height: 96,
    backgroundColor: colors.primaryLight,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
  },
  streakText: {
    fontSize: 14,
    color: colors.accent,
    fontWeight: '600',
    marginLeft: 4,
  },
  milestoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
  },
  milestoneText: {
    fontSize: 14,
    color: '#D97706',
    fontWeight: '600',
    marginLeft: 4,
  },
});
