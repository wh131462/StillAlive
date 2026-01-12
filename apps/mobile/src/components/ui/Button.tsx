import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors } from '../../theme/colors';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const variantStyles: Record<ButtonVariant, ViewStyle> = {
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.slate100,
  },
  outline: {
    backgroundColor: colors.transparent,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghost: {
    backgroundColor: colors.transparent,
  },
  danger: {
    backgroundColor: colors.error,
  },
};

const variantTextStyles: Record<ButtonVariant, TextStyle> = {
  primary: {
    color: colors.white,
  },
  secondary: {
    color: colors.textPrimary,
  },
  outline: {
    color: colors.textPrimary,
  },
  ghost: {
    color: colors.primary,
  },
  danger: {
    color: colors.white,
  },
};

const sizeStyles: Record<ButtonSize, ViewStyle> = {
  sm: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  md: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  lg: {
    height: 56,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
};

const sizeTextStyles: Record<ButtonSize, TextStyle> = {
  sm: {
    fontSize: 14,
  },
  md: {
    fontSize: 16,
  },
  lg: {
    fontSize: 18,
  },
};

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  textStyle,
}: ButtonProps) {
  const buttonStyles: ViewStyle[] = [
    styles.base,
    variantStyles[variant],
    sizeStyles[size],
    fullWidth && styles.fullWidth,
    disabled && styles.disabled,
    style,
  ].filter(Boolean) as ViewStyle[];

  const textStyles: TextStyle[] = [
    styles.text,
    variantTextStyles[variant],
    sizeTextStyles[size],
    textStyle,
  ].filter(Boolean) as TextStyle[];

  const spinnerColor = variant === 'primary' || variant === 'danger' ? colors.white : colors.primary;

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} size="small" />
      ) : (
        <Text style={textStyles}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontWeight: '600',
  },
});
