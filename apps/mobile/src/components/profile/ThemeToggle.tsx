import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeToggleProps {
  value: ThemeMode;
  onChange: (theme: ThemeMode) => void;
}

interface ThemeOption {
  value: ThemeMode;
  label: string;
  icon: string;
}

const THEME_OPTIONS: ThemeOption[] = [
  { value: 'light', label: '浅色', icon: 'sunny-outline' },
  { value: 'dark', label: '深色', icon: 'moon-outline' },
  { value: 'system', label: '跟随系统', icon: 'phone-portrait-outline' },
];

export default function ThemeToggle({ value, onChange }: ThemeToggleProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="color-palette-outline" size={20} color={colors.textPrimary} />
        <Text style={styles.title}>主题设置</Text>
      </View>

      <View style={styles.options}>
        {THEME_OPTIONS.map((option) => {
          const isSelected = value === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.option, isSelected && styles.optionSelected]}
              onPress={() => onChange(option.value)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, isSelected && styles.iconContainerSelected]}>
                <Ionicons
                  name={option.icon as any}
                  size={24}
                  color={isSelected ? colors.primary : colors.textMuted}
                />
              </View>
              <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                {option.label}
              </Text>
              {isSelected && (
                <View style={styles.checkContainer}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
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
  options: {
    flexDirection: 'row',
    gap: 12,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.slate50,
    position: 'relative',
  },
  optionSelected: {
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  iconContainerSelected: {
    backgroundColor: colors.white,
  },
  optionLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  optionLabelSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  checkContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
});
