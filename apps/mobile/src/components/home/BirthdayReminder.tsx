import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { LocalPerson } from '@still-alive/local-storage';
import { colors } from '../../theme/colors';
import Avatar from '../ui/Avatar';

interface BirthdayReminderProps {
  persons: LocalPerson[];
  onPress?: (person: LocalPerson) => void;
}

export default function BirthdayReminder({ persons, onPress }: BirthdayReminderProps) {
  if (persons.length === 0) return null;

  const firstPerson = persons[0];
  const otherCount = persons.length - 1;

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name="gift" size={20} color={colors.amber600} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>今日生日提醒</Text>
        <Text style={styles.subtitle}>
          {firstPerson.name} 今天生日
          {otherCount > 0 ? `，还有 ${otherCount} 人` : ''}，记得送上祝福
        </Text>
      </View>
      <TouchableOpacity onPress={() => onPress?.(firstPerson)}>
        <Text style={styles.action}>查看</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.amber50,
    borderWidth: 1,
    borderColor: colors.amber100,
    borderRadius: 12,
    padding: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    backgroundColor: colors.amber100,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    color: '#92400e',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: colors.amber600,
  },
  action: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.amber600,
  },
});
