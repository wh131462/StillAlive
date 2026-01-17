import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors } from '../../theme/colors';

interface CalendarDayProps {
  day: number;
  isToday: boolean;
  isChecked: boolean;
  isPast: boolean;
  onPress?: () => void;
}

export default function CalendarDay({
  day,
  isToday,
  isChecked,
  isPast,
  onPress,
}: CalendarDayProps) {
  const containerStyle: ViewStyle[] = [styles.container];
  let textStyle: TextStyle = styles.text;

  if (isChecked) {
    containerStyle.push(styles.checked);
    textStyle = styles.checkedText;
  } else if (isToday) {
    containerStyle.push(styles.today);
  } else if (isPast) {
    textStyle = styles.pastText;
  }

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={textStyle}>{day}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  text: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  checked: {
    backgroundColor: colors.primary,
  },
  checkedText: {
    fontSize: 14,
    color: colors.white,
    fontWeight: '500',
  },
  today: {
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  pastText: {
    fontSize: 14,
    color: colors.textMuted,
  },
});
