import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface MilestoneModalProps {
  visible: boolean;
  milestone: { days: number; name: string } | null;
  onClose: () => void;
}

const MILESTONE_CONFIG: Record<number, { icon: string; color: string; description: string }> = {
  7: {
    icon: 'leaf-outline',
    color: '#10b981',
    description: '连续打卡一周，你已经迈出了坚持的第一步！',
  },
  30: {
    icon: 'moon-outline',
    color: '#3b82f6',
    description: '一个月的坚持，习惯正在养成！',
  },
  100: {
    icon: 'star-outline',
    color: '#f59e0b',
    description: '百日坚持，你的毅力令人钦佩！',
  },
  365: {
    icon: 'trophy-outline',
    color: '#ec4899',
    description: '整整一年！你已经把打卡融入了生活！',
  },
  1000: {
    icon: 'diamond-outline',
    color: '#8b5cf6',
    description: '千日传奇！你是真正的打卡大师！',
  },
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function MilestoneModal({
  visible,
  milestone,
  onClose,
}: MilestoneModalProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const confettiAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && milestone) {
      // Reset animations
      scaleAnim.setValue(0);
      rotateAnim.setValue(0);
      confettiAnim.setValue(0);

      // Play animations
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 5,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.parallel([
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(confettiAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }
  }, [visible, milestone, scaleAnim, rotateAnim, confettiAnim]);

  if (!milestone) return null;

  const config = MILESTONE_CONFIG[milestone.days] || MILESTONE_CONFIG[7];

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.container,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          {/* Confetti decorations */}
          <View style={styles.confettiContainer}>
            {[...Array(12)].map((_, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.confetti,
                  {
                    backgroundColor: ['#f59e0b', '#ec4899', '#3b82f6', '#10b981'][i % 4],
                    left: `${10 + (i * 7)}%`,
                    transform: [
                      {
                        translateY: confettiAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-50, 150 + Math.random() * 100],
                        }),
                      },
                      {
                        rotate: confettiAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', `${180 + Math.random() * 360}deg`],
                        }),
                      },
                    ],
                    opacity: confettiAnim.interpolate({
                      inputRange: [0, 0.8, 1],
                      outputRange: [1, 1, 0],
                    }),
                  },
                ]}
              />
            ))}
          </View>

          {/* Trophy Icon */}
          <Animated.View
            style={[
              styles.iconContainer,
              { backgroundColor: config.color + '20', transform: [{ rotate: spin }] },
            ]}
          >
            <Ionicons
              name={config.icon as any}
              size={64}
              color={config.color}
            />
          </Animated.View>

          {/* Badge */}
          <View style={[styles.badge, { backgroundColor: config.color }]}>
            <Text style={styles.badgeText}>解锁成就</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>「{milestone.name}」</Text>

          {/* Days */}
          <View style={styles.daysContainer}>
            <Text style={[styles.daysNumber, { color: config.color }]}>
              {milestone.days}
            </Text>
            <Text style={styles.daysLabel}>天</Text>
          </View>

          {/* Description */}
          <Text style={styles.description}>{config.description}</Text>

          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>太棒了！</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: SCREEN_WIDTH * 0.85,
    maxWidth: 340,
    overflow: 'hidden',
  },
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    overflow: 'hidden',
  },
  confetti: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  badgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  daysContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  daysNumber: {
    fontSize: 48,
    fontWeight: '800',
  },
  daysLabel: {
    fontSize: 20,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  description: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  closeButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 12,
  },
  closeText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
