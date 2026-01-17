import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { LocalPerson } from '@still-alive/local-storage';
import Avatar from '../ui/Avatar';
import { colors } from '../../theme/colors';

interface PersonCardProps {
  person: LocalPerson;
  onPress: () => void;
}

export default function PersonCard({ person, onPress }: PersonCardProps) {
  const birthdayDisplay = person.birthday
    ? `${person.birthday.replace('-', '月')}日生日`
    : null;

  const metaText = [person.mbti, birthdayDisplay].filter(Boolean).join(' · ');

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <Avatar uri={person.photo} name={person.name} size={48} />
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>
          {person.name}
        </Text>
        {metaText && (
          <Text style={styles.meta} numberOfLines={1}>
            {metaText}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.slate300} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  content: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  meta: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
