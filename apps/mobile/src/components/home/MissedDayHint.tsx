import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface MissedDayHintProps {
  show?: boolean;
}

export default function MissedDayHint({ show = true }: MissedDayHintProps) {
  if (!show) return null;

  return (
    <View style={styles.container}>
      <Ionicons name="information-circle" size={16} color={colors.sky700} />
      <Text style={styles.text}>
        一定是因为昨天过得很开心吧，才忘了打卡。
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.sky50,
    borderWidth: 1,
    borderColor: colors.sky100,
    borderRadius: 12,
    padding: 16,
  },
  text: {
    flex: 1,
    fontSize: 14,
    color: colors.sky700,
    marginLeft: 8,
  },
});
