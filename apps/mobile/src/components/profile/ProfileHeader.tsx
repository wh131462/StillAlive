import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { User } from '@still-alive/types';
import Avatar from '../ui/Avatar';
import { colors } from '../../theme/colors';

interface ProfileHeaderProps {
  user: User | null;
  totalDays: number;
  onEditPress?: () => void;
}

export default function ProfileHeader({ user, totalDays, onEditPress }: ProfileHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.avatarContainer}>
        <Avatar uri={user?.avatar} name={user?.nickname || user?.email || '?'} size={80} />
      </View>
      <Text style={styles.name}>{user?.nickname || '未设置昵称'}</Text>
      <Text style={styles.stats}>
        已存活 <Text style={styles.statsHighlight}>{totalDays}</Text> 天
      </Text>
      <TouchableOpacity style={styles.editButton} onPress={onEditPress}>
        <Ionicons name="create-outline" size={16} color={colors.primary} />
        <Text style={styles.editButtonText}>编辑资料</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 12,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  stats: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  statsHighlight: {
    color: colors.primary,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary,
    marginLeft: 4,
  },
});
