import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface CheckinButtonProps {
  isCheckedIn: boolean;
  onPress: () => void;
  disabled?: boolean;
}

export default function CheckinButton({
  isCheckedIn,
  onPress,
  disabled,
}: CheckinButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isCheckedIn) {
      // Pulse animation when not checked in
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.05,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      scaleAnim.setValue(1);
    }
  }, [isCheckedIn, scaleAnim]);

  const handlePress = () => {
    if (isCheckedIn || disabled) return;

    // Press animation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    onPress();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={isCheckedIn || disabled}
      activeOpacity={0.9}
    >
      <Animated.View
        style={[
          styles.button,
          isCheckedIn && styles.buttonCompleted,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        <Ionicons
          name="checkmark"
          size={32}
          color={isCheckedIn ? colors.primaryDark : colors.white}
        />
        <Text style={[styles.text, isCheckedIn && styles.textCompleted]}>
          {isCheckedIn ? '已确认' : '确认存活'}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
  buttonCompleted: {
    backgroundColor: colors.primaryLight,
    shadowOpacity: 0.2,
  },
  text: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  textCompleted: {
    color: colors.primaryDark,
  },
});
