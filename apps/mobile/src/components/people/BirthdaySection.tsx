import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Person } from '@still-alive/types';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';
import { colors } from '../../theme/colors';

interface BirthdaySectionProps {
  persons: Person[];
  onPersonPress: (person: Person) => void;
}

export default function BirthdaySection({ persons, onPersonPress }: BirthdaySectionProps) {
  if (persons.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="gift" size={16} color={colors.amber600} />
        <Text style={styles.headerText}>今日生日</Text>
      </View>

      {persons.map((person) => {
        const age = person.birthYear
          ? new Date().getFullYear() - person.birthYear
          : null;

        return (
          <TouchableOpacity
            key={person.id}
            style={styles.card}
            onPress={() => onPersonPress(person)}
            activeOpacity={0.8}
          >
            <View style={styles.avatarContainer}>
              <Avatar uri={person.photo} name={person.name} size={56} />
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{person.name}</Text>
              <Text style={styles.meta}>
                {person.mbti && `${person.mbti} · `}
                今天 {age ?? '?'} 岁
              </Text>
            </View>
            <TouchableOpacity style={styles.wishButton}>
              <Text style={styles.wishButtonText}>送祝福</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.amber600,
    marginLeft: 6,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.amber50,
    borderWidth: 1,
    borderColor: colors.amber100,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  avatarContainer: {
    borderWidth: 2,
    borderColor: '#fbbf24',
    borderRadius: 30,
    padding: 2,
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  meta: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  wishButton: {
    backgroundColor: colors.amber500,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  wishButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.white,
  },
});
