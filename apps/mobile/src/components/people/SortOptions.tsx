import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

type SortType = 'createdAt' | 'birthday';

interface SortOptionsProps {
  value: SortType;
  onChange: (value: SortType) => void;
}

export default function SortOptions({ value, onChange }: SortOptionsProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.option, value === 'createdAt' && styles.optionActive]}
        onPress={() => onChange('createdAt')}
      >
        <Text style={[styles.optionText, value === 'createdAt' && styles.optionTextActive]}>
          按添加时间
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.option, value === 'birthday' && styles.optionActive]}
        onPress={() => onChange('birthday')}
      >
        <Text style={[styles.optionText, value === 'birthday' && styles.optionTextActive]}>
          按生日临近
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
  },
  option: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.slate100,
    borderRadius: 8,
  },
  optionActive: {
    backgroundColor: colors.primary,
  },
  optionText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  optionTextActive: {
    color: colors.white,
  },
});
