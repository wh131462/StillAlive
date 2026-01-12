import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUIStore, type ToastType } from '../../stores/uiStore';
import { colors } from '../../theme/colors';

const TOAST_DURATION = 2000;

const iconMap: Record<ToastType, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error: 'close-circle',
  warning: 'warning',
  info: 'information-circle',
};

const colorMap: Record<ToastType, { bg: string; border: string; text: string; icon: string }> = {
  success: {
    bg: colors.primaryLight,
    border: '#a7f3d0',
    text: colors.primaryDark,
    icon: colors.primaryDark,
  },
  error: {
    bg: colors.errorLight,
    border: '#fecaca',
    text: '#dc2626',
    icon: '#dc2626',
  },
  warning: {
    bg: colors.warningLight,
    border: '#fde68a',
    text: '#d97706',
    icon: '#d97706',
  },
  info: {
    bg: colors.infoLight,
    border: '#93c5fd',
    text: '#1d4ed8',
    icon: '#1d4ed8',
  },
};

export default function Toast() {
  const { toast, hideToast } = useUIStore();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    if (toast) {
      // Show animation
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto hide
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: -20,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => hideToast());
      }, toast.duration || TOAST_DURATION);

      return () => clearTimeout(timer);
    }
  }, [toast, hideToast, opacity, translateY]);

  if (!toast) return null;

  const toastColors = colorMap[toast.type];

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity,
          transform: [{ translateY }],
          backgroundColor: toastColors.bg,
          borderColor: toastColors.border,
        },
      ]}
    >
      <Ionicons name={iconMap[toast.type]} size={20} color={toastColors.icon} />
      <Text style={[styles.message, { color: toastColors.text }]}>{toast.message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 80,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  message: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
});
