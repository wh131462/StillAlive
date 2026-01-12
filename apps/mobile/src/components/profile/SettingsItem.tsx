import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface SettingsItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBgColor?: string;
  label: string;
  value?: string;
  textColor?: string;
  showArrow?: boolean;
  onPress?: () => void;
}

export default function SettingsItem({
  icon,
  iconColor = colors.textSecondary,
  iconBgColor = colors.slate100,
  label,
  value,
  textColor = colors.textPrimary,
  showArrow = true,
  onPress,
}: SettingsItemProps) {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      <View style={[styles.iconContainer, { backgroundColor: iconBgColor }]}>
        <Ionicons name={icon} size={16} color={iconColor} />
      </View>
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
      <View style={styles.right}>
        {value && <Text style={styles.value}>{value}</Text>}
        {showArrow && (
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  label: {
    flex: 1,
    fontSize: 16,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  value: {
    fontSize: 14,
    color: colors.textMuted,
    marginRight: 4,
  },
});
