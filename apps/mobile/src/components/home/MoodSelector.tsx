import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MOOD_OPTIONS, type MoodType } from '@still-alive/types';
import { colors } from '../../theme/colors';

interface MoodSelectorProps {
  value?: MoodType;
  onChange: (mood: MoodType) => void;
  disabled?: boolean;
}

export default function MoodSelector({ value, onChange, disabled }: MoodSelectorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>今天心情如何？</Text>
      <View style={styles.moodGrid}>
        {MOOD_OPTIONS.map((mood) => (
          <TouchableOpacity
            key={mood.value}
            style={[
              styles.moodItem,
              value === mood.value && styles.moodItemSelected,
            ]}
            onPress={() => onChange(mood.value)}
            disabled={disabled}
            activeOpacity={0.7}
          >
            <Text style={styles.moodEmoji}>{mood.emoji}</Text>
            <Text
              style={[
                styles.moodLabel,
                value === mood.value && styles.moodLabelSelected,
              ]}
            >
              {mood.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  moodItem: {
    width: '31%',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: colors.slate100,
    marginBottom: 8,
  },
  moodItemSelected: {
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  moodEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  moodLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  moodLabelSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
});
