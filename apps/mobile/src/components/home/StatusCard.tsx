import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import CheckinButton from './CheckinButton';

interface StatusCardProps {
  isCheckedIn: boolean;
  onCheckinPress: () => void;
  isLoading?: boolean;
}

export default function StatusCard({
  isCheckedIn,
  onCheckinPress,
  isLoading,
}: StatusCardProps) {
  const heartAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Heartbeat animation
    const heartbeat = Animated.loop(
      Animated.sequence([
        Animated.timing(heartAnim, {
          toValue: 1.1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(heartAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(heartAnim, {
          toValue: 1.1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(heartAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    heartbeat.start();
    return () => heartbeat.stop();
  }, [heartAnim]);

  return (
    <View style={styles.container}>
      <View style={styles.heartContainer}>
        <Animated.View style={{ transform: [{ scale: heartAnim }] }}>
          <Ionicons name="heart" size={40} color={colors.accent} />
        </Animated.View>
      </View>

      <Text style={styles.title}>
        {isCheckedIn ? '恭喜你又活过了一天！' : '还活着吗？'}
      </Text>
      <Text style={styles.subtitle}>
        {isCheckedIn ? '今日已确认存活' : '今日尚未确认存活'}
      </Text>

      <View style={styles.buttonContainer}>
        <CheckinButton
          isCheckedIn={isCheckedIn}
          onPress={onCheckinPress}
          disabled={isLoading}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  heartContainer: {
    width: 80,
    height: 80,
    backgroundColor: colors.accentLight,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  buttonContainer: {
    alignItems: 'center',
  },
});
