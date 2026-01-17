import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import type { LocalPerson } from '@still-alive/local-storage';
import { colors } from '../../theme/colors';

interface PersonDetailModalProps {
  visible: boolean;
  person: LocalPerson | null;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 性别配置
const GENDER_CONFIG = {
  male: { icon: 'male', label: '男', color: '#3b82f6' },
  female: { icon: 'female', label: '女', color: '#ec4899' },
  other: { icon: 'person', label: '其他', color: '#8b5cf6' },
};

export default function PersonDetailModal({
  visible,
  person,
  onClose,
  onEdit,
  onDelete,
}: PersonDetailModalProps) {
  if (!person) return null;

  const genderInfo = person.gender ? GENDER_CONFIG[person.gender] : null;

  // 计算年龄
  const calculateAge = () => {
    if (!person.birthYear) return null;
    const currentYear = new Date().getFullYear();
    return currentYear - person.birthYear;
  };

  // 计算距离生日天数
  const getDaysUntilBirthday = () => {
    if (!person.birthday) return null;
    const today = dayjs();
    const [month, day] = person.birthday.split('-').map(Number);
    let birthday = dayjs().month(month - 1).date(day);

    if (birthday.isBefore(today, 'day')) {
      birthday = birthday.add(1, 'year');
    }

    const diff = birthday.diff(today, 'day');
    return diff === 0 ? '今天' : `${diff}天后`;
  };

  const age = calculateAge();
  const birthdayDiff = getDaysUntilBirthday();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
            <View style={styles.headerActions}>
              {onEdit && (
                <TouchableOpacity onPress={onEdit} style={styles.headerButton}>
                  <Ionicons name="create-outline" size={22} color={colors.primary} />
                </TouchableOpacity>
              )}
              {onDelete && (
                <TouchableOpacity onPress={onDelete} style={styles.headerButton}>
                  <Ionicons name="trash-outline" size={22} color={colors.error} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Avatar Section */}
            <View style={styles.avatarSection}>
              {person.photo ? (
                <Image source={{ uri: person.photo }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Ionicons name="person" size={48} color={colors.textMuted} />
                </View>
              )}
              <Text style={styles.name}>{person.name}</Text>

              {/* Tags */}
              <View style={styles.tags}>
                {genderInfo && (
                  <View style={[styles.tag, { backgroundColor: genderInfo.color + '20' }]}>
                    <Ionicons name={genderInfo.icon as any} size={14} color={genderInfo.color} />
                    <Text style={[styles.tagText, { color: genderInfo.color }]}>
                      {genderInfo.label}
                    </Text>
                  </View>
                )}
                {age && (
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>{age}岁</Text>
                  </View>
                )}
                {person.mbti && (
                  <View style={[styles.tag, styles.mbtiTag]}>
                    <Text style={styles.mbtiText}>{person.mbti}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Birthday Section */}
            {person.birthday && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="gift-outline" size={20} color={colors.primary} />
                  <Text style={styles.sectionTitle}>生日</Text>
                </View>
                <View style={styles.birthdayCard}>
                  <Text style={styles.birthdayDate}>
                    {person.birthday.replace('-', '月')}日
                    {person.birthYear && ` (${person.birthYear}年)`}
                  </Text>
                  {birthdayDiff && (
                    <View style={styles.birthdayCountdown}>
                      <Ionicons name="time-outline" size={14} color={colors.accent} />
                      <Text style={styles.birthdayCountdownText}>{birthdayDiff}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Impression Section */}
            {person.impression && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="sparkles-outline" size={20} color={colors.warning} />
                  <Text style={styles.sectionTitle}>个人印象</Text>
                </View>
                <Text style={styles.impressionText}>{person.impression}</Text>
              </View>
            )}

            {/* Experience Section */}
            {person.experience && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="book-outline" size={20} color={colors.accent} />
                  <Text style={styles.sectionTitle}>共同经历</Text>
                </View>
                <View style={styles.experienceCard}>
                  <Text style={styles.experienceText}>{person.experience}</Text>
                </View>
              </View>
            )}

            {/* Meta Info */}
            <View style={styles.metaSection}>
              <Text style={styles.metaText}>
                添加于 {dayjs(person.createdAt).format('YYYY年M月D日')}
              </Text>
              {person.updatedAt !== person.createdAt && (
                <Text style={styles.metaText}>
                  更新于 {dayjs(person.updatedAt).format('YYYY年M月D日')}
                </Text>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    minHeight: '50%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    padding: 4,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    padding: 4,
  },
  content: {
    padding: 16,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  avatarPlaceholder: {
    backgroundColor: colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.slate100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  tagText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  mbtiTag: {
    backgroundColor: '#8b5cf6' + '20',
  },
  mbtiText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8b5cf6',
  },
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  birthdayCard: {
    backgroundColor: colors.primaryLight,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  birthdayDate: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  birthdayCountdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  birthdayCountdownText: {
    fontSize: 14,
    color: colors.accent,
    fontWeight: '500',
  },
  impressionText: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    backgroundColor: colors.slate50,
    padding: 16,
    borderRadius: 12,
  },
  experienceCard: {
    backgroundColor: colors.accentLight,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
  },
  experienceText: {
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  metaSection: {
    marginTop: 32,
    marginBottom: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
